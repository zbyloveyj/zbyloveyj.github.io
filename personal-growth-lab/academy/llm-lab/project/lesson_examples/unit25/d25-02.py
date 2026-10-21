# 真实菌群数据工程：版本、组合性与测量边界 / 对齐不是取交集后悄悄补零
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import numpy as np
input_names = ["taxon_B", "taxon_A", "taxon_new"]
vocabulary = ["taxon_A", "taxon_B", "taxon_C"]
x = np.array([[0.20, 0.00, 0.10], [0.00, 0.40, 0.20]])
assert len(input_names) == len(set(input_names))
lookup = {name: j for j, name in enumerate(input_names)}
aligned = np.full((len(x), len(vocabulary)), np.nan)
for j, name in enumerate(vocabulary):
    if name in lookup:
        aligned[:, j] = x[:, lookup[name]]
observed = np.isfinite(aligned)
report = {"missing": [n for n in vocabulary if n not in lookup],
          "unused": [n for n in input_names if n not in vocabulary],
          "retained_input_fraction": (np.nansum(aligned, axis=1) / x.sum(axis=1)).tolist()}
assert aligned[0, 0] == 0.0 and observed[0, 0]
assert np.isnan(aligned[:, 2]).all() and not observed[:, 2].any()
print(aligned)
print(report)
# NaN是明确的未知测量状态；不要将此诊断数组直接传入现有训练接口。
