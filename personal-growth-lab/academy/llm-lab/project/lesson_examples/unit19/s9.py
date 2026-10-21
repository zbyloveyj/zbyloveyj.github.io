# 规模化与系统：先算清账，再扩大模型 / FLOPs、时间与利用率：写清近似
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

C = 6e18  # illustrative FLOP budget, not a measured run
candidates = []
for N in [100_000_000, 300_000_000, 1_000_000_000]:
    tokens = C/(6*N)
    candidates.append((N, int(tokens)))
P, utilization = 100e12, 0.4  # hypothetical aggregate rate and utilization
seconds = C/(P*utilization)
assert candidates[0][1] == 10_000_000_000
print('parameter/token choices:', candidates)
print('illustrative hours:', seconds/3600)
