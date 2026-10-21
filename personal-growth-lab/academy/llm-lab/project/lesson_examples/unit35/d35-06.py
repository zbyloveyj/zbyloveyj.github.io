# 把检索向量训练出来：双塔、负例与索引验收 / 精确检索提供参照，近似索引提供资源取舍
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import numpy as np
rng = np.random.default_rng(35)
vectors = rng.normal(size=(12, 5))
vectors /= np.linalg.norm(vectors, axis=1, keepdims=True)
query = vectors[0].copy()
exact = np.argsort(-(vectors @ query), kind="stable")[:3]
assert exact[0] == 0
# 人为省略最优项，模拟候选阶段漏召回；不是实现HNSW或Faiss。
candidates = np.array([i for i in range(12) if i != 0])
reranked = candidates[np.argsort(-(vectors[candidates] @ query), kind="stable")[:3]]
index_recall = len(set(exact) & set(reranked)) / len(exact)
assert np.isclose(index_recall, 2/3)
# 人工相关性标签是另一个对象，不能以向量近邻当作真实证据标签。
relevant = {int(exact[2]), int(exact[1])}
task_recall = len(relevant & set(reranked)) / len(relevant)
assert task_recall == 1.0
print({"exact_top3": exact.tolist(), "candidate_top3": reranked.tolist(),
       "index_recall_at_3": index_recall, "task_recall_at_3": task_recall})

