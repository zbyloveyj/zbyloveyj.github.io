# DNA、蛋白与功能基础模型：从序列到群落 / 反向互补不变性要服从任务含义
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

from collections import Counter
complement = str.maketrans("ACGTN", "TGCAN")
def rc(sequence):
    return sequence.upper().translate(complement)[::-1]
def canonical_kmers(sequence, k=3):
    sequence = sequence.upper()
    counts = Counter()
    for i in range(len(sequence)-k+1):
        token = sequence[i:i+k]
        if set(token) <= set("ACGT"):
            counts[min(token, rc(token))] += 1
    return counts
sequence = "ACGTTNCAACGT"  # 人工字符串，不对应具体生物目标
a = canonical_kmers(sequence); b = canonical_kmers(rc(sequence))
assert rc(rc(sequence)) == sequence
assert a == b
print({"forward": sequence, "reverse_complement": rc(sequence),
       "valid_windows": sum(a.values()), "canonical_counts": dict(sorted(a.items()))})
# 无方向的计数不保留长程次序；链特异任务不应未经判断采用这种不变性。
