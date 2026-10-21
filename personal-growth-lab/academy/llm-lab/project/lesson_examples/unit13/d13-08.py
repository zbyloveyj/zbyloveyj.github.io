# 理解模型的边界：解释、分布变化与跨模态 / 数据增强要写出保留了什么假设
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import numpy as np
rng = np.random.default_rng(13)
p = np.array([0.2, 0.3, 0.5, 0.0])
q = p * np.exp(rng.normal(0.0, 0.05, size=p.shape))
q = q / q.sum()
assert np.all(q >= 0) and np.isclose(q.sum(), 1.0)
assert np.array_equal(p == 0, q == 0)
print({"original": p.tolist(), "augmented": q.tolist()})
# 这是训练增强候选；保持组成约束并不证明标签保持或生物真实性。
