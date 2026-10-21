# 外推与研究可信度：分布变化、缺失、预测集合与因果识别 / 独立实验一：同样的阈值性能，可以得到不同的阳性预测值
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import math
sensitivity, specificity = 0.8, 0.9  # 人工固定阈值性能，并非临床估计。
def ppv(pi):
    return sensitivity*pi/(sensitivity*pi+(1-specificity)*(1-pi))
assert math.isclose(ppv(0.5),8/9)
assert ppv(0.05) < ppv(0.5)
# 另一个计算：在纯标签迁移假设下，修正某个已校准样本的后验 odds。
def change_prior(p, source_pi, target_pi):
    if not all(0 < v < 1 for v in (p, source_pi, target_pi)):
        raise ValueError("Probabilities must lie strictly between zero and one")
    odds = p/(1-p)
    ratio = (target_pi/(1-target_pi))/(source_pi/(1-source_pi))
    return odds*ratio/(1+odds*ratio)
updated = change_prior(0.8,0.5,0.05)
assert math.isclose(updated,4/23)
print({"PPV_at_pi_0.5":ppv(0.5),"PPV_at_pi_0.05":ppv(0.05),
       "individual_posterior_after_pure_label_shift":updated})
# PPV描述阈值以上群体；updated描述单个给定特征的后验，不要把两者当同一指标。

