#!/usr/bin/env python3
"""Static smoke tests for the public graduate research handbook."""
from pathlib import Path
from html.parser import HTMLParser
import csv
import json
import re
import subprocess
import sys
from urllib.parse import urlsplit

ROOT = Path("graduate-research-handbook")
data = json.loads((ROOT / "data/catalog.json").read_text(encoding="utf-8"))
volumes, chapters = data["volumes"], data["chapters"]
assert len(volumes) == 9, "Expected nine book parts"
assert len(chapters) == 50, "Expected fifty chapters"
assert [x["n"] for x in chapters] == list(range(1, 51))
assert all(x["ready"] for x in chapters), "Only release completed chapters"

for item in chapters:
    p = ROOT / "content" / f'{item["n"]:02d}.md'
    assert p.is_file(), f"Missing chapter: {p}"
    md = p.read_text(encoding="utf-8")
    assert len(md) > 2200, f"Insufficient chapter text: {p}"
    assert re.match(r"^# 第(?:\d+|[零一二三四五六七八九十]+)章", md), f"Bad chapter heading: {p}"
    assert len(re.findall(r"^## ", md, flags=re.M)) >= 5, f"Missing main sections: {p}"

required = [
    "index.html", "preface.html", "appendices.html", "search.html", "resources.html", "library.html", "workshop.html", "print-book.html", "plan.html",
    "assets/app.js", "assets/style.css", "assets/search.js", "assets/search.css", "assets/edition.js",
    "assets/resources.css", "assets/library.js", "assets/workshop.js", "assets/print-book.js",
    "assets/library.css", "assets/workshop.css", "assets/print-book.css",
    "content/00-preface.md", "content/appendices.md", "downloads/complete-manuscript.md",
    "data/search-index.json", "data/edition.json", "downloads/complete-book.pdf", "downloads/complete-book.docx"
]
for relative in required:
    assert (ROOT / relative).is_file(), f"Missing published file: {relative}"

html = (ROOT / "index.html").read_text(encoding="utf-8")
embedded = re.search(r'<script id="catalog-data" type="application/json">([\s\S]*?)</script>', html)
assert embedded, "Reader missing embedded navigation catalog"
site_data = json.loads(embedded.group(1))
assert site_data["chapters"] == chapters, "Embedded chapter flags or titles differ from source"
for phrase in ['id="reader-mobile-toolbar"', 'href="resources.html"', 'href="search.html"', 'href="library.html"', 'href="print-book.html"', 'href="workshop.html"']:
    assert phrase in html, f"Reading UI missing {phrase}"
assert "50</strong><small>完整章节" in html, "Wrong published chapter count"
assert "04</strong><small>实用附录" in html, "Wrong appendix count"
assert "全书初稿" not in html, "Obsolete draft label remains"

index = json.loads((ROOT / "data/search-index.json").read_text(encoding="utf-8"))
assert len(index) == 50, "Full-text index must cover every chapter"
for item, search in zip(chapters, index):
    assert item["n"] == search["n"], f"Index chapter mismatch at {item['n']}"
    assert item["title"] == search["title"], f"Index title mismatch at {item['n']}"
    assert len(search["heads"]) >= 5, f"Missing search headings: {item['n']}"
    assert len(search["text"]) >= 350, f"Missing indexed body: {item['n']}"

book = (ROOT / "downloads/complete-manuscript.md").read_text(encoding="utf-8")
assert len(book) > 120000, "Combined manuscript incomplete"
assert len(re.findall(r"^# 第(?:\d+|[零一二三四五六七八九十]+)章", book, re.M)) == 50
for phrase in ["三遍阅读，逐步进入证据", "怎样把统计结果写清楚", "把标题写具体", "逐项处理审稿意见", "从证据整理转入正文写作", "独立判断在具体工作中形成"]:
    assert phrase in book, f"Offline edition missing revised section: {phrase}"
for tag in ["# 附录A", "# 附录B", "# 附录C", "# 附录D"]:
    assert tag in book, f"Missing appendix: {tag}"

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs = []
    def handle_starttag(self, tag, attrs):
        if tag == "a":
            href = dict(attrs).get("href", "")
            if href:
                self.hrefs.append(href)

page = Links()
page.feed((ROOT / "resources.html").read_text(encoding="utf-8"))
downloads = set(urlsplit(link).path for link in page.hrefs if link.startswith("downloads/"))
assert len(downloads) >= 23, f"Expected full resource collection: got {len(downloads)}"
assert not any("ai-verification-log" in link for link in downloads), "Removed process-log link remains"
for link in downloads:
    assert (ROOT / link).is_file(), f"Broken resource link: {link}"

sample = ROOT / "downloads/synthetic-demo.csv"
with sample.open(newline="", encoding="utf-8") as f:
    records = list(csv.DictReader(f))
assert len(records) == 64 and len(set(r["id"] for r in records)) == 64
assert {r["group"] for r in records} == {"0", "1"}
assert {r["batch"] for r in records} == {"A", "B"}
p = ROOT / "downloads/analyze-demo.py"
run = subprocess.run([sys.executable, str(p)], capture_output=True, text=True, check=True)
assert "Total rows: 64" in run.stdout, "Demo analysis failed"

reader_js=(ROOT/"assets/app.js").read_text(encoding="utf-8")
assert not re.search(r'(?<!\$)\$\("#text-body[^"]*"\)\.(?:map|find)\(', reader_js), "querySelector/array-method regression"
print_js=(ROOT/"assets/print-book.js").read_text(encoding="utf-8")
assert 'window.print()' in print_js and 'chapter' in print_js, "print edition missing functionality"
library_html=(ROOT/"library.html").read_text(encoding="utf-8")
assert '"gradbook-reader-backup"' in (ROOT/"assets/library.js").read_text(encoding="utf-8"), "personal backup invalid"
assert library_html.count('"n":')>=50, "library catalog incomplete"
plan_html=(ROOT/"plan.html").read_text(encoding="utf-8")
assert plan_html.count('"tasks":')==12, "12-week curriculum incomplete"

print("PASS: nine parts, fifty revised chapters, four appendices, full-text index and synchronized manuscript")
print("PASS: resources page, download links, simulated dataset and executable Python demo")
