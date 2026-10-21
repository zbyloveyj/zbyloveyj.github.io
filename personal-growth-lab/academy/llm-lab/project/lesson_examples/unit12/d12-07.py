# 让模型经得起比较：基线、外测与不确定性 / 留一研究外测需要每折重新训练
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

studies = [f"STUDY_{i:02d}" for i in range(1,7)]
for i, test in enumerate(studies):
    val = studies[(i+1) % len(studies)]
    train = [x for x in studies if x not in {test,val}]
    assert not set(train) & {test,val}
    print({"outer_fold": i+1, "train": train, "val": [val], "test": [test]})
# 这只生成计划；每折必须重新拟合预处理、预训练与分类器。
