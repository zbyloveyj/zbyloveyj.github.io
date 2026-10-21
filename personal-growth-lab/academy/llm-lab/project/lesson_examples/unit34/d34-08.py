# 接上真实预训练模型：从文件快照到可复现适配 / 合并LoRA要证明等价，也要保留可回退的原件
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
from torch.nn import functional as F
torch.manual_seed(34)
torch.set_num_threads(1)
# 一个线性层的代数验收；不宣称任意量化模型都可以无损合并。
x = torch.randn(5, 4, dtype=torch.float64)
weight = torch.randn(6, 4, dtype=torch.float64)
bias = torch.randn(6, dtype=torch.float64)
a = torch.randn(2, 4, dtype=torch.float64)
b = torch.randn(6, 2, dtype=torch.float64)
scale = 4 / 2
adapted = F.linear(x, weight, bias) + scale * F.linear(F.linear(x, a), b)
merged_weight = weight + scale * (b @ a)
merged = F.linear(x, merged_weight, bias)
torch.testing.assert_close(merged, adapted, rtol=1e-12, atol=1e-12)
wrong_base = F.linear(x, weight + 0.1 + scale * (b @ a), bias)
assert not torch.allclose(wrong_base, adapted)
print({"merge_max_error": float((merged-adapted).abs().max()),
       "wrong_base_changes_output": True})

