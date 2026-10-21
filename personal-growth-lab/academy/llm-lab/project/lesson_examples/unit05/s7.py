# 组装 TinyGPT：多头、残差、归一化与前馈网络 / 直接运行工程里的 TinyGPT
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
from curatemicrobiota.language import GPTConfig, TinyGPT
model = TinyGPT(GPTConfig(dropout=0.0))
z = torch.randint(0, 256, (2, 17))
logits, loss = model(z[:, :-1], z[:, 1:])
assert logits.shape == (2, 16, 256)
assert torch.isfinite(loss)
loss.backward()
assert all(torch.isfinite(p.grad).all() for p in model.parameters() if p.grad is not None)
assert sum(p.numel() for p in model.parameters()) == 136960
print(float(loss.detach()))
