"""
Resume Verifier Transformer — built from scratch.
A GPT-style causal language model, fully HuggingFace compatible.
Registers with AutoModelForCausalLM so it works with the HF Hub and Inference API.
"""

import math
import torch
import torch.nn as nn
from transformers import PretrainedConfig, PreTrainedModel
from transformers.modeling_outputs import CausalLMOutputWithPast


# ── Config ────────────────────────────────────────────────────────────────────

class ResumeVerifierConfig(PretrainedConfig):
    model_type = "resume_verifier"

    def __init__(
        self,
        vocab_size: int = 32000,
        n_embd: int = 512,         # embedding dimension
        n_layer: int = 8,          # number of transformer blocks
        n_head: int = 8,           # number of attention heads
        n_positions: int = 2048,   # max sequence length
        intermediate_size: int = 2048,  # FFN hidden dimension
        dropout: float = 0.1,
        layer_norm_eps: float = 1e-5,
        tie_word_embeddings: bool = True,
        pad_token_id: int = 0,
        bos_token_id: int = 1,
        eos_token_id: int = 2,
        **kwargs,
    ):
        super().__init__(
            pad_token_id=pad_token_id,
            bos_token_id=bos_token_id,
            eos_token_id=eos_token_id,
            tie_word_embeddings=tie_word_embeddings,
            **kwargs,
        )
        self.vocab_size = vocab_size
        self.n_embd = n_embd
        self.n_layer = n_layer
        self.n_head = n_head
        self.n_positions = n_positions
        self.intermediate_size = intermediate_size
        self.dropout = dropout
        self.layer_norm_eps = layer_norm_eps


# ── Building blocks ───────────────────────────────────────────────────────────

class RotaryEmbedding(nn.Module):
    """RoPE positional embeddings — better than learned absolute positions."""

    def __init__(self, dim: int, max_seq_len: int = 2048):
        super().__init__()
        inv_freq = 1.0 / (10000 ** (torch.arange(0, dim, 2).float() / dim))
        self.register_buffer("inv_freq", inv_freq)
        self._build_cache(max_seq_len)

    def _build_cache(self, seq_len: int):
        t = torch.arange(seq_len, device=self.inv_freq.device).float()
        freqs = torch.outer(t, self.inv_freq)
        emb = torch.cat([freqs, freqs], dim=-1)
        self.register_buffer("cos_cached", emb.cos()[None, None, :, :])
        self.register_buffer("sin_cached", emb.sin()[None, None, :, :])

    def forward(self, seq_len: int):
        if seq_len > self.cos_cached.shape[2]:
            self._build_cache(seq_len)
        return self.cos_cached[:, :, :seq_len, :], self.sin_cached[:, :, :seq_len, :]


def rotate_half(x):
    half = x.shape[-1] // 2
    return torch.cat([-x[..., half:], x[..., :half]], dim=-1)


def apply_rotary(q, k, cos, sin):
    q = (q * cos) + (rotate_half(q) * sin)
    k = (k * cos) + (rotate_half(k) * sin)
    return q, k


class MultiHeadAttention(nn.Module):
    def __init__(self, config: ResumeVerifierConfig):
        super().__init__()
        assert config.n_embd % config.n_head == 0
        self.n_head = config.n_head
        self.head_dim = config.n_embd // config.n_head
        self.scale = math.sqrt(self.head_dim)

        self.q_proj = nn.Linear(config.n_embd, config.n_embd, bias=False)
        self.k_proj = nn.Linear(config.n_embd, config.n_embd, bias=False)
        self.v_proj = nn.Linear(config.n_embd, config.n_embd, bias=False)
        self.out_proj = nn.Linear(config.n_embd, config.n_embd, bias=False)
        self.dropout = nn.Dropout(config.dropout)
        self.rope = RotaryEmbedding(self.head_dim, config.n_positions)

    def _split_heads(self, x: torch.Tensor) -> torch.Tensor:
        B, T, C = x.shape
        return x.view(B, T, self.n_head, self.head_dim).transpose(1, 2)

    def forward(
        self,
        hidden: torch.Tensor,
        attention_mask: torch.Tensor | None = None,
        past_key_value: tuple | None = None,
        use_cache: bool = False,
    ):
        B, T, _ = hidden.shape
        q = self._split_heads(self.q_proj(hidden))
        k = self._split_heads(self.k_proj(hidden))
        v = self._split_heads(self.v_proj(hidden))

        # RoPE
        offset = past_key_value[0].shape[2] if past_key_value else 0
        cos, sin = self.rope(T + offset)
        cos = cos[:, :, offset : offset + T, :]
        sin = sin[:, :, offset : offset + T, :]
        q, k = apply_rotary(q, k, cos, sin)

        # KV cache
        if past_key_value is not None:
            k = torch.cat([past_key_value[0], k], dim=2)
            v = torch.cat([past_key_value[1], v], dim=2)
        present = (k, v) if use_cache else None

        # Scaled dot-product attention (uses flash attention when available)
        attn_out = torch.nn.functional.scaled_dot_product_attention(
            q, k, v,
            attn_mask=attention_mask,
            dropout_p=self.dropout.p if self.training else 0.0,
            is_causal=(attention_mask is None),
        )

        attn_out = attn_out.transpose(1, 2).contiguous().view(B, T, -1)
        return self.out_proj(attn_out), present


class FeedForward(nn.Module):
    """SwiGLU feed-forward (same as Llama/Mistral)."""

    def __init__(self, config: ResumeVerifierConfig):
        super().__init__()
        self.gate_proj = nn.Linear(config.n_embd, config.intermediate_size, bias=False)
        self.up_proj   = nn.Linear(config.n_embd, config.intermediate_size, bias=False)
        self.down_proj = nn.Linear(config.intermediate_size, config.n_embd, bias=False)
        self.dropout   = nn.Dropout(config.dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.dropout(self.down_proj(
            torch.nn.functional.silu(self.gate_proj(x)) * self.up_proj(x)
        ))


class TransformerBlock(nn.Module):
    def __init__(self, config: ResumeVerifierConfig):
        super().__init__()
        self.ln1  = nn.RMSNorm(config.n_embd, eps=config.layer_norm_eps)
        self.attn = MultiHeadAttention(config)
        self.ln2  = nn.RMSNorm(config.n_embd, eps=config.layer_norm_eps)
        self.ffn  = FeedForward(config)

    def forward(self, hidden, attention_mask=None, past_key_value=None, use_cache=False):
        # Pre-norm residual (same as modern LLMs)
        attn_out, present = self.attn(
            self.ln1(hidden),
            attention_mask=attention_mask,
            past_key_value=past_key_value,
            use_cache=use_cache,
        )
        hidden = hidden + attn_out
        hidden = hidden + self.ffn(self.ln2(hidden))
        return hidden, present


# ── Full model ────────────────────────────────────────────────────────────────

class ResumeVerifierForCausalLM(PreTrainedModel):
    config_class = ResumeVerifierConfig
    supports_gradient_checkpointing = True

    def __init__(self, config: ResumeVerifierConfig):
        super().__init__(config)
        self.embed_tokens = nn.Embedding(config.vocab_size, config.n_embd, padding_idx=config.pad_token_id)
        self.embed_dropout = nn.Dropout(config.dropout)
        self.layers = nn.ModuleList([TransformerBlock(config) for _ in range(config.n_layer)])
        self.norm = nn.RMSNorm(config.n_embd, eps=config.layer_norm_eps)
        self.lm_head = nn.Linear(config.n_embd, config.vocab_size, bias=False)

        if config.tie_word_embeddings:
            self.lm_head.weight = self.embed_tokens.weight

        self.post_init()

    def get_input_embeddings(self):
        return self.embed_tokens

    def set_input_embeddings(self, value):
        self.embed_tokens = value

    def get_output_embeddings(self):
        return self.lm_head

    def set_output_embeddings(self, value):
        self.lm_head = value

    def forward(
        self,
        input_ids: torch.LongTensor,
        attention_mask: torch.Tensor | None = None,
        past_key_values: list | None = None,
        labels: torch.LongTensor | None = None,
        use_cache: bool = True,
        **kwargs,
    ) -> CausalLMOutputWithPast:
        hidden = self.embed_dropout(self.embed_tokens(input_ids))

        new_past = []
        for i, layer in enumerate(self.layers):
            pkv = past_key_values[i] if past_key_values else None
            hidden, present = layer(hidden, attention_mask=attention_mask, past_key_value=pkv, use_cache=use_cache)
            new_past.append(present)

        hidden = self.norm(hidden)
        logits = self.lm_head(hidden)

        loss = None
        if labels is not None:
            shift_logits = logits[..., :-1, :].contiguous()
            shift_labels = labels[..., 1:].contiguous()
            loss = nn.CrossEntropyLoss(ignore_index=-100)(
                shift_logits.view(-1, shift_logits.size(-1)),
                shift_labels.view(-1),
            )

        return CausalLMOutputWithPast(
            loss=loss,
            logits=logits,
            past_key_values=new_past if use_cache else None,
        )

    def prepare_inputs_for_generation(self, input_ids, past_key_values=None, attention_mask=None, **kwargs):
        if past_key_values:
            input_ids = input_ids[:, -1:]
        return {
            "input_ids": input_ids,
            "past_key_values": past_key_values,
            "attention_mask": attention_mask,
            "use_cache": True,
        }


# ── Register with HuggingFace AutoClass ──────────────────────────────────────

from transformers import AutoConfig, AutoModelForCausalLM

AutoConfig.register("resume_verifier", ResumeVerifierConfig)
AutoModelForCausalLM.register(ResumeVerifierConfig, ResumeVerifierForCausalLM)
