"""Small, executable laboratories for BPE, exact CPU resume, and memory budgets.

These experiments complement the main model. The BPE tokenizer is independent
of the fixed-byte TinyGPT checkpoint; replacing a tokenizer requires retraining.
The resume proof covers this CPU, single-process experiment, not every GPU kernel
or distributed loader. Budget estimates are arithmetic, never measured capacity.
"""
from __future__ import annotations

import argparse
from collections import Counter
from dataclasses import asdict
import hashlib
import json
from pathlib import Path
import random

import numpy as np

from .common import seed_everything, write_json, read_json


def merge_pair(tokens, pair, replacement):
    """Left-to-right, nonoverlapping replacement, including repeated pairs."""
    result, i = [], 0
    while i < len(tokens):
        if i + 1 < len(tokens) and (tokens[i], tokens[i + 1]) == tuple(pair):
            result.append(replacement)
            i += 2
        else:
            result.append(tokens[i])
            i += 1
    return result


class ByteBPE:
    """Train-only byte BPE; no regex pretokenizer or special control tokens.

    Each document is a separate sequence. Pair counts never span document
    boundaries. Lexicographic tie-breaking makes training deterministic.
    """
    def __init__(self, merges=()):
        self.merges = [tuple(pair) for pair in merges]
        self.vocab = {i: bytes([i]) for i in range(256)}
        for index, (left, right) in enumerate(self.merges, 256):
            if left not in self.vocab or right not in self.vocab:
                raise ValueError("A merge may reference only earlier vocabulary items.")
            self.vocab[index] = self.vocab[left] + self.vocab[right]

    @classmethod
    def train(cls, documents, vocabulary_size=320):
        if not 256 <= vocabulary_size <= 65536:
            raise ValueError("vocabulary_size must be in [256, 65536].")
        if not documents or not any(doc for doc in documents):
            raise ValueError("Provide nonempty training documents.")
        sequences = [list(doc.encode("utf-8")) for doc in documents]
        merges = []
        for new_id in range(256, vocabulary_size):
            counts = Counter(pair for seq in sequences for pair in zip(seq, seq[1:]))
            if not counts:
                break
            pair = min(counts, key=lambda item: (-counts[item], item))
            # Stop when a merge no longer reuses a recurring pattern.
            if counts[pair] < 2:
                break
            merges.append(pair)
            sequences = [merge_pair(seq, pair, new_id) for seq in sequences]
        return cls(merges)

    def encode(self, text):
        tokens = list(text.encode("utf-8"))
        for new_id, pair in enumerate(self.merges, 256):
            tokens = merge_pair(tokens, pair, new_id)
        return tokens

    def decode(self, tokens):
        try:
            raw = b"".join(self.vocab[i] for i in tokens)
        except KeyError as error:
            raise ValueError("Unknown token ID.") from error
        # Encoded text round-trips exactly. Arbitrary generated token sequences
        # can still be invalid UTF-8; display such bytes with replacement marks.
        return raw.decode("utf-8", errors="replace")

    def save(self, path):
        write_json(path, {"format": "curatemicrobiota-byte-bpe-v1", "merges": self.merges})

    @classmethod
    def load(cls, path):
        obj = read_json(path)
        if obj.get("format") != "curatemicrobiota-byte-bpe-v1":
            raise ValueError("Unsupported tokenizer format.")
        return cls(obj["merges"])


def bpe_experiment(out, vocabulary_size=320):
    from .language import TRAIN_DOCUMENTS, VALIDATION_DOCUMENTS
    out = Path(out)
    training = TRAIN_DOCUMENTS + [
        "微生物群落的相对丰度具有组合性。训练数据与验证数据必须分离。",
        "语言模型预测下一个词元。微生物模型预测被遮盖的丰度。",
        "研究结果需要独立验证。模型的低损失不等于生物学因果证据。",
    ]
    heldout = VALIDATION_DOCUMENTS + ["新队列 🧬 需要重新检查输入单位、物种版本和受试者编号。"]
    tokenizer = ByteBPE.train(training, vocabulary_size)
    tokenizer.save(out / "tokenizer.json")
    loaded = ByteBPE.load(out / "tokenizer.json")
    report = {"experiment": "train-only byte BPE", "vocabulary_size": len(tokenizer.vocab),
              "requested_vocabulary_size": vocabulary_size, "merges": len(tokenizer.merges),
              "training_documents_sha256": hashlib.sha256(json.dumps(training, ensure_ascii=False).encode()).hexdigest(),
              "heldout_never_used_for_merges": True,
              "all_roundtrips_exact": all(loaded.decode(loaded.encode(s)) == s for s in training + heldout),
              "scope": "Independent tokenizer experiment; existing TinyGPT stays on its original 256-byte vocabulary.",
              "limitations": "No regex pretokenization, normalization, special tokens, efficient priority queue, or production streaming decoder."}
    for name, documents in [("train", training), ("heldout", heldout)]:
        byte_count = sum(len(s.encode("utf-8")) for s in documents)
        tokens = sum(len(loaded.encode(s)) for s in documents)
        report[name] = {"documents": len(documents), "utf8_bytes": byte_count,
                        "bpe_tokens": tokens, "bytes_per_token": byte_count / tokens}
    report["example"] = {"text": heldout[-1], "tokens": loaded.encode(heldout[-1])}
    write_json(out / "report.json", report)
    return report


def resume_experiment(out, steps=12, interrupt_at=5, seed=42):
    """Prove checkpoint resume equality with optimizer, scheduler and RNG states.

    Two microbatches are averaged before each optimizer step. Save points are
    optimizer-step boundaries, so no unfinished accumulated gradients are needed.
    A private generator owns sampling; global Torch RNG owns dropout. Python and
    NumPy RNGs affect example weights and are restored as well.
    """
    import torch
    from .language import GPTConfig, TinyGPT, ByteTokenizer, TRAIN_DOCUMENTS, sample_batch
    if not 0 < interrupt_at < steps:
        raise ValueError("Require 0 < interrupt_at < steps.")
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    config = GPTConfig(context=24, width=32, heads=4, layers=1, dropout=0.1)
    tokens = torch.tensor(ByteTokenizer.encode("\n".join(TRAIN_DOCUMENTS)), dtype=torch.long)
    corpus_hash = hashlib.sha256(tokens.numpy().tobytes()).hexdigest()

    def initialize():
        seed_everything(seed, threads=1)
        model = TinyGPT(config)
        optimizer = torch.optim.AdamW(model.parameters(), lr=0.002, weight_decay=0.01)
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=steps)
        sampler = torch.Generator().manual_seed(seed + 701)
        return model, optimizer, scheduler, sampler

    def advance(state, count):
        model, optimizer, scheduler, sampler = state
        model.train()
        losses = []
        for _ in range(count):
            optimizer.zero_grad(set_to_none=True)
            accumulated = 0.0
            for _microbatch in range(2):
                x, y = sample_batch(tokens, 4, config.context, sampler)
                _, loss = model(x, y)
                weight = 1 + 0.01 * random.random() + 0.01 * float(np.random.random())
                (loss * weight / 2).backward()
                accumulated += float(loss.detach()) / 2
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            scheduler.step()
            losses.append(accumulated)
        return losses

    continuous = initialize()
    expected_losses = advance(continuous, steps)
    partial = initialize()
    first_losses = advance(partial, interrupt_at)
    numpy_state = np.random.get_state()
    checkpoint = {"format": "curatemicrobiota-resume-cpu-v1", "config": asdict(config),
                  "model": partial[0].state_dict(), "optimizer": partial[1].state_dict(),
                  "scheduler": partial[2].state_dict(), "step": interrupt_at,
                  "total_steps": steps, "corpus_sha256": corpus_hash,
                  "torch_rng": torch.get_rng_state(), "sampler_rng": partial[3].get_state(),
                  "python_rng": random.getstate(),
                  "numpy_rng": [numpy_state[0], numpy_state[1].tolist(), *numpy_state[2:]],
                  "accumulation_steps": 2, "saved_at_optimizer_boundary": True}
    torch.save(checkpoint, out / "checkpoint.pt")
    restored = initialize()  # Initialization consumes RNG; restore states AFTER it.
    saved = torch.load(out / "checkpoint.pt", map_location="cpu", weights_only=True)
    if saved["corpus_sha256"] != corpus_hash or saved["total_steps"] != steps:
        raise ValueError("Data or schedule changed across resume.")
    restored[0].load_state_dict(saved["model"])
    restored[1].load_state_dict(saved["optimizer"])
    restored[2].load_state_dict(saved["scheduler"])
    torch.set_rng_state(saved["torch_rng"])
    restored[3].set_state(saved["sampler_rng"])
    random.setstate(saved["python_rng"])
    ns = saved["numpy_rng"]
    np.random.set_state((ns[0], np.asarray(ns[1], dtype=np.uint32), *ns[2:]))
    remaining_losses = advance(restored, steps - interrupt_at)
    max_delta = max(float((value - restored[0].state_dict()[key]).abs().max())
                    for key, value in continuous[0].state_dict().items())
    report = {"experiment": "full-state CPU checkpoint resume", "steps": steps,
              "interrupted_after_step": interrupt_at, "seed": seed,
              "max_parameter_absolute_difference": max_delta,
              "loss_sequences_exactly_equal": expected_losses == first_losses + remaining_losses,
              "parameters_exactly_equal": max_delta == 0.0,
              "learning_rate_equal": continuous[2].get_last_lr() == restored[2].get_last_lr(),
              "continuous_losses": expected_losses, "resumed_losses": first_losses + remaining_losses,
              "scope": "CPU, one process, single-thread Torch, in-memory corpus, fixed optimizer-step boundary.",
              "not_covered": ["GPU nondeterministic kernels", "AMP GradScaler", "distributed sampler/ranks",
                              "DataLoader worker/prefetch state", "resume inside gradient accumulation"]}
    write_json(out / "report.json", report)
    return report


def memory_budget(parameters, layers, kv_heads, head_dim, context, batch=1, kv_bytes=2):
    vals = [parameters, layers, kv_heads, head_dim, context, batch, kv_bytes]
    if any(type(v) is not int or v <= 0 for v in vals):
        raise ValueError("All counts and bytes must be positive integers.")
    # Cache stores both keys and values, per layer, sequence position, and item.
    cache = 2 * layers * batch * context * kv_heads * head_dim * kv_bytes
    weights = {"fp32": 4 * parameters, "fp16_or_bf16": 2 * parameters,
               "ideal_int8_payload": parameters, "ideal_int4_payload": (parameters + 1) // 2}
    # One explicit convention: 2-byte weights, 2-byte gradients, FP32 master
    # copy, and two 4-byte Adam moments. Actual training implementations differ.
    training = {"low_precision_weights": 2 * parameters, "low_precision_gradients": 2 * parameters,
                "fp32_master_weights": 4 * parameters, "fp32_adam_moments": 8 * parameters}
    return {"parameters": parameters, "layers": layers, "kv_heads": kv_heads, "head_dim": head_dim,
            "context_tokens": context, "batch_size": batch, "kv_element_bytes": kv_bytes,
            "weight_bytes": weights, "weight_gib": {k: v / 2**30 for k, v in weights.items()},
            "kv_cache_bytes": cache, "kv_cache_gib": cache / 2**30,
            "kv_formula": "2 * layers * batch * context * kv_heads * head_dim * kv_bytes",
            "training_parameter_state_bytes": training,
            "training_parameter_state_total_gib": sum(training.values()) / 2**30,
            "scope": "Theoretical payload estimates; no model was loaded and no GPU capacity was measured.",
            "excluded": ["activations and attention intermediates", "quantization scales/zero points/padding",
                         "temporary dequantization buffers", "allocator fragmentation and CUDA context",
                         "logits, communication buffers and pipeline stages"],
            "conventions": "GiB = 2^30 bytes. KV heads may differ from query heads in GQA. Cache includes prompt plus generated tokens. No KV sharding or sliding window is assumed."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="experiment", required=True)
    bpe = sub.add_parser("bpe")
    bpe.add_argument("--out", default="runs/bpe")
    bpe.add_argument("--vocabulary-size", type=int, default=320)
    resume = sub.add_parser("resume")
    resume.add_argument("--out", default="runs/resume")
    resume.add_argument("--steps", type=int, default=12)
    resume.add_argument("--interrupt-at", type=int, default=5)
    budget = sub.add_parser("budget")
    budget.add_argument("--out", default="runs/budget")
    for name, default in [("parameters", 7_000_000_000), ("layers", 32), ("kv-heads", 8),
                          ("head-dim", 128), ("context", 8192), ("batch", 1), ("kv-bytes", 2)]:
        budget.add_argument("--" + name, type=int, default=default)
    args = parser.parse_args()
    if args.experiment == "bpe":
        result = bpe_experiment(args.out, args.vocabulary_size)
    elif args.experiment == "resume":
        result = resume_experiment(args.out, args.steps, args.interrupt_at)
    else:
        result = memory_budget(args.parameters, args.layers, args.kv_heads, args.head_dim,
                               args.context, args.batch, args.kv_bytes)
        write_json(Path(args.out) / "report.json", result)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
