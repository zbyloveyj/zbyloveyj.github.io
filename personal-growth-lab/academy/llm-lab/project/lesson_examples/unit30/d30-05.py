# 科研级 Capstone：从合成流程到多队列证据 / 05｜独立代码一：用摘要锁定输入、划分与配置
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import copy, hashlib, json

def digest(obj):
    encoded = json.dumps(obj, sort_keys=True, ensure_ascii=False,
                         separators=(",", ":"), allow_nan=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()

# Entirely artificial examples; these are not identifiers from a real cohort.
data = {"source_kind": "synthetic_teaching_example",
        "units": "relative_abundance_proportion",
        "features": ["toy_taxon_A", "toy_taxon_B"],
        "samples": [{"id": "toy_01", "values": [0.25, 0.75]}]}
split = {"train_studies": ["toy_study_A"],
         "validation_studies": ["toy_study_B"],
         "test_studies": ["toy_study_C"]}
config = {"seed": 42, "mask_rate": 0.25,
          "feature_order": data["features"],
          "preprocessing_fit_scope": "training_studies_only"}
manifest = {"data_sha256": digest(data), "split_sha256": digest(split),
            "config_sha256": digest(config),
            "code_version": "example_only_replace_with_actual_commit"}
assert digest(dict(reversed(list(data.items())))) == manifest["data_sha256"]
changed = copy.deepcopy(data)
changed["samples"][0]["values"] = [0.30, 0.70]
assert digest(changed) != manifest["data_sha256"]
changed_config = dict(config, seed=43)
assert digest(changed_config) != manifest["config_sha256"]
print(json.dumps(manifest, indent=2))
print("Detected data and configuration changes; provenance is not scientific validity.")

