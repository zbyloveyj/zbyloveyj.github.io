# 注意力：让每个位置只读取允许的信息 / 用未来扰动，检验真正的因果性
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
import math
def attention(q, k, v):
    scores = q @ k.transpose(-2, -1) / math.sqrt(q.shape[-1])
    allowed = torch.ones(q.shape[-2], k.shape[-2], dtype=torch.bool).tril()
    weights = scores.masked_fill(~allowed, float("-inf")).softmax(dim=-1)
    return weights @ v, weights

torch.manual_seed(11)
x = torch.randn(1, 4, 6)
x2 = x.clone(); x2[:, 2:] += 100
Wq, Wk, Wv = [torch.randn(6, 6) for _ in range(3)]
def forward(z):
    return attention(z @ Wq, z @ Wk, z @ Wv)[0]
y1, y2 = forward(x), forward(x2)
assert torch.allclose(y1[:, :2], y2[:, :2], atol=1e-6)
print('future perturbation passed')
