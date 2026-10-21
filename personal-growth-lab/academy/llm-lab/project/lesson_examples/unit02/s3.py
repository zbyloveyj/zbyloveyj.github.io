# 从文字到 token：把训练样本做对 / 手工做一次 BPE
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

from collections import Counter
seqs = [list("ababa"), list("aba")]
pairs = Counter(pair for s in seqs for pair in zip(s, s[1:]))
print(pairs)
def merge_once(seq, pair, new):
    out, i = [], 0
    while i < len(seq):
        if i + 1 < len(seq) and tuple(seq[i:i+2]) == pair:
            out.append(new); i += 2
        else:
            out.append(seq[i]); i += 1
    return out
assert merge_once(seqs[0], ("a", "b"), "X") == ["X", "X", "a"]
