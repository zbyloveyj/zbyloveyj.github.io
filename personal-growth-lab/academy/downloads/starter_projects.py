#!/usr/bin/env python3
"""Growth Academy: six small, synthetic-data-only project starters.
Python 3.10+ recommended. Create a virtual environment before installing packages.
  python -m venv .venv
  # Activate with .venv\Scripts\activate on Windows or source .venv/bin/activate on Unix.
  python -m pip install numpy scikit-learn
  # Only the representation example additionally requires torch:
  python -m pip install torch
  python starter_projects.py --project qc
  python starter_projects.py --project baseline
  python starter_projects.py --project representation
  python starter_projects.py --project multimodal
  python starter_projects.py --project signal
  python starter_projects.py --project retrieval --query "training data"

These are teaching baselines, not clinically validated tools. No network calls,
no private data, and no claims about real participants. Console output is JSON.
For reproducing an experiment, record actual dependency versions with pip freeze.
"""
from __future__ import annotations
import argparse
import json
import math
import sys
from typing import Any


def qc() -> dict[str, Any]:
    rows = [
        {"sample_id": "S01", "value": "1.2"},
        {"sample_id": "S02", "value": ""},
        {"sample_id": "S01", "value": "-2"},
        {"sample_id": "S04", "value": "bad"},
        {"sample_id": "S05", "value": "nan"},
    ]
    seen: set[str] = set()
    issues = []
    for line, row in enumerate(rows, 2):
        sid = row["sample_id"]
        if not sid:
            issues.append({"line": line, "issue": "missing_id"})
        elif sid in seen:
            issues.append({"line": line, "issue": "duplicate_id"})
        seen.add(sid)
        raw = row["value"]
        if not raw:
            issues.append({"line": line, "issue": "missing_value"})
            continue
        try:
            value = float(raw)
        except ValueError:
            issues.append({"line": line, "issue": "non_numeric"})
            continue
        if not math.isfinite(value):
            issues.append({"line": line, "issue": "non_finite"})
        elif value < 0:
            issues.append({"line": line, "issue": "negative_value"})
    assert len(issues) == 5
    return {"synthetic": True, "rows": len(rows), "issues": issues,
            "next": "Add a CSV interface, schema validation, and tests. Do not overwrite input."}


def baseline() -> dict[str, Any]:
    import numpy as np
    from sklearn.datasets import make_classification
    from sklearn.dummy import DummyClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import balanced_accuracy_score, roc_auc_score
    from sklearn.model_selection import train_test_split
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    x, y = make_classification(n_samples=200, n_features=12, n_informative=4, random_state=42)
    train, test = train_test_split(np.arange(len(y)), test_size=.25, stratify=y, random_state=42)
    assert not set(train) & set(test)
    results = {}
    for name, model in [("dummy", DummyClassifier(strategy="prior")),
                        ("logistic", make_pipeline(StandardScaler(), LogisticRegression(max_iter=500)))]:
        model.fit(x[train], y[train])
        results[name] = {"balanced_accuracy": float(balanced_accuracy_score(y[test], model.predict(x[test]))),
                         "roc_auc": float(roc_auc_score(y[test], model.predict_proba(x[test])[:, 1]))}
    return {"synthetic": True, "n_train": len(train), "n_test": len(test), "metrics": results,
            "next": "Use development-only validation for tuning. This held-out test must not guide choices."}


def representation() -> dict[str, Any]:
    import numpy as np
    import torch
    from sklearn.datasets import make_classification
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler
    from sklearn.metrics import roc_auc_score
    torch.manual_seed(42)
    torch.set_num_threads(1)
    x, y = make_classification(n_samples=240, n_features=10, n_informative=4, random_state=42)
    dev, test = train_test_split(np.arange(len(y)), test_size=.2, stratify=y, random_state=42)
    train, val = train_test_split(dev, test_size=.25, stratify=y[dev], random_state=43)
    scaler = StandardScaler().fit(x[train])
    tx = torch.tensor(scaler.transform(x), dtype=torch.float32)
    ty = torch.tensor(y, dtype=torch.float32).reshape(-1, 1)
    model = torch.nn.Sequential(torch.nn.Linear(10, 8), torch.nn.ReLU(), torch.nn.Linear(8, 1))
    optimizer = torch.optim.Adam(model.parameters(), lr=.01)
    loss_fn = torch.nn.BCEWithLogitsLoss()
    log = []
    for epoch in range(60):
        model.train()
        optimizer.zero_grad()
        loss = loss_fn(model(tx[train]), ty[train])
        loss.backward()
        optimizer.step()
        if epoch % 10 == 0 or epoch == 59:
            model.eval()
            with torch.no_grad(): vl = float(loss_fn(model(tx[val]), ty[val]).item())
            log.append({"epoch": epoch + 1, "train_loss": float(loss.item()), "validation_loss": vl})
    model.eval()
    with torch.no_grad(): p = torch.sigmoid(model(tx[test])).numpy().ravel()
    return {"synthetic": True, "shape": list(x.shape), "log": log,
            "test_auc": float(roc_auc_score(y[test], p)),
            "next": "The epoch count is fixed in advance here. Extend with development-only model selection."}


def multimodal() -> dict[str, Any]:
    import numpy as np
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import roc_auc_score
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    rng = np.random.default_rng(42)
    a, b = rng.normal(size=(200, 5)), rng.normal(size=(200, 5))
    y = (a[:, 0] + b[:, 0] + rng.normal(size=200) > 0).astype(int)
    ids = np.arange(len(y))
    order = rng.permutation(ids)
    b_shuffled, shuffled_ids = b[order], ids[order]
    position = {int(sid): i for i, sid in enumerate(shuffled_ids)}
    b_aligned = b_shuffled[[position[int(sid)] for sid in ids]]
    assert np.allclose(b_aligned, b)
    train, test = train_test_split(ids, test_size=.25, stratify=y, random_state=42)
    metrics = {}
    for name, x in [("A", a), ("B", b_aligned), ("A+B", np.column_stack([a, b_aligned]))]:
        model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=500)).fit(x[train], y[train])
        metrics[name] = float(roc_auc_score(y[test], model.predict_proba(x[test])[:, 1]))
    return {"synthetic": True, "alignment_verified": True, "auc": metrics,
            "next": "Add shuffled-pair and missing-modality controls; compare on the same evaluation subjects."}


def signal() -> dict[str, Any]:
    import numpy as np
    fs = 200
    duration = 2.0
    time_axis = np.arange(int(fs * duration)) / fs
    rng = np.random.default_rng(42)
    clean = np.sin(2 * np.pi * 10 * time_axis)
    noisy = clean + .2 * rng.normal(size=len(time_axis))
    frequency = np.fft.rfftfreq(len(time_axis), d=1 / fs)
    # One-sided amplitude spectrum, with DC/Nyquist endpoints not doubled.
    amplitude = np.abs(np.fft.rfft(noisy)) / len(noisy)
    amplitude[1:-1] *= 2
    peak = float(frequency[np.argmax(amplitude[1:]) + 1])
    assert peak == 10.0
    return {"synthetic": True, "sample_rate_hz": fs, "duration_s": duration,
            "signal_unit": "arbitrary", "peak_hz": peak,
            "frequency_hz": frequency.tolist(), "amplitude": amplitude.tolist(),
            "next": "Compare windows and noise. This synthetic peak is not evidence of a cognitive state."}


def retrieval(query: str) -> dict[str, Any]:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    corpus = [
        ("note-01", "Preprocessing parameters are fitted on training data, never on the test data."),
        ("note-02", "A research question should specify the population, measurements, and comparison."),
        ("note-03", "A writing draft becomes clearer when each paragraph serves one main purpose."),
        ("note-04", "A synthetic signal can illustrate the relationship between sampling rate and frequency."),
        ("note-05", "Microbiome composition and function answer different biological questions."),
    ]
    vec = TfidfVectorizer(stop_words="english")
    matrix = vec.fit_transform([text for _, text in corpus])
    scores = cosine_similarity(vec.transform([query]), matrix).ravel()
    ranked = sorted(range(len(corpus)), key=lambda i: (-scores[i], i))[:3]
    matches = [{"source_id": corpus[i][0], "text": corpus[i][1], "score": float(scores[i])}
               for i in ranked if scores[i] > 0]
    return {"query": query, "matches": matches, "generated_answer": False,
            "note": "Original teaching notes only. Lexical matches are not a scientific correctness score."}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", required=True, choices=["qc", "baseline", "representation", "multimodal", "signal", "retrieval"])
    parser.add_argument("--query", default="training data")
    args = parser.parse_args()
    try:
        result = retrieval(args.query) if args.project == "retrieval" else globals()[args.project]()
    except ImportError as exc:
        print(f"Missing dependency: {exc}. Read the installation instructions at the top of this file.", file=sys.stderr)
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
