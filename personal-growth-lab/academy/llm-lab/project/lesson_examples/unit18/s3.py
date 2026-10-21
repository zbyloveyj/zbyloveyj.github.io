# 训练工程：把一次下降变成可恢复的实验 / 变长数据的梯度累积必须按分母推导
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
x = torch.tensor([1.,2.,3.,4.,5.], dtype=torch.float64)
y = torch.tensor([0.,1.,0.,2.,1.], dtype=torch.float64)
w_full = torch.tensor(0.3, dtype=torch.float64, requires_grad=True)
((w_full*x-y).square().mean()).backward()
w_acc = w_full.detach().clone().requires_grad_()
for sl in [slice(0,2), slice(2,5)]:
    loss_sum = (w_acc*x[sl]-y[sl]).square().sum()
    (loss_sum/len(x)).backward()
assert torch.allclose(w_full.grad, w_acc.grad, atol=1e-12)
print('full / accumulated gradients:', float(w_full.grad), float(w_acc.grad))
