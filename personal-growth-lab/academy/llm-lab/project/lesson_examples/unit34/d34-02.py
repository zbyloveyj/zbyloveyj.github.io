# 接上真实预训练模型：从文件快照到可复现适配 / 一个模型快照是一组相互约束的文件
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import hashlib, json, tempfile
from pathlib import Path
# 原创微型文件夹具，不是假装下载了外部预训练模型。
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
with tempfile.TemporaryDirectory() as folder:
    root = Path(folder)
    (root / "config.json").write_text(json.dumps({"vocab_size": 2}), encoding="utf-8")
    (root / "tokenizer.json").write_text(json.dumps({"microbe": 0, "cohort": 1}), encoding="utf-8")
    manifest = {p.name: digest(p) for p in sorted(root.iterdir())}
    def check():
        if any(digest(root / name) != expected for name, expected in manifest.items()):
            raise ValueError("snapshot files changed")
    check()
    # 两个词表大小相同，ID语义却已互换。
    (root / "tokenizer.json").write_text(json.dumps({"microbe": 1, "cohort": 0}), encoding="utf-8")
    try:
        check()
    except ValueError:
        rejected = True
    else:
        rejected = False
    assert rejected
    print({"same_vocab_size": True, "changed_tokenizer_rejected": rejected,
           "frozen_files": sorted(manifest)})

