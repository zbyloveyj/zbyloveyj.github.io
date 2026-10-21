# 深入 RAG：从找到材料到可核验的证据系统 / 结构化输出通过语法后，还要过引用与语义核验
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import copy, json
# 验证结构、引用成员关系及人工核验状态；不自动判断自然语言蕴含。
retrieved_ids = {"B", "D"}
def validate_answer(row):
    if type(row) is not dict or set(row) != {"status", "claims"}:
        raise ValueError("unexpected answer fields")
    if row["status"] not in {"supported", "conflicting", "insufficient"}:
        raise ValueError("unknown status")
    if type(row["claims"]) is not list:
        raise ValueError("claims must be a list")
    if row["status"] != "insufficient" and not row["claims"]:
        raise ValueError("nonempty claims required")
    for claim in row["claims"]:
        if type(claim) is not dict or set(claim) != {"text", "evidence_ids", "review"}:
            raise ValueError("invalid claim fields")
        refs = claim["evidence_ids"]
        if not isinstance(claim["text"], str) or not claim["text"].strip():
            raise ValueError("empty claim")
        if type(refs) is not list or any(type(x) is not str for x in refs):
            raise ValueError("reference IDs must be strings")
        if len(set(refs)) != len(refs) or not set(refs) <= retrieved_ids:
            raise ValueError("unknown or repeated evidence ID")
        if claim["review"] not in {"human_supported", "needs_review", "conflicting"}:
            raise ValueError("unknown review state")
        if row["status"] == "supported" and (not refs or claim["review"] != "human_supported"):
            raise ValueError("supported claims need references and review")
    return row
good = {"status":"supported", "claims":[{
    "text":"教学片段B涉及按研究和受试者划分。",
    "evidence_ids":["B"], "review":"human_supported"}]}
print(json.dumps(validate_answer(good), ensure_ascii=False))
bad = copy.deepcopy(good); bad["claims"][0]["evidence_ids"] = ["invented-id"]
try:
    validate_answer(bad)
except ValueError as error:
    print("rejected:", error)
else:
    raise AssertionError("unknown ID was accepted")
