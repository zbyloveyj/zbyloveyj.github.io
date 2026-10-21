# 后训练全景：从答案监督到偏好优化 / RLHF与PPO：旧策略和参考策略不能混淆
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
ratio = torch.tensor([1.4,0.6,1.4,0.6], dtype=torch.float64, requires_grad=True)
advantage = torch.tensor([1.,1.,-1.,-1.], dtype=torch.float64)
clipped = ratio.clamp(0.8,1.2)
objective = torch.minimum(ratio*advantage, clipped*advantage)
assert torch.allclose(objective, torch.tensor([1.2,0.6,-1.4,-0.8], dtype=torch.float64))
(-objective.mean()).backward()
assert ratio.grad[0] == 0 and ratio.grad[3] == 0
print('surrogate:', objective.detach().tolist(), 'loss gradient:', ratio.grad.tolist())
