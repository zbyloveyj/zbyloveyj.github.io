"""Build or verify the available reading editions from complete Markdown."""
from pathlib import Path
import json,re,sys
p=Path(__file__).resolve().parents[1]
editions = [
 (1,'day-01-philosophy-complete.md',10),
 (2,'day-02-psychology-complete.md',8),
 (3,'courses/day-03-economics.md',7),
 (4,'courses/day-04-history.md',8),
]
for day,name,book_count in editions:
 s=(p/name).read_text()
 if day==1:
  a=s.index('## 第一部分');b=s.index('## 第二部分');c=s.index('## 综合复习');d=s.index('## 原著与参考来源')
  intro=s[:a];books=re.split(r'(?=^## \d{2} )',s[a:b],flags=re.M)[1:];points=s[b:c];review=s[c:d];refs=s[d:]
 else:
  a=s.index('## B｜');b=s.index('## C｜');c=s.index('## D｜');d=s.index('## 权威教材')
  intro=s[:a];books=re.split(r'(?=^### \d{2} )',s[a:b],flags=re.M)[1:];points=s[b:c];review=s[c:d];refs=s[d:]
 modules=[];items=[];guides={}
 for group in re.split(r'(?=^### 模块)',points,flags=re.M)[1:]:
  title=group.splitlines()[0].removeprefix('### ')
  modules.append(title)
  first=re.search(r'^\*\*\d{3} ',group,re.M)
  closing=re.search(r'^#### 模块\d{2}小结与衔接',group,re.M)
  prelude=group[len(group.splitlines()[0]):first.start()].strip()
  if prelude or closing:
   guides[title]={'intro':prelude,'review':group[closing.start():].strip() if closing else ''}
  for m in re.finditer(r'^\*\*(\d{3}) ([^\n]+?)(?:。\*\*|\*\*｜)(.*?)(?=^\*\*\d{3} |^#### 模块\d{2}小结与衔接|\Z)',group,re.M|re.S):
   items.append(dict(id=int(m[1]),title=m[2],body=m[3].strip(),module=title))
 assert len(books)==book_count,(day,len(books))
 assert len(items)==100,(day,len(items))
 assert [x['id'] for x in items]==list(range(1,101))
 assert len(modules)==10 and all(sum(x['module']==g for x in items)==10 for g in modules)
 assert all(x['body'] and '例子' in x['body'] for x in items)
 out=dict(day=day,source=name,intro=intro,books=books,modules=modules,items=items,review=review,references=refs)
 if guides:out['moduleGuides']=guides
 question_start=re.search(r'^### 应用题\d{2}',review,re.M)
 tail_start=re.search(r'^### 自评标准',review,re.M)
 if day==1:
  question_start=re.search(r'^\*\*题1：',review,re.M)
  tail_start=re.search(r'^## 第五部分',review,re.M)
 if question_start and tail_start:
  out['reviewBrief']=review[:question_start.start()].strip()
  out['reviewTail']=review[tail_start.start():].strip()
  out['questions']=[]
  boundary=r'(?=^\*\*题\d：)' if day==1 else r'(?=^### 应用题\d{2})'
  for question in re.split(boundary,review[question_start.start():tail_start.start()],flags=re.M):
   if not question.strip():continue
   prompt,answer=question.split('**参考答案：**',1)
   out['questions'].append({'prompt':prompt.strip(),'answer':answer.strip()})
 if day>=2:
  assert len(guides)==10 and all(g['intro'] and g['review'] for g in guides.values())
  assert len(out.get('questions',[]))==5
  assert all('**理解与机制：**' in x['body'] and '**具体例子：**' in x['body'] and '**应用与辨别：**' in x['body'] for x in items)
  assert all('#### 模块' not in x['body'] for x in items)
  for book in books:
   paragraphs=len(book.strip().split('\n\n'))-1
   assert (paragraphs==6 if day==2 else 3<=paragraphs<=6),book.splitlines()[0]
 if day>=3:
  assert [re.match(r'### 应用题(\d{2})',q['prompt'])[1] for q in out['questions']]==['01','02','03','04','05']
  assert all('评分共4分' in q['answer'] for q in out['questions'])
  assert len(re.findall(r'^### 案例[一二三]｜',out['reviewBrief'],re.M))==3
  assert all(len(x['body'].split('\n\n'))==3 for x in items)
 target=p/f'course-{day:02}.json'
 expected=json.dumps(out,ensure_ascii=False,indent=2)+'\n'
 if '--check' in sys.argv:
  assert target.read_text()==expected, f'Rebuild {target.name}'
 elif not target.exists() or target.read_text()!=expected:
  target.write_text(expected)
print(f'Validated {sum(book_count for _,_,book_count in editions)} book guides and {100*len(editions)} core concepts across {len(editions)} editions.')
