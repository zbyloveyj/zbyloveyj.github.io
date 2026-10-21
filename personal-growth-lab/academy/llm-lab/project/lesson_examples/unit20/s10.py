# 后训练全景：从答案监督到偏好优化 / GRPO：用同题回答组构造相对优势
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
def group_advantage(rewards):
    return (rewards-rewards.mean())/(rewards.std(unbiased=False)+1e-8)
r = torch.tensor([0.,1.,1.,0.], dtype=torch.float64)
a = group_advantage(r)
flat = group_advantage(torch.ones(4, dtype=torch.float64))
assert torch.allclose(a, torch.tensor([-1.,1.,1.,-1.], dtype=torch.float64))
assert torch.equal(flat, torch.zeros_like(flat))
assert abs(float(a.mean())) < 1e-12
print('group advantage:', a.tolist(), 'equal reward group:', flat.tolist())
