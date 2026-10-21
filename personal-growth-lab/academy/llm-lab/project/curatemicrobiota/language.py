"""A small decoder-only Transformer; each major operation remains visible.

The default corpus is original teaching text. Training it demonstrates mechanics,
not microbiological expertise, instruction-following ability, or clinical utility.
"""
from __future__ import annotations

import math
import time
from dataclasses import asdict, dataclass
from pathlib import Path

import torch
from torch import nn
from torch.nn import functional as F

from .common import parameter_count, seed_everything, write_json


@dataclass
class GPTConfig:
    vocabulary: int = 256
    context: int = 64
    width: int = 64
    heads: int = 4
    layers: int = 2
    dropout: float = 0.05


class ByteTokenizer:
    """UTF-8 bytes have a fixed 256-item vocabulary and no unknown token."""
    @staticmethod
    def encode(text):
        return list(text.encode("utf-8"))

    @staticmethod
    def decode(tokens):
        return bytes(tokens).decode("utf-8", errors="replace")


class CausalSelfAttention(nn.Module):
    def __init__(self, config):
        super().__init__()
        if config.width % config.heads:
            raise ValueError("width must be divisible by heads")
        self.heads, self.head_dim = config.heads, config.width // config.heads
        self.qkv = nn.Linear(config.width, 3 * config.width)
        self.output = nn.Linear(config.width, config.width)
        self.dropout = nn.Dropout(config.dropout)
        self.register_buffer("allowed", torch.ones(config.context, config.context, dtype=torch.bool).tril(), persistent=False)

    def forward(self, x):
        batch, length, width = x.shape
        q, k, v = self.qkv(x).chunk(3, dim=-1)
        # [B,T,C] -> [B,H,T,D], where C = H*D.
        q, k, v = [a.view(batch, length, self.heads, self.head_dim).transpose(1, 2) for a in (q, k, v)]
        scores = (q @ k.transpose(-2, -1)) / math.sqrt(self.head_dim)
        scores = scores.masked_fill(~self.allowed[:length, :length], float("-inf"))
        weights = self.dropout(F.softmax(scores, dim=-1))
        attended = weights @ v
        attended = attended.transpose(1, 2).contiguous().view(batch, length, width)
        return self.dropout(self.output(attended))


class DecoderBlock(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.norm_attention = nn.LayerNorm(config.width)
        self.attention = CausalSelfAttention(config)
        self.norm_mlp = nn.LayerNorm(config.width)
        self.mlp = nn.Sequential(nn.Linear(config.width, config.width * 4), nn.GELU(),
                                 nn.Linear(config.width * 4, config.width), nn.Dropout(config.dropout))

    def forward(self, x):
        x = x + self.attention(self.norm_attention(x))
        return x + self.mlp(self.norm_mlp(x))


class TinyGPT(nn.Module):
    def __init__(self, config=None):
        super().__init__()
        self.config = config or GPTConfig()
        self.token_embedding = nn.Embedding(self.config.vocabulary, self.config.width)
        self.position_embedding = nn.Embedding(self.config.context, self.config.width)
        self.blocks = nn.Sequential(*[DecoderBlock(self.config) for _ in range(self.config.layers)])
        self.final_norm = nn.LayerNorm(self.config.width)
        self.head = nn.Linear(self.config.width, self.config.vocabulary, bias=False)
        self.apply(self._initialize)

    @staticmethod
    def _initialize(module):
        if isinstance(module, (nn.Embedding, nn.Linear)):
            nn.init.normal_(module.weight, std=0.02)
            if isinstance(module, nn.Linear) and module.bias is not None:
                nn.init.zeros_(module.bias)

    def forward(self, token_ids, targets=None):
        length = token_ids.shape[1]
        if length == 0 or length > self.config.context:
            raise ValueError("Input length must be between 1 and model context.")
        positions = torch.arange(length, device=token_ids.device)
        x = self.token_embedding(token_ids) + self.position_embedding(positions)
        logits = self.head(self.final_norm(self.blocks(x)))
        # x and y are already shifted by one token in sample_batch; do not shift twice.
        loss = None if targets is None else F.cross_entropy(logits.reshape(-1, logits.size(-1)), targets.reshape(-1))
        return logits, loss

    @torch.no_grad()
    def generate(self, token_ids, new_tokens=80, temperature=0.8, top_k=40):
        if temperature <= 0 or new_tokens < 0 or top_k < 1:
            raise ValueError("temperature and top_k must be positive; new_tokens cannot be negative.")
        self.eval()
        for _ in range(new_tokens):
            logits, _ = self(token_ids[:, -self.config.context:])
            logits = logits[:, -1, :] / temperature
            threshold = torch.topk(logits, min(top_k, logits.size(-1))).values[:, -1, None]
            logits = logits.masked_fill(logits < threshold, float("-inf"))
            next_token = torch.multinomial(F.softmax(logits, dim=-1), num_samples=1)
            token_ids = torch.cat((token_ids, next_token), dim=1)
        return token_ids


def sample_batch(tokens, batch_size, context, generator=None):
    if len(tokens) <= context:
        raise ValueError(f"Each text split must contain more than {context} bytes.")
    starts = torch.randint(len(tokens) - context, (batch_size,), generator=generator)
    x = torch.stack([tokens[i:i + context] for i in starts])
    y = torch.stack([tokens[i + 1:i + context + 1] for i in starts])
    return x, y


TRAIN_DOCUMENTS = [
    "A language model predicts the next token from earlier tokens. A token can be a byte, a character, or a learned subword.",
    "Attention compares queries with keys and mixes values. Causal attention hides future positions during language training.",
    "Residual connections preserve a path for the signal. Layer normalization changes the scale within a hidden representation.",
    "A training loss is a numerical objective. A low loss alone does not establish that a scientific claim is correct.",
    "The optimizer changes parameters after backward propagation. Evaluation uses fixed parameters and separate observations.",
    "A microbiome table contains samples and features. A sample identifier must align with the corresponding metadata row.",
    "Relative abundances are compositional. Increasing one part changes the proportions even when the other absolute amounts stay fixed.",
    "Different studies can have different technical protocols. A model can learn study identity instead of a transferable biological signal.",
    "Group assignment happens before feature selection. Repeated visits from one person remain in the same partition.",
    "A validation set guides model selection. A test set estimates performance after choices have been fixed.",
    "Masking a taxon is an artificial prediction task. A missing assay measurement is different from a measured zero.",
    "A foundation model requires diverse data and evidence of transfer. A small classroom prototype demonstrates the training recipe.",
    "A baseline is a useful scientific comparison. Greater model complexity does not guarantee better predictions.",
    "A source citation identifies evidence that a reader can inspect. A generated sentence is not evidence by itself.",
    "A checkpoint stores learned tensors and their configuration. Reproducing a run also requires the data split and preprocessing.",
    "Logistic regression maps features to a probability. Calibration asks whether predicted probabilities agree with observed frequencies.",
]
VALIDATION_DOCUMENTS = [
    "A new cohort can differ in age, diet, collection method, sequencing depth, and medication. Transfer must be measured directly.",
    "Taxonomic names and profiling versions must be harmonized before merging microbial tables. Matching column positions is insufficient.",
    "The test labels should not determine hyperparameters. Results from synthetic samples describe a simulation rather than patients.",
    "An experiment should record its assumptions, data provenance, random seed, fitted transformations, and evaluation procedure.",
]


@torch.no_grad()
def estimate_loss(model, tokens, batches=4):
    model.eval()
    generator = torch.Generator().manual_seed(2026)
    losses = []
    for _ in range(batches):
        x, y = sample_batch(tokens, 8, model.config.context, generator)
        _, loss = model(x, y)
        losses.append(float(loss))
    return sum(losses) / len(losses)


def train_language(out, steps=100, seed=42, text=None):
    seed_everything(seed)
    if steps < 1:
        raise ValueError("steps must be positive")
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    if text is None:
        train_text = "\n\n".join(TRAIN_DOCUMENTS)
        val_text = "\n\n".join(VALIDATION_DOCUMENTS)
        corpus_source = "original_teaching_text; distinct train/validation paragraphs"
    else:
        raw = Path(text).read_text(encoding="utf-8")
        paragraphs = list(dict.fromkeys(p.strip() for p in raw.split("\n\n") if p.strip()))
        if len(paragraphs) < 5:
            raise ValueError("Custom --text needs at least 5 blank-line-separated documents; split by source first for real corpora.")
        split = max(1, int(len(paragraphs) * 0.8))
        train_text, val_text = "\n\n".join(paragraphs[:split]), "\n\n".join(paragraphs[split:])
        corpus_source = "user-supplied text; deterministic paragraph split, duplicate exact paragraphs removed"
    (out / "train_text.txt").write_text(train_text, encoding="utf-8")
    (out / "validation_text.txt").write_text(val_text, encoding="utf-8")
    train_ids = torch.tensor(ByteTokenizer.encode(train_text), dtype=torch.long)
    val_ids = torch.tensor(ByteTokenizer.encode(val_text), dtype=torch.long)
    config = GPTConfig()
    model = TinyGPT(config)
    initial_val = estimate_loss(model, val_ids)
    optimizer = torch.optim.AdamW(model.parameters(), lr=0.001, weight_decay=0.01)
    log = []
    best_loss, best_state, best_step = initial_val, {k: v.detach().clone() for k, v in model.state_dict().items()}, 0
    start = time.perf_counter()
    for step in range(1, steps + 1):
        model.train()
        x, y = sample_batch(train_ids, 8, config.context)
        _, loss = model(x, y)
        optimizer.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        if step == 1 or step % max(1, steps // 5) == 0 or step == steps:
            val_loss = estimate_loss(model, val_ids)
            log.append({"step": step, "train_batch_loss": float(loss.detach()), "validation_loss": val_loss})
            if val_loss < best_loss:
                best_loss, best_step = val_loss, step
                best_state = {k: v.detach().clone() for k, v in model.state_dict().items()}
    model.load_state_dict(best_state)
    checkpoint = {"format": "curatemicrobiota-tinygpt-v1", "config": asdict(config), "state_dict": best_state,
                  "tokenizer": "utf8-bytes-256", "seed": seed, "selected_step": best_step}
    torch.save(checkpoint, out / "model.pt")
    generated = ByteTokenizer.decode(model.generate(torch.tensor([ByteTokenizer.encode("Microbes ")]), 80)[0].tolist())
    report = {"kind": "small_language_model_teaching_run", "config": asdict(config), "parameters": parameter_count(model),
              "corpus_source": corpus_source, "train_bytes": len(train_ids), "validation_bytes": len(val_ids),
              "initial_validation_loss_nats_per_byte": initial_val, "selected_validation_loss_nats_per_byte": best_loss,
              "selected_validation_perplexity_per_byte": math.exp(min(best_loss, 50)), "selected_step": best_step,
              "steps": steps, "elapsed_seconds": time.perf_counter() - start, "log": log, "example_generation": generated,
              "limitations": "Byte-level perplexity is not comparable with another tokenizer. Tiny teaching text does not train scientific expertise; generated text can be incoherent."}
    write_json(out / "report.json", report)
    return report


def generate_from_checkpoint(checkpoint_path, prompt="Microbes ", tokens=80, temperature=0.8, top_k=40, seed=42):
    seed_everything(seed)
    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=True)
    if checkpoint.get("format") != "curatemicrobiota-tinygpt-v1":
        raise ValueError("Expected a CurateMicrobiota TinyGPT checkpoint.")
    model = TinyGPT(GPTConfig(**checkpoint["config"]))
    if checkpoint.get("lora"):
        from .lora import inject_lora
        inject_lora(model, **checkpoint["lora"])
    model.load_state_dict(checkpoint["state_dict"])
    ids = ByteTokenizer.encode(prompt) or [10]
    result = model.generate(torch.tensor([ids], dtype=torch.long), tokens, temperature, top_k)
    return ByteTokenizer.decode(result[0].tolist())
