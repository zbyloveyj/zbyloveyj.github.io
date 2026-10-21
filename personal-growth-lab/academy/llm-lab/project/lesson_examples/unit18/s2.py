# 训练工程：把一次下降变成可恢复的实验 / DataLoader：顺序、批处理与随机源
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
from torch.utils.data import TensorDataset, DataLoader
def order(seed):
    dataset = TensorDataset(torch.arange(11))
    generator = torch.Generator().manual_seed(seed)
    loader = DataLoader(dataset, batch_size=4, shuffle=True,
                        num_workers=0, generator=generator)
    return [int(v) for batch in loader for v in batch[0]]
a, b = order(18), order(18)
assert a == b and sorted(a) == list(range(11))
print('sample order:', a)
