# 训练你的微生物自监督 Transformer / 用两项单元实验检查模型假设
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
from curatemicrobiota.microbiome import MicrobiomeConfig, MaskedMicrobiomeEncoder
torch.manual_seed(11)
m = MaskedMicrobiomeEncoder(MicrobiomeConfig(taxa=6, width=8, heads=2, layers=1, dropout=0.0)).eval()
x = torch.randn(2,6)
mask = torch.tensor([[1,1,0,0,0,0],[0,0,1,1,0,0]], dtype=torch.bool)
a, h = m(x,mask)
changed = x.clone(); changed[mask] += 1000
b, _ = m(changed,mask)
assert torch.allclose(a,b,atol=1e-6)
perm = torch.tensor([4,2,5,0,3,1])
c, g = m(x[:,perm],mask[:,perm],taxon_ids=torch.arange(6)[perm])
assert torch.allclose(c,a[:,perm],atol=1e-5)
assert torch.allclose(g,h,atol=1e-5)
print("masked-input and permutation checks passed")
