# 结构先验与生成目标：图模型、VAE 和扩散怎样进入菌群研究 / 独立实验一：消息传递应跟随节点身份一起重排
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import numpy as np
# 四个匿名分类单元构成的人工无向图，不代表真实生态互作。
A = np.array([[0.,1.,0.,0.],[1.,0.,1.,0.],
              [0.,1.,0.,1.],[0.,0.,1.,0.]])
H = np.array([[1.,0.],[0.,1.],[1.,1.],[0.2,0.7]])
W = np.array([[0.5,-0.2],[0.3,0.8]])
def layer(A, H):
    if not np.allclose(A,A.T) or np.any(A < 0):
        raise ValueError("This lesson assumes nonnegative undirected adjacency")
    At = A + np.eye(len(A))
    inv = 1.0 / np.sqrt(At.sum(axis=1))
    norm = inv[:,None]*At*inv[None,:]
    return np.maximum(norm @ H @ W, 0.0)
Z = layer(A,H)
p = np.array([2,0,3,1])
Zp = layer(A[np.ix_(p,p)], H[p])
assert np.allclose(Zp,Z[p])
assert np.allclose(Zp.mean(axis=0),Z.mean(axis=0))
wrong = layer(A,H[p])  # 只重排特征，图没有同步重排。
assert not np.allclose(wrong,Z[p])
print({"node_embeddings": Z.tolist(),
       "pooled_embedding": Z.mean(axis=0).tolist(),
       "permutation_equivariance": True})

