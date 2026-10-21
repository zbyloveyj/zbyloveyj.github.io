# 精神疾病、脑影像与纵向研究：配对、特异性与可证伪假设 / 规范模型估计个体偏离，而不是直接分类
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import numpy as np
rng = np.random.default_rng(2907)
age = rng.uniform(18,60,70)
C = np.column_stack([np.ones(len(age)),(age-40)/10])
y = 2.0-0.3*(age-40)/10+rng.normal(0,0.4,len(age))
beta = np.linalg.lstsq(C,y,rcond=None)[0]
sigma2 = np.sum((y-C@beta)**2)/(len(y)-C.shape[1])
new_age = np.array([25.,45.,80.])
new_C = np.column_stack([np.ones(3),(new_age-40)/10])
observed = 2.0-0.3*(new_age-40)/10+np.array([0.,0.8,-0.8])
mean = new_C@beta
leverage = np.einsum("ij,jk,ik->i",new_C,np.linalg.inv(C.T@C),new_C)
standardized = (observed-mean)/np.sqrt(sigma2*(1+leverage))
outside = (new_age<age.min()) | (new_age>age.max())
assert outside.tolist() == [False,False,True]
assert np.isfinite(standardized).all()
print({"standardized_predictive_residuals": standardized.tolist(), "outside_training_age": outside.tolist()})
# 合成线性参考模型；不是疾病诊断，也不保证精确标准正态校准。
