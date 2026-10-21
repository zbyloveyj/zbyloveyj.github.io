# 现代架构拆解：位置、归一化、门控与稀疏专家 / RMSNorm与LayerNorm，少了哪一步
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
import torch.nn.functional as F
x = torch.tensor([1., 2., 4.], dtype=torch.float64)
def rms(v, eps=1e-8):
    return v / torch.sqrt(v.square().mean() + eps)
a, b = rms(x), F.layer_norm(x, (3,))
assert abs(float(b.mean())) < 1e-12
assert abs(float(a.mean())) > 0.1
assert torch.allclose(rms(3*x), a, atol=1e-8)
print(a, b)
