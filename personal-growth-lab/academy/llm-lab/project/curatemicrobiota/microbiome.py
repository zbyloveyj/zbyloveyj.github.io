"""Masked continuous-feature pretraining with an explicit, frozen taxon vocabulary.

This is an educational prototype of a microbiome encoder, not a validated
foundation model. Taxa are a set of identified features, not words in a sentence.
No sequence-position embedding or causal language mask is applied here.
"""
from __future__ import annotations

import math
import time
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
import torch
from torch import nn

from .common import file_sha256, parameter_count, read_json, seed_everything, write_json
from .data import Preprocessor, load_cohort


@dataclass
class MicrobiomeConfig:
    taxa: int
    width: int = 48
    heads: int = 4
    layers: int = 2
    dropout: float = 0.05


class BidirectionalAttention(nn.Module):
    def __init__(self, config):
        super().__init__()
        if config.width % config.heads:
            raise ValueError("width must be divisible by heads")
        self.heads, self.head_dim = config.heads, config.width // config.heads
        self.qkv = nn.Linear(config.width, 3 * config.width)
        self.output = nn.Linear(config.width, config.width)
        self.dropout = nn.Dropout(config.dropout)

    def forward(self, x):
        b, t, c = x.shape
        q, k, v = [a.view(b, t, self.heads, self.head_dim).transpose(1, 2)
                   for a in self.qkv(x).chunk(3, dim=-1)]
        weights = torch.softmax(q @ k.transpose(-2, -1) / math.sqrt(self.head_dim), dim=-1)
        context = (self.dropout(weights) @ v).transpose(1, 2).contiguous().view(b, t, c)
        return self.dropout(self.output(context))


class EncoderBlock(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.norm1 = nn.LayerNorm(config.width)
        self.attention = BidirectionalAttention(config)
        self.norm2 = nn.LayerNorm(config.width)
        self.mlp = nn.Sequential(nn.Linear(config.width, config.width * 2), nn.GELU(),
                                 nn.Linear(config.width * 2, config.width), nn.Dropout(config.dropout))

    def forward(self, x):
        x = x + self.attention(self.norm1(x))
        return x + self.mlp(self.norm2(x))


class MaskedMicrobiomeEncoder(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.config = config
        self.taxon_embedding = nn.Embedding(config.taxa, config.width)
        self.value_embedding = nn.Linear(1, config.width)
        self.mask_embedding = nn.Parameter(torch.zeros(config.width))
        self.blocks = nn.Sequential(*[EncoderBlock(config) for _ in range(config.layers)])
        self.norm = nn.LayerNorm(config.width)
        self.reconstruction = nn.Linear(config.width, 1)
        nn.init.normal_(self.taxon_embedding.weight, std=0.02)
        nn.init.normal_(self.mask_embedding, std=0.02)

    def forward(self, values, mask=None, taxon_ids=None):
        if mask is None:
            mask = torch.zeros_like(values, dtype=torch.bool)
        if mask.shape != values.shape or mask.dtype != torch.bool:
            raise ValueError("mask must be boolean and match the [batch, taxa] input shape")
        if taxon_ids is None:
            if values.shape[1] != self.config.taxa:
                raise ValueError("Input columns must match the frozen taxon vocabulary.")
            taxon_ids = torch.arange(self.config.taxa, device=values.device)
        # Replace the entire value representation, not just its numeric input:
        # a masked measurement remains distinct from a genuine observed zero.
        content = self.value_embedding(values.unsqueeze(-1))
        content = torch.where(mask.unsqueeze(-1), self.mask_embedding.view(1, 1, -1), content)
        hidden = content + self.taxon_embedding(taxon_ids)
        hidden = self.norm(self.blocks(hidden))
        prediction = self.reconstruction(hidden).squeeze(-1)
        return prediction, hidden.mean(dim=1)


def make_mask(batch_size, taxa, rate=0.25, generator=None):
    if not 0 < rate < 1 or taxa < 3:
        raise ValueError("Mask rate must lie in (0,1); at least three taxa are required.")
    # Mask at least two taxa: with closed proportions, hiding only one component
    # can create an almost trivial sum-to-one reconstruction problem.
    count = min(taxa - 1, max(2, round(taxa * rate)))
    random_scores = torch.rand(batch_size, taxa, generator=generator)
    chosen = random_scores.argsort(dim=1)[:, :count]
    mask = torch.zeros(batch_size, taxa, dtype=torch.bool)
    return mask.scatter_(1, chosen, True)


def masked_mse(prediction, target, mask):
    if mask.dtype != torch.bool or mask.shape != target.shape or prediction.shape != target.shape:
        raise ValueError("Prediction, target and boolean mask must have matching shapes.")
    if not bool(mask.any()):
        raise ValueError("At least one masked target is required.")
    return (prediction[mask] - target[mask]).square().mean()


@torch.no_grad()
def reconstruction_metrics(model, values, mask):
    model.eval()
    prediction, _ = model(values, mask)
    # Training-feature means equal zero after train-only standardization.
    baseline = torch.zeros_like(values)
    mse = float(masked_mse(prediction, values, mask))
    baseline_mse = float(masked_mse(baseline, values, mask))
    return {"masked_mse_standardized_log_abundance": mse,
            "training_mean_imputation_mse": baseline_mse,
            "relative_mse_reduction_vs_mean": 1 - mse / baseline_mse if baseline_mse > 0 else None,
            "masked_values": int(mask.sum()), "mask_count_per_sample": int(mask[0].sum())}


def pretrain_microbiome(data, out, steps=100, seed=42, max_taxa=64, mask_rate=0.25):
    seed_everything(seed)
    if steps < 1:
        raise ValueError("steps must be positive")
    data, out = Path(data), Path(out)
    out.mkdir(parents=True, exist_ok=True)
    cohort = load_cohort(data)
    split = cohort.indices()
    preprocess = Preprocessor.fit(cohort.values[split["train"]], cohort.taxa, max_taxa=max_taxa)
    preprocess.save(out / "preprocessor.json")
    transformed, alignment = preprocess.transform(cohort.values, cohort.taxa)
    tensors = {name: torch.from_numpy(transformed[idx]) for name, idx in split.items()}
    config = MicrobiomeConfig(taxa=len(preprocess.taxa))
    model = MaskedMicrobiomeEncoder(config)
    initial_state = {key: value.detach().clone() for key, value in model.state_dict().items()}
    torch.save({"config": asdict(config), "state_dict": initial_state}, out / "random_encoder.pt")
    val_mask = make_mask(len(tensors["val"]), config.taxa, mask_rate, torch.Generator().manual_seed(7301))
    initial = reconstruction_metrics(model, tensors["val"], val_mask)
    best_loss = initial["masked_mse_standardized_log_abundance"]
    best_state, best_step = initial_state, 0
    optimizer = torch.optim.AdamW(model.parameters(), lr=0.001, weight_decay=0.01)
    log = []
    start = time.perf_counter()
    for step in range(1, steps + 1):
        model.train()
        idx = torch.randint(len(tensors["train"]), (16,))
        values = tensors["train"][idx]
        mask = make_mask(len(values), config.taxa, mask_rate)
        prediction, _ = model(values, mask)
        loss = masked_mse(prediction, values, mask)
        optimizer.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        if step == 1 or step % max(1, steps // 5) == 0 or step == steps:
            val_metrics = reconstruction_metrics(model, tensors["val"], val_mask)
            val_loss = val_metrics["masked_mse_standardized_log_abundance"]
            log.append({"step": step, "train_batch_masked_mse": float(loss.detach()), **val_metrics})
            if val_loss < best_loss:
                best_loss, best_step = val_loss, step
                best_state = {key: value.detach().clone() for key, value in model.state_dict().items()}
    model.load_state_dict(best_state)
    manifest = {"format": "curatemicrobiota-masked-encoder-v1", "config": asdict(config), "seed": seed,
                "selected_step": best_step, "mask_rate": mask_rate, "split": cohort.split,
                "data_sha256": {name: file_sha256(data / name) for name in ["abundance.csv", "metadata.csv", "split.json"]},
                "preprocessor_sha256": file_sha256(out / "preprocessor.json"),
                "source_kind": read_json(data / "data_provenance.json").get("source_kind", "user_provided")
                    if (data / "data_provenance.json").exists() else "user_provided_unverified_provenance"}
    torch.save({"config": asdict(config), "state_dict": best_state, "format": manifest["format"]}, out / "encoder.pt")
    write_json(out / "manifest.json", manifest)
    report = {"kind": "masked_microbiome_encoder_pretraining", "source_kind": manifest["source_kind"],
              "parameters": parameter_count(model), "config": asdict(config), "steps": steps, "selected_step": best_step,
              "elapsed_seconds": time.perf_counter() - start, "samples_per_split": {k: len(v) for k, v in split.items()},
              "studies_per_split": cohort.split, "initial_validation": initial,
              "selected_validation": reconstruction_metrics(model, tensors["val"], val_mask), "log": log,
              "alignment": alignment, "test_used_during_pretraining": False,
              "limitations": "Loss concerns randomly hidden standardized log proportions. It is not an absolute-abundance error or clinical metric. Compositional dependence, zeros and study shifts remain; compare mean imputation and independent-cohort downstream baselines."}
    write_json(out / "pretrain_report.json", report)
    return report


@torch.no_grad()
def encode_samples(model, values, batch_size=32):
    model.eval()
    result = []
    for start in range(0, len(values), batch_size):
        _, embedding = model(torch.as_tensor(values[start:start + batch_size], dtype=torch.float32))
        result.append(embedding.numpy())
    return np.concatenate(result)


def load_encoder(path):
    state = torch.load(path, map_location="cpu", weights_only=True)
    model = MaskedMicrobiomeEncoder(MicrobiomeConfig(**state["config"]))
    model.load_state_dict(state["state_dict"])
    return model
