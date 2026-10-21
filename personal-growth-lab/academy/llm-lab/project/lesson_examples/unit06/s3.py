# 训练不是按下开始：目标、优化、验证与恢复 / 一个优化步的顺序
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
from curatemicrobiota.language import ByteTokenizer, TinyGPT, sample_batch
model = TinyGPT(); model.train()
tokens = torch.tensor(ByteTokenizer.encode('Microbes form diverse communities. ' * 100))
x, y = sample_batch(tokens, batch_size=2, context=32)
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=0.01)
optimizer.zero_grad(set_to_none=True)
_, loss = model(x, y)
loss.backward()
norm = torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
assert torch.isfinite(norm)
optimizer.step()
print(float(loss.detach()), float(norm))
