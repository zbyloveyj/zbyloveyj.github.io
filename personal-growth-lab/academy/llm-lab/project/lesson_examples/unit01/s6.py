# 先把问题说清，再让第一个模型动起来 / 从一次手算开始理解自动求导
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
w = torch.tensor(1.0, requires_grad=True)
b = torch.tensor(0.0, requires_grad=True)
loss = (w * 2.0 + b - 5.0).square()
loss.backward()
assert w.grad.item() == -12.0
assert b.grad.item() == -6.0
with torch.no_grad():
    w -= 0.01 * w.grad
    b -= 0.01 * b.grad
print(float((w * 2.0 + b - 5.0).square().detach()))
