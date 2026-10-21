# 数学底座：从矩阵低秩到概率目标 / SVD、秩与低秩近似
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
W = torch.diag(torch.tensor([5., 2., 0.1], dtype=torch.float64))
U, S, Vh = torch.linalg.svd(W, full_matrices=False)
for r in [1, 2, 3]:
    Wr = (U[:, :r] * S[:r]) @ Vh[:r]
    error2 = (W - Wr).square().sum()
    assert torch.allclose(error2, S[r:].square().sum(), atol=1e-12)
    print(r, float(error2))
