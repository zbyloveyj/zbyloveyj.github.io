# 语料工程与真正的 BPE：模型之前的数据系统 / BPE训练：把合并规则真正学出来
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

from collections import Counter
texts = ['microbe microbiome microbe', 'gut microbiome and microbe', '菌群与微生物，菌群与宿主']
def merge_pair(seq, pair, new_id):
    out, i = [], 0
    while i < len(seq):
        if i+1 < len(seq) and (seq[i], seq[i+1]) == pair:
            out.append(new_id); i += 2
        else:
            out.append(seq[i]); i += 1
    return out
vocab = {i: bytes([i]) for i in range(256)}
seqs = [list(t.encode('utf-8')) for t in texts]
merges = []
for _ in range(20):
    counts = Counter(pair for seq in seqs for pair in zip(seq, seq[1:]))
    if not counts: break
    pair = min(counts, key=lambda p: (-counts[p], p))
    new_id = len(vocab)
    vocab[new_id] = vocab[pair[0]] + vocab[pair[1]]
    seqs = [merge_pair(seq, pair, new_id) for seq in seqs]
    merges.append((pair, new_id))
print('learned merges:', len(merges), 'vocabulary:', len(vocab))
