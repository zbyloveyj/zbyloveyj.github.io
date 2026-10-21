# 现代架构拆解：位置、归一化、门控与稀疏专家 / RoPE：相对位置怎样进入点积
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import math, torch
def R(angle):
    return torch.tensor([[math.cos(angle), -math.sin(angle)],
                         [math.sin(angle), math.cos(angle)]], dtype=torch.float64)
q = torch.tensor([1.2, -0.3], dtype=torch.float64)
k = torch.tensor([0.4, 0.8], dtype=torch.float64)
m, n, theta = 3, 8, 0.2
lhs = (R(m*theta) @ q) @ (R(n*theta) @ k)
rhs = q @ (R((n-m)*theta) @ k)
assert torch.allclose(lhs, rhs, atol=1e-12)
assert torch.allclose(torch.linalg.vector_norm(R(m*theta) @ q), torch.linalg.vector_norm(q))
print(float(lhs), float(rhs))
