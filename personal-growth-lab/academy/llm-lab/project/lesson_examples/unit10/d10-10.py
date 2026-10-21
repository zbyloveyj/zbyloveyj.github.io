# 接入真实微生物数据：从样本到训练契约 / 用断言替代“看起来对齐了”
# 前置：先运行 python -m curatemicrobiota make-demo --out data/demo
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import csv, json
from pathlib import Path
p = Path("data/demo")
meta = list(csv.DictReader((p/"metadata.csv").open(encoding="utf-8")))
split = json.loads((p/"split.json").read_text(encoding="utf-8"))
subjects = {part: {r["subject_id"] for r in meta if r["study"] in studies}
            for part, studies in split.items()}
for a,b in [("train","val"),("train","test"),("val","test")]:
    assert not subjects[a] & subjects[b], (a,b)
print({part: len(ids) for part,ids in subjects.items()})
assert len(meta) == 240
assert len({r["subject_id"] for r in meta}) == 120
