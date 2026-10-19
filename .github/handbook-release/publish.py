#!/usr/bin/env python3
"""Import the reviewed October edition and synchronize the reader surfaces."""
from pathlib import Path
import re, json, hashlib, subprocess
from bs4 import BeautifulSoup
import markdown

REPO=Path(__file__).resolve().parents[2]
ROOT=REPO/'graduate-research-handbook'
HERE=Path(__file__).resolve().parent
EDITION='20261019-r3'
BASE='d782173aa9b58813e213bdaf79ba071bb521de6c'
TARGET='df6e3077f732852c0d20937f1bd04de2bad4da1add0209e4132e25561e554329'

def norm(s):
 s=s.replace('**','')
 s=re.sub(r'(?m)^(#{2,6} )\d+\.\d+\s+',r'\1',s)
 s=re.sub(r'(?m)^> [^\n]+\n\n(?=## )','',s)
 s=s.replace('## 深入案例：','## 案例：').replace('## 本章综合实训：','## 练习：').replace('## 综合练习：','## 练习：').replace('## 本章实践：','## 实践：')
 for a,b in [('真正的科研审查刚刚开始','仍需进一步核查'),('这个例子提醒我们：',''),('这个案例提醒我们：',''),('任务情境。 ','') ,('具体做法。 ',''),('完成材料。 ','练习材料：'),('核验标准。 ','检查时注意：')]:s=s.replace(a,b)
 s=s.replace('\\_','_').replace('\\*','*')
 s=re.sub(r'(?m)^[-*] ','- ',s)
 s=re.sub(r'(?m)^---\s*\n','',s)
 out=[];fence=False
 for line in s.splitlines():
  if re.match(r'^\s*(```|~~~)',line):fence=not fence;line=line.replace('~~~','```')
  if not fence and line.startswith('|') and line.rstrip().endswith('|'):
   cells=[x.strip() for x in line.strip().strip('|').split('|')]
   if all(re.match(r'^:?-+:?$',x) for x in cells):cells=['---']*len(cells)
   line='| '+' | '.join(cells)+' |'
  out.append(line.rstrip())
 s='\n'.join(out)
 return re.sub(r'\n{3,}','\n\n',s).strip()+'\n'

def write(rel,text):
 p=ROOT/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text,encoding='utf-8')

def page(title,body):
 return '''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'''+title+'''｜从读研到做研究</title><link rel="stylesheet" href="assets/style.css"><style>.edition-page{max-width:900px;margin:38px auto;padding:24px;line-height:1.95}.edition-page h1{font-size:clamp(26px,4vw,38px);line-height:1.5}.edition-page h2{font-size:1.25em;margin-top:2em}.edition-page h3{font-size:1.08em}.edition-page p{overflow-wrap:anywhere}.edition-page table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:.88em}.edition-page td,.edition-page th{padding:10px;overflow-wrap:anywhere;border-bottom:1px solid var(--line,#dce3dc);text-align:left;vertical-align:top}.edition-page pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;background:var(--panel,#eef2eb)}.edition-page blockquote{margin:24px 0;padding-left:18px;border-left:2px solid #8b9f8d}.edition-label{font-size:13px;color:var(--muted,#67796c)}</style></head><body><header><a class="brand" href="./"><span class="brandmark">研</span>从读研到做研究</a><div class="actions"><a href="./">全书目录</a><a href="search.html">全文检索</a><a href="library.html">我的书房</a></div></header><main class="edition-page"><p class="edition-label">一心问道 著 · 2026年10月19日修订版</p>'''+body+'''<p><a href="./?chapter=01">开始阅读第一章 →</a>　<a href="./">返回全书目录</a></p></main><footer class="wrap">© 2026 一心问道 · 保留所有权利</footer></body></html>'''

def main():
 marker=ROOT/'data/edition.json'
 if marker.exists() and json.loads(marker.read_text()).get('edition')==EDITION:
  print('Reviewed edition already imported; retaining subsequent source corrections.');return
 raw=subprocess.check_output(['git','cat-file','blob',BASE],cwd=REPO)
 assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==BASE
 lines=norm(raw.decode()).splitlines(keepends=True)
 edits=[]
 for n in range(1,4):edits+=json.loads((HERE/f'edits{n}.json').read_text())
 assert len(edits)==601
 for i,j,text in reversed(edits):lines[i:j]=[text]
 manuscript=''.join(lines)
 actual=hashlib.sha256(manuscript.encode()).hexdigest()
 assert actual==TARGET, f'Revised delivery checksum mismatch: {actual}'
 manuscript=re.sub(r'(?m)^```','~~~',manuscript)
 blocks=re.split(r'(?m)(?=^# )',manuscript)
 chapters=[];appendices=[];preface=''
 for block in blocks:
  if re.match(r'^# 第[零一二三四五六七八九十\d]+章',block):chapters.append(block.strip()+'\n')
  elif block.startswith('# 附录'):appendices.append(block.strip()+'\n')
  elif block.startswith('# 前言'):preface=block.strip()+'\n'
 assert len(chapters)==50 and len(appendices)==4 and preface
 for n,text in enumerate(chapters,1):
  assert len(text)>2200 and len(re.findall(r'(?m)^## ',text))>=5
  write(f'content/{n:02d}.md',text)
 write('content/00-preface.md',preface)
 write('content/appendices.md','\n'.join(appendices))
 write('preface.html',page('前言',markdown.markdown(preface,extensions=['tables','fenced_code'])))
 appendix_html=markdown.markdown('\n'.join(appendices),extensions=['tables','fenced_code'])
 write('appendices.html',page('科研附录',appendix_html))
 sync=ROOT/'tools/sync_book.py';txt=sync.read_text()
 txt=txt.replace('九编五十章 · 内容深度修订版 V2.2 · 2026年10月','九编五十章 · 2026年10月修订版')
 txt=txt.replace('> 本书为持续编校中的系统教学书稿；并非出版社正式出版终审版。','> 本书中的模拟案例仅用于教学。')
 sync.write_text(txt,encoding='utf-8')
 build=ROOT/'tools/build_book.py';txt=build.read_text()
 txt=txt.replace('内容深化编辑版 V2.2 · 2026年10月','2026年10月修订版').replace('内容深度修订版 V2.2','2026年10月修订版')
 build.write_text(txt,encoding='utf-8')
 obsolete=('ai-verification-log.md','EDITORIAL_REVIEW_2026-10-16.md','outline.md')
 for rel in ['downloads/ai-verification-log.md','EDITORIAL_REVIEW_2026-10-16.md','content/outline.md']:
  (ROOT/rel).unlink(missing_ok=True)
 edition_js='''(function(){"use strict";window.GRADBOOK_EDITION="20261019-r3";var original=window.fetch.bind(window);window.fetch=function(input,init){if(typeof input==="string"){try{var u=new URL(input,location.href);if(u.origin===location.origin&&u.pathname.indexOf("/graduate-research-handbook/")===0&&/\\.(md|json)$/.test(u.pathname)){u.searchParams.set("v",window.GRADBOOK_EDITION);input=u.href;init=Object.assign({},init||{},{cache:"no-cache"});}}catch(e){}}return original(input,init);};try{document.documentElement.dataset.theme=JSON.parse(localStorage.getItem("gradbook:theme"))||"light";}catch(e){}})();'''
 write('assets/edition.js',edition_js)
 for p in ROOT.glob('*.html'):
  soup=BeautifulSoup(p.read_text(),'html.parser')
  for a in list(soup.find_all('a',href=True)):
   if any(x in a['href'] for x in obsolete):a.decompose()
   elif 'GitHub 源码' in a.get_text():a['href']='preface.html';a.string='阅读前言'
  for text in list(soup.find_all(string=True)):
   if text.parent and text.parent.name not in ('script','style'):
    value=str(text).replace('全书初稿 · 2026年10月　｜　正文持续编辑与核验','2026年10月19日修订版')
    value=value.replace('九编五十章 · 完整阅读版','2026年10月19日修订版')
    value=value.replace('九编形成初稿','完整知识编次').replace('规划章节','全书章节')
    if value!=str(text):text.replace_with(value)
  if p.name=='index.html':
   meta=soup.find('meta',attrs={'name':'description'})
   if meta:meta['content']='《从读研到做研究》2026年10月修订版。一心问道著，九编五十章与四份附录，涵盖报考、文献阅读、研究设计、数据分析、论文写作和毕业发展。'
   metrics=soup.select_one('.metrics')
   if metrics:
    metrics.clear()
    for value,label in [('09','知识编次'),('50','完整章节'),('04','实用附录'),('2026','十月修订版')]:
     div=soup.new_tag('div');strong=soup.new_tag('strong');strong.string=value;small=soup.new_tag('small');small.string=label;div.extend([strong,small]);metrics.append(div)
   fine=soup.select_one('.hero .meta')
   if fine:
    fine.clear()
    for value in ['著 · 一心问道','九编五十章 · 四份附录','2026年10月19日修订版']:
     span=soup.new_tag('span');span.string=value;fine.append(span)
  if soup.head:
   meta=soup.find('meta',attrs={'name':'book-edition'})
   if not meta:meta=soup.new_tag('meta');meta['name']='book-edition';soup.head.append(meta)
   meta['content']=EDITION
   for tag in soup.select('script[src],link[rel="stylesheet"]'):
    attr='src' if tag.name=='script' else 'href';url=tag.get(attr,'')
    if url.startswith('assets/'):tag[attr]=url.split('?')[0]+'?v='+EDITION
   boot=soup.new_tag('script',src='assets/edition.js?v='+EDITION);soup.head.insert(0,boot)
  p.write_text(str(soup),encoding='utf-8')
 css=ROOT/'assets/style.css'
 with css.open('a',encoding='utf-8') as f:f.write('\n/* October reader edition */\n@media(max-width:600px){header .actions{gap:7px;flex-wrap:wrap}header .actions a{font-size:12px}header .brand{min-width:0}.edition-page{margin-top:14px;padding:18px}.article{min-width:0}.table-scroller{max-width:100%;overflow-x:auto}}\n')
 write('data/edition.json',json.dumps({'edition':EDITION,'updated':'2026-10-19','title':'从读研到做研究','author':'一心问道','chapters':50,'parts':9,'appendices':4,'reviewed_content_sha256':TARGET,'chapter_sha256':{f'{i:02d}':hashlib.sha256(t.encode()).hexdigest() for i,t in enumerate(chapters,1)}},ensure_ascii=False,indent=2)+'\n')
 print('Imported reviewed text: 50 chapters, four appendices; reader chrome and cache version synchronized.')

if __name__=='__main__':main()
