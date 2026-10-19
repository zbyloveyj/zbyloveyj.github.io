#!/usr/bin/env python3
"""Validate the reader locally, then compare deployed content with the release."""
from pathlib import Path
import argparse, hashlib, json, os, re, threading, time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, unquote
from urllib.request import Request, urlopen
from concurrent.futures import ThreadPoolExecutor
from bs4 import BeautifulSoup

REPO=Path(__file__).resolve().parents[2]
ROOT=REPO/'graduate-research-handbook'
EDITION='20261019-r3'
OUT=Path(os.environ.get('RUNNER_TEMP','/tmp'))/'handbook-qa'
OUT.mkdir(parents=True,exist_ok=True)

def digest(data):return hashlib.sha256(data).hexdigest()
def summary(text):
 print(text,flush=True)
 if os.environ.get('GITHUB_STEP_SUMMARY'):
  with open(os.environ['GITHUB_STEP_SUMMARY'],'a',encoding='utf-8') as f:f.write(text+'\n\n')

def local():
 meta=json.loads((ROOT/'data/edition.json').read_text())
 assert meta['edition']==EDITION and len(meta['chapter_sha256'])==50
 for n,h in meta['chapter_sha256'].items():assert digest((ROOT/f'content/{n}.md').read_bytes())==h,n
 idx=json.loads((ROOT/'data/search-index.json').read_text())
 assert len(idx)==50 and '从证据整理转入正文写作' in idx[34]['heads']
 assert '独立判断在具体工作中形成' in idx[49]['heads']
 assert (ROOT/'content/appendices.md').read_text().count('# 附录')==4
 for p in ROOT.glob('*.html'):
  html=p.read_text();soup=BeautifulSoup(html,'html.parser')
  assert soup.select_one('meta[name="book-edition"]')['content']==EDITION,p
  assert not soup.select('a[href*="ai-verification-log"],a[href*="EDITORIAL_REVIEW"]'),p
  for tag in soup.select('a[href],script[src],link[href]'):
   value=tag.get('href',tag.get('src',''));url=urlsplit(value)
   if url.scheme or value.startswith('//') or not url.path:continue
   target=(REPO/unquote(url.path).lstrip('/')) if url.path.startswith('/') else p.parent/unquote(url.path)
   if target.is_dir():target=target/'index.html'
   assert target.exists(),f'Broken local link in {p.name}: {value}'
 from playwright.sync_api import sync_playwright
 class Quiet(SimpleHTTPRequestHandler):
  def log_message(self,*args):pass
 server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(REPO)))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 base=f'http://127.0.0.1:{server.server_port}/graduate-research-handbook/'
 errors=[]
 try:
  with sync_playwright() as pw:
   browser=pw.chromium.launch(headless=True)
   page=browser.new_page(viewport={'width':1440,'height':960})
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(base);page.locator('#volume-list .volume li').last.wait_for()
   assert page.locator('#volume-list .volume li').count()==50
   assert '2026年10月19日修订版' in page.locator('#home').inner_text()
   page.screenshot(path=str(OUT/'home-desktop.png'),full_page=False)
   page.evaluate("localStorage.setItem('gradbook:notes-1',JSON.stringify([{quote:'旧版保留的笔记',comment:'用于核验升级后笔记不丢失',at:'2026-10-19'}]))")
   for n in range(1,51):
    page.goto(base+f'?chapter={n:02d}');page.locator('#text-body h2').first.wait_for()
    assert len(page.locator('#text-body').inner_text())>2000,n
    assert page.locator('#toc-heads a').count()>=5,n
    assert '全书初稿' not in page.locator('.article-head').inner_text(),n
   page.goto(base+'?chapter=35');page.locator('#text-body h2').first.wait_for()
   assert '从证据整理转入正文写作' in page.locator('#text-body').inner_text()
   page.locator('#bookmark').click();assert page.evaluate("JSON.parse(localStorage.getItem('gradbook:bookmark-35'))") is True
   page.reload();page.locator('#text-body h2').first.wait_for()
   assert '已收藏' in page.locator('#bookmark').inner_text()
   assert len(page.evaluate("JSON.parse(localStorage.getItem('gradbook:notes-1'))"))==1
   page.screenshot(path=str(OUT/'reader-desktop.png'),full_page=False)
   page.goto(base+'?chapter=30');page.locator('#text-body pre code').first.wait_for()
   page.goto(base+'search.html?q=从证据整理转入正文写作');page.locator('#search-results a[href*="chapter=35"]').wait_for()
   page.goto(base+'preface.html');assert '拿到录取通知书以后' in page.locator('main').inner_text()
   page.goto(base+'appendices.html');assert page.locator('main h1').count()==4
   for width in (390,768):
    page.set_viewport_size({'width':width,'height':844})
    for path in ('','?chapter=35','resources.html','appendices.html'):
     page.goto(base+path)
     if path.startswith('?'):page.locator('#text-body h2').first.wait_for()
     else:page.locator('main').first.wait_for()
     assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+2'),(width,path)
    page.goto(base+'?chapter=35');page.locator('#text-body h2').first.wait_for()
    page.screenshot(path=str(OUT/f'reader-{width}.png'),full_page=False)
   assert not errors,errors
   browser.close()
 finally:server.shutdown()
 summary('PASS: 50 revised chapter hashes, four appendices, local links, full-text search, code blocks, retained notes, bookmarks, desktop / 768px tablet / 390px mobile layout.')
 (OUT/'local-check.json').write_text(json.dumps({'edition':EDITION,'chapters':50,'appendices':4,'browser_checks':'passed'},ensure_ascii=False,indent=2))

def live():
 base='https://zbyloveyj.github.io/graduate-research-handbook/'
 def get(rel):
  url=base+rel+('&' if '?' in rel else '?')+'v='+EDITION
  with urlopen(Request(url,headers={'User-Agent':'Handbook-Release-Check','Cache-Control':'no-cache'}),timeout=45) as r:
   assert r.status==200;return r.read()
 deadline=time.monotonic()+780
 while True:
  try:
   current=json.loads(get('data/edition.json'))
   home=get('').decode()
   assert current['edition']==EDITION and '2026年10月19日修订版' in home
   break
  except Exception as e:
   if time.monotonic()>deadline:raise RuntimeError('Updated public Pages edition not available before verification deadline') from e
   print('Waiting for public Pages edition:',str(e)[:180],flush=True);time.sleep(15)
 meta=json.loads((ROOT/'data/edition.json').read_text())
 def check(n):
  actual=digest(get(f'content/{n}.md'));assert actual==meta['chapter_sha256'][n],f'Live chapter differs: {n}'
 with ThreadPoolExecutor(max_workers=6) as ex:list(ex.map(check,meta['chapter_sha256']))
 checked=['preface.html','appendices.html','resources.html','data/search-index.json','downloads/complete-book.pdf','downloads/complete-book.docx']
 for rel in checked:
  expected=digest((ROOT/rel).read_bytes());assert digest(get(rel))==expected,rel
 result={'edition':EDITION,'public_url':base,'chapters_verified':50,'appendices_verified':4,'downloads_verified':['PDF','Word'],'live_content_hashes':'all match published repository files','verified_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
 (OUT/'live-check.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
 summary('PASS: PUBLIC WEBSITE VERIFIED. Homepage shows the revised edition; all 50 deployed chapters, four appendices, search index, PDF and Word match this release byte for byte.')
 summary('Verified public URL: '+base)

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--live',action='store_true');args=parser.parse_args()
 live() if args.live else local()
