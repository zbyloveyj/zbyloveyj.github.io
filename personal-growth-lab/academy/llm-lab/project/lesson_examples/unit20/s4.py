# 后训练全景：从答案监督到偏好优化 / Packing：省padding需要保留任务边界
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
segment = torch.tensor([0,0,0,1,1,1])
causal = torch.ones(6,6,dtype=torch.bool).tril()
same_segment = segment[:,None] == segment[None,:]
allowed = causal & same_segment
assert causal[3,2] and not allowed[3,2]
assert allowed[4,3] and not allowed[3,4]
assert torch.all(allowed.diag())
print(allowed.int())
