# 提示与上下文工程：让每一次输入成为可比较的实验 / 07｜约束解码保证可接受形式，仍要检查意义
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import json
import torch

# A one-token enum is a small constraint example, not a complete JSON grammar.
vocabulary = ['supported', 'insufficient', 'invented']
logits = torch.tensor([1., 0., 8.], dtype=torch.float64)
allowed = torch.tensor([True, True, False])
masked = logits.masked_fill(~allowed, float('-inf'))
probability = torch.softmax(masked, dim=0)
assert float(probability[2]) == 0.0
chosen = vocabulary[int(probability.argmax())]
assert chosen == 'supported'

def validate_shape(raw):
    obj = json.loads(raw)
    if not isinstance(obj, dict) or set(obj) != {'status', 'claim', 'evidence_ids'}:
        raise ValueError('unexpected fields')
    if obj['status'] not in {'supported', 'insufficient'}:
        raise ValueError('invalid status')
    if not isinstance(obj['claim'], str) or not obj['claim']:
        raise ValueError('claim must be nonempty text')
    if not isinstance(obj['evidence_ids'], list) or not all(type(x) is str for x in obj['evidence_ids']):
        raise ValueError('evidence_ids must be a string list')
    return obj

catalog = {'E1': {'design': 'observational', 'measured': ['relative_abundance']}}
bad = validate_shape(json.dumps({'status': 'supported',
    'claim': 'The microbe causes the phenotype.', 'evidence_ids': ['E1']}))
assert set(bad['evidence_ids']) <= set(catalog)
# The ID exists and JSON is valid, but these checks have not proved the claim.
verified_causal_claim = any(catalog[i]['design'] == 'randomized_intervention'
                            for i in bad['evidence_ids'])
assert not verified_causal_claim
try:
    validate_shape('{"status":"supported","claim":"x","evidence_ids":42}')
except ValueError:
    pass
else:
    raise AssertionError('wrong field type accepted')
print('enum:', chosen, '| schema: valid | citation ID: valid | causal support: absent')
print('A randomized label would still require detailed scientific review.')
