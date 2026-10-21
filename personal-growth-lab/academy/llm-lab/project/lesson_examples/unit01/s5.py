# 先把问题说清，再让第一个模型动起来 / 张量形状，是理解模型最可靠的入口
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
x = torch.tensor([[1., 2., 3.], [4., 5., 6.]])
w = torch.tensor([[1., 0.], [0., 1.], [1., 1.]])
b = torch.tensor([0.5, -0.5])
y = x @ w + b
assert x.shape == (2, 3)
assert y.shape == (2, 2)
print(y)  # [[4.5, 4.5], [10.5, 10.5]]
