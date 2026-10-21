"""LoRA mechanics on a small regression task, with an optional GPT injection helper."""
from __future__ import annotations

import math
from pathlib import Path

import torch
from torch import nn
from torch.nn import functional as F

from .common import parameter_count, seed_everything, write_json


class LoRALinear(nn.Module):
    def __init__(self, base, rank=2, alpha=4.0):
        super().__init__()
        if not isinstance(base, nn.Linear) or rank < 1:
            raise ValueError("LoRALinear requires nn.Linear and a positive rank.")
        self.base, self.rank, self.alpha = base, rank, alpha
        for parameter in self.base.parameters():
            parameter.requires_grad_(False)
        self.lora_a = nn.Parameter(torch.empty(rank, base.in_features))
        self.lora_b = nn.Parameter(torch.zeros(base.out_features, rank))
        nn.init.kaiming_uniform_(self.lora_a, a=math.sqrt(5))

    def forward(self, x):
        # PyTorch Linear computes x W^T; the low-rank update is B A.
        return self.base(x) + F.linear(F.linear(x, self.lora_a), self.lora_b) * (self.alpha / self.rank)


def inject_lora(model, rank=2, alpha=4.0, target_names=("qkv",)):
    """Freeze the model and wrap named Linear children; return the wrapped paths."""
    for parameter in model.parameters():
        parameter.requires_grad_(False)
    replaced = []
    # Snapshot named_modules because we mutate the module tree during iteration.
    for path, module in list(model.named_modules()):
        for child_name, child in list(module.named_children()):
            if child_name in target_names and isinstance(child, nn.Linear):
                setattr(module, child_name, LoRALinear(child, rank=rank, alpha=alpha))
                replaced.append(f"{path}.{child_name}".strip("."))
    if not replaced:
        raise ValueError("No matching nn.Linear modules found for LoRA injection.")
    return replaced


def lora_demo(out, steps=100, seed=42):
    if steps < 1:
        raise ValueError("steps must be positive")
    seed_everything(seed)
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    base = nn.Linear(12, 8)
    model = LoRALinear(base, rank=2, alpha=2.0)
    before = {key: value.detach().clone() for key, value in base.state_dict().items()}
    x_train, x_test = torch.randn(64, 12), torch.randn(32, 12)
    true_update = torch.randn(8, 2) @ torch.randn(2, 12) * 0.12
    with torch.no_grad():
        y_train = base(x_train) + F.linear(x_train, true_update)
        y_test = base(x_test) + F.linear(x_test, true_update)
        initial = float(F.mse_loss(model(x_test), y_test))
    optimizer = torch.optim.Adam([p for p in model.parameters() if p.requires_grad], lr=0.03)
    for _ in range(steps):
        loss = F.mse_loss(model(x_train), y_train)
        optimizer.zero_grad(set_to_none=True)
        loss.backward()
        optimizer.step()
    with torch.no_grad():
        final = float(F.mse_loss(model(x_test), y_test))
    unchanged = all(torch.equal(before[key], value) for key, value in base.state_dict().items())
    report = {"kind": "lora_linear_regression_teaching_demo", "rank": 2, "alpha": 2.0, "steps": steps,
              "parameters": parameter_count(model), "frozen_base_unchanged": unchanged,
              "initial_heldout_mse": initial, "final_heldout_mse": final,
              "limitations": "The target update is deliberately rank 2. This demonstrates adapter gradients and frozen weights, not instruction tuning, preference alignment or LLM task performance."}
    torch.save({"lora_a": model.lora_a.detach(), "lora_b": model.lora_b.detach(), "rank": 2, "alpha": 2.0}, out / "adapter.pt")
    write_json(out / "report.json", report)
    return report
