# 交付 CurateMicrobiota：从可复现原型到研究路线 / 从运行目录建立可复现证据链
# 前置：先运行 python -m curatemicrobiota pipeline --quick --out runs/demo
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import json
from pathlib import Path
from curatemicrobiota.common import file_sha256
root = Path("runs/demo")
report = json.loads((root / "report.json").read_text())
manifest = json.loads((root / "microbiome/manifest.json").read_text())
assert report["source_kind"] == "synthetic_teaching_fixture"
assert report["data"]["samples"] == 240
assert report["data"]["subjects"] == 120
for name, expected in manifest["data_sha256"].items():
    assert file_sha256(root / "data" / name) == expected, name
assert file_sha256(root / "microbiome/preprocessor.json") == manifest["preprocessor_sha256"]
print("Input identity checks passed")
for name in ("language/model.pt", "microbiome/encoder.pt"):
    print(name, file_sha256(root / name))
print(report["environment"])
