# 语料工程与真正的 BPE：模型之前的数据系统 / 准确重复、近重复和同源关系
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import hashlib, re, unicodedata
def normalize(text):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', text)).strip()
def digest(text):
    return hashlib.sha256(normalize(text).encode('utf-8')).hexdigest()
assert digest('Microbe   A') == digest('Microbe A')
assert digest('dose 10 mg') != digest('dose 100 mg')
def shingles(text, n=3):
    words = normalize(text).split()
    return {tuple(words[i:i+n]) for i in range(max(0, len(words)-n+1))}
a = shingles('gut microbes affect host metabolic processes in this cohort')
b = shingles('gut microbes affect host metabolic processes in another cohort')
score = len(a & b) / len(a | b)
print('Jaccard candidate score:', score)
assert 0 < score < 1
