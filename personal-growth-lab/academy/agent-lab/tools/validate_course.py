#!/usr/bin/env python3
"""Validate complete teaching units and their published artifacts."""
import json, re, sys, zipfile
from pathlib import Path
R=Path(__file__).resolve().parents[1]
lessons=[json.loads(p.read_text()) for p in sorted((R/'course').glob('day*.json'))]
assert [d['day'] for d in lessons]==list(range(1,31))
stats={'lessons':30,'minutes':0,'concepts':0,'walkthrough_steps':0,'checks':0,'quizzes':0,'command_blocks':0}
for d in lessons:
    n=d['day'];assert d['minutes']==60 and sum(x['minutes'] for x in d['agenda'])==60,n
    assert len(d['concepts'])>=4 and all(len(x['paragraphs'])>=2 for x in d['concepts']),n
    assert len(d['walkthrough'])>=4 and sum(bool(x['command']) for x in d['walkthrough'])>=2,n
    assert len(d['deliverable']['checks'])>=3 and d['deliverable']['file'],n
    assert len(d['quiz'])>=2 and all(len(q['options'])==4 and 0<=q['answer']<4 and len(q['explanation'])>=15 for q in d['quiz']),n
    assert d['lite']['minutes']==20 and d['stretch']['minutes']==20,n
    assert len(d['troubleshooting'])>=2 and len(d['references'])>=1,n
    assert all(r['url'].startswith('https://') and r['scope'] for r in d['references']),n
    assert d['outcomes'] and d['experiment']['instructions'] and d['experiment']['expected'],n
    assert d['phase']==min((n-1)//7+1,5),n
    for key,field in [('concepts','concepts'),('walkthrough_steps','walkthrough'),('checks',None),('quizzes','quiz')]:stats[key]+=len(d[field] if field else d['deliverable']['checks'])
    stats['command_blocks']+=sum(bool(x['command']) for x in d['walkthrough']);stats['minutes']+=d['minutes']
    for ext in ['md','pdf']:assert (R/f'downloads/day{n:02d}.{ext}').is_file(),(n,ext)
    text=(R/f'downloads/day{n:02d}.md').read_text()
    assert d['title'] in text and all(q['explanation'] in text for q in d['quiz']),n
sources=json.loads((R/'sources.json').read_text());sources=sources.get('sources',[]) if isinstance(sources,dict) else sources
assert len({s['id'] for s in sources})==len(sources)
assert sum(s.get('starred',False) for s in sources)==2
assert sum(s.get('forked',False) for s in sources)>=2
assert any(s.get('kind')=='own-project' for s in sources)
for name in ['agent-practice.zip','agent-complete.zip']:
    with zipfile.ZipFile(R/'downloads'/name) as z:
        assert z.testzip() is None
        assert 'practice/run.py' in z.namelist()
        assert not any('/outputs/' in p or '/.env' in p or '__pycache__' in p for p in z.namelist())
stats.update(sources=len(sources),pdfs=len(list((R/'downloads').glob('*.pdf'))),status='passed')
print(json.dumps(stats,ensure_ascii=False,indent=2))
