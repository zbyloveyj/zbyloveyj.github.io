# 词向量与位置：沿形状走完一次前向传播 / 查表与 one-hot 乘法为何等价
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
import torch.nn.functional as F
E = torch.arange(18, dtype=torch.float32).reshape(6, 3)
ids = torch.tensor([[2, 1, 2], [0, 5, 3]])
lookup = E[ids]
onehot = F.one_hot(ids, num_classes=6).float()
assert lookup.shape == (2, 3, 3)
assert torch.equal(lookup, onehot @ E)
assert lookup[0, 0].tolist() == [6., 7., 8.]
print(lookup)
