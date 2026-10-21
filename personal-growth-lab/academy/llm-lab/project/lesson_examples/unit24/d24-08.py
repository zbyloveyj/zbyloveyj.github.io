# 推理与部署：把模型放进资源与延迟预算 / 流式输出首先明确时间事件和停止原因
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import numpy as np
def kv_bytes(layers, kv_heads, head_dim, context, batch, element_bytes):
    values = [layers,kv_heads,head_dim,context,batch,element_bytes]
    if any(type(x) is not int or x <= 0 for x in values):
        raise ValueError("positive integer dimensions required")
    return 2*layers*batch*context*kv_heads*head_dim*element_bytes
cache = kv_bytes(32,8,128,8192,1,2)
assert cache == 1024**3
# 合成时间戳：每个事件恰好一个token，不是实测服务性能。
start = 0.0
arrivals = np.array([.120,.140,.165,.190])
if len(arrivals) < 2 or not np.all(np.diff(arrivals) > 0):
    raise ValueError("need increasing token arrival times")
ttft = float(arrivals[0]-start)
tpot = float((arrivals[-1]-arrivals[0])/(len(arrivals)-1))
e2e_rate = float(len(arrivals)/(arrivals[-1]-start))
decode_rate = float((len(arrivals)-1)/(arrivals[-1]-arrivals[0]))
print({"kv_GiB":cache/1024**3, "TTFT_seconds":ttft,
       "TPOT_seconds":tpot, "end_to_end_output_tokens_per_second":e2e_rate,
       "decode_tokens_per_second":decode_rate})
assert np.isclose(ttft,.12) and np.isclose(tpot,.07/3)
context_limit, prompt_tokens, template_tokens, reserved_output = 8192,6900,200,768
assert prompt_tokens+template_tokens+reserved_output <= context_limit
print({"remaining_context_tokens":context_limit-prompt_tokens-template_tokens-reserved_output})
