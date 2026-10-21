# 让模型真正可调用：本地接口、流式输出与运行验收 / 先在无socket环境验证真实检查点引擎
# 前置：先运行 python -m curatemicrobiota pipeline --quick --out runs/demo
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

from pathlib import Path
import torch
from curatemicrobiota.language import ByteTokenizer
from curatemicrobiota.local_service import LocalEngine
torch.set_num_threads(1)
checkpoint = Path("runs/demo/language/model.pt")
if not checkpoint.is_file():
    raise FileNotFoundError("Run: python -m curatemicrobiota pipeline --quick --out runs/demo")
engine = LocalEngine(checkpoint)
request = {"prompt": "Microbes ", "max_new_tokens": 8, "seed": 36}
rng_before = torch.get_rng_state().clone()
events = list(engine.events(request))
repeat = list(engine.events(request))[-1]
final = events[-1]
assert final["completion_token_ids"] == repeat["completion_token_ids"]
assert torch.equal(rng_before, torch.get_rng_state())
assert final["completion_tokens"] == 8
reassembled = "".join(e["text_delta"] for e in events if e["event"] == "token") + final["final_text_delta"]
assert reassembled == final["completion"] == ByteTokenizer.decode(final["completion_token_ids"])
print({"checkpoint_sha256": engine.checkpoint_sha256,
       "completion_tokens": final["completion_tokens"], "finish_reason": final["finish_reason"],
       "request_rng_independent": True, "stream_reassembly_matches": True,
       "scope": "actual local checkpoint engine; no HTTP socket in this example"})

