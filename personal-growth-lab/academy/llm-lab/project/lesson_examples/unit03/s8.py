# 词向量与位置：沿形状走完一次前向传播 / Embedding 的梯度会更新哪些行
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
from torch import nn
emb = nn.Embedding(5, 2)
ids = torch.tensor([1, 1, 3])
emb(ids).sum().backward()
expected = torch.tensor([[0.,0.],[2.,2.],[0.,0.],[1.,1.],[0.,0.]])
assert torch.equal(emb.weight.grad, expected)
print(emb.weight.grad)
