# 从文字到 token：把训练样本做对 / 计算机看到的文本，比“一个字”复杂
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

text = "菌A"
raw = text.encode("utf-8")
print(len(text), len(raw), list(raw))
assert len(text) == 2 and len(raw) == 4
assert bytes(list(raw)).decode("utf-8") == text
