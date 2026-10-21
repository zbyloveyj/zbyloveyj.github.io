# 让模型真正可调用：本地接口、流式输出与运行验收 / 字节流与可见文字不是一对一关系
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import codecs
text = "微生物abc"
raw = text.encode("utf-8")
decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
deltas = [decoder.decode(bytes([byte]), final=False) for byte in raw]
tail = decoder.decode(b"", final=True)
assert "".join(deltas) + tail == text
assert any(delta == "" for delta in deltas)
# 截止时留下不完整编码，应在终态冲洗；不是每次收到单字节就错误解码。
partial = codecs.getincrementaldecoder("utf-8")(errors="replace")
assert partial.decode(b"\xe5", final=False) == ""
assert partial.decode(b"", final=True) == "\ufffd"
print({"byte_tokens": len(raw), "visible_characters": len(text),
       "reassembled_text": "".join(deltas) + tail,
       "incomplete_tail_reported": True})

