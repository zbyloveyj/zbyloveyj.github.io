# 精神疾病、脑影像与纵向研究：配对、特异性与可证伪假设 / 实跑：训练域残差化后的PLS关联
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import numpy as np
from sklearn.cross_decomposition import PLSRegression
rng = np.random.default_rng(29)
n = 120
age = rng.uniform(18,65,n); site = rng.integers(0,2,n)
C = np.column_stack([np.ones(n),(age-40)/10,site])
latent = rng.normal(size=(n,1))
X = latent @ np.array([[1.,0.8,-0.6,0.4]]) + C @ rng.normal(size=(3,4)) + rng.normal(0,0.35,(n,4))
Y = latent @ np.array([[0.9,-0.7,0.5]]) + C @ rng.normal(size=(3,3)) + rng.normal(0,0.35,(n,3))
train = np.arange(80); test = np.arange(80,n)
Bx = np.linalg.lstsq(C[train],X[train],rcond=None)[0]
By = np.linalg.lstsq(C[train],Y[train],rcond=None)[0]
Rx = X-C@Bx; Ry = Y-C@By
model = PLSRegression(n_components=1,scale=True).fit(Rx[train],Ry[train])
tx,ty = model.transform(Rx[test],Ry[test])
correlation = np.corrcoef(tx[:,0],ty[:,0])[0,1]
shuffled = np.corrcoef(tx[:,0],ty[rng.permutation(len(test)),0])[0,1]
assert np.isfinite([correlation,shuffled]).all()
print({"heldout_paired_correlation": float(correlation), "one_shuffled_control": float(shuffled)})
# 单次打乱不是显著性检验；该合成PLS例子不是sCCA、cVAE或真实肠脑模型。
