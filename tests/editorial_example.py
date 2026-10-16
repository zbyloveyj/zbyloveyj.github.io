#!/usr/bin/env python3
"""Verify the teaching manuscript's numerical claims against its synthetic CSV."""
from pathlib import Path
import csv
from statistics import mean, stdev

root = Path("graduate-research-handbook")
sample = root / "downloads" / "synthetic-demo.csv"
paper = (root / "downloads" / "example-paper-synthetic.md").read_text(encoding="utf-8")
page = (root / "resources.html").read_text(encoding="utf-8")

with sample.open(encoding="utf-8", newline="") as handle:
    records = list(csv.DictReader(handle))
assert len(records) == 64
assert len({r["id"] for r in records}) == 64

groups = {
    n: [float(r["score"]) for r in records if int(r["group"]) == n]
    for n in (0, 1)
}
assert all(len(v) == 32 for v in groups.values())
assert round(mean(groups[0]), 2) == 42.20
assert round(mean(groups[1]), 2) == 45.59
assert round(stdev(groups[0]), 2) == 3.12
assert round(stdev(groups[1]), 2) == 3.26
assert round(mean(groups[1]) - mean(groups[0]), 2) == 3.39

for value in ("42.20", "45.59", "3.39", "2.05", "1.14", "2.95"):
    assert value in paper, f"Teaching manuscript missing verified numerical value {value}"
assert "完全模拟" in paper and "不能" in paper
assert 'href="downloads/example-paper-synthetic.md"' in page
assert paper.count("~~~") % 2 == 0
print("PASS: example-paper data summaries, limitations and download link")
