# 外推与研究可信度：分布变化、缺失、预测集合与因果识别 / 缺失机制实验：观察到的均值、加权与敏感性各说明什么
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import numpy as np
rng = np.random.default_rng(394)
n = 20000
x = rng.integers(0,2,size=n)  # 始终观察到的背景变量。
y = 2*x+rng.normal(size=n)   # 模拟完整总体；真实缺失时无法读取缺失部分。
p_mcar = np.full(n,0.6)
p_mar = np.where(x==0,0.9,0.3)
p_mnar = 1/(1+np.exp(0.8*y))
probs = {"MCAR":p_mcar,"MAR_given_X":p_mar,"MNAR_given_X":p_mnar}
masks = {name:rng.random(n)<p for name,p in probs.items()}
summary = {}
for name,r in masks.items():
    assert r.dtype == bool and r.any() and (~r).any()
    summary[name] = {"observed_fraction":float(r.mean()),
                     "complete_case_mean":float(y[r].mean())}
r = masks["MAR_given_X"]
# 这里只因知道模拟机制才知道真实观察概率；真实项目需要估计并检验适用假设。
w = 1/p_mar[r]
mar_weighted = np.sum(w*y[r])/np.sum(w)
r = masks["MNAR_given_X"]
observed_y = np.where(r,y,np.nan)
conditional_observed_mean = np.array([np.nanmean(observed_y[x==g]) for g in [0,1]])
sensitivity = {}
for delta in [-0.5,0.0,0.5]:
    # 假设缺失Y的条件均值 = 同X组已观察Y均值 + delta。
    filled = np.where(r,observed_y,conditional_observed_mean[x]+delta)
    assert np.isfinite(filled).all()
    sensitivity[str(delta)] = float(filled.mean())
assert sensitivity["-0.5"] < sensitivity["0.0"] < sensitivity["0.5"]
print({"synthetic_full_mean":float(y.mean()),"mechanisms":summary,
       "MAR_known_probability_weighted_mean":float(mar_weighted),
       "MNAR_delta_sensitivity":sensitivity})
# 完整y仅用于模拟核验；实际分析不能借缺失真值挑选最接近答案的delta。

