# 推理与部署：把模型放进资源与延迟预算 / 量化：看数值范围、比例因子与任务误差
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import numpy as np
rng = np.random.default_rng(7)
weights = rng.normal(size=(4,8)).astype(np.float32)
weights[-1] = 0  # 全零行不能除以零。
maximum = np.max(np.abs(weights), axis=1, keepdims=True)
scale = np.where(maximum > 0, maximum/127, 1).astype(np.float32)
quantized = np.clip(np.rint(weights/scale), -127, 127).astype(np.int8)
restored = quantized.astype(np.float32)*scale
error = np.abs(restored-weights)
assert np.all(error <= scale/2 + 1e-6)
assert np.all(quantized[-1] == 0)
x = rng.normal(size=(3,8)).astype(np.float32)
reference, approximate = x@weights.T, x@restored.T
print({"weight_fp32_bytes":weights.nbytes,
       "int8_plus_scale_bytes":quantized.nbytes+scale.nbytes,
       "max_weight_error":float(error.max()),
       "max_output_error":float(np.max(np.abs(reference-approximate)))})
# 乘法仍在反量化后的float32上进行，不是整数kernel，也不是速度基准。
