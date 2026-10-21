# 深入 RAG：从找到材料到可核验的证据系统 / 混合检索用排名融合，避免直接相加不同尺度
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import numpy as np
# 三维向量为手工教学夹具，不是下载或训练出的语义 embedding。
ids = ["A", "B", "C", "D"]
vectors = np.array([[.8,.2,0], [.1,.9,.1], [0,.1,.9], [.2,.75,.1]])
query = np.array([0., 1., 0.])
norms = np.linalg.norm(vectors, axis=1)
if np.any(norms == 0) or np.linalg.norm(query) == 0:
    raise ValueError("cosine similarity needs nonzero vectors")
cosine = (vectors / norms[:, None]) @ (query / np.linalg.norm(query))
dense = sorted(ids, key=lambda key: (-cosine[ids.index(key)], key))[:3]
lexical = ["B", "A", "D"]
def rrf(rankings, constant=60):
    if constant < 0:
        raise ValueError("constant must be nonnegative")
    result = {}
    for ranking in rankings:
        if len(ranking) != len(set(ranking)):
            raise ValueError("one ranking must not repeat an ID")
        for rank, key in enumerate(ranking, start=1):
            result[key] = result.get(key, 0.0) + 1 / (constant + rank)
    return sorted(result.items(), key=lambda pair: (-pair[1], pair[0]))
fused = rrf([lexical, dense])
print({"cosine": dict(zip(ids, cosine.round(4))), "dense": dense, "rrf": fused})
assert dense[0] == fused[0][0] == "B"
assert np.isclose(dict(fused)["B"], 2 / 61)
assert set(dict(fused)) == set(lexical) | set(dense)
