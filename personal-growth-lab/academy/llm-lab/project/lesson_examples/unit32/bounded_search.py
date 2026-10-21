# 推理与推理时计算：候选、验证器和预算怎样共同决定结果 / 07｜用可核验证书区分成功和停止
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

from collections import deque

def check_certificate(path, start=1, goal=7):
    return (isinstance(path, list) and bool(path)
            and path[0] == start and path[-1] == goal
            and all(type(x) is int and 1 <= x <= 12 for x in path)
            and all(b in (a+1, a*2) for a,b in zip(path,path[1:])))

def bounded_search(max_expansions, goal=7):
    if type(max_expansions) is not int or max_expansions < 0:
        raise ValueError('budget must be a nonnegative integer')
    queue = deque([[1]])
    seen = {1}
    expanded = 0
    while queue:
        path = queue.popleft()
        if path[-1] == goal:
            assert check_certificate(path, goal=goal)
            return {'status': 'verified', 'expanded': expanded, 'path': path}
        if expanded >= max_expansions:
            return {'status': 'budget_exhausted', 'expanded': expanded, 'path': None}
        expanded += 1
        for value in (path[-1]+1, path[-1]*2):
            if value <= 12 and value not in seen:
                seen.add(value)
                queue.append(path+[value])
    return {'status': 'search_exhausted', 'expanded': expanded, 'path': None}

small = bounded_search(2)
enough = bounded_search(20)
impossible = bounded_search(20, goal=13)
assert small['status'] == 'budget_exhausted' and small['expanded'] == 2
assert enough['status'] == 'verified' and check_certificate(enough['path'])
assert impossible['status'] == 'search_exhausted'
assert not check_certificate([1,2,7])
print(small)
print(enough)
print(impossible)
print('Finite arithmetic graph only: no LLM proposal or learned verifier is used.')
