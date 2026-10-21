# 组装 TinyGPT：多头、残差、归一化与前馈网络 / 拆头、转置与合头，最容易悄悄出错
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
B, T, H, d = 2, 5, 4, 3
x = torch.arange(B*T*H*d).reshape(B, T, H*d)
heads = x.reshape(B, T, H, d).transpose(1, 2)
assert heads.shape == (B, H, T, d)
restored = heads.transpose(1, 2).contiguous().view(B, T, H*d)
assert torch.equal(x, restored)
