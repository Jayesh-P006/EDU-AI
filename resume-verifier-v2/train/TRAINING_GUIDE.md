# Training Your Own Resume Verifier Model From Scratch

This guide walks you through building, training, and deploying a transformer LLM completely from scratch — no pretrained weights, your own architecture, your own tokenizer.

---

## What "From Scratch" Means Here

| Component | What you own |
|-----------|-------------|
| **Architecture** | Custom GPT-style transformer (`model.py`) — RoPE embeddings, SwiGLU FFN, RMSNorm |
| **Tokenizer** | BPE tokenizer trained on your data (`tokenizer_train.py`) |
| **Weights** | Randomly initialised, trained only on your data |
| **HF Integration** | Registered with `AutoModelForCausalLM` — works with HF Hub and Inference API |

---

## Files

```
train/
├── model.py              # Transformer architecture (from scratch)
├── tokenizer_train.py    # Trains a BPE tokenizer on your data
├── train_scratch.py      # Full training loop + push to HuggingFace
├── prepare_data.py       # Generates training_data.jsonl
├── requirements_train.txt
├── training_data.jsonl   # Created by prepare_data.py
├── tokenizer/            # Created by tokenizer_train.py
└── output_scratch/       # Checkpoints saved here
```

---

## Architecture Details

The model (`ResumeVerifierForCausalLM`) is a modern decoder-only transformer:

```
Input IDs
    ↓
Token Embeddings (vocab_size → n_embd)
    ↓
N × TransformerBlock:
  ├─ RMSNorm
  ├─ Multi-Head Attention + RoPE positional encoding + KV cache
  ├─ Residual connection
  ├─ RMSNorm
  └─ SwiGLU Feed-Forward + Residual
    ↓
RMSNorm
    ↓
LM Head (n_embd → vocab_size)
    ↓
Next-token logits
```

**Key design choices (same as modern LLMs like Llama/Mistral):**
- **RoPE** — Rotary Position Embedding (better than learned absolute positions)
- **SwiGLU** — Gated activation in FFN (better than plain ReLU/GELU)
- **RMSNorm** — Simpler and faster than LayerNorm
- **Pre-norm** — Normalise before attention, not after (more stable training)
- **Weight tying** — LM head shares weights with token embeddings (saves params)
- **KV Cache** — Efficient generation (no recomputing past tokens)

---

## Model Size Guide

| Config | Params | VRAM needed | Training time (1050 examples, 10 epochs) |
|--------|--------|-------------|------------------------------------------|
| `--n_embd 128 --n_layer 2 --n_head 2` | ~2M | CPU works | ~5 min |
| `--n_embd 256 --n_layer 4 --n_head 4` | ~10M | 2 GB | ~20 min |
| `--n_embd 512 --n_layer 8 --n_head 8` | ~50M | 4 GB | ~60 min |
| `--n_embd 768 --n_layer 12 --n_head 12` | ~120M | 8 GB | ~2 hrs |

---

## Step-by-Step

### 1. Install dependencies

```bash
pip install -r train/requirements_train.txt
```

### 2. Generate training data

```bash
python train/prepare_data.py
```
Creates `train/training_data.jsonl` with **1050+ examples** (750 claim extraction + 300 authenticity).

### 3. Train the tokenizer

```bash
python train/tokenizer_train.py \
  --data train/training_data.jsonl \
  --vocab_size 32000 \
  --output_dir train/tokenizer
```

This trains a **BPE tokenizer** on your data and saves it to `train/tokenizer/`.  
The tokenizer learns which character sequences appear most commonly and merges them into tokens.

### 4. Train the model from scratch

```bash
python train/train_scratch.py \
  --hf_token "hf_your_token_here" \
  --hf_repo "Navn2025/resume-verifier-model" \
  --epochs 10
```

Training will:
- Randomly initialise all weights
- Learn to predict the next token on your data
- Save the best checkpoint after each epoch
- Push the final model to your HuggingFace account

### 5. Update your `.env`

```env
HUGGINGFACE_MODEL=Navn2025/resume-verifier-model
HUGGINGFACE_PRO_MODEL=Navn2025/resume-verifier-model
```

---

## All Training Flags

```bash
python train/train_scratch.py \
  --hf_token       "hf_..."               # required
  --hf_repo        "username/model-name"  # required
  --data           train/training_data.jsonl
  --tokenizer_dir  train/tokenizer
  --output_dir     train/output_scratch
  --epochs         10
  --batch_size     2
  --grad_accum     4       # effective batch = batch_size × grad_accum
  --max_seq_len    2048
  --lr             3e-4
  --dropout        0.1
  --n_embd         512     # model width
  --n_layer        8       # model depth
  --n_head         8       # attention heads
```

---

## Adding Training Data

`prepare_data.py` already generates **1050+ examples** automatically — no manual additions needed for a first training run.

To add your own high-quality examples, append to `SEED_CLAIM_EXAMPLES` or `SEED_AUTH_EXAMPLES` in `prepare_data.py` then re-run it. Seed examples are used verbatim (not generated) so they should be very accurate.

```python
SEED_CLAIM_EXAMPLES = [
    # existing 10 examples...
    {
        "resume": "Paste any real resume project description here...",
        "claims": ["React", "Node.js", "PostgreSQL", "JWT"]
    },
]
```

### Sources for more high-quality data
- Real resume project sections (anonymised)
- GitHub project READMEs → extract tech stack as claims
- Job posting "requirements" sections → invert as authenticity examples

---

## Training Tips

| Tip | Why |
|-----|-----|
| More data > bigger model | A 10M model on 500 examples beats a 50M model on 12 examples |
| Watch the loss curve | Loss should decrease smoothly — if it spikes, lower `--lr` |
| Use `--grad_accum 8` on small GPU | Simulates larger batch without needing more VRAM |
| Train for more epochs with small data | 20–30 epochs is fine if data is small |
| Lower `--dropout 0.0` with tiny data | Dropout hurts when you have very few examples |

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `CUDA out of memory` | Lower `--n_embd` or `--batch_size 1` |
| `Dataset is empty` | Run `prepare_data.py` first |
| Loss not decreasing | Add more training data or increase `--epochs` |
| `tokenizer has no chat template` | Re-run `tokenizer_train.py` |
| Very high loss (>5) after epoch 1 | Normal for scratch training — keep going |
| `401 Unauthorized` on push | Token expired — create a new write token on HF |

---

## Viewing Your Model

After training:
```
https://huggingface.co/Navn2025/resume-verifier-model
```

You'll see all the model files including:
- `config.json` — your custom architecture config
- `model.safetensors` — the trained weights
- `tokenizer.json` — your custom BPE tokenizer
- `tokenizer_config.json` — chat template and special tokens

The model is registered as `AutoModelForCausalLM` so anyone can load it with:
```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("Navn2025/resume-verifier-model")
```
