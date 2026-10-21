# 理解模型的边界：解释、分布变化与跨模态 / 一个可运行的训练参考距离诊断
# 前置：先 make-demo，再运行 python -m curatemicrobiota pretrain --data data/demo --out runs/microbiome --steps 40
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import numpy as np
from curatemicrobiota.data import load_cohort, Preprocessor
cohort = load_cohort("data/demo")
split = cohort.indices()
prep = Preprocessor.load("runs/microbiome/preprocessor.json")
z, alignment = prep.transform(cohort.values, cohort.taxa)
score = np.sqrt(np.mean(z.astype(float) ** 2, axis=1))
threshold = float(np.quantile(score[split["train"]], 0.95))
print({"teaching_threshold": threshold, "alignment": alignment})
for name in ("train", "val"):
    distance = score[split[name]]
    print(name, {"n": len(distance), "mean_distance": float(distance.mean()),
                 "flag_fraction": float(np.mean(distance > threshold))})
# 描述性诊断，不是经过校准的OOD概率；没有使用测试数据调阈值。
