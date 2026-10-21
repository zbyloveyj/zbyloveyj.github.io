# 推理与部署：把模型放进资源与延迟预算 / 先证明缓存与完整因果计算等价
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import math, torch
torch.manual_seed(7)
torch.set_num_threads(2)
B, H, T, D = 1, 2, 6, 4
# 固定Q/K/V的单层注意力机制，不是已给TinyGPT接入完整KV cache。
q, k, v = [torch.randn(B, H, T, D) for _ in range(3)]
with torch.inference_mode():
    logits = q @ k.transpose(-2, -1) / math.sqrt(D)
    future = torch.triu(torch.ones(T, T, dtype=torch.bool), diagonal=1)
    full = logits.masked_fill(future, float('-inf')).softmax(-1) @ v
    cached_k, cached_v, outputs = None, None, []
    for t in range(T):
        next_k, next_v = k[:,:,t:t+1], v[:,:,t:t+1]
        cached_k = next_k if cached_k is None else torch.cat([cached_k, next_k], dim=2)
        cached_v = next_v if cached_v is None else torch.cat([cached_v, next_v], dim=2)
        # 当前查询只能看已缓存前缀和当前位置，不存在未来列。
        score = q[:,:,t:t+1] @ cached_k.transpose(-2, -1) / math.sqrt(D)
        outputs.append(score.softmax(-1) @ cached_v)
    incremental = torch.cat(outputs, dim=2)
torch.testing.assert_close(incremental, full, rtol=1e-5, atol=1e-6)
bytes_used = (cached_k.numel()+cached_v.numel())*cached_k.element_size()
assert bytes_used == 2*B*H*T*D*4
print({"max_absolute_error":float((incremental-full).abs().max()),
       "kv_bytes":bytes_used, "all_tokens_match":True})
