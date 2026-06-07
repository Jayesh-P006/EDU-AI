"""
Trains a BPE tokenizer from scratch on the training data.
Run this before train_scratch.py.

Output: train/tokenizer/  (tokenizer files ready to push to HuggingFace)
"""

import argparse
import json
from pathlib import Path

from tokenizers import Tokenizer, models, trainers, pre_tokenizers, decoders, processors
from transformers import PreTrainedTokenizerFast


SPECIAL_TOKENS = ["<pad>", "<bos>", "<eos>", "<unk>", "<sep>", "<|system|>", "<|user|>", "<|assistant|>"]

# Chat template — matches the format used in training data
CHAT_TEMPLATE = (
    "{% for message in messages %}"
    "{% if message['role'] == 'system' %}<|system|>{{ message['content'] }}<eos>{% endif %}"
    "{% if message['role'] == 'user' %}<|user|>{{ message['content'] }}<eos>{% endif %}"
    "{% if message['role'] == 'assistant' %}<|assistant|>{{ message['content'] }}<eos>{% endif %}"
    "{% endfor %}"
    "{% if add_generation_prompt %}<|assistant|>{% endif %}"
)


def extract_texts(jsonl_path: str) -> list[str]:
    """Pull all message content from the training JSONL."""
    texts = []
    with open(jsonl_path, encoding="utf-8") as f:
        for line in f:
            example = json.loads(line.strip())
            for msg in example.get("messages", []):
                texts.append(msg["content"])
    return texts


def train_tokenizer(texts: list[str], vocab_size: int, output_dir: str):
    print(f"Training BPE tokenizer on {len(texts)} text samples (vocab_size={vocab_size}) ...")

    tokenizer = Tokenizer(models.BPE(unk_token="<unk>"))
    tokenizer.pre_tokenizer = pre_tokenizers.ByteLevel(add_prefix_space=False)
    tokenizer.decoder = decoders.ByteLevel()

    trainer = trainers.BpeTrainer(
        vocab_size=vocab_size,
        special_tokens=SPECIAL_TOKENS,
        min_frequency=2,
        show_progress=True,
    )
    tokenizer.train_from_iterator(texts, trainer=trainer)

    # Add post-processor for BOS/EOS
    bos_id = tokenizer.token_to_id("<bos>")
    eos_id = tokenizer.token_to_id("<eos>")
    tokenizer.post_processor = processors.TemplateProcessing(
        single="<bos> $A <eos>",
        special_tokens=[("<bos>", bos_id), ("<eos>", eos_id)],
    )

    # Wrap as HuggingFace fast tokenizer
    hf_tokenizer = PreTrainedTokenizerFast(
        tokenizer_object=tokenizer,
        bos_token="<bos>",
        eos_token="<eos>",
        unk_token="<unk>",
        pad_token="<pad>",
        sep_token="<sep>",
        additional_special_tokens=["<|system|>", "<|user|>", "<|assistant|>"],
        chat_template=CHAT_TEMPLATE,
    )

    Path(output_dir).mkdir(parents=True, exist_ok=True)
    hf_tokenizer.save_pretrained(output_dir)
    print(f"Tokenizer saved to {output_dir}  (vocab size: {hf_tokenizer.vocab_size})")
    return hf_tokenizer


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--data", default="train/training_data.jsonl")
    p.add_argument("--vocab_size", type=int, default=32000)
    p.add_argument("--output_dir", default="train/tokenizer")
    args = p.parse_args()

    texts = extract_texts(args.data)
    if not texts:
        raise ValueError(f"No text found in {args.data} — run prepare_data.py first.")

    print(f"Extracted {len(texts)} text segments from training data.")
    print("Note: for a high-quality tokenizer, provide thousands of text samples.")

    train_tokenizer(texts, args.vocab_size, args.output_dir)


if __name__ == "__main__":
    main()
