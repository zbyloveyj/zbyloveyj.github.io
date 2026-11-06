"""Build or verify the two approved reading editions from complete Markdown."""
from pathlib import Path
import json,re,sys
p=Path(__file__).resolve().parents[1]
for day,name in [(1,'day-01-philosophy-complete.md'),(2,'day-02-psychology-complete.md')]:
 s=(p/name).read_text()
 if day==1:
  a=s.index('## 第一部分');b=s.index('## 第二部分');c=s.index('## 综合复习');d=s.index('## 原著与参考来源')
  intro=s[:a];books=re.split(r'(?=^## \d{2} )',s[a:b],flags=re.M)[1:];points=s[b:c];review=s[c:d];refs=s[d:]
 else:
  a=s.index('## B｜');b=s.index('## C｜');c=s.index('## D｜');d=s.index('## 权威教材')
  intro=s[:a];books=re.split(r'(?=^### \d{2} )',s[a:b],flags=re.M)[1:];points=s[b:c];review=s[c:d];refs=s[d:]
 modules=[];items=[]
 for group in re.split(r'(?=^### 模块)',points,flags=re.M)[1:]:
  title=group.splitlines()[0].removeprefix('### ')
  modules.append(title)
  for m in re.finditer(r'^\*\*(\d{3}) ([^\n]+?)(?:。\*\*|\*\*｜)(.*?)(?=^\*\*\d{3} |\Z)',group,re.M|re.S):
   items.append(dict(id=int(m[1]),title=m[2],body=m[3].strip(),module=title))
 assert len(books)==(10 if day==1 else 8),(day,len(books))
 assert len(items)==100,(day,len(items))
 assert [x['id'] for x in items]==list(range(1,101))
 assert len(modules)==10 and all(sum(x['module']==g for x in items)==10 for g in modules)
 assert all(x['body'] and '例子' in x['body'] for x in items)
 out=dict(day=day,source=name,intro=intro,books=books,modules=modules,items=items,review=review,references=refs)
 target=p/f'course-{day:02}.json'
 expected=json.dumps(out,ensure_ascii=False,indent=2)+'\n'
 if '--check' in sys.argv:
  assert target.read_text()==expected, f'Rebuild {target.name}'
 else:
  target.write_text(expected)
print('Verified 18 book guides and 200 core concepts across both approved editions.')
