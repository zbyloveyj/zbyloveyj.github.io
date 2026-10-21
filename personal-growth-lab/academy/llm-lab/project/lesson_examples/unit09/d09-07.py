# 让回答有出处：证据检索与 RAG / 把检索质量与回答质量分开计分
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

def retrieval_scores(ranked, relevant, k):
    if k < 1:
        raise ValueError("k must be positive")
    if len(set(ranked)) != len(ranked):
        raise ValueError("duplicate evidence IDs")
    relevant = set(relevant)
    top = ranked[:k]
    hits = [x in relevant for x in top]
    precision = sum(hits) / k
    recall = sum(hits) / len(relevant) if relevant else None
    rr = next((1.0/(i+1) for i, x in enumerate(top) if x in relevant), 0.0)
    return {"precision_at_k": precision, "recall_at_k": recall, "reciprocal_rank_at_k": rr}
print(retrieval_scores(["A", "C", "B"], {"B", "C", "D"}, 3))
assert retrieval_scores(["A"], {"A"}, 3)["precision_at_k"] == 1/3
# 完整列表示例：precision=2/3，recall=2/3，RR@3=1/2；跨题平均RR得到MRR。
