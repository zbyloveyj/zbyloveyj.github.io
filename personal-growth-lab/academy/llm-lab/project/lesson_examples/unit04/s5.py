# 注意力：让每个位置只读取允许的信息 / 稳定 softmax 与负无穷遮罩
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
scores = torch.tensor([[1000., 1001., 999.]])
shifted = scores - scores.max(dim=-1, keepdim=True).values
manual = shifted.exp() / shifted.exp().sum(dim=-1, keepdim=True)
assert torch.allclose(manual, torch.softmax(scores, dim=-1))
forbidden = torch.tensor([[False, True, False]])
a = torch.softmax(scores.masked_fill(forbidden, float('-inf')), dim=-1)
assert a[0, 1].item() == 0.0
assert torch.isfinite(a).all()
