#!/usr/bin/env python3
"""Synthetic teaching data analysis using only Python 3 standard library."""
from pathlib import Path
from collections import defaultdict
from statistics import mean, stdev
import csv

HERE = Path(__file__).resolve().parent
DATA = HERE / "synthetic-demo.csv"
with DATA.open(encoding="utf-8-sig", newline="") as handle:
    rows = list(csv.DictReader(handle))
assert rows, "empty input"
ids = [r["id"] for r in rows]
assert len(ids) == len(set(ids)), "duplicate IDs"

groups = defaultdict(list)
batches = defaultdict(list)
for r in rows:
    assert r["group"] in {"0", "1"}
    assert r["batch"] in {"A", "B"}
    score = float(r["score"])
    groups[r["group"]].append(score)
    batches[r["batch"]].append(score)

print("This is synthetic instructional data only.")
print("Total rows:", len(rows))
for label, values in sorted(groups.items()):
    print("Group", label, "n =", len(values),
          "mean =", round(mean(values), 3),
          "SD =", round(stdev(values), 3))
print("Unadjusted mean difference (1 - 0):",
      round(mean(groups["1"]) - mean(groups["0"]), 3))
for batch, values in sorted(batches.items()):
    print("Batch", batch, "mean =", round(mean(values), 3))
print("Interpretation: descriptive comparison only, not causal evidence.")
