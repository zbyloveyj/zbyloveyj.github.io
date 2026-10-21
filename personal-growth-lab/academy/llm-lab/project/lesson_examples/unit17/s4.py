# 现代架构拆解：位置、归一化、门控与稀疏专家 / SwiGLU：乘法门控如何改变MLP
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
import torch.nn.functional as F
torch.manual_seed(17)
D, H = 12, 32
x = torch.randn(2, 3, D)
Wg, Wu, Wd = torch.randn(D,H), torch.randn(D,H), torch.randn(H,D)
y = (F.silu(x @ Wg) * (x @ Wu)) @ Wd
assert y.shape == x.shape
assert 3*D*H == 2*D*(4*D)
print(y.shape, 'matched weights:', 3*D*H)
