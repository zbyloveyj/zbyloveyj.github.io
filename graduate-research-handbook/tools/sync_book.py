#!/usr/bin/env python3
"""Build derived reader/search/volume/manuscript files from one canonical source.

Canonical material:
  content/00-preface.md, content/01.md ... content/50.md, content/appendices.md
This script never invents missing chapter prose or silently discards appendices.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import re
import sys

ROOT=Path(__file__).resolve().parents[1]
CATALOG=json.loads((ROOT/"data"/"catalog.json").read_text(encoding="utf-8"))
CHAPTERS=CATALOG["chapters"]
NAMES="一二三四五六七八九"
assert len(CHAPTERS)==50 and len(CATALOG["volumes"])==9
assert [x["n"] for x in CHAPTERS]==list(range(1,51))
assert all(x["ready"] for x in CHAPTERS)


def read(rel: str)->str:
    return (ROOT/rel).read_text(encoding="utf-8").strip()


def plain(md: str)->str:
    text=re.sub(r"(?ms)^~~~.*?^~~~", " ", md)
    text=re.sub(r"(?ms)^" + "\x60\x60\x60" + r".*?^" + "\x60\x60\x60", " ", text)
    text=re.sub(r"!\[([^\]]*)\]\([^)]+\)",r"\1",text)
    text=re.sub(r"\[([^\]]+)\]\([^)]+\)",r"\1",text)
    text=re.sub(r"(?m)^#{1,6}\s*", "", text)
    text=re.sub(r"[\x60*|_]+", " ", text)
    return re.sub(r"\s+"," ",text).strip()


def canonical_files()->dict[str,str]:
    preface=read("content/00-preface.md")
    appendices=read("content/appendices.md")
    assert appendices.count("# 附录")>=4, "Four source appendices required"
    groups={i:[] for i in range(1,10)}
    local_indexes={i:[] for i in range(1,10)}
    global_index=[]
    for item in CHAPTERS:
        n,p=item["n"],item["part"]
        md=read(f"content/{n:02d}.md")
        if not re.match(r"^# 第(?:\d+|[零一二三四五六七八九十]+)章",md):
            raise ValueError(f"Chapter {n} has no expected H1 heading")
        if len(md)<2200:
            raise ValueError(f"Chapter {n} is too short to publish without review")
        heads=re.findall(r"(?m)^## (.+)$",md)
        if len(heads)<5:raise ValueError(f"Chapter {n} has too few sections")
        if md.count("~~~")%2 or md.count("\x60\x60\x60")%2:
            raise ValueError(f"Unbalanced code fences in chapter {n}")
        entry={"n":n,"part":p,"title":item["title"],
               "heads":heads,"text":plain(md)[:16000]}
        groups[p].append(md)
        local_indexes[p].append({"n":n,"title":item["title"],"heads":heads,
                                  "text":entry["text"]})
        global_index.append(entry)
    output={}
    book=[
        "# 从读研到做研究",
        "作者：一心问道",
        "九编五十章 · 内容深度修订版 V2.2 · 2026年10月",
        "> 本书为持续编校中的系统教学书稿；并非出版社正式出版终审版。"
        "涉及招生、科研伦理、投稿及学位规则的时效性信息，"
        "应以对应年度与机构的正式文件为准。",
        "---",
        preface,
        "---"
    ]
    for part in range(1,10):
        part_num=f"{part:02d}"
        md="\n\n---\n\n".join(groups[part])+"\n"
        output[f"downloads/volume-{part_num}.md"]=md
        output[f"data/search-part-{part_num}.json"]=json.dumps(
            local_indexes[part],ensure_ascii=False,indent=2)+"\n"
        book.append(f"# 第{NAMES[part-1]}编　{CATALOG['volumes'][part-1]}")
        book.append(md.strip())
        book.append("---")
    book.append(appendices)
    output["downloads/complete-manuscript.md"]="\n\n".join(book)+"\n"
    output["data/search-index.json"]=json.dumps(global_index,ensure_ascii=False,indent=2)+"\n"
    assert len(re.findall(r"(?m)^# 第(?:\d+|[零一二三四五六七八九十]+)章",
                          output["downloads/complete-manuscript.md"]))==50
    for tag in ("# 附录A","# 附录B","# 附录C","# 附录D"):
        if tag not in output["downloads/complete-manuscript.md"]:
            raise ValueError(f"Missing {tag}")
    return output


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--check",action="store_true",
                        help="Exit with error when generated files differ from canonical sources")
    args=parser.parse_args()
    files=canonical_files()
    changed=[]
    for rel,content in files.items():
        dest=ROOT/rel
        before=dest.read_text(encoding="utf-8") if dest.exists() else None
        if before!=content:
            changed.append(rel)
            if not args.check:
                dest.parent.mkdir(parents=True,exist_ok=True)
                dest.write_text(content,encoding="utf-8")
    print(f"Source chapters: {len(CHAPTERS)}; derived files: {len(files)}; updated: {len(changed)}")
    for name in changed:print("UPDATE:",name)
    if args.check and changed:
        print("ERROR: derived files not synchronized; run tools/sync_book.py")
        return 1
    print("PASS: nine parts, fifty chapters, four appendices and two search-index layers")
    return 0


if __name__=="__main__":
    sys.exit(main())
