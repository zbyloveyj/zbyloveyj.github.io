# 把检索向量训练出来：双塔、负例与索引验收 / 批内负例可能实际上是正确答案
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
# 两个问题，每行两个文档是已核验的正例；其余才可作负例。
scores = torch.tensor([[2.0, 1.0, -0.5, 0.0], [0.0, -0.5, 1.0, 2.0]], requires_grad=True)
positive = torch.tensor([[True, True, False, False], [False, False, True, True]])
assert positive.any(dim=1).all()
log_denominator = torch.logsumexp(scores, dim=1)
log_positive_mass = torch.logsumexp(scores.masked_fill(~positive, float("-inf")), dim=1)
loss = (log_denominator - log_positive_mass).mean()
loss.backward()
# 此目标推动总正例概率质量上升；这里每个正例的梯度非正，负例非负。
assert (scores.grad[positive] <= 0).all()
assert (scores.grad[~positive] >= 0).all()
with torch.no_grad():
    naive = torch.nn.functional.cross_entropy(scores, torch.tensor([0, 3]))
print({"multi_positive_loss": float(loss.detach()), "single_positive_loss": float(naive),
       "positive_gradient_nonpositive": True, "negative_gradient_nonnegative": True})
# 这是正例集合质量目标，区别于逐个正例CE再平均；不能把两者混称同一损失。

