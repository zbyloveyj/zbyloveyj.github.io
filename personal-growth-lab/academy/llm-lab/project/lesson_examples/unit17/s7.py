# 现代架构拆解：位置、归一化、门控与稀疏专家 / MoE路由的一个可计算例子
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
route_logits = torch.tensor([[3.,0.,0.],[2.,1.,0.],[0.,3.,0.],[0.,0.,3.]])
probs = route_logits.softmax(-1)
chosen = probs.argmax(-1)
counts = torch.bincount(chosen, minlength=3)
assert counts.tolist() == [2,1,1]
assert counts.sum().item() == 4
print(chosen.tolist(), counts.tolist())
