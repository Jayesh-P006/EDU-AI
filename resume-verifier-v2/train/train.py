"""
Fine-tune a base model for resume verification tasks and push to HuggingFace Hub.

Usage:
    python train/train.py \
        --base_model "Qwen/Qwen2.5-1.5B-Instruct" \
        --hf_token "hf_your_token" \
        --hf_repo "your-username/resume-verifier-model" \
        --data "train/training_data.jsonl" \
        --epochs 3

Requirements:
    pip install -r train/requirements_train.txt

Hardware:
    - Minimum: 8 GB VRAM GPU (runs 1.5B model with 4-bit quantization)
    - Recommended: 16 GB VRAM GPU (runs 3B model comfortably)
    - CPU-only: very slow but possible with --no_quantize flag
"""

import argparse
import json
from pathlib import Path

import torch
from datasets import Dataset
from huggingface_hub import login
from peft import LoraConfig, get_peft_model, TaskType
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
)
from trl import SFTTrainer, SFTConfig


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--base_model", default="Qwen/Qwen2.5-1.5B-Instruct",
                   help="Base model from HuggingFace to fine-tune")
    p.add_argument("--hf_token", required=True, help="HuggingFace API token (hf_...)")
    p.add_argument("--hf_repo", required=True,
                   help="Your HF repo to push to, e.g. navneet99837/resume-verifier-model")
    p.add_argument("--data", default="train/training_data.jsonl",
                   help="Path to training JSONL file")
    p.add_argument("--epochs", type=int, default=3)
    p.add_argument("--batch_size", type=int, default=2)
    p.add_argument("--max_seq_len", type=int, default=2048)
    p.add_argument("--lr", type=float, default=2e-4)
    p.add_argument("--no_quantize", action="store_true",
                   help="Disable 4-bit quantization (needs more VRAM)")
    p.add_argument("--output_dir", default="train/output")
    return p.parse_args()


def load_jsonl(path: str) -> Dataset:
    rows = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return Dataset.from_list(rows)


def format_messages(tokenizer, example: dict) -> dict:
    """Convert messages list → single text using the tokenizer's chat template."""
    text = tokenizer.apply_chat_template(
        example["messages"],
        tokenize=False,
        add_generation_prompt=False,
    )
    return {"text": text}


def main():
    args = parse_args()

    print(f"Logging into HuggingFace as {args.hf_repo.split('/')[0]} ...")
    login(token=args.hf_token)

    # ── Load tokenizer ────────────────────────────────────────────────────────
    print(f"Loading tokenizer from {args.base_model} ...")
    tokenizer = AutoTokenizer.from_pretrained(
        args.base_model,
        trust_remote_code=True,
        token=args.hf_token,
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # ── Load base model ───────────────────────────────────────────────────────
    bnb_config = None
    if not args.no_quantize and torch.cuda.is_available():
        print("Using 4-bit quantization (bitsandbytes) ...")
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.bfloat16,
            bnb_4bit_use_double_quant=True,
        )

    print(f"Loading base model {args.base_model} ...")
    model = AutoModelForCausalLM.from_pretrained(
        args.base_model,
        quantization_config=bnb_config,
        device_map="auto" if torch.cuda.is_available() else "cpu",
        trust_remote_code=True,
        token=args.hf_token,
    )
    model.config.use_cache = False

    # ── Apply LoRA adapters ───────────────────────────────────────────────────
    lora_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=16,
        lora_alpha=32,
        target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
        lora_dropout=0.05,
        bias="none",
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    # ── Prepare dataset ───────────────────────────────────────────────────────
    print(f"Loading training data from {args.data} ...")
    dataset = load_jsonl(args.data)
    dataset = dataset.map(lambda ex: format_messages(tokenizer, ex))

    split = dataset.train_test_split(test_size=0.1, seed=42)
    train_ds = split["train"]
    eval_ds = split["test"]
    print(f"Train: {len(train_ds)} examples | Eval: {len(eval_ds)} examples")

    # ── Training ──────────────────────────────────────────────────────────────
    Path(args.output_dir).mkdir(parents=True, exist_ok=True)

    training_args = SFTConfig(
        output_dir=args.output_dir,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        gradient_accumulation_steps=4,
        learning_rate=args.lr,
        lr_scheduler_type="cosine",
        warmup_ratio=0.1,
        fp16=torch.cuda.is_available() and not torch.cuda.is_bf16_supported(),
        bf16=torch.cuda.is_available() and torch.cuda.is_bf16_supported(),
        logging_steps=5,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        report_to="none",
        max_seq_length=args.max_seq_len,
        dataset_text_field="text",
        push_to_hub=True,
        hub_model_id=args.hf_repo,
        hub_token=args.hf_token,
    )

    trainer = SFTTrainer(
        model=model,
        args=training_args,
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        processing_class=tokenizer,
    )

    print("Starting training ...")
    trainer.train()

    print(f"\nPushing model to https://huggingface.co/{args.hf_repo} ...")
    trainer.push_to_hub()
    tokenizer.push_to_hub(args.hf_repo, token=args.hf_token)

    print(f"\nDone! Your model is live at: https://huggingface.co/{args.hf_repo}")
    print(f"\nUpdate your .env:")
    print(f"  HUGGINGFACE_MODEL={args.hf_repo}")
    print(f"  HUGGINGFACE_PRO_MODEL={args.hf_repo}")


if __name__ == "__main__":
    main()
