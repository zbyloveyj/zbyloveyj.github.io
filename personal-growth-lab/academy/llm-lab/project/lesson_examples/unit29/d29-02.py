# 精神疾病、脑影像与纵向研究：配对、特异性与可证伪假设 / 配对表比融合网络先完成
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

microbiome = [{"subject": s, "prediction_day": 0} for s in ("toy_A","toy_B","toy_C","toy_D")]
images = [{"subject":"toy_A","available_day":-1}, {"subject":"toy_A","available_day":30},
          {"subject":"toy_B","available_day":2}, {"subject":"toy_C","available_day":-3},
          {"subject":"toy_D","available_day":-2}]
split = {"train":{"toy_A","toy_B"}, "test":{"toy_C","toy_D"}}
assert not split["train"] & split["test"]
paired, missing = [], []
for row in microbiome:
    cutoff = row["prediction_day"]
    valid = [r for r in images if r["subject"] == row["subject"] and cutoff-7 <= r["available_day"] <= cutoff]
    if valid:
        chosen = max(valid, key=lambda r:r["available_day"])
        paired.append((row["subject"],chosen["available_day"]))
    else:
        missing.append(row["subject"])
assert missing == ["toy_B"]
assert all(day <= 0 for _,day in paired)
print({"paired": paired, "missing_at_prediction": missing})
# available_day表示预测时实际可获得数据的日期，不能只看采集日期。
