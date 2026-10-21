# 工具与 Agent：把科研步骤变成受限、可验证的工作流 / 缓存与幂等：复用结果时仍检查版本和范围
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import hashlib, json
def cache_key(query, corpus_sha, permission_scope):
    # permission_scope来自认证层，不由模型在工具参数中自报。
    contract = {"tool":"retrieve:v1", "query":query,
                "corpus_sha":corpus_sha, "permission_scope":permission_scope,
                "schema":"evidence:v1"}
    return hashlib.sha256(json.dumps(contract, sort_keys=True).encode()).hexdigest()
cache = {}
key = cache_key("subject split", "corpus-001", "public")
cache[key] = {"ids":["fixture-A"], "source_kind":"synthetic"}
assert cache_key("subject split", "corpus-001", "public") in cache
assert cache_key("subject split", "corpus-002", "public") not in cache
assert cache_key("subject split", "corpus-001", "restricted") not in cache
print({"same_version_hit":True, "new_corpus_hit":False, "other_scope_hit":False})
# 这是键隔离机制；实际系统仍必须在缓存命中时重新检查授权与失效策略。
