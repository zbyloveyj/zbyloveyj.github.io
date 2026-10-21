# 跨队列与小样本实战：嵌套验证、统计与校准 / 配对与层级bootstrap需要说明条件
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import numpy as np
from sklearn.metrics import roc_auc_score
rng = np.random.default_rng(2707)
cohorts = []
for study in range(4):
    y = np.tile([0,1], 6)
    shared = 0.9*y + rng.normal(size=len(y))
    pa = 1/(1+np.exp(-shared))
    pb = 1/(1+np.exp(-(shared + 0.15*y + rng.normal(0,0.15,len(y)))))
    cohorts.append((y,pa,pb))
point = np.mean([roc_auc_score(y,b)-roc_auc_score(y,a) for y,a,b in cohorts])
boot = []
for _ in range(500):
    differences = []
    for s in rng.choice(len(cohorts), len(cohorts), replace=True):
        y,a,b = cohorts[s]
        index = np.concatenate([rng.choice(np.flatnonzero(y==c), (y==c).sum(), replace=True) for c in (0,1)])
        differences.append(roc_auc_score(y[index],b[index])-roc_auc_score(y[index],a[index]))
    boot.append(np.mean(differences))
assert len(boot) == 500 and np.isfinite(boot).all()
print({"macro_auc_difference_B_minus_A": float(point),
       "illustrative_interval": np.quantile(boot,[0.025,0.975]).tolist(),
       "scope": "fixed synthetic predictions; studies then class-stratified subjects; no retraining"})
