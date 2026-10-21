# 微生物模型设计谱系：表示、目标与对照 / 排序词元：少了数值就改变了任务
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import numpy as np
taxa = np.array(["A", "B", "C"])
x = np.array([0.80, 0.15, 0.05])
y = np.array([0.36, 0.34, 0.30])
def rank_ids(values):
    return taxa[np.argsort(-values, kind="stable")].tolist()
assert np.isclose(x.sum(), 1) and np.isclose(y.sum(), 1)
assert rank_ids(x) == rank_ids(y)
assert not np.allclose(x, y)
print({"x_tokens": rank_ids(x), "y_tokens": rank_ids(y),
       "x_A_over_C": float(x[0]/x[2]), "y_A_over_C": float(y[0]/y[2])})
# 相同排序无法恢复原幅度；若额外编码数值或分箱，信息保留情况会改变。
