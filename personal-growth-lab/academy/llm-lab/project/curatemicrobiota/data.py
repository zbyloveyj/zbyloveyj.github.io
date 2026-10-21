"""Data contracts, a labelled synthetic fixture, and leakage-aware preprocessing.

Input abundances are proportions in [0, 1], not read counts or percentages. We do
not recompute a sample total, apply CLR, or centre within a sample before masking.
The compositional constraint in supplied relative abundance remains a modelling
limitation; the masked task is compared with a training-mean imputation baseline.
"""
from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .common import file_sha256, read_json, write_csv, write_json


@dataclass
class Cohort:
    values: np.ndarray
    taxa: list[str]
    metadata: list[dict]
    split: dict[str, list[str]]

    def indices(self):
        return validate_split(self.metadata, self.split)


def validate_split(metadata, split):
    """Assign entire studies and ensure subjects cannot cross partitions."""
    if set(split) != {"train", "val", "test"}:
        raise ValueError("split.json must contain exactly train, val and test study lists.")
    flattened = [study for studies in split.values() for study in studies]
    if len(flattened) != len(set(flattened)):
        raise ValueError("A study appears in more than one split.")
    all_studies = {row["study"] for row in metadata}
    if set(flattened) != all_studies:
        raise ValueError("split.json must assign every observed study exactly once.")
    result = {name: np.array([i for i, row in enumerate(metadata) if row["study"] in studies], dtype=int)
              for name, studies in split.items()}
    if any(len(idx) == 0 for idx in result.values()):
        raise ValueError("train, val and test must each contain samples.")
    subjects = {name: {metadata[i]["subject_id"] for i in idx} for name, idx in result.items()}
    for a, b in [("train", "val"), ("train", "test"), ("val", "test")]:
        overlap = subjects[a] & subjects[b]
        if overlap:
            raise ValueError(f"Subject leakage between {a} and {b}: {sorted(overlap)[:3]}")
    return result


def load_cohort(directory):
    directory = Path(directory)
    with (directory / "abundance.csv").open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.reader(handle))
    if not rows or rows[0][0] != "sample_id" or len(rows[0]) < 4:
        raise ValueError("abundance.csv needs sample_id followed by at least three taxon columns.")
    taxa = rows[0][1:]
    if len(taxa) != len(set(taxa)) or any(not t.strip() for t in taxa):
        raise ValueError("Taxon names must be unique and nonempty.")
    sample_ids = [row[0] for row in rows[1:]]
    if len(sample_ids) != len(set(sample_ids)):
        raise ValueError("Duplicate abundance sample_id values.")
    if any(len(row) != len(rows[0]) for row in rows[1:]):
        raise ValueError("abundance.csv has inconsistent row lengths.")
    values = np.array([[float(v) for v in row[1:]] for row in rows[1:]], dtype=np.float64)
    if values.ndim != 2 or not len(values) or not np.isfinite(values).all() or (values < 0).any():
        raise ValueError("Abundances must be a nonempty, finite, nonnegative matrix.")
    totals = values.sum(axis=1)
    if (totals <= 0).any() or (totals > 1.01).any():
        raise ValueError("Expected proportions with positive row sums <= 1.01; explicitly convert percent/count inputs first.")
    with (directory / "metadata.csv").open(encoding="utf-8-sig", newline="") as handle:
        metadata = list(csv.DictReader(handle))
    required = {"sample_id", "study", "subject_id", "label"}
    if not metadata or not required.issubset(metadata[0]):
        raise ValueError("metadata.csv requires sample_id, study, subject_id and label.")
    for row in metadata:
        if any(not row[k].strip() for k in required - {"label"}):
            raise ValueError("Sample, study and subject identifiers cannot be empty.")
        row["label"] = row["label"].strip()
        if row["label"] not in {"0", "1", ""}:
            raise ValueError("Labels must be 0, 1 or blank for unlabelled pretraining samples.")
    by_id = {row["sample_id"]: row for row in metadata}
    if len(by_id) != len(metadata) or set(by_id) != set(sample_ids):
        raise ValueError("Metadata and abundance sample IDs must match exactly, with no duplicates.")
    metadata = [by_id[sample_id] for sample_id in sample_ids]
    cohort = Cohort(values, taxa, metadata, read_json(directory / "split.json"))
    cohort.indices()
    return cohort


def align_abundance(values, input_taxa, vocabulary, allow_missing=False):
    """Apply a frozen feature order, reporting unseen or absent columns explicitly."""
    lookup = {taxon: i for i, taxon in enumerate(input_taxa)}
    missing = [taxon for taxon in vocabulary if taxon not in lookup]
    if missing and not allow_missing:
        raise ValueError(f"Missing {len(missing)} trained taxon columns; distinguish assay missingness from biological zero.")
    aligned = np.zeros((len(values), len(vocabulary)), dtype=np.float64)
    for j, taxon in enumerate(vocabulary):
        if taxon in lookup:
            aligned[:, j] = values[:, lookup[taxon]]
    unknown = [taxon for taxon in input_taxa if taxon not in set(vocabulary)]
    total = np.asarray(values).sum(axis=1)
    report = {"missing_trained_taxa": missing, "excluded_input_taxa": unknown,
              "retained_abundance_mass_mean": float(aligned.sum(axis=1).mean()),
              "retained_fraction_of_input_mass_mean": float(np.mean(aligned.sum(axis=1) / np.maximum(total, 1e-12))),
              "missing_assumed_zero": bool(missing and allow_missing)}
    return aligned, report


@dataclass
class Preprocessor:
    taxa: list[str]
    mean: list[float]
    scale: list[float]
    prevalence: float = 0.10
    transform_name: str = "log1p(proportion * 1e6); train-only per-taxon standardization"

    @classmethod
    def fit(cls, training_values, taxa, max_taxa=64, prevalence=0.10):
        """All selection, means and scales are estimated from TRAIN samples only."""
        x = np.asarray(training_values, dtype=np.float64)
        keep = np.flatnonzero((x > 0).mean(axis=0) >= prevalence)
        # A stable tie break by original column order makes vocabularies reproducible.
        keep = np.array(sorted(keep, key=lambda j: (-x[:, j].mean(), j))[:max_taxa], dtype=int)
        if len(keep) < 3:
            raise ValueError("At least three taxa must pass training-set prevalence filtering.")
        selected = x[:, keep]
        z = np.log1p(selected * 1_000_000.0)
        mean = z.mean(axis=0)
        scale = np.maximum(z.std(axis=0), 0.1)
        return cls([taxa[i] for i in keep], mean.tolist(), scale.tolist(), prevalence)

    def transform(self, values, taxa, allow_missing=False):
        aligned, report = align_abundance(values, taxa, self.taxa, allow_missing=allow_missing)
        z = np.log1p(aligned * 1_000_000.0)
        z = (z - np.asarray(self.mean)) / np.asarray(self.scale)
        return z.astype(np.float32), report

    def save(self, path):
        from dataclasses import asdict
        write_json(path, asdict(self))

    @classmethod
    def load(cls, path):
        return cls(**read_json(path))


def make_demo(directory, seed=42):
    """240 synthetic samples, 6 studies, 120 subjects, 48 deliberately unnamed taxa."""
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(seed)
    taxa = [f"demo_taxon_{i + 1:03d}" for i in range(48)]
    rows, metadata = [], []
    base = rng.normal(-2, 0.7, len(taxa))
    for study in range(6):
        study_id = f"STUDY_{study + 1:02d}"
        batch_effect = rng.normal(0, 0.35, len(taxa))
        labels = np.array([0, 1] * 10)
        rng.shuffle(labels)
        for subject, label in enumerate(labels):
            subject_id = f"{study_id}_PERSON_{subject + 1:03d}"
            individual = rng.normal(0, 0.65, len(taxa))
            latent = base + batch_effect + individual
            # The artificial label shifts two groups of taxa. This is a simulator,
            # not a finding about any real organism, disease, or clinical cohort.
            latent[:6] += 0.65 * (2 * label - 1)
            latent[6:12] -= 0.45 * (2 * label - 1)
            for visit in [1, 2]:
                abundance = np.exp(latent + rng.normal(0, 0.3, len(taxa)))
                abundance[rng.random(len(taxa)) < 0.12] = 0
                abundance /= abundance.sum()
                sample_id = f"{subject_id}_V{visit}"
                rows.append([sample_id, *[f"{a:.10g}" for a in abundance]])
                metadata.append([sample_id, study_id, subject_id, int(label)])
    write_csv(directory / "abundance.csv", ["sample_id", *taxa], rows)
    write_csv(directory / "metadata.csv", ["sample_id", "study", "subject_id", "label"], metadata)
    split = {"train": [f"STUDY_{i:02d}" for i in range(1, 5)], "val": ["STUDY_05"], "test": ["STUDY_06"]}
    write_json(directory / "split.json", split)
    write_json(directory / "data_provenance.json", {
        "source_kind": "synthetic_teaching_fixture", "seed": seed, "samples": 240, "subjects": 120,
        "studies": 6, "taxa": 48, "units": "relative_abundance_proportion",
        "description": "Logistic-normal synthetic compositions with zeros, repeated visits, artificial label effects and study shifts.",
        "not_a_real_cohort": True, "license": "CC0-1.0 for this synthetic fixture",
        "limitations": "No inference about real microbes or diseases; visit correlations and study effects are simplified.",
        "sha256": {name: file_sha256(directory / name) for name in ["abundance.csv", "metadata.csv", "split.json"]}})
    return {"directory": str(directory), "samples": len(rows), "subjects": 120, "studies": 6, "taxa": len(taxa),
            "source_kind": "synthetic_teaching_fixture"}
