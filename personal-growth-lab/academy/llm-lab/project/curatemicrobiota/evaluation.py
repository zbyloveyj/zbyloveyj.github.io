"""A frozen-cohort evaluation: supervised baselines, probes and subject-level metrics."""
from __future__ import annotations

from pathlib import Path

import numpy as np
import torch
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (average_precision_score, balanced_accuracy_score, brier_score_loss,
                             confusion_matrix, f1_score, log_loss, roc_auc_score)
from sklearn.preprocessing import StandardScaler

from .common import file_sha256, read_json, seed_everything, write_csv, write_json
from .data import Preprocessor, load_cohort
from .microbiome import encode_samples, load_encoder, make_mask, reconstruction_metrics


def require_resolved_subject_ids(metadata):
    """Do not report independent-person metrics for sample-based surrogate IDs."""
    unresolved = [row for row in metadata
                  if str(row.get("subject_id_unresolved", "false")).strip().lower() in {"true", "1"}]
    if unresolved:
        raise ValueError(
            f"{len(unresolved)} samples have unresolved subject IDs. Resolve the original donor/visit mapping "
            "before subject-level evaluation or bootstrap; sample-based surrogate IDs are not independent people. "
            "Export and self-supervised pretraining can still be used without this evaluation."
        )


def aggregate_subjects(metadata, indices, probability):
    """Repeated visits contribute one mean probability per subject to primary metrics."""
    grouped = {}
    for index, p in zip(indices, probability):
        row = metadata[index]
        grouped.setdefault(row["subject_id"], []).append((int(row["label"]), float(p)))
    subjects, labels, probabilities = [], [], []
    for subject, rows in grouped.items():
        observed_labels = {row[0] for row in rows}
        if len(observed_labels) != 1:
            raise ValueError(f"Subject {subject} has changing labels; define a single subject-level outcome before this benchmark.")
        subjects.append(subject)
        labels.append(rows[0][0])
        probabilities.append(np.mean([row[1] for row in rows]))
    return subjects, np.array(labels, dtype=int), np.array(probabilities, dtype=float)


def binary_metrics(labels, probabilities, bootstrap=False, seed=42):
    labels, probabilities = np.asarray(labels), np.asarray(probabilities)
    if not len(labels):
        raise ValueError("No labelled samples available for evaluation.")
    prediction = (probabilities >= 0.5).astype(int)
    two_classes = len(np.unique(labels)) == 2
    bins = []
    ece = 0.0
    for index in range(5):
        lo, hi = index / 5, (index + 1) / 5
        selected = (probabilities >= lo) & ((probabilities < hi) if index < 4 else (probabilities <= hi))
        count = int(selected.sum())
        if count:
            predicted = float(probabilities[selected].mean())
            observed = float(labels[selected].mean())
            ece += count / len(labels) * abs(predicted - observed)
        else:
            predicted = observed = None
        bins.append({"lower": lo, "upper": hi, "n": count, "mean_probability": predicted, "positive_fraction": observed})
    result = {"n": len(labels), "positive_n": int(labels.sum()), "prevalence": float(labels.mean()),
              "roc_auc": float(roc_auc_score(labels, probabilities)) if two_classes else None,
              "average_precision": float(average_precision_score(labels, probabilities)) if two_classes else None,
              "macro_f1_at_0_5": float(f1_score(labels, prediction, average="macro", labels=[0, 1], zero_division=0)),
              "balanced_accuracy_at_0_5": float(balanced_accuracy_score(labels, prediction)) if two_classes else None,
              "brier_score": float(brier_score_loss(labels, probabilities)),
              "log_loss": float(log_loss(labels, probabilities, labels=[0, 1])),
              "ece_5_equal_width_bins": ece, "calibration_bins": bins,
              "confusion_matrix_labels_0_1": confusion_matrix(labels, prediction, labels=[0, 1]).tolist(),
              "threshold": 0.5, "auprc_definition": "average_precision (AP), not trapezoidal PR-curve area"}
    if bootstrap and two_classes:
        rng = np.random.default_rng(seed)
        aucs = []
        for _ in range(400):
            idx = rng.integers(0, len(labels), len(labels))
            if len(np.unique(labels[idx])) == 2:
                aucs.append(float(roc_auc_score(labels[idx], probabilities[idx])))
        result["roc_auc_ci95_subject_bootstrap"] = np.quantile(aucs, [0.025, 0.975]).tolist() if aucs else None
        result["bootstrap_valid_replicates"] = len(aucs)
        result["bootstrap_note"] = "Illustrative 400-replicate subject bootstrap within one held-out study; it does not quantify between-study uncertainty."
    return result


def _subject_weights(metadata, indices):
    counts = {}
    for i in indices:
        subject = metadata[i]["subject_id"]
        counts[subject] = counts.get(subject, 0) + 1
    weights = np.array([1.0 / counts[metadata[i]["subject_id"]] for i in indices])
    return weights * (len(weights) / weights.sum())


def fit_probe(features, cohort, split):
    """Fit only train, select C only val, then touch test for final reporting."""
    labelled = {name: np.array([i for i in idx if cohort.metadata[i]["label"] != ""], dtype=int)
                for name, idx in split.items()}
    labels = {name: np.array([int(cohort.metadata[i]["label"]) for i in idx]) for name, idx in labelled.items()}
    if any(len(np.unique(labels[name])) < 2 for name in ["train", "val"]):
        raise ValueError("The teaching classifier needs both binary classes in labelled train and validation subjects.")
    if not len(labelled["test"]):
        raise ValueError("Test partition needs labelled subjects for the supervised benchmark.")
    scaler = StandardScaler().fit(features[labelled["train"]])
    x = {name: scaler.transform(features[idx]) for name, idx in labelled.items()}
    weights = _subject_weights(cohort.metadata, labelled["train"])
    candidates, best = [], None
    for c in [0.1, 1.0, 10.0]:
        classifier = LogisticRegression(C=c, max_iter=2000, solver="lbfgs", random_state=42)
        classifier.fit(x["train"], labels["train"], sample_weight=weights)
        validation_probability = classifier.predict_proba(x["val"])[:, 1]
        _, validation_y, validation_p = aggregate_subjects(cohort.metadata, labelled["val"], validation_probability)
        score = float(roc_auc_score(validation_y, validation_p))
        candidates.append({"C": c, "validation_subject_roc_auc": score})
        if best is None or score > best[0]:
            best = (score, c, classifier)
    _, selected_c, classifier = best
    val_probability = classifier.predict_proba(x["val"])[:, 1]
    test_probability = classifier.predict_proba(x["test"])[:, 1]
    _, val_y, val_p = aggregate_subjects(cohort.metadata, labelled["val"], val_probability)
    test_subjects, test_y, test_p = aggregate_subjects(cohort.metadata, labelled["test"], test_probability)
    return {"selected_C": selected_c, "C_candidates": candidates,
            "validation_subject_metrics": binary_metrics(val_y, val_p),
            "test_subject_metrics": binary_metrics(test_y, test_p, bootstrap=True),
            "test_sample_metrics_secondary": binary_metrics(labels["test"], test_probability),
            "labelled_samples_per_split": {name: len(idx) for name, idx in labelled.items()},
            "supervised_fit": "train only; each subject has equal total sample weight; no validation refit",
            "test_predictions": [{"subject_id": subject, "label": int(y), "probability": float(p)}
                                 for subject, y, p in zip(test_subjects, test_y, test_p)]}


def evaluate_microbiome(data, run, seed=42):
    seed_everything(seed)
    data, run = Path(data), Path(run)
    manifest = read_json(run / "manifest.json")
    for name, checksum in manifest["data_sha256"].items():
        if file_sha256(data / name) != checksum:
            raise ValueError(f"{name} changed after pretraining. Freeze data and split, then retrain before evaluation.")
    if file_sha256(run / "preprocessor.json") != manifest["preprocessor_sha256"]:
        raise ValueError("Fitted preprocessing changed after pretraining.")
    cohort = load_cohort(data)
    require_resolved_subject_ids(cohort.metadata)
    split = cohort.indices()
    preprocessor = Preprocessor.load(run / "preprocessor.json")
    values, alignment = preprocessor.transform(cohort.values, cohort.taxa)
    encoder = load_encoder(run / "encoder.pt")
    random_encoder = load_encoder(run / "random_encoder.pt")
    features = {"log_abundance_logistic_baseline": values,
                "random_encoder_linear_probe": encode_samples(random_encoder, values),
                "pretrained_encoder_linear_probe": encode_samples(encoder, values)}
    models = {}
    prediction_rows = []
    for name, representation in features.items():
        result = fit_probe(representation, cohort, split)
        prediction_rows.extend([[name, row["subject_id"], row["label"], row["probability"]] for row in result.pop("test_predictions")])
        models[name] = result
    test_values = torch.from_numpy(values[split["test"]])
    test_mask = make_mask(len(test_values), len(preprocessor.taxa), manifest["mask_rate"], torch.Generator().manual_seed(7302))
    report = {"kind": "frozen_study_holdout_evaluation", "source_kind": manifest["source_kind"],
              "primary_unit": "subject; repeated visit probabilities averaged", "split": cohort.split,
              "selection": "encoder checkpoint by validation masked MSE; each probe C by validation subject AUROC; fixed probability threshold 0.5",
              "test_used_for_selection": False, "models": models, "alignment": alignment,
              "test_reconstruction": reconstruction_metrics(encoder, test_values, test_mask),
              "interpretation": ["Synthetic results validate the pipeline, not real disease prediction.",
                                 "A frozen encoder probe tests whether the learned representation adds value to a simple baseline.",
                                 "The random encoder control separates the contribution of pretraining from the architecture.",
                                 "No model is assumed to outperform another; negative transfer is a valid outcome.",
                                 "One held-out study is a demonstration. Research claims need multiple held-out cohorts, seeds, covariate checks and uncertainty across studies.",
                                 "Do not change decisions after viewing test metrics; reserve a new test cohort for subsequent tuning."]}
    write_json(run / "evaluation_report.json", report)
    write_csv(run / "test_subject_predictions.csv", ["model", "subject_id", "label", "probability"], prediction_rows)
    return report
