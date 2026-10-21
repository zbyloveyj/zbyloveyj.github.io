"""Study-held-out benchmark with fair supervised and pretrained comparisons.

Each outer test study is completely excluded from preprocessing and training.
One rotating study is validation; the remaining studies are training. This is
NOT exhaustive nested CV. All architectures and budgets are specified before
testing. Test metrics cannot be used to retune a completed experiment.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import json
from pathlib import Path
import shutil

import numpy as np
import torch
from torch import nn
from torch.nn import functional as F
from sklearn.metrics import roc_auc_score

from .common import file_sha256, read_json, seed_everything, write_csv, write_json
from .data import Cohort, Preprocessor, load_cohort, validate_split
from .evaluation import aggregate_subjects, binary_metrics, fit_probe, require_resolved_subject_ids
from .microbiome import encode_samples, load_encoder, pretrain_microbiome


def loso_splits(metadata):
    """Hold out every study once, with a deterministic rotating validation study."""
    studies = sorted({r["study"] for r in metadata})
    if len(studies) < 4:
        raise ValueError("This benchmark needs >=4 studies: >=2 training, 1 validation, 1 test.")
    owners = defaultdict(set)
    for row in metadata:
        owners[row["subject_id"]].add(row["study"])
    if any(len(v) != 1 for v in owners.values()):
        raise ValueError("A subject spans studies; define subject-connected study groups before LOSO.")
    result = []
    for i, test in enumerate(studies):
        val = studies[(i + 1) % len(studies)]
        split = {"train": [s for s in studies if s not in {test, val}], "val": [val], "test": [test]}
        validate_split(metadata, split)
        result.append(split)
    return result


def select_training_labels(metadata, split, fraction, seed):
    """Stratified subject-level subsampling, preserving every visit together."""
    if not 0 < fraction <= 1:
        raise ValueError("label_fraction must be in (0, 1].")
    groups = {"0": set(), "1": set()}
    labels = defaultdict(set)
    for row in metadata:
        if row["study"] in split["train"] and row["label"] != "":
            labels[row["subject_id"]].add(row["label"])
    if any(len(v) != 1 for v in labels.values()):
        raise ValueError("Inconsistent labels within a training subject.")
    for subject, value in labels.items():
        groups[next(iter(value))].add(subject)
    if any(not group for group in groups.values()):
        raise ValueError("Training requires labelled subjects of both classes.")
    rng = np.random.default_rng(seed)
    selected = set()
    for label in ["0", "1"]:
        subjects = np.asarray(sorted(groups[label]))
        count = max(1, int(np.ceil(len(subjects) * fraction)))
        selected.update(rng.permutation(subjects)[:count].tolist())
    rows = [dict(row) for row in metadata]
    for row in rows:
        if row["study"] in split["train"] and row["subject_id"] not in selected:
            row["label"] = ""
    return rows, sorted(selected)


def labelled_indices(cohort, split):
    result = {part: np.array([i for i in ids if cohort.metadata[i]["label"] != ""], dtype=int)
              for part, ids in split.items()}
    for part in ["train", "val"]:
        classes = {cohort.metadata[i]["label"] for i in result[part]}
        if classes != {"0", "1"}:
            raise ValueError(f"{part} needs both labelled classes; choose a documented grouped split.")
    if not len(result["test"]):
        raise ValueError("Test study has no labels; predictions are possible, metrics are not.")
    return result


class MicrobiomeClassifier(nn.Module):
    def __init__(self, encoder):
        super().__init__()
        self.encoder = encoder
        # The reconstruction head is not used by the classification loss.
        for parameter in self.encoder.reconstruction.parameters():
            parameter.requires_grad_(False)
        self.classifier = nn.Linear(encoder.config.width, 1)

    def forward(self, values):
        _, representation = self.encoder(values)
        return self.classifier(representation).squeeze(-1)


def supervised_fit(encoder_path, features, cohort, split, out, steps=40, seed=42, lr=0.001):
    """Same head seed, optimizer, steps, batching and selection for both arms."""
    if steps < 1:
        raise ValueError("supervised_steps must be positive.")
    seed_everything(seed, threads=1)
    encoder = load_encoder(encoder_path)
    # Loading/constructing either encoder consumes the same RNG operations.
    torch.manual_seed(seed + 311)
    model = MicrobiomeClassifier(encoder)
    indices = labelled_indices(cohort, split)
    x = torch.as_tensor(features, dtype=torch.float32)
    y = torch.tensor([float(r["label"]) if r["label"] else 0.0 for r in cohort.metadata], dtype=torch.float32)
    train = indices["train"]
    visits = Counter(cohort.metadata[i]["subject_id"] for i in train)
    weights = np.array([1 / visits[cohort.metadata[i]["subject_id"]] for i in train])
    weights = torch.tensor(weights / weights.mean(), dtype=torch.float32)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=0.01)
    sampler = torch.Generator().manual_seed(seed + 901)

    @torch.no_grad()
    def predictions(ids):
        model.eval()
        return torch.sigmoid(model(x[ids])).numpy()

    def validation():
        ids = indices["val"]
        _, labels, probabilities = aggregate_subjects(cohort.metadata, ids, predictions(ids))
        return binary_metrics(labels, probabilities)

    # Always include step zero; validation never forces a trained checkpoint.
    best_metrics = validation()
    best_key = (best_metrics["roc_auc"], -best_metrics["log_loss"])
    best_state = {k: v.detach().clone() for k, v in model.state_dict().items()}
    best_step = 0
    history = [{"step": 0, "validation": best_metrics}]
    for step in range(1, steps + 1):
        model.train()
        positions = torch.randint(len(train), (min(16, len(train)),), generator=sampler)
        batch = train[positions.numpy()]
        loss = (F.binary_cross_entropy_with_logits(model(x[batch]), y[batch], reduction="none") * weights[positions]).mean()
        optimizer.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        if step == 1 or step % max(1, steps // 4) == 0 or step == steps:
            metrics = validation()
            key = (metrics["roc_auc"], -metrics["log_loss"])
            history.append({"step": step, "train_batch_loss": float(loss.detach()), "validation": metrics})
            if key > best_key:
                best_key, best_metrics, best_step = key, metrics, step
                best_state = {k: v.detach().clone() for k, v in model.state_dict().items()}
    model.load_state_dict(best_state)
    test = indices["test"]
    subjects, labels, probabilities = aggregate_subjects(cohort.metadata, test, predictions(test))
    result = {"validation_subject_metrics": best_metrics, "test_subject_metrics": binary_metrics(labels, probabilities),
              "selected_step": best_step, "max_steps": steps, "learning_rate": lr,
              "selection": "validation subject AUROC, tie-break lower validation log loss; includes step zero",
              "test_predictions": [{"subject_id": s, "label": int(y), "probability": float(p)}
                                   for s, y, p in zip(subjects, labels, probabilities)], "history": history,
              "train_subjects": len(visits), "train_samples": len(train),
              "trainable_parameters": sum(p.numel() for p in model.parameters() if p.requires_grad)}
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    torch.save({"encoder_config": model.encoder.config.__dict__, "state_dict": best_state,
                "format": "curatemicrobiota-supervised-v1"}, out / "classifier.pt")
    write_json(out / "report.json", result)
    return result


def paired_auroc_difference(first, second, seed=42, draws=300):
    """Pair subject resampling within one test study and one fitted seed."""
    a = {r["subject_id"]: r for r in first}
    b = {r["subject_id"]: r for r in second}
    if len(a) != len(first) or len(b) != len(second) or set(a) != set(b):
        raise ValueError("Paired comparison needs identical unique subject IDs.")
    subjects = sorted(a)
    if any(a[s]["label"] != b[s]["label"] for s in subjects):
        raise ValueError("Paired labels differ.")
    labels = np.array([a[s]["label"] for s in subjects])
    pa = np.array([a[s]["probability"] for s in subjects])
    pb = np.array([b[s]["probability"] for s in subjects])
    if len(set(labels)) < 2:
        return {"difference": None, "ci95": None, "valid_resamples": 0, "reason": "test study has one class"}
    rng = np.random.default_rng(seed)
    samples = []
    for _ in range(draws):
        idx = rng.integers(0, len(labels), len(labels))
        if len(set(labels[idx])) == 2:
            samples.append(float(roc_auc_score(labels[idx], pa[idx]) - roc_auc_score(labels[idx], pb[idx])))
    return {"difference": float(roc_auc_score(labels, pa) - roc_auc_score(labels, pb)),
            "ci95": np.quantile(samples, [0.025, 0.975]).tolist() if samples else None,
            "valid_resamples": len(samples), "subjects": len(subjects),
            "scope": "Paired subject bootstrap conditional on this held-out study and these fitted models; excludes training and between-study uncertainty."}


def benchmark(data, out, pretrain_steps=40, supervised_steps=40, seeds=(42, 43),
              max_folds=None, label_fraction=1.0, max_taxa=64):
    data, out = Path(data), Path(out)
    if pretrain_steps < 1 or supervised_steps < 1 or max_taxa < 3:
        raise ValueError("Positive training steps and >=3 taxa are required.")
    if not seeds or len(set(seeds)) != len(seeds):
        raise ValueError("Provide unique nonempty seeds.")
    if out.exists() and any(out.iterdir()):
        raise ValueError("Output directory is not empty; use a new experiment directory.")
    cohort = load_cohort(data)
    outcomes = defaultdict(set)
    for row in cohort.metadata:
        if row["label"] != "":
            outcomes[row["subject_id"]].add(row["label"])
    if any(len(values) > 1 for values in outcomes.values()):
        raise ValueError("Changing subject labels require a time-specific outcome and a different benchmark.")
    require_resolved_subject_ids(cohort.metadata)
    splits = loso_splits(cohort.metadata)
    if max_folds is not None:
        if not 1 <= max_folds <= len(splits):
            raise ValueError("max_folds must lie between 1 and the number of studies.")
        splits = splits[:max_folds]
    # Preflight all included splits BEFORE creating outputs or any model fitting.
    for split in splits:
        for seed in seeds:
            rows, _ = select_training_labels(cohort.metadata, split, label_fraction, seed)
            labelled_indices(Cohort(cohort.values, cohort.taxa, rows, split), validate_split(rows, split))
    out.mkdir(parents=True, exist_ok=True)
    results, prediction_rows = [], []
    source = read_json(data / "data_provenance.json") if (data / "data_provenance.json").exists() else {"source_kind": "unspecified"}
    source_hashes = {name: file_sha256(data / name) for name in ["abundance.csv", "metadata.csv", "split.json"]}
    for fold, split in enumerate(splits, 1):
        for seed in seeds:
            run = out / f"fold{fold:02d}" / f"seed{seed}"
            folder = run / "data"
            folder.mkdir(parents=True, exist_ok=True)
            rows, selected = select_training_labels(cohort.metadata, split, label_fraction, seed)
            shutil.copyfile(data / "abundance.csv", folder / "abundance.csv")
            columns = list(rows[0])
            write_csv(folder / "metadata.csv", columns, [[row.get(c, "") for c in columns] for row in rows])
            write_json(folder / "split.json", split)
            write_json(folder / "data_provenance.json", {**source, "benchmark_source_sha256": source_hashes,
                       "benchmark_label_fraction": label_fraction, "benchmark_split": split})
            write_json(run / "label_subset.json", {"seed": seed, "fraction_requested": label_fraction,
                       "selected_training_subjects": selected,
                       "setting": "All training samples remain available for feature preprocessing and self-supervision; only selected training-subject labels enter supervised fits."})
            pretrain_microbiome(folder, run / "pretrain", steps=pretrain_steps, seed=seed, max_taxa=max_taxa)
            fitted = load_cohort(folder)
            indices = fitted.indices()
            preprocessor = Preprocessor.load(run / "pretrain/preprocessor.json")
            features, alignment = preprocessor.transform(fitted.values, fitted.taxa)
            random_path = run / "pretrain/random_encoder.pt"
            trained_path = run / "pretrain/encoder.pt"
            arms = {"logistic": fit_probe(features, fitted, indices),
                    "random_frozen": fit_probe(encode_samples(load_encoder(random_path), features), fitted, indices),
                    "pretrained_frozen": fit_probe(encode_samples(load_encoder(trained_path), features), fitted, indices),
                    "supervised_scratch": supervised_fit(random_path, features, fitted, indices,
                                                        run / "supervised_scratch", supervised_steps, seed),
                    "pretrained_finetuned": supervised_fit(trained_path, features, fitted, indices,
                                                           run / "pretrained_finetuned", supervised_steps, seed)}
            comparisons = {name: paired_auroc_difference(arms["pretrained_finetuned"]["test_predictions"],
                                                         arms[name]["test_predictions"], seed)
                           for name in ["supervised_scratch", "logistic", "pretrained_frozen"]}
            for arm, record in arms.items():
                for prediction in record["test_predictions"]:
                    prediction_rows.append([fold, split["test"][0], seed, arm, prediction["subject_id"],
                                            prediction["label"], prediction["probability"]])
            row = {"fold": fold, "seed": seed, "split": split, "selected_taxa": len(preprocessor.taxa),
                   "labelled_train_subjects": len(selected), "alignment": alignment, "arms": arms,
                   "paired_finetuned_minus_comparator": comparisons}
            write_json(run / "comparison.json", row)
            results.append(row)
            print(f"Completed fold {fold}/{len(splits)}, seed {seed}, held-out {split['test'][0]}", flush=True)
    summaries = {}
    for arm in results[0]["arms"]:
        per_study = defaultdict(list)
        for row in results:
            value = row["arms"][arm]["test_subject_metrics"]["roc_auc"]
            if value is not None:
                per_study[row["split"]["test"][0]].append(value)
        means = {study: float(np.mean(values)) for study, values in per_study.items()}
        values = list(means.values())
        summaries[arm] = {"study_mean_auroc_across_seeds": means,
                          "macro_study_auroc": float(np.mean(values)) if values else None,
                          "between_study_sd_descriptive": float(np.std(values, ddof=1)) if len(values) > 1 else None,
                          "studies_with_defined_auroc": len(values)}
    report = {"benchmark": "study-held-out five-arm teaching benchmark", "source_kind": source.get("source_kind", "unspecified"),
              "source_sha256": source_hashes, "folds": len(splits), "seeds": list(seeds),
              "full_loso": len(splits) == len({r["study"] for r in cohort.metadata}),
              "label_fraction": label_fraction, "pretrain_steps": pretrain_steps, "supervised_steps": supervised_steps,
              "summaries": summaries, "results": results,
              "protocol": {"validation": "one rotating validation study per outer held-out study; not exhaustive nested CV",
                           "preprocessing": "refit using only each fold's training samples; no test self-supervision",
                           "label_budget": "subject-stratified training labels; all training inputs available to every arm",
                           "training_selection": "fixed architectures and step budgets; validation selects checkpoints/C, never test",
                           "compute_comparison": "equal supervised steps for scratch and finetuning; pretrained arm has extra unsupervised compute",
                           "statistics": "each study averages seeds before macro averaging; seeds are not independent people or studies",
                           "limitations": "Descriptive benchmark, not confirmatory significance testing. Related training sets overlap across outer folds. Fixed LR and simple baselines need broader tuning in real research. No clinical claim."}}
    write_json(out / "report.json", report)
    write_csv(out / "predictions.csv", ["fold", "test_study", "seed", "model", "subject_id", "label", "probability"], prediction_rows)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", required=True)
    parser.add_argument("--out", default="runs/loso")
    parser.add_argument("--pretrain-steps", type=int, default=40)
    parser.add_argument("--supervised-steps", type=int, default=40)
    parser.add_argument("--seeds", type=int, nargs="+", default=[42, 43])
    parser.add_argument("--max-folds", type=int)
    parser.add_argument("--label-fraction", type=float, default=1.0)
    parser.add_argument("--max-taxa", type=int, default=64)
    args = parser.parse_args()
    result = benchmark(args.data, args.out, args.pretrain_steps, args.supervised_steps,
                       args.seeds, args.max_folds, args.label_fraction, args.max_taxa)
    print(json.dumps({k: result[k] for k in ["source_kind", "full_loso", "folds", "seeds", "summaries"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
