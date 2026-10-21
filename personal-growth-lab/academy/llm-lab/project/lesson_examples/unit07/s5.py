# 模型学会了什么：评价、生成与第一阶段答辩 / Top-k 与 top-p 分别截断什么
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
def nucleus_probs(logits, p=0.9):
    if not 0 < p <= 1:
        raise ValueError('p must be in (0, 1]')
    if p == 1:
        return logits.softmax(dim=-1)  # 不截断完整分布。
    sorted_logits, order = logits.sort(descending=True)
    probs = sorted_logits.softmax(dim=-1)
    remove = probs.cumsum(dim=-1) >= p
    remove[1:] = remove[:-1].clone()
    remove[0] = False
    kept = sorted_logits.masked_fill(remove, float('-inf')).softmax(dim=-1)
    result = torch.zeros_like(kept).scatter(0, order, kept)
    return result
p = nucleus_probs(torch.tensor([0.4, 0.3, 0.2, 0.1]).log(), 0.65)
assert torch.allclose(p, torch.tensor([4/7, 3/7, 0., 0.]))
print(p)
# 恰好达到阈值时，保留最小前缀；并列项的具体ID不影响项数。
assert torch.count_nonzero(nucleus_probs(torch.zeros(2), 0.5)).item() == 1
assert torch.count_nonzero(nucleus_probs(torch.zeros(4), 0.5)).item() == 2
full = torch.tensor([0.4, 0.3, 0.2, 0.1])
assert torch.allclose(nucleus_probs(full.log(), 1.0), full)
for invalid_p in [0.0, -0.1, 1.1]:
    try:
        nucleus_probs(torch.zeros(2), invalid_p)
    except ValueError:
        pass
    else:
        raise AssertionError('invalid top-p threshold was accepted')
print('top-p equality, full-distribution and range checks passed')
