# 训练不是按下开始：目标、优化、验证与恢复 / 交叉熵到底在奖励什么
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
import torch.nn.functional as F
p = torch.tensor([[0.7, 0.2, 0.1], [0.2, 0.4, 0.4]])
y = torch.tensor([0, 1])
manual = -torch.log(torch.tensor([0.7, 0.4])).mean()
loss = F.cross_entropy(p.log(), y)
assert torch.allclose(loss, manual)
print(loss.item())  # about 0.63648
