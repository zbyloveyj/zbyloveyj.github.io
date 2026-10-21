# 结构先验与生成目标：图模型、VAE 和扩散怎样进入菌群研究 / 独立实验三：在合适坐标加噪，并诚实区分已知噪声与学会去噪
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import numpy as np
rng = np.random.default_rng(38)
# 三分类单元组成的二维ILR坐标；V的列正交且与全1向量正交。
V = np.array([[1/np.sqrt(2),1/np.sqrt(6)],
              [-1/np.sqrt(2),1/np.sqrt(6)], [0.,-2/np.sqrt(6)]])
assert np.allclose(V.T@V,np.eye(2)) and np.allclose(V.sum(axis=0),0)
z0 = np.array([0.5,-0.2]); noise = rng.normal(size=2); abar = 0.7
zt = np.sqrt(abar)*z0+np.sqrt(1-abar)*noise
oracle_recovery = (zt-np.sqrt(1-abar)*noise)/np.sqrt(abar)
assert np.allclose(oracle_recovery,z0)
def to_composition(z):
    logits = z@V.T
    exp = np.exp(logits-logits.max())
    return exp/exp.sum()
a = to_composition(z0); noisy = to_composition(zt)
assert np.all(a>0) and np.isclose(a.sum(),1)
assert np.all(noisy>0) and np.isclose(noisy.sum(),1)
print({"composition":a.tolist(),"noisy_composition":noisy.tolist(),
       "oracle_coordinate_error":float(np.max(np.abs(oracle_recovery-z0)))})
# noise在例子中已知；真实扩散模型必须学习预测噪声，不能把本恒等式叫作已学会去噪。

