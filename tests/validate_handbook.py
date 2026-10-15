#!/usr/bin/env python3
"""Validate the 50-chapter handbook source before GitHub Pages publication."""
from pathlib import Path
import json, re
root=Path("graduate-research-handbook")
data=json.loads((root/"data/catalog.json").read_text(encoding="utf-8"))
assert len(data["volumes"])==9, "must have 9 parts"
chapters=data["chapters"]
assert len(chapters)==50 and [x["n"] for x in chapters]==list(range(1,51)), "must have 50 sequential chapters"
assert all(x["ready"] for x in chapters), "cannot claim release with unpublished chapters"
for item in chapters:
    path=root/"content"/f'{item["n"]:02d}.md'
    assert path.is_file(), f"missing {path}"
    txt=path.read_text(encoding="utf-8")
    assert len(txt)>900, f"chapter too short: {path}"
    n = item["n"]
    digits = "零一二三四五六七八九"
    tens, units = divmod(n, 10)
    if n == 10:
        cn = "十"
    elif n < 10:
        cn = digits[n]
    elif n < 20:
        cn = "十" + (digits[units] if units else "")
    else:
        cn = digits[tens] + "十" + (digits[units] if units else "")
    assert txt.startswith(f'# 第{n}章') or txt.startswith(f'# 第{cn}章'), f"wrong heading {path}"
    assert len(re.findall(r"^## ",txt,re.M))>=5, f"missing sections {path}"
for name in ["index.html","preface.html","assets/app.js","assets/style.css","content/00-preface.md"]:
    assert (root/name).is_file(), f"missing site asset {name}"
html=(root/"index.html").read_text(encoding="utf-8")
assert '"ready":true' in html, "embedded catalog has not been activated"
assert "50</strong><small>已开放章节" in html, "public chapter count mismatched"
print("PASS: handbook website has 9 parts and 50 substantive chapter drafts.")
