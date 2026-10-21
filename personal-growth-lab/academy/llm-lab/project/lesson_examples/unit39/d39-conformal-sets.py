# 外推与研究可信度：分布变化、缺失、预测集合与因果识别 / 独立实验二：按有限样本秩构造保形预测集合
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import math
import numpy as np
rng = np.random.default_rng(39)
def sample(n):
    x = rng.normal(size=n)
    p = 1/(1+np.exp(-2*x))
    y = (rng.random(n)<p).astype(int)
    return np.column_stack([1-p,p]), y
# 视为一个训练阶段已经固定的预测器。校准与测试样本独立。
pc, yc = sample(199); pt, yt = sample(4000)
alpha = 0.1
scores = 1-pc[np.arange(len(yc)),yc]
k = math.ceil((len(scores)+1)*(1-alpha))
qhat = np.inf if k > len(scores) else np.sort(scores)[k-1]
sets = (1-pt) <= qhat  # 包含边界值，保留并列分数的保守性。
coverage = sets[np.arange(len(yt)),yt].mean()
# 人工改变标签生成关系，破坏与校准集的交换性。
shifted_coverage = sets[np.arange(len(yt)),1-yt].mean()
assert sets.shape == (4000,2) and 0 <= coverage <= 1
assert 1 <= k <= len(scores)+1
# n太小时允许阈值为无穷大，不能把k机械截到n后仍声称原有保证。
small_n = 4
assert math.ceil((small_n+1)*(1-alpha)) > small_n
print({"k":k,"qhat":float(qhat),"empirical_coverage":float(coverage),
       "mean_set_size":float(sets.sum(axis=1).mean()),
       "coverage_after_label_flip":float(shifted_coverage)})
# 一次经验覆盖率不是定理证明；理论保证是交换性条件下的边际覆盖。

