# 词向量与位置：沿形状走完一次前向传播 / 写出最小预测器，并准确说明它的限制
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
from torch import nn
class TokenPositionHead(nn.Module):
    def __init__(self, vocab=10, dim=8, context=4):
        super().__init__()
        self.token = nn.Embedding(vocab, dim)
        self.position = nn.Embedding(context, dim)
        self.head = nn.Linear(dim, vocab, bias=False)
    def forward(self, ids):
        B, T = ids.shape
        pos = torch.arange(T, device=ids.device)
        h = self.token(ids) + self.position(pos)
        return self.head(h)
model = TokenPositionHead()
ids = torch.tensor([[1, 2, 3, 4], [4, 3, 2, 1]])
logits = model(ids)
assert logits.shape == (2, 4, 10)
assert torch.isfinite(logits).all()
print(sum(p.numel() for p in model.parameters()))  # 192
