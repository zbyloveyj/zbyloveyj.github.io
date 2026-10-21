# 语料工程与真正的 BPE：模型之前的数据系统 / 编码阶段不能重新训练词表
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

vocab = {i: bytes([i]) for i in range(256)}
# Fixed saved-rule fixture; use section 4 or advanced.bpe to train rules.
pairs = [(109,105), (256,99), (257,114), (258,111), (259,98), (260,101)]
merges = []
for pair in pairs:
    new_id = len(vocab)
    vocab[new_id] = vocab[pair[0]] + vocab[pair[1]]
    merges.append((pair,new_id))
def merge_pair(seq, pair, new_id):
    out, i = [], 0
    while i < len(seq):
        if i+1 < len(seq) and (seq[i],seq[i+1]) == pair:
            out.append(new_id); i += 2
        else:
            out.append(seq[i]); i += 1
    return out
def encode_bpe(text):
    ids = list(text.encode('utf-8'))
    for pair,new_id in merges:
        ids = merge_pair(ids,pair,new_id)
    return ids
def decode_bpe(ids):
    return b''.join(vocab[i] for i in ids).decode('utf-8')
assert encode_bpe('microbe') == [261]
for text in ['microbe microbiome', '菌群与宿主', 'Faecalibacterium prausnitzii', 'GCF_000166035.1']:
    ids = encode_bpe(text)
    assert decode_bpe(ids) == text
    print(text, len(text), len(text.encode('utf-8')), len(ids))
