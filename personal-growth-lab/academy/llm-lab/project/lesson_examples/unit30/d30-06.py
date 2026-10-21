# 科研级 Capstone：从合成流程到多队列证据 / 06｜独立代码二：从逐研究数字检查主结论
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import numpy as np

# Values are per-study AUROC means across seeds 42 and 43 from the
# completed synthetic teaching benchmark (40 pretraining / 40 supervised steps).
# This snippet checks aggregation; it does not train or re-run those models.
by_study = {
    "logistic": [0.87, 0.79, 0.80, 0.80, 0.84, 0.87],
    "random_frozen": [0.705, 0.91, 0.79, 0.925, 0.66, 0.485],
    "pretrained_frozen": [0.64, 0.93, 0.77, 0.925, 0.645, 0.455],
    "supervised_scratch": [0.50, 0.665, 0.525, 0.835, 0.53, 0.27],
    "pretrained_finetuned": [0.485, 0.745, 0.58, 0.78, 0.53, 0.28],
}
macro = {name: float(np.mean(values)) for name, values in by_study.items()}
difference = (np.array(by_study["pretrained_finetuned"])
              - np.array(by_study["supervised_scratch"]))
tol = 1e-12
wins = int(np.sum(difference > tol))
losses = int(np.sum(difference < -tol))
ties = int(np.sum(np.abs(difference) <= tol))
assert np.isclose(macro["logistic"], 0.8283333333333333)
assert np.isclose(difference.mean(), 0.0125)
assert (wins, losses, ties) == (3, 2, 1)
for name, value in macro.items():
    print(f"{name}: macro study AUROC = {value:.6f}")
print("paired study differences:", np.round(difference, 4).tolist())
print("mean difference:", round(float(difference.mean()), 4))
print("wins / losses / ties:", wins, losses, ties)
print("Descriptive synthetic result; no significance or biological benefit established.")

