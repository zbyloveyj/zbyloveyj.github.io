# 后训练全景：从答案监督到偏好优化 / 答案mask：正确的监督从第一个答案token开始
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
prompt, response = 'Question: A?\nAnswer:', 'B\n'
sequence = list((prompt+response).encode('utf-8'))
P, valid_length = len(prompt.encode('utf-8')), len(sequence)
padded = sequence + [0,0,0]
x = torch.tensor(padded[:-1], dtype=torch.long)
labels = torch.tensor(padded[1:], dtype=torch.long)
original_target_position = torch.arange(1, len(padded))
ignored = (original_target_position < P) | (original_target_position >= valid_length)
labels[ignored] = -100
assert int(torch.nonzero(labels != -100)[0,0]) == P-1
assert bytes(labels[labels != -100].tolist()).decode() == response
assert x.shape == labels.shape
print('supervised target positions:', torch.nonzero(labels != -100).flatten().tolist())
