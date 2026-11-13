"""Build or verify the available reading editions from complete Markdown."""
from pathlib import Path
import json,re,sys
p=Path(__file__).resolve().parents[1]
editions = [
 (1,'day-01-philosophy-complete.md',10),
 (2,'day-02-psychology-complete.md',8),
 (3,'courses/day-03-economics.md',7),
 (4,'courses/day-04-history.md',8),
 (8,'courses/day-08-sociology.md',7),
]
def sociology_edition(s,day,name,book_count):
 """Parse the expanded Day08 prose without changing existing course formats."""
 a=s.index('## A 领域导论与学习主线')
 b=s.index('## B 七本代表性著作精讲')
 c=s.index('## C 一百个核心知识点')
 d=s.index('## D 连贯复述与五道应用自测')
 e=s.index('## E 概念检索与延伸阅读')
 intro=s[:s.index('## 阅读导航')].strip()+'\n\n'+s[a:b].strip()
 books=[x.strip() for x in re.split(r'(?=^### \d{2} )',s[b:c],flags=re.M)[1:]]
 modules=[];items=[];guides={}
 for group in re.split(r'(?=^### 模块)',s[c:d],flags=re.M)[1:]:
  title=group.splitlines()[0].removeprefix('### ')
  first=re.search(r'^\*\*\d{3} ',group,re.M)
  closing=re.search(r'^\*\*(?:模块衔接|全课收束)。\*\*',group,re.M)
  assert first and closing
  modules.append(title)
  guides[title]={'intro':group[len(group.splitlines()[0]):first.start()].strip(),'review':group[closing.start():].strip()}
  for m in re.finditer(r'^\*\*(\d{3}) ([^\n]+?)。\*\*\s*\n(.*?)(?=^\*\*\d{3} |\Z)',group[:closing.start()],re.M|re.S):
   items.append(dict(id=int(m[1]),title=m[2],body=m[3].strip(),module=title))
 review=s[d:e].strip()
 start=re.search(r'^### 题1 ',review,re.M)
 assert start
 questions=[]
 for question in re.split(r'(?=^### 题\d )',review[start.start():],flags=re.M):
  if not question.strip():continue
  prompt,answer=question.split('<details>',1)
  answer=re.sub(r'<summary>.*?</summary>','',answer,flags=re.S).replace('</details>','').strip()
  questions.append({'prompt':prompt.strip(),'answer':answer})
 assert len(books)==book_count==7
 assert len(items)==100 and [x['id'] for x in items]==list(range(1,101))
 assert len(modules)==10 and all(sum(x['module']==g for x in items)==10 for g in modules)
 assert all(len(x['body'].split('\n\n'))==3 for x in items)
 assert all(len(book.split('\n\n'))==5 for book in books)
 assert len(questions)==5 and all('**评分。**' in q['answer'] and '<details>' not in q['answer'] for q in questions)
 return dict(day=day,source=name,intro=intro,books=books,modules=modules,items=items,review=review,references=s[e:].strip(),moduleGuides=guides,reviewBrief=review[:start.start()].strip(),reviewTail='### 完成自测后\n\n依据每题评分点核对解释与证据，回到对应编号补读，再尝试用新的现实案例复述。',questions=questions)

for day,name,book_count in editions:
 s=(p/name).read_text()
 if day==8:
  out=sociology_edition(s,day,name,book_count)
  target=p/f'course-{day:02}.json'
  expected=json.dumps(out,ensure_ascii=False,indent=2)+'\n'
  if '--check' in sys.argv:
   assert target.read_text()==expected, f'Rebuild {target.name}'
  elif not target.exists() or target.read_text()!=expected:
   target.write_text(expected)
  continue
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

