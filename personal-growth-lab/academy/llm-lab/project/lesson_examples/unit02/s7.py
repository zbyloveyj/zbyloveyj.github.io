# 从文字到 token：把训练样本做对 / 让任何窗口都能回溯来源
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

docs = {"train_a": list(range(10)), "valid_b": list(range(20, 30))}
def windows(ids, length=4, stride=2):
    return [(i, ids[i:i+length], ids[i+1:i+length+1])
            for i in range(0, len(ids)-length, stride)]
train_ids, valid_ids = {"train_a"}, {"valid_b"}
assert train_ids.isdisjoint(valid_ids)
for doc_id, ids in docs.items():
    for start, x, y in windows(ids):
        assert len(x) == len(y) == 4
        assert x[1:] == y[:-1]
        print(doc_id, start, x, y)
