# 持续学习与知识蒸馏：学新任务时怎样保留旧能力 / 04｜回放保留旧信号，却不会消除目标冲突
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

def adapt(start, replay_weight, steps=100, learning_rate=0.1):
    if not 0 <= replay_weight <= 1:
        raise ValueError('replay weight must lie in [0,1]')
    value = start
    for _ in range(steps):
        # Old objective A=(w-1)^2; new objective B=(w+1)^2.
        gradient = 2*((1-replay_weight)*(value+1) + replay_weight*(value-1))
        value -= learning_rate*gradient
    return value

after_A = 1.0
naive = adapt(after_A, replay_weight=0.0)
replay = adapt(after_A, replay_weight=0.5)
def losses(value): return {'old_loss': (value-1)**2, 'new_loss': (value+1)**2}
assert abs(naive+1) < 1e-7
assert abs(replay) < 1e-7
assert losses(replay)['old_loss'] < losses(naive)['old_loss']
assert losses(replay)['new_loss'] > losses(naive)['new_loss']
print({'after_A': losses(after_A), 'after_B_only': losses(naive),
       'after_B_with_replay': losses(replay)})
print('A deliberately conflicting one-parameter example, not a language-model benchmark.')
