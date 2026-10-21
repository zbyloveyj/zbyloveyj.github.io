# DNA、蛋白与功能基础模型：从序列到群落 / 视觉语言模型：对齐、连接器与科研图像的边界
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
import torch.nn.functional as F
image = torch.eye(4, dtype=torch.float64)
text = torch.eye(4, dtype=torch.float64)
labels = torch.arange(4)
def paired_loss(v, t):
    logits = F.normalize(v, dim=-1) @ F.normalize(t, dim=-1).T / 0.1
    return (F.cross_entropy(logits, labels) + F.cross_entropy(logits.T, labels)) / 2
correct = paired_loss(image, text)
wrong = paired_loss(image, text[[1, 0, 2, 3]])
assert correct < wrong
permutation = torch.tensor([2, 0, 3, 1])
assert torch.allclose(correct, paired_loss(image[permutation], text[permutation]))
print({"correct_pair_loss": float(correct), "mispaired_loss": float(wrong)})
