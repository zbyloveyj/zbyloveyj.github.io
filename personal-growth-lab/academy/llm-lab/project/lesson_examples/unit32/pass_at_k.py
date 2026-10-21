# 推理与推理时计算：候选、验证器和预算怎样共同决定结果 / 04｜pass@k 衡量候选覆盖，不是最终交付正确率
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

from collections import Counter
from math import comb

def pass_at_k(n, correct, k):
    if not (type(n) is int and type(correct) is int and type(k) is int
            and n >= 1 and 0 <= correct <= n and 1 <= k <= n):
        raise ValueError('require 0<=correct<=n and 1<=k<=n')
    return 1.0 if n-correct < k else 1-comb(n-correct, k)/comb(n, k)

assert pass_at_k(4, 1, 2) == 0.5
assert pass_at_k(4, 0, 4) == 0.0
assert pass_at_k(4, 4, 1) == 1.0
try:
    pass_at_k(4, 1, 5)
except ValueError:
    pass
else:
    raise AssertionError('k>n must be rejected')

# These are hand-authored candidates, not samples from a trained LLM.
cases = [((2,3), [4,4,5,4]), ((4,7), [11,12,11,12]), ((6,6), [10,10,11,11])]
rows=[]
for operands, candidates in cases:
    truth = sum(operands)  # exact arithmetic contract, not a learned judge
    correct = sum(answer == truth for answer in candidates)
    counts = Counter(candidates)
    # Fixed tie rule: earliest candidate among those with maximum frequency.
    majority = max(counts, key=counts.get)
    accepted = [answer for answer in candidates if answer == sum(operands)]
    selected = accepted[0] if accepted else None
    row = {'operands': operands, 'pass@2_estimate': pass_at_k(4,correct,2),
           'any_correct_in_4': bool(correct),
           'majority_correct': majority == truth,
           'verified_selection_correct': selected == truth,
           'verified_selection_status': 'accepted' if accepted else 'no_valid_candidate'}
    rows.append(row)
    print(row)
assert rows[0]['any_correct_in_4'] and not rows[0]['majority_correct']
assert rows[0]['verified_selection_correct']
assert rows[2]['verified_selection_status'] == 'no_valid_candidate'
print('Coverage of candidates, majority success, and selected-answer success differ.')
