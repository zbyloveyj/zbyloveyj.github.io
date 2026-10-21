# 数学底座：从矩阵低秩到概率目标 / 熵、交叉熵与KL的关系
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
p = torch.tensor([0.6, 0.3, 0.1], dtype=torch.float64)
q = torch.tensor([0.4, 0.4, 0.2], dtype=torch.float64)
H = -(p * p.log()).sum()
CE = -(p * q.log()).sum()
KL = (p * (p.log() - q.log())).sum()
reverse = (q * (q.log() - p.log())).sum()
assert torch.allclose(CE, H + KL)
assert KL >= 0
print(float(H), float(CE), float(KL), float(reverse))
