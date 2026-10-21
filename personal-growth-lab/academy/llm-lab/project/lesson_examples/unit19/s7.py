# 规模化与系统：先算清账，再扩大模型 / FlashAttention：改变数据搬运，不改变目标
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
torch.manual_seed(19)
scores = torch.randn(9, dtype=torch.float64)*3
values = torch.randn(9, 4, dtype=torch.float64)
reference = scores.softmax(0) @ values
m = torch.tensor(float('-inf'), dtype=torch.float64)
l = torch.zeros((), dtype=torch.float64)
a = torch.zeros(4, dtype=torch.float64)
for start in range(0, 9, 3):
    z, v = scores[start:start+3], values[start:start+3]
    new_m = torch.maximum(m, z.max())
    old_scale = torch.exp(m-new_m)
    e = torch.exp(z-new_m)
    l = old_scale*l + e.sum()
    a = old_scale*a + e @ v
    m = new_m
online = a/l
assert torch.allclose(reference, online, atol=1e-12)
print('online softmax max error:', float((reference-online).abs().max()))
