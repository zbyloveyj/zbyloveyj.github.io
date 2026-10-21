# 训练不是按下开始：目标、优化、验证与恢复 / 学习率调度、warmup与稳定性
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import math
def lr_at(step, total=100, warmup=10, peak=1e-3):
    if step < warmup:
        return peak * (step + 1) / warmup
    progress = (step - warmup) / max(1, total - warmup - 1)
    return peak * 0.5 * (1 + math.cos(math.pi * min(progress, 1)))
print([lr_at(s) for s in [0, 9, 10, 50, 99]])
