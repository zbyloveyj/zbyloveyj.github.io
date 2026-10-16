#!/usr/bin/env python3
"""Source-of-truth and editorial consistency checks for the handbook."""
from pathlib import Path
import json
import re

ROOT = Path("graduate-research-handbook")
catalog = json.loads((ROOT / "data/catalog.json").read_text(encoding="utf-8"))
chapters = catalog["chapters"]
assert len(chapters) == 50 and len(catalog["volumes"]) == 9

book = (ROOT / "downloads/complete-manuscript.md").read_text(encoding="utf-8")
global_index = json.loads((ROOT / "data/search-index.json").read_text(encoding="utf-8"))
assert len(global_index) == 50
assert len(re.findall(r"^# 第(?:\d+|[零一二三四五六七八九十]+)章", book, re.M)) == 50

short_sections = 0
short_chapters = []
rewritten = [13, 19, 21, 23, 25, 28, 41, 47]
part_indexes = {}
part_volumes = {}
for part in range(1, 10):
    p = f"{part:02d}"
    part_indexes[part] = json.loads((ROOT / "data" / f"search-part-{p}.json").read_text(encoding="utf-8"))
    part_volumes[part] = (ROOT / "downloads" / f"volume-{p}.md").read_text(encoding="utf-8")
    expected = sum(item["part"] == part for item in chapters)
    assert len(part_indexes[part]) == expected
    assert len(re.findall(r"^# 第(?:\d+|[零一二三四五六七八九十]+)章", part_volumes[part], re.M)) == expected

for item in chapters:
    n, part = item["n"], item["part"]
    source = (ROOT / "content" / f"{n:02d}.md").read_text(encoding="utf-8").strip()
    assert len(source) > 2200, f"Chapter {n} is unexpectedly short"
    assert source.startswith("# 第"), f"Chapter {n} lost its heading"
    assert source in part_volumes[part], f"Chapter {n} out of sync with volume {part}"
    assert source in book, f"Chapter {n} out of sync with combined manuscript"
    assert source.count("~~~") % 2 == 0, f"Chapter {n} has unbalanced code fences"
    sections = list(re.finditer(r"^## (.+)$", source, re.M))
    assert len(sections) >= 5, f"Chapter {n} missing sections"
    if len(source) < 4000:
        short_chapters.append(n)
    short_sections += sum(
        (sections[k+1].start() if k+1 < len(sections) else len(source)) - m.start() < 210
        for k, m in enumerate(sections)
    )
    heading_text = [match.group(1) for match in sections]
    local = next((x for x in part_indexes[part] if x["n"] == n), None)
    overall = global_index[n - 1]
    assert local, f"Local index missing chapter {n}"
    for name, obj in [("part index", local), ("full index", overall)]:
        assert obj["n"] == n and obj["title"] == item["title"], f"Chapter {n} {name} metadata drift"
        assert obj["heads"] == heading_text, f"Chapter {n} {name} heading drift"
        assert len(obj["text"]) > 250, f"Chapter {n} {name} missing body"

for n in rewritten:
    source = (ROOT / "content" / f"{n:02d}.md").read_text(encoding="utf-8")
    sections = list(re.finditer(r"^## (.+)$", source, re.M))
    assert len(sections) <= 10, f"Rewritten chapter {n} became fragmented again"
    assert all(
        ((sections[k+1].start() if k+1 < len(sections) else len(source)) - m.start()) >= 210
        for k, m in enumerate(sections)
    ), f"Rewritten chapter {n} contains a tiny section"

print(f"PASS: 50 chapters exactly match nine volumes, the full manuscript and two search indexes")
print(f"EDITORIAL METRICS: {len(book):,} source characters including markup")
print(f"EDITORIAL METRICS: {len(short_chapters)} chapters under 4,000 characters")
print(f"EDITORIAL METRICS: {short_sections} short H2 sections (<210 characters); editorial improvement remains necessary")
