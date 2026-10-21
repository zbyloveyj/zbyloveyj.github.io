# 后训练全景：从答案监督到偏好优化 / DPO：比较相对于参考模型的回答优势
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
import torch.nn.functional as F
policy = torch.tensor([-2.0,-3.0], dtype=torch.float64, requires_grad=True)
reference = torch.tensor([-2.3,-2.8], dtype=torch.float64)
beta = 0.2
margin = (policy[0]-reference[0])-(policy[1]-reference[1])
loss = -F.logsigmoid(beta*margin)
loss.backward()
improved_loss = -F.logsigmoid(beta*(margin.detach()+0.5))
assert policy.grad[0] < 0 and policy.grad[1] > 0
assert improved_loss < loss.detach()
print('DPO loss:', float(loss.detach()), 'grad:', policy.grad.tolist())
