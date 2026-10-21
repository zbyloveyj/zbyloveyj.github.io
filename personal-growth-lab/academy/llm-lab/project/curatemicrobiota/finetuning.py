"""Inspectable response-only SFT and DPO-loss mechanics for the tiny byte model.

The included pairs are original, synthetic teaching examples. This module can
demonstrate instruction-format optimization, not reliable microbiological advice.
"""
from __future__ import annotations

import json
import math
import time
from dataclasses import asdict
from pathlib import Path

import torch
from torch.nn import functional as F

from .common import file_sha256, parameter_count, seed_everything, write_json
from .language import ByteTokenizer, GPTConfig, TinyGPT
from .lora import inject_lora


def load_sft_pairs(path=None):
    path = Path(path) if path else Path(__file__).with_name("sft_pairs.jsonl")
    pairs = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    required = {"id", "split", "prompt", "response", "source_kind"}
    if not pairs or any(not required.issubset(pair) for pair in pairs):
        raise ValueError("SFT JSONL requires id, split, prompt, response and source_kind.")
    ids, texts = set(), set()
    for pair in pairs:
        if pair["split"] not in {"train", "validation"}:
            raise ValueError("SFT split must be train or validation, explicitly assigned before training.")
        key = (pair["prompt"], pair["response"])
        if pair["id"] in ids or key in texts:
            raise ValueError("Duplicate SFT IDs or exact prompt/response pairs; deduplicate before splitting.")
        ids.add(pair["id"])
        texts.add(key)
    split = {name: [pair for pair in pairs if pair["split"] == name] for name in ["train", "validation"]}
    if any(not rows for rows in split.values()):
        raise ValueError("Both fixed SFT training and validation pairs are required.")
    return split, path


def pack_sft_batch(pairs, context):
    """Shift once, then supervise response bytes plus one newline terminator.

For a prompt of P bytes, the logit at input position P-1 predicts the first
response byte. All targets before that position and all right-padding targets
are -100. No prompt is silently truncated to make an oversized pair fit.
    """
    x = torch.zeros((len(pairs), context), dtype=torch.long)
    labels = torch.full((len(pairs), context), -100, dtype=torch.long)
    records = []
    for row, pair in enumerate(pairs):
        prompt = ByteTokenizer.encode(pair["prompt"])
        response = ByteTokenizer.encode(pair["response"].rstrip("\n") + "\n")
        if not prompt or len(response) < 2:
            raise ValueError("Each SFT pair needs a nonempty prompt and response.")
        combined = prompt + response
        if len(combined) - 1 > context:
            raise ValueError(f"SFT pair {pair.get('id', row)} needs {len(combined)-1} positions, exceeding context={context}; shorten it explicitly.")
        length = len(combined) - 1
        x[row, :length] = torch.tensor(combined[:-1])
        # Original target token k sits at shifted target position k-1.
        start = len(prompt) - 1
        labels[row, start:length] = torch.tensor(combined[len(prompt):])
        records.append({"id": pair.get("id", str(row)), "prompt_bytes": len(prompt),
                        "response_bytes_including_terminator": len(response), "input_length": length,
                        "first_supervised_position": start, "padding_positions": context - length})
    return x, labels, records


def response_loss(logits, labels):
    if not bool((labels != -100).any()):
        raise ValueError("No response targets are available.")
    return F.cross_entropy(logits.reshape(-1, logits.shape[-1]), labels.reshape(-1), ignore_index=-100)


def response_log_probabilities(logits, labels):
    """Sum conditional log probabilities over response/terminator tokens only."""
    selected = labels != -100
    safe_labels = labels.masked_fill(~selected, 0)
    log_probs = F.log_softmax(logits, dim=-1).gather(-1, safe_labels.unsqueeze(-1)).squeeze(-1)
    return (log_probs * selected).sum(dim=-1), selected.sum(dim=-1)


def train_sft(checkpoint_path, out, steps=30, use_lora=False, seed=42, pairs_path=None):
    checkpoint_path = Path(checkpoint_path)
    if not checkpoint_path.is_file():
        raise ValueError("A real TinyGPT base checkpoint is required. Run train-lm first and pass --checkpoint.")
    if steps < 1:
        raise ValueError("steps must be positive")
    seed_everything(seed)
    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=True)
    if checkpoint.get("format") != "curatemicrobiota-tinygpt-v1" or checkpoint.get("lora"):
        raise ValueError("Use a full TinyGPT base checkpoint, not an adapter-only or already-LoRA checkpoint.")
    model = TinyGPT(GPTConfig(**checkpoint["config"]))
    model.load_state_dict(checkpoint["state_dict"])
    # Save immutable base tensors before wrapping attention qkv modules.
    before = {name: parameter.detach().clone() for name, parameter in model.named_parameters()}
    wrapped = inject_lora(model, rank=2, alpha=4.0) if use_lora else []
    fixed_base = {name: parameter.detach().clone() for name, parameter in model.named_parameters() if not parameter.requires_grad}
    split, pairs_file = load_sft_pairs(pairs_path)
    train_x, train_y, train_masks = pack_sft_batch(split["train"], model.config.context)
    val_x, val_y, val_masks = pack_sft_batch(split["validation"], model.config.context)

    def validation_loss():
        model.eval()
        with torch.no_grad():
            logits, _ = model(val_x)
            return float(response_loss(logits, val_y))

    initial = validation_loss()
    best_loss, best_step = initial, 0
    best_state = {name: value.detach().clone() for name, value in model.state_dict().items()}
    optimizer = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad],
                                  lr=0.003 if use_lora else 0.0005, weight_decay=0.0)
    log = []
    start_time = time.perf_counter()
    for step in range(1, steps + 1):
        model.train()
        idx = torch.randint(len(train_x), (min(6, len(train_x)),))
        logits, _ = model(train_x[idx])
        loss = response_loss(logits, train_y[idx])
        optimizer.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_([p for p in model.parameters() if p.requires_grad], 1.0)
        optimizer.step()
        if step == 1 or step % max(1, steps // 5) == 0 or step == steps:
            current_validation = validation_loss()
            log.append({"step": step, "train_batch_response_loss": float(loss.detach()), "validation_response_loss": current_validation})
            if current_validation < best_loss:
                best_loss, best_step = current_validation, step
                best_state = {name: value.detach().clone() for name, value in model.state_dict().items()}
    model.load_state_dict(best_state)
    base_unchanged = (all(torch.equal(value, dict(model.named_parameters())[name]) for name, value in fixed_base.items())
                      if use_lora else None)
    changed_tensors = sum(not torch.equal(before[name], p) for name, p in model.named_parameters() if name in before)
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    lora_config = {"rank": 2, "alpha": 4.0, "target_names": ["qkv"]} if use_lora else None
    state = {"format": "curatemicrobiota-tinygpt-v1", "config": asdict(model.config), "state_dict": best_state,
             "tokenizer": "utf8-bytes-256", "seed": seed, "selected_step": best_step,
             "training_stage": "synthetic_response_only_sft", "lora": lora_config,
             "base_checkpoint_sha256": file_sha256(checkpoint_path)}
    torch.save(state, out / "model.pt")
    if use_lora:
        torch.save({"format": "curatemicrobiota-lora-adapter-v1", "lora": lora_config,
                    "base_checkpoint_sha256": file_sha256(checkpoint_path),
                    "adapter_state_dict": {name: value for name, value in best_state.items() if "lora_" in name}}, out / "adapter.pt")
    prompt = split["validation"][0]["prompt"]
    generated = ByteTokenizer.decode(model.generate(torch.tensor([ByteTokenizer.encode(prompt)]), new_tokens=24, temperature=0.7)[0].tolist())
    report = {"kind": "tinygpt_response_only_sft", "source_kind": "synthetic_teaching_pairs" if pairs_path is None else "user_supplied_pairs",
              "adaptation": "lora_qkv" if use_lora else "full_parameter_sft", "parameters": parameter_count(model),
              "base_checkpoint_sha256": file_sha256(checkpoint_path), "sft_pairs_sha256": file_sha256(pairs_file),
              "train_pair_ids": [p["id"] for p in split["train"]], "validation_pair_ids": [p["id"] for p in split["validation"]],
              "supervision": "response UTF-8 bytes plus newline terminator; prompt and padding ignore_index=-100",
              "train_batch_masks": train_masks, "validation_batch_masks": val_masks,
              "initial_validation_response_loss": initial, "selected_validation_response_loss": best_loss,
              "selected_validation_response_perplexity_per_byte": math.exp(min(best_loss, 50)),
              "selected_step": best_step, "steps": steps, "seed": seed, "log": log,
              "elapsed_seconds": time.perf_counter() - start_time, "wrapped_lora_modules": wrapped,
              "frozen_base_unchanged": base_unchanged, "full_sft_base_tensors_changed": changed_tensors if not use_lora else None,
              "example_generation": generated,
              "limitations": "Four tiny validation pairs cannot measure general instruction-following. This is an actual SFT optimization demonstration, not verified microbiological knowledge or clinical evidence."}
    write_json(out / "report.json", report)
    return report


def dpo_loss(policy_chosen, policy_rejected, reference_chosen, reference_rejected, beta=0.1):
    """Standard DPO classification loss on response sequence log probabilities.

The reference is fixed. These are sequence sums, not token averages; any length
normalization would change the objective and must be introduced explicitly.
    """
    tensors = [policy_chosen, policy_rejected, reference_chosen, reference_rejected]
    if beta <= 0 or any(t.shape != policy_chosen.shape for t in tensors):
        raise ValueError("DPO needs matching tensor shapes and beta > 0.")
    policy_ratio = policy_chosen - policy_rejected
    reference_ratio = reference_chosen.detach() - reference_rejected.detach()
    return -F.logsigmoid(beta * (policy_ratio - reference_ratio)).mean()


def alignment_demo(out):
    chosen = torch.tensor([-6.0, -7.2], requires_grad=True)
    rejected = torch.tensor([-8.0, -6.9], requires_grad=True)
    reference_chosen = torch.tensor([-6.5, -7.1])
    reference_rejected = torch.tensor([-7.4, -6.8])
    beta = 0.1
    loss = dpo_loss(chosen, rejected, reference_chosen, reference_rejected, beta)
    loss.backward()
    with torch.no_grad():
        improved = dpo_loss(chosen + 0.2, rejected - 0.2, reference_chosen, reference_rejected, beta)
        advantage = (chosen - rejected) - (reference_chosen - reference_rejected)
    report = {"kind": "dpo_formula_and_gradient_mechanics", "source_kind": "fixed_synthetic_sequence_log_probabilities",
              "beta": beta, "policy_chosen_logp": chosen.detach().tolist(), "policy_rejected_logp": rejected.detach().tolist(),
              "reference_chosen_logp": reference_chosen.tolist(), "reference_rejected_logp": reference_rejected.tolist(),
              "preference_advantage": advantage.tolist(), "dpo_loss": float(loss.detach()),
              "chosen_logp_gradient": chosen.grad.tolist(), "rejected_logp_gradient": rejected.grad.tolist(),
              "chosen_gradient_is_negative": bool((chosen.grad < 0).all()),
              "rejected_gradient_is_positive": bool((rejected.grad > 0).all()),
              "loss_after_higher_chosen_advantage": float(improved), "higher_advantage_lowers_loss": bool(improved < loss.detach()),
              "meaning": "Gradient descent increases chosen relative log probability and decreases rejected relative log probability compared with a fixed reference.",
              "limitations": "This differentiates a DPO equation on fixed scalar examples; it does not train a preference-aligned language model, fit a reward model, or perform RLHF.",
              "source": "https://arxiv.org/abs/2305.18290"}
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    write_json(out / "report.json", report)
    return report
