# 模型学会了什么：评价、生成与第一阶段答辩 / Temperature 改变分布，不增加知识
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
logits = torch.tensor([2.0, 1.0, 0.0])
for temperature in [0.5, 1.0, 2.0]:
    p = torch.softmax(logits / temperature, dim=-1)
    print(temperature, p.tolist(), float(-(p * p.log()).sum()))
