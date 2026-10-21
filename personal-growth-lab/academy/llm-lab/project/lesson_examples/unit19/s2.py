# 规模化与系统：先算清账，再扩大模型 / KV缓存按键值头计算，激活按实际图计算
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

N, L, B, T, Hkv, dh, s = 7_000_000_000, 32, 1, 8192, 8, 128, 2
kv = 2*L*B*T*Hkv*dh*s
assert kv == 2**30
ledger = {'bf16_weight_gib':2*N/2**30,
          'example_adam_state_gib':16*N/2**30,
          'kv_gib':kv/2**30,
          'double_batch_double_context_kv_gib':4*kv/2**30}
print(ledger)
