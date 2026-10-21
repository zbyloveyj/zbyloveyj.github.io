# 语言模型与系统评价：让提升经得起比较 / 配对比较：两套系统必须面对同一批问题
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import numpy as np
def paired_group_bootstrap(ids_a, a, ids_b, b, groups, seed=42):
    if list(ids_a) != list(ids_b) or len(set(ids_a)) != len(ids_a):
        raise ValueError("paired unique question IDs must match in order")
    a, b, groups = np.asarray(a, float), np.asarray(b, float), np.asarray(groups)
    if a.ndim != 1 or a.shape != b.shape or a.shape != groups.shape or len(a) == 0:
        raise ValueError("shape mismatch or empty evaluation")
    if not np.all(np.isfinite(a)) or not np.all(np.isfinite(b)):
        raise ValueError("nonfinite score")
    unique = np.unique(groups)
    # 每个来源族权重相等；族内改写先取平均，不把改写当独立新问题。
    ga = np.array([a[groups == g].mean() for g in unique])
    gb = np.array([b[groups == g].mean() for g in unique])
    rng = np.random.default_rng(seed)
    sample = rng.integers(0, len(unique), size=(4000, len(unique)))
    delta = (gb[sample] - ga[sample]).mean(axis=1)
    return {"difference_B_minus_A": float((gb-ga).mean()),
            "percentile_interval_95": np.quantile(delta, [.025,.975]).tolist(),
            "independent_source_groups": len(unique)}
ids = [f"q{i}" for i in range(12)]
groups = np.repeat(np.arange(6), 2)
a = [1,1, 1,0, 0,1, 1,0, 1,1, 0,0]
b = [1,1, 1,1, 1,1, 1,0, 1,0, 1,0]
print(paired_group_bootstrap(ids, a, ids, b, groups))
same = paired_group_bootstrap(ids, a, ids, a, groups)
assert same["percentile_interval_95"] == [0.0, 0.0]
try:
    paired_group_bootstrap(ids, a, ids[::-1], b, groups)
except ValueError:
    print("misaligned IDs rejected")
else:
    raise AssertionError("pairing was not checked")
