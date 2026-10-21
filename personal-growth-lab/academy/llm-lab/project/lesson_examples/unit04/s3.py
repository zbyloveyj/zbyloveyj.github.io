# 注意力：让每个位置只读取允许的信息 / 两位置例子：把一次注意力算完
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import math
import torch
q = torch.tensor([[1., 0.]])
k = torch.tensor([[1., 0.], [0., 1.]])
v = torch.tensor([[2., 0.], [0., 4.]])
a = torch.softmax(q @ k.T / math.sqrt(2), dim=-1)
out = a @ v
assert torch.allclose(a.sum(-1), torch.ones(1))
print(a, out)
