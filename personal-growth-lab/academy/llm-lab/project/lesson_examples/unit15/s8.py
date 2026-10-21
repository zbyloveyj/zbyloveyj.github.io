# 数学底座：从矩阵低秩到概率目标 / 有限差分：用数值独立核对梯度
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
z = torch.tensor([0.2, -0.4, 0.7], dtype=torch.float64, requires_grad=True)
def f(v):
    return torch.logsumexp(v, dim=0) + 0.2 * v.square().sum()
f(z).backward()
h = 1e-5
num = torch.zeros_like(z)
with torch.no_grad():
    for i in range(z.numel()):
        e = torch.zeros_like(z); e[i] = h
        num[i] = (f(z + e) - f(z - e)) / (2*h)
assert torch.allclose(z.grad, num, atol=1e-8, rtol=1e-6)
print(z.grad, num)
