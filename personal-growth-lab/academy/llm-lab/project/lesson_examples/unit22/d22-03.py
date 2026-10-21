# 工具与 Agent：把科研步骤变成受限、可验证的工作流 / 工具合同要同时约束名称、字段、单位和结果
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import math
# 这是手写的小合同验证器，不是通用JSON Schema实现。
def invoke(request, granted_tools):
    if type(request) is not dict or set(request) != {"name", "arguments"}:
        raise ValueError("invalid request fields")
    name, args = request["name"], request["arguments"]
    if type(name) is not str or name not in granted_tools:
        raise PermissionError("tool is not granted by the caller")
    if name != "mean_relative":
        raise ValueError("unknown registered tool")
    if type(args) is not dict or set(args) != {"values"}:
        raise ValueError("invalid arguments")
    values = args["values"]
    if type(values) is not list or not 1 <= len(values) <= 256:
        raise ValueError("values must contain 1..256 numbers")
    # Python bool是int子类；这里显式排除，且拒绝NaN/Infinity。
    if any(type(x) not in (int, float) or not math.isfinite(x) or not 0 <= x <= 1
           for x in values):
        raise ValueError("each relative abundance must be finite and within [0,1]")
    result = {"mean": sum(values) / len(values), "n": len(values)}
    if set(result) != {"mean", "n"} or result["n"] != len(values):
        raise RuntimeError("tool result violates its contract")
    if not math.isfinite(result["mean"]) or not 0 <= result["mean"] <= 1:
        raise RuntimeError("invalid mean")
    return result
good = {"name":"mean_relative", "arguments":{"values":[.1,.3,.2]}}
result = invoke(good, granted_tools={"mean_relative"})
print(result)
assert math.isclose(result["mean"], .2)
for bad in [True, float("nan"), 1.2]:
    try:
        invoke({"name":"mean_relative", "arguments":{"values":[bad]}}, {"mean_relative"})
    except ValueError:
        pass
    else:
        raise AssertionError("bad numeric argument accepted")
try:
    invoke(good, granted_tools=set())
except PermissionError:
    print("ungranted tool rejected")
else:
    raise AssertionError("permission check missing")
