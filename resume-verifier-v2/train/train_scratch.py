"""
Train the ResumeVerifier model from scratch and push to HuggingFace Hub.

Steps this script performs:
  1. Load your custom tokenizer (from tokenizer_train.py)
  2. Initialise the model with RANDOM weights (from scratch)
  3. Tokenize and batch the training JSONL
  4. Run a full training loop with AdamW + cosine LR schedule
  5. Push model + tokenizer to your HuggingFace repo

Usage:
    python train/train_scratch.py \
        --hf_token "hf_your_token" \
        --hf_repo "your-username/resume-verifier-model" \
        --epochs 10

Recommended hardware: GPU with 8+ GB VRAM.
For CPU-only training, use --n_layer 2 --n_embd 128 (tiny model for testing).
"""

import argparse
import json
import math
import time
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from transformers import PreTrainedTokenizerFast, get_cosine_schedule_with_warmup
from huggingface_hub import login

from model import ResumeVerifierConfig, ResumeVerifierForCausalLM


# ── Dataset ───────────────────────────────────────────────────────────────────

class ChatDataset(Dataset):
    def __init__(self, jsonl_path: str, tokenizer: PreTrainedTokenizerFast, max_len: int):
        self.samples = []
        with open(jsonl_path, encoding="utf-8") as f:
            for line in f:
                example = json.loads(line.strip())
                # Apply chat template → single string
                text = tokenizer.apply_chat_template(
                    example["messages"],
                    tokenize=False,
                    add_generation_prompt=False,
                )
                tokens = tokenizer(
                    text,
                    truncation=True,
                    max_length=max_len,
                    return_tensors="pt",
                )
                ids = tokens["input_ids"].squeeze(0)
                if len(ids) > 1:
                    self.samples.append(ids)

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        return self.samples[idx]


def collate_fn(batch, pad_id: int):
    max_len = max(x.size(0) for x in batch)
    input_ids = torch.full((len(batch), max_len), pad_id, dtype=torch.long)
    labels    = torch.full((len(batch), max_len), -100,   dtype=torch.long)
    for i, ids in enumerate(batch):
        input_ids[i, : ids.size(0)] = ids
        labels[i, : ids.size(0)]    = ids
    return input_ids, labels


# ── Training loop ─────────────────────────────────────────────────────────────

def train(args):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    # ── Tokenizer ────────────────────────────────────────────────────────────
    print(f"Loading tokenizer from {args.tokenizer_dir} ...")
    tokenizer = PreTrainedTokenizerFast.from_pretrained(args.tokenizer_dir)

    # ── Model config ─────────────────────────────────────────────────────────
    config = ResumeVerifierConfig(
        vocab_size=len(tokenizer),
        n_embd=args.n_embd,
        n_layer=args.n_layer,
        n_head=args.n_head,
        n_positions=args.max_seq_len,
        intermediate_size=args.n_embd * 4,
        dropout=args.dropout,
        pad_token_id=tokenizer.pad_token_id,
        bos_token_id=tokenizer.bos_token_id,
        eos_token_id=tokenizer.eos_token_id,
    )

    print(f"\nModel config:")
    print(f"  vocab_size     : {config.vocab_size}")
    print(f"  n_embd         : {config.n_embd}")
    print(f"  n_layer        : {config.n_layer}")
    print(f"  n_head         : {config.n_head}")
    print(f"  n_positions    : {config.n_positions}")
    print(f"  intermediate   : {config.intermediate_size}")

    # ── Initialise from scratch ───────────────────────────────────────────────
    model = ResumeVerifierForCausalLM(config)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"\nTotal parameters: {total_params / 1e6:.2f}M  (training from scratch)")
    model.to(device)

    # ── Dataset ───────────────────────────────────────────────────────────────
    print(f"\nLoading training data from {args.data} ...")
    dataset = ChatDataset(args.data, tokenizer, args.max_seq_len)
    if len(dataset) == 0:
        raise ValueError("Dataset is empty. Run prepare_data.py first.")
    print(f"Training examples: {len(dataset)}")

    pad_fn = lambda batch: collate_fn(batch, tokenizer.pad_token_id)
    loader = DataLoader(
        dataset,
        batch_size=args.batch_size,
        shuffle=True,
        collate_fn=pad_fn,
        num_workers=0,
    )

    # ── Optimiser + schedule ─────────────────────────────────────────────────
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=args.lr,
        weight_decay=0.1,
        betas=(0.9, 0.95),
    )
    total_steps  = len(loader) * args.epochs
    warmup_steps = max(1, total_steps // 10)
    scheduler = get_cosine_schedule_with_warmup(optimizer, warmup_steps, total_steps)

    scaler = torch.cuda.amp.GradScaler(enabled=(device.type == "cuda"))

    # ── Training ──────────────────────────────────────────────────────────────
    Path(args.output_dir).mkdir(parents=True, exist_ok=True)
    best_loss = float("inf")

    print(f"\nStarting training: {args.epochs} epochs, {total_steps} total steps\n")

    for epoch in range(1, args.epochs + 1):
        model.train()
        epoch_loss = 0.0
        t0 = time.time()

        for step, (input_ids, labels) in enumerate(loader, 1):
            input_ids = input_ids.to(device)
            labels    = labels.to(device)

            with torch.cuda.amp.autocast(enabled=(device.type == "cuda")):
                outputs = model(input_ids=input_ids, labels=labels)
                loss    = outputs.loss / args.grad_accum

            scaler.scale(loss).backward()

            if step % args.grad_accum == 0 or step == len(loader):
                scaler.unscale_(optimizer)
                nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                scaler.step(optimizer)
                scaler.update()
                optimizer.zero_grad()
                scheduler.step()

            epoch_loss += loss.item() * args.grad_accum

            if step % 10 == 0:
                lr_now = scheduler.get_last_lr()[0]
                print(f"  epoch {epoch}/{args.epochs} | step {step}/{len(loader)} "
                      f"| loss {loss.item() * args.grad_accum:.4f} | lr {lr_now:.2e}")

        avg_loss = epoch_loss / len(loader)
        elapsed  = time.time() - t0
        print(f"\nEpoch {epoch} done — avg loss: {avg_loss:.4f}  ({elapsed:.1f}s)\n")

        # Save best checkpoint
        if avg_loss < best_loss:
            best_loss = avg_loss
            ckpt_path = Path(args.output_dir) / "best"
            model.save_pretrained(ckpt_path)
            tokenizer.save_pretrained(ckpt_path)
            print(f"  New best checkpoint saved to {ckpt_path}")

    # ── Push to HuggingFace ───────────────────────────────────────────────────
    print(f"\nLogging in to HuggingFace ...")
    login(token=args.hf_token)

    best_model = ResumeVerifierForCausalLM.from_pretrained(
        Path(args.output_dir) / "best"
    )
    print(f"Pushing to https://huggingface.co/{args.hf_repo} ...")
    best_model.push_to_hub(args.hf_repo, token=args.hf_token, private=False)
    tokenizer.push_to_hub(args.hf_repo, token=args.hf_token)

    print(f"\nYour model is live at: https://huggingface.co/{args.hf_repo}")
    print(f"\nUpdate your .env:")
    print(f"  HUGGINGFACE_MODEL={args.hf_repo}")
    print(f"  HUGGINGFACE_PRO_MODEL={args.hf_repo}")


# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--hf_token",      required=True,  help="HuggingFace write token")
    p.add_argument("--hf_repo",       required=True,  help="username/model-name on HF Hub")
    p.add_argument("--data",          default="train/training_data.jsonl")
    p.add_argument("--tokenizer_dir", default="train/tokenizer")
    p.add_argument("--output_dir",    default="train/output_scratch")
    p.add_argument("--epochs",        type=int,   default=10)
    p.add_argument("--batch_size",    type=int,   default=2)
    p.add_argument("--grad_accum",    type=int,   default=4,   help="Gradient accumulation steps")
    p.add_argument("--max_seq_len",   type=int,   default=2048)
    p.add_argument("--lr",            type=float, default=3e-4)
    p.add_argument("--dropout",       type=float, default=0.1)
    # Model size flags
    p.add_argument("--n_embd",        type=int,   default=512,  help="Embedding dimension")
    p.add_argument("--n_layer",       type=int,   default=8,    help="Number of transformer layers")
    p.add_argument("--n_head",        type=int,   default=8,    help="Number of attention heads")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    train(args)
