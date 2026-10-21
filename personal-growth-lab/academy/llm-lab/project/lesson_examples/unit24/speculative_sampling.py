# 推理与部署：把模型放进资源与延迟预算 / 推测解码：用校正保持目标分布
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import numpy as np
p = np.array([0.1, 0.3, 0.6])
q = np.array([0.7, 0.1, 0.2])
assert np.all(p >= 0) and np.all(q >= 0)
assert np.isclose(p.sum(), 1) and np.isclose(q.sum(), 1)
accepted_mass = np.minimum(p, q)
reject_mass = 1 - accepted_mass.sum()
residual = np.maximum(p - q, 0)
assert np.isclose(residual.sum(), reject_mass)
output_mass = accepted_mass + reject_mass * residual / residual.sum()
assert np.allclose(output_mass, p)
assert not np.allclose(q, p)  # accepting every draft would be wrong
assert np.isclose(np.minimum(p, p).sum(), 1)  # p=q: no rejection
print({"accepted_probability": float(accepted_mass.sum()),
       "corrected_distribution": output_mass.tolist()})
