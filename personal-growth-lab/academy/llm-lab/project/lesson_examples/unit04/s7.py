# 注意力：让每个位置只读取允许的信息 / 实现单头注意力
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import math
import torch
def attention(q, k, v):
    T, d = q.shape[-2:]
    scores = q @ k.transpose(-2, -1) / math.sqrt(d)
    forbidden = torch.triu(torch.ones(T, T, dtype=torch.bool, device=q.device), diagonal=1)
    a = torch.softmax(scores.masked_fill(forbidden, float('-inf')), dim=-1)
    return a @ v, a
torch.manual_seed(7)
q = torch.randn(2, 4, 6); k = torch.randn(2, 4, 6); v = torch.randn(2, 4, 5)
out, a = attention(q, k, v)
assert out.shape == (2, 4, 5)
assert torch.allclose(a.sum(-1), torch.ones(2, 4))
assert torch.count_nonzero(torch.triu(a, diagonal=1)) == 0
