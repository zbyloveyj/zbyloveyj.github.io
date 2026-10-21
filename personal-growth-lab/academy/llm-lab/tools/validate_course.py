"""Validate complete lessons, published artifacts and the project entry point."""
import ast
import json
import re
from pathlib import Path, PurePosixPath
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
lessons=[]
python_blocks=0
for day in range(1,31):
    p=ROOT/'course'/f'day{day:02d}.json'
    l=json.loads(p.read_text(encoding='utf-8'))
    assert l['day']==day
    for key in ['title','subtitle','phase','next']:
        assert isinstance(l[key],str) and l[key].strip(), (day,key)
    assert 8 <= len(l['sections']) <= 16
    assert len(l['objectives']) >= 3 and len(l['deliverables']) >= 2
    assert len(l['lab']['steps']) >= 3 and len(l['lab']['acceptance']) >= 3
    assert len(l['exercises']) >= 3 and len(l['quiz']) >= 5
    cjk=len(re.findall(r'[\u4e00-\u9fff]',json.dumps(l,ensure_ascii=False)))
    assert cjk >= (3900 if day<=14 else 3500), (day,'insufficient substance',cjk)
    md=(ROOT/'downloads'/f'day{day:02d}.md').read_text(encoding='utf-8')
    for section in l['sections']:
        assert section['title'] and section['paragraphs']
        for para in section['paragraphs']:
            assert para in md,(day,'download lost paragraph')
        if section.get('code'):
            c=section['code']
            assert c['text'] in md,(day,'download lost code')
            if c['language'].lower()=='python':
                ast.parse(c['text'],filename=f'day{day:02d}/{section["id"]}')
                python_blocks+=1
    for q in l['quiz']:
        assert len(q['options'])==4 and type(q['correct']) is int and 0<=q['correct']<4
        assert len(set(q['options']))==4 and q['explanation'].strip()
    for p in l['papers']:
        assert p['url'].startswith('https://') and p['questions'] and p['read']
    lessons.append(l)

for name in ['index.html','handbook.html','assets/course-data.js','assets/lab.js','assets/lab.css','assets/evidence-data.js','downloads/curatemicrobiota-course.md','course-manifest.json','coverage.json']:
    assert (ROOT/name).is_file(),name
assert len({l['day'] for l in lessons})==30
coverage=json.loads((ROOT/'coverage.json').read_text(encoding='utf-8'))
assert len(coverage['groups'])>=6
for group in coverage['groups']:
    for topic in group['topics']:
        assert topic['level'] in coverage['levels']
        assert topic['lessons'] and all(1<=d<=30 for d in topic['lessons'])
        assert topic['outcome'] and topic['artifact']
entry=(ROOT.parent/'index.html').read_text(encoding='utf-8')
assert 'assets/curatemicrobiota-bridge.js' in entry and 'llm-lab/' in entry
app=(ROOT.parent/'assets/app.js').read_text(encoding='utf-8')
assert 'A.externalCourses' in app
archive_members = 0
for archive_name, prefix, source_root in [
    ('curatemicrobiota-project.zip', 'curatemicrobiota-project', ROOT/'project'),
    ('curatemicrobiota-complete.zip', 'curatemicrobiota-learning', ROOT),
]:
    with ZipFile(ROOT/'downloads'/archive_name) as archive:
        assert archive.testzip() is None, (archive_name, 'CRC failure')
        for member in archive.infolist():
            if member.is_dir():
                continue
            rel = PurePosixPath(member.filename)
            assert rel.parts[0] == prefix and '..' not in rel.parts, member.filename
            source = source_root.joinpath(*rel.parts[1:])
            assert source.is_file(), (archive_name, 'missing source', member.filename)
            assert archive.read(member) == source.read_bytes(), (archive_name, 'stale member', member.filename)
            archive_members += 1
print(json.dumps({'status':'passed','lessons':len(lessons),'python_blocks_syntax_checked':python_blocks,'downloaded_content_matches_source':True,'archive_members_verified':archive_members},ensure_ascii=False))
