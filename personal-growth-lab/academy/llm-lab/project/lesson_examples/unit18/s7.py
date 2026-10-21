# 训练工程：把一次下降变成可恢复的实验 / 完整检查点：保存下一步所需要的状态
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
g = torch.Generator().manual_seed(1807)
_ = torch.rand(3, generator=g)
state = g.get_state().clone()
expected = torch.rand(5, generator=g)
_ = torch.rand(99, generator=g)
g.set_state(state)
resumed = torch.rand(5, generator=g)
assert torch.equal(expected, resumed)
restarted = torch.rand(5, generator=torch.Generator().manual_seed(1807))
assert not torch.equal(expected, restarted)
print('restored stream equal:', torch.equal(expected, resumed))
