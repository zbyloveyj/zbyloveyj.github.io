# 语言模型与系统评价：让提升经得起比较 / 校准与拒答：更少回答不自动意味着更可靠
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import numpy as np
# 合成的“答案正确概率”与独立核验标签，不是模型已校准的真实输出。
confidence = np.array([.95,.90,.85,.70,.60,.55])
correct = np.array([1,0,1,1,0,1])
threshold = .80  # 假设已在独立开发集固定；此处不能按测试结果调节。
accepted = confidence >= threshold
coverage = float(accepted.mean())
risk = float(1-correct[accepted].mean()) if accepted.any() else None
brier = float(np.mean((confidence-correct)**2))
edges = np.array([0., .5, .8, 1.])
ece = 0.0
for j in range(len(edges)-1):
    member = ((confidence >= edges[j]) &
              (confidence <= edges[j+1] if j == len(edges)-2 else confidence < edges[j+1]))
    if member.any():
        ece += member.mean() * abs(correct[member].mean()-confidence[member].mean())
print({"coverage":coverage, "selective_risk":risk, "brier":brier, "ece_3_bins":float(ece)})
assert np.isclose(coverage, .5) and np.isclose(risk, 1/3)
assert np.isclose(brier, .24791666666666667)
assert not (confidence >= 1.0).any()  # 零覆盖时风险应为不适用，不能报告“零错误”。
