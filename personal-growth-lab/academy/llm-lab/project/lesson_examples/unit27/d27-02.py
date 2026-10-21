# 跨队列与小样本实战：嵌套验证、统计与校准 / 嵌套验证把选择与最终评价隔开
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import numpy as np
from sklearn.model_selection import LeaveOneGroupOut
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
rng = np.random.default_rng(27)
group = np.repeat(np.arange(6), 12)
y = np.tile([0, 1], 36)
X = rng.normal(size=(72, 5))
X[:, 0] += 0.8*y
X += rng.normal(0, 0.25, size=(6,5))[group]
Cs = [0.1, 1.0, 10.0]
def make_model(c):
    return make_pipeline(StandardScaler(), LogisticRegression(C=c, max_iter=500))
rows = []
for train, test in LeaveOneGroupOut().split(X, y, group):
    assert not set(group[train]) & set(group[test])
    scores = []
    for c in Cs:
        inner = []
        for a, b in LeaveOneGroupOut().split(X[train], y[train], group[train]):
            model = make_model(c).fit(X[train[a]], y[train[a]])
            inner.append(roc_auc_score(y[train[b]], model.predict_proba(X[train[b]])[:,1]))
        scores.append(float(np.mean(inner)))
    best_c = Cs[int(np.argmax(scores))]
    final = make_model(best_c).fit(X[train], y[train])
    auc = roc_auc_score(y[test], final.predict_proba(X[test])[:,1])
    rows.append({"study": int(group[test][0]), "C": best_c, "test_auc": float(auc)})
assert len(rows) == 6
print(rows)
print("macro study AUROC", np.mean([r["test_auc"] for r in rows]))
