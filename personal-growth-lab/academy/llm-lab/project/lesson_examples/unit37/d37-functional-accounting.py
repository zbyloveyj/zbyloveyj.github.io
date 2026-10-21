# 从原始宏基因组到模型输入：把测量链补完整 / 独立实验二：抓住功能总量与物种贡献的重复计数
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import math
# 人工基因家族表：同一单位、同一层级，所有物种贡献（含未分类）均保留。
rows = {"GF_A": 10.0, "GF_A|taxon_1": 6.0, "GF_A|taxon_2": 3.0,
        "GF_A|unclassified": 1.0, "GF_B": 5.0,
        "GF_B|taxon_1": 2.0, "GF_B|unclassified": 3.0}
total = {k:v for k,v in rows.items() if "|" not in k}
for family, amount in total.items():
    parts = [v for k,v in rows.items() if k.startswith(family+"|")]
    assert math.isclose(sum(parts), amount, rel_tol=1e-9, abs_tol=1e-9)
assert sum(total.values()) == 15.0
assert sum(rows.values()) == 30.0
fractions = {k: v/sum(total.values()) for k,v in total.items()}
assert math.isclose(sum(fractions.values()), 1.0)
print({"unstratified_total": sum(total.values()),
       "incorrect_double_count": sum(rows.values()),
       "fractions_for_this_retained_feature_set": fractions})
# 这是基因家族的守恒例子；推断出的通路总量不必等于物种通路量之和。

