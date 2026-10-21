# 外推与研究可信度：分布变化、缺失、预测集合与因果识别 / 独立实验三：正确调整可消除混杂，错误调整可制造关联
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import numpy as np
rng = np.random.default_rng(390)
n = 20000
u = rng.normal(size=n)
x = 2*u+rng.normal(size=n)
y = 3*u+rng.normal(size=n)  # 构造中没有 x -> y 的直接因果箭头。
def coef(y,*xs):
    design = np.column_stack([np.ones(len(y)),*xs])
    return np.linalg.lstsq(design,y,rcond=None)[0]
naive = coef(y,x)[1]
adjusted = coef(y,x,u)[1]
assert naive > 1.0 and abs(adjusted) < 0.05
# 另一独立世界：a、b独立，但共同影响collider c。
a = rng.normal(size=n); b = rng.normal(size=n)
c = a+b+0.1*rng.normal(size=n)
unadjusted_collider = coef(b,a)[1]
adjusted_collider = coef(b,a,c)[1]
assert abs(unadjusted_collider) < 0.05 and adjusted_collider < -0.9
print({"confounded_coefficient":float(naive),"adjusted_for_true_U":float(adjusted),
       "independent_a_b":float(unadjusted_collider),
       "after_adjusting_collider":float(adjusted_collider)})
# 生成机制已知才可解释本例；真实研究不能凭回归系数变化反推出正确DAG。

