# 语言模型与系统评价：让提升经得起比较 / 人工标注先有规则，再计算一致性
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import numpy as np
from sklearn.metrics import cohen_kappa_score
def agreement(a, b):
    a, b = np.asarray(a), np.asarray(b)
    if a.shape != b.shape or a.ndim != 1 or len(a) == 0:
        raise ValueError("paired nonempty labels required")
    labels = np.unique(np.concatenate([a, b]))
    observed = float(np.mean(a == b))
    expected = sum(float(np.mean(a == x) * np.mean(b == x)) for x in labels)
    kappa = (observed - expected) / (1 - expected) if expected < 1 else None
    return {"observed_agreement":observed, "chance_agreement":expected, "kappa":kappa}
a = [1,1,1,1,0,0,0,0]
b = [1,1,1,0,0,0,0,1]
result = agreement(a, b)
print(result)
assert np.isclose(result["observed_agreement"], .75)
assert np.isclose(result["kappa"], .5)
assert np.isclose(result["kappa"], cohen_kappa_score(a, b))
assert agreement([1,1], [1,1])["kappa"] is None
