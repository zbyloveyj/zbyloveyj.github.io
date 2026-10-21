# 真实菌群数据工程：版本、组合性与测量边界 / CLR与ILR：转换的是相对关系
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import numpy as np
x = np.array([0.2, 0.3, 0.5])
V = np.array([[1/np.sqrt(2), 1/np.sqrt(6)],
              [-1/np.sqrt(2), 1/np.sqrt(6)], [0, -2/np.sqrt(6)]])
def clr(a):
    a = np.asarray(a, float)
    if np.any(a <= 0):
        raise ValueError("CLR requires positive parts")
    loga = np.log(a)
    return loga - loga.mean(axis=-1, keepdims=True)
z = clr(x); u = z @ V
assert np.allclose(V.T @ V, np.eye(2))
assert np.allclose(V.T @ np.ones(3), 0)
assert np.allclose(u @ V.T, z)
assert np.allclose(clr(17*x), z)
print({"CLR": z.tolist(), "ILR": u.tolist()})
zero_example = np.array([0.0, 0.25, 0.75])
for epsilon in [1e-6, 1e-3]:
    closed = (zero_example + epsilon) / (zero_example + epsilon).sum()
    print("epsilon", epsilon, "CLR", clr(closed).round(3).tolist())
