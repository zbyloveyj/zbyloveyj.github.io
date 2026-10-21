# 从原始宏基因组到模型输入：把测量链补完整 / 独立实验一：让过滤日志在数量上说得通
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

from copy import deepcopy
# 合成日志；所有数量都是单条 read，不是 read pair，也不是碱基数。
records = [
    {"sample_id": "S1", "unit": "reads", "raw": 10000,
     "qc_pass": 9000, "host_removed": 1000, "analysis": 8000},
    {"sample_id": "S2", "unit": "reads", "raw": 12000,
     "qc_pass": 11000, "host_removed": 3000, "analysis": 8000},
]
def audit(records):
    ids = [r["sample_id"] for r in records]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate sample_id")
    rows = []
    for r in records:
        if r["unit"] != "reads":
            raise ValueError("Do not mix reads and pairs")
        vals = [r[k] for k in ("raw", "qc_pass", "host_removed", "analysis")]
        if any(type(v) is not int or v < 0 for v in vals):
            raise ValueError("Counts must be nonnegative integers")
        if not (r["raw"] > 0 and r["qc_pass"] <= r["raw"]
                and r["analysis"] == r["qc_pass"] - r["host_removed"]):
            raise ValueError("Sequential count contract violated")
        rows.append({"sample_id": r["sample_id"],
                     "retained_fraction": r["analysis"] / r["raw"]})
    return rows
summary = audit(records)
assert summary[0]["retained_fraction"] == 0.8
bad = deepcopy(records); bad[1]["analysis"] += 1
try:
    audit(bad)
except ValueError:
    print("Expected rejection: inconsistent stage counts")
else:
    raise AssertionError("Invalid counts must be rejected")
print(summary)
# 此合同只适用于这里声明的顺序过滤日志；真实工具须先解析其计数定义。

