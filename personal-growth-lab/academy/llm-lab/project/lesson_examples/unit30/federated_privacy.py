# 科研级 Capstone：从合成流程到多队列证据 / 多中心协作：联邦聚合、隐私与可复现性
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import numpy as np
counts = np.array([2., 8., 10.])
weights = counts / counts.sum()
curvature = np.array([1., 2., 4.])
centers = np.array([1., 3., 5.])
w0, lr = 0.0, 0.1
local1 = w0 - lr * curvature * (w0 - centers)
central1 = w0 - lr * np.dot(weights, curvature * (w0 - centers))
assert np.isclose(weights @ local1, central1)
local2 = local1 - lr * curvature * (local1 - centers)
central2 = central1 - lr * np.dot(weights, curvature * (central1 - centers))
assert not np.isclose(weights @ local2, central2)
print({"one_step_equal": True, "two_local_steps_average": float(weights @ local2),
       "two_central_steps": float(central2), "privacy_guarantee": "none"})
