# 深入 RAG：从找到材料到可核验的证据系统 / BM25：词频饱和、长度归一与逆文档频率
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import math, re
from collections import Counter
# 原创合成短句，只用于检索机制；不代表真实论文结论。
docs = {
    "A": "relative abundance taxon sample species",
    "B": "external validation study subject split",
    "C": "dna sequence base token model",
    "D": "study study internal validation no external cohort",
}
tokenize = lambda text: re.findall(r"[a-z0-9_]+", text.lower())
counts = {key: Counter(tokenize(text)) for key, text in docs.items()}
lengths = {key: sum(row.values()) for key, row in counts.items()}
avg_length = sum(lengths.values()) / len(lengths)
def bm25(query, k1=1.2, b=0.75):
    if k1 <= 0 or not 0 <= b <= 1:
        raise ValueError("invalid BM25 parameters")
    scores = dict.fromkeys(docs, 0.0)
    for term in sorted(set(tokenize(query))):
        df = sum(term in row for row in counts.values())
        idf = math.log1p((len(docs) - df + 0.5) / (df + 0.5))
        for key, row in counts.items():
            f = row[term]
            norm = k1 * (1 - b + b * lengths[key] / avg_length)
            scores[key] += idf * f * (k1 + 1) / (f + norm)
    return sorted(scores.items(), key=lambda pair: (-pair[1], pair[0]))
ranked = bm25("subject external validation")
print(ranked)
assert ranked[0][0] == "B"
assert bm25("subject subject") == bm25("subject")
assert all(score == 0 for _, score in bm25("unseenword"))
