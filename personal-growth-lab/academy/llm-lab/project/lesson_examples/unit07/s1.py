# 模型学会了什么：评价、生成与第一阶段答辩 / 困惑度是怎样从损失得到的
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import math
loss = math.log(4)
assert abs(math.exp(loss) - 4) < 1e-12
print(math.exp(3.053329646587372))  # about 21.18577
