# 让模型真正可调用：本地接口、流式输出与运行验收 / 先验证字节预算和错误输入，避免生成时才发现
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

from curatemicrobiota.local_service import validate_request
# 上下文是字节token预算，不是中文字符数；本例不需要模型权重或socket。
accepted = validate_request({"prompt": "菌" * 8, "max_new_tokens": 8}, context=32)
assert len(accepted["prompt_ids"]) == 24
bad = [{"prompt": "菌" * 9, "max_new_tokens": 8},
       {"prompt": "a", "seed": True},
       {"prompt": "a", "temperature": float("nan")},
       {"prompt": "a", "model_path": "another.pt"}]
rejected = 0
for request in bad:
    try:
        validate_request(request, context=32)
    except ValueError:
        rejected += 1
assert rejected == 4
print({"prompt_bytes": len(accepted["prompt_ids"]), "reserved_output": 8,
       "invalid_requests_rejected": rejected})

