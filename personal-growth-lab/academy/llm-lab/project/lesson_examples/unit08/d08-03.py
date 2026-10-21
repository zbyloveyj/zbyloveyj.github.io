# 让模型适应任务：指令微调与 LoRA / 只在答案位置计算损失
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
import torch.nn.functional as F
torch.manual_seed(8)
ids = torch.tensor([[2, 3, 4, 5]])
answer = torch.tensor([[False, False, True, True]])
logits = torch.randn(1, 4, 8, requires_grad=True)
target = ids[:, 1:].clone()
target[~answer[:, 1:]] = -100
loss = F.cross_entropy(logits[:, :-1].reshape(-1, 8), target.reshape(-1), ignore_index=-100)
loss.backward()
print("shifted labels:", target.tolist())
print("scored answer tokens:", int((target != -100).sum()))
print("loss:", float(loss.detach()))
assert target.tolist() == [[-100, 4, 5]]
assert logits.grad[:, 0].abs().sum().item() == 0
assert logits.grad[:, 1:3].abs().sum().item() > 0
