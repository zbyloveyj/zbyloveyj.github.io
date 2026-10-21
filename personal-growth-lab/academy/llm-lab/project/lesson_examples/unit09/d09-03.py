# 让回答有出处：证据检索与 RAG / 分块：保证事实和限定条件留在一起
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

def chunks(text, size=80, overlap=20):
    if not 0 <= overlap < size:
        raise ValueError("overlap must be smaller than size")
    step = size - overlap
    return [{"start": i, "end": min(i + size, len(text)), "text": text[i:i+size]}
            for i in range(0, len(text), step)]
text = "研究仅纳入成年粪便样本。模型在同一研究内交叉验证；尚未在独立研究验证。" * 3
for row in chunks(text):
    print(row)
assert all(row["text"] == text[row["start"]:row["end"]] for row in chunks(text))
