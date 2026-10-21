# 现代架构拆解：位置、归一化、门控与稀疏专家 / SSM与Mamba：压缩历史的另一条路径
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
x = torch.tensor([1., 0., 2., 0.], dtype=torch.float64)
h = torch.zeros((), dtype=torch.float64)
states = []
for value in x:
    h = 0.8*h + value
    states.append(float(h))
weights = torch.tensor([0.8**(len(x)-1-t) for t in range(len(x))], dtype=x.dtype)
assert torch.allclose(h, (weights*x).sum())
print(states, 'final:', float(h))
