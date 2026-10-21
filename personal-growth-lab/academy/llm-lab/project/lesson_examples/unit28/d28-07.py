# DNA、蛋白与功能基础模型：从序列到群落 / 从基因表示到群落需要显式权重
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import numpy as np
E = np.array([[1.,0.], [0.,1.], [1.,1.], [np.nan,np.nan]])
A = np.array([[2.,0.,1.,1.], [0.,3.,1.,0.]])
def pool(abundance, embeddings):
    known = np.isfinite(embeddings).all(axis=1)
    mass = abundance[:, known].sum(axis=1)
    if np.any(mass <= 0):
        raise ValueError("No covered sequence representation for a sample")
    h = abundance[:, known] @ embeddings[known] / mass[:,None]
    coverage = mass / abundance.sum(axis=1)
    return h, coverage
h, coverage = pool(A,E)
order = np.array([2,0,3,1])
h2, c2 = pool(A[:,order],E[order])
assert np.allclose(h,h2) and np.allclose(coverage,c2)
assert np.allclose(coverage,[0.75,1.0])
print({"sample_embeddings": h.tolist(), "covered_mass_fraction": coverage.tolist()})
# 向量和权重全部人工构造，真实研究需验证基因映射与权重单位。
