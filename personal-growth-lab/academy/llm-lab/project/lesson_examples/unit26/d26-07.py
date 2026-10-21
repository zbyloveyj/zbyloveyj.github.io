# 微生物模型设计谱系：表示、目标与对照 / 对比学习学习的是你规定的不变性
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
import torch.nn.functional as F
torch.manual_seed(26)
a = F.normalize(torch.eye(3), dim=1)
b = F.normalize(torch.eye(3) + 0.02*torch.randn(3,3), dim=1)
tau = 0.2
labels = torch.arange(3)
paired = F.cross_entropy(a @ b.T / tau, labels)
wrong = F.cross_entropy(a @ b.roll(1, dims=0).T / tau, labels)
assert paired < wrong
single_logit = torch.tensor([[2.0]], requires_grad=True)
single = F.cross_entropy(single_logit, torch.tensor([0]))
single.backward()
assert single.item() == 0 and single_logit.grad.item() == 0
print({"correct_pairs": paired.item(), "shuffled_pairs": wrong.item(),
       "one_pair_without_negatives": single.item()})
# 三行代表不同的人工受试者；没有假设真实访视或任意增强自动构成正例。
