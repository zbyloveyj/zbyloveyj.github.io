# 提示与上下文工程：让每一次输入成为可比较的实验 / 05｜先分配上下文，再装入材料
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import hashlib
import json
from curatemicrobiota.language import ByteTokenizer

def render(question, cards):
    # This is an explicit teaching template, not an external model's chat template.
    return ('TASK: use only the supplied evidence; preserve uncertainty.\n'
            + '\n'.join('EVIDENCE '+c['id']+': '+c['text'] for c in cards)
            + '\nQUESTION: '+question+'\nANSWER:')

def assemble(question, ranked_cards, context_limit, output_reserve):
    if context_limit <= 0 or not 0 <= output_reserve < context_limit:
        raise ValueError('invalid context/output budget')
    selected, dropped = [], []
    if len(ByteTokenizer.encode(render(question, []))) + output_reserve > context_limit:
        raise ValueError('mandatory task and question do not fit')
    if len({c['id'] for c in ranked_cards}) != len(ranked_cards):
        raise ValueError('duplicate evidence ID')
    for card in ranked_cards:
        candidate = render(question, selected+[card])
        if len(ByteTokenizer.encode(candidate)) + output_reserve <= context_limit:
            selected.append(card)
        else:
            dropped.append(card['id'])
    prompt = render(question, selected)
    manifest = {'template': 'evidence-v1', 'tokenizer': 'utf8-byte-v1',
                'context_limit': context_limit, 'output_reserve': output_reserve,
                'input_tokens': len(ByteTokenizer.encode(prompt)),
                'kept': [c['id'] for c in selected], 'dropped': dropped,
                'sha256': hashlib.sha256(prompt.encode('utf-8')).hexdigest()}
    return prompt, manifest

cards = [{'id': 'A', 'text': '关联不等于因果。'},
         {'id': 'B', 'text': 'Repeated explanatory background. '*30},
         {'id': 'C', 'text': 'A held-out study was not used in training.'}]
prompt, report = assemble('What can the study establish?', cards, 360, 40)
assert report['kept'] == ['A', 'C'] and report['dropped'] == ['B']
assert report['input_tokens'] + report['output_reserve'] <= 360
assert len(ByteTokenizer.encode('微生物')) == 9 and len('微生物') == 3
assert report == assemble('What can the study establish?', cards, 360, 40)[1]
try:
    assemble('x'*400, cards, 360, 40)
except ValueError:
    pass
else:
    raise AssertionError('mandatory content must not be silently truncated')
print(json.dumps(report, ensure_ascii=False, indent=2))
print('Assembly only: no model was loaded; 360 is not TinyGPT default capacity.')
