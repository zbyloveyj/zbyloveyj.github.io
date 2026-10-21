# 从文字到 token：把训练样本做对 / 输入和目标只差一格
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
z = torch.tensor([5, 8, 2, 9, 4], dtype=torch.long)
T = 4
x, y = z[:T], z[1:T+1]
assert x.tolist() == [5, 8, 2, 9]
assert y.tolist() == [8, 2, 9, 4]
assert torch.equal(x[1:], y[:-1])
print(list(zip(x.tolist(), y.tolist())))
