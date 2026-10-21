"""Chromium integration checks against a local HTTP-served copy of the site."""
import functools,json,threading,os
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[3]
OUT=Path(os.environ.get('QA_OUTPUT','qa-artifacts'));OUT.mkdir(exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a): pass
http=ThreadingHTTPServer(('127.0.0.1',8765),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=http.serve_forever,daemon=True).start()
base='http://127.0.0.1:8765/personal-growth-lab/academy/'
errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 page=browser.new_page(viewport={'width':1440,'height':1000})
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base,wait_until='networkidle')
 expect(page.locator('.priority-card')).to_have_count(3)
 expect(page.locator('.project-card')).to_have_count(8)
 expect(page.locator('.project-card a.card-title[href="#/llm"]')).to_have_count(1)
 expect(page.locator('.project-card a.card-title[href="#/llm"]')).to_have_text('14天大模型实战 · CurateMicrobiota')
 expect(page.locator('.cm-launch a[href="llm-lab/"]')).to_be_visible()
 assert page.locator('.storage-alert').count()==0
 page.screenshot(path=str(OUT/'desktop.png'),full_page=True)
 counts=page.evaluate('ACADEMY.courses.map(c=>[c.id,c.lessons.length])')
 def visit(route):
  page.goto(base+route)
  page.wait_for_timeout(80)
 for cid,n in counts:
  visit('#/'+cid)
  expect(page.locator('.syllabus .lesson-row')).to_have_count(n)
  for pos in sorted(set([1,(n+1)//2,n])):
   visit(f'#/{cid}/{pos}')
   expect(page.locator('.lesson-sheet h1')).to_be_visible()
   assert page.locator('[data-task]').count()>=3
   assert page.locator('.deliverable').inner_text()
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(cid,pos)
 visit('#/english/1')
 page.locator('[data-act=complete]').click()
 expect(page.locator('#toast')).to_contain_text('请先')
 page.locator('#note').fill('测试笔记 <script>alert(1)</script>')
 page.locator('#artifact').fill('day1.webm')
 for item in page.locator('[data-task]').all(): item.check()
 page.locator('#score').select_option('4')
 page.locator('[data-act=complete]').click()
 expect(page.locator('#lesson-state')).to_have_text('已完成')
 page.reload()
 expect(page.locator('#note')).to_have_value('测试笔记 <script>alert(1)</script>')
 expect(page.locator('#lesson-state')).to_have_text('已完成')
 with page.expect_download() as d: page.locator('[data-act=export-data]').click()
 backup=OUT/'backup-test.json';d.value.save_as(str(backup));raw=json.loads(backup.read_text())
 assert raw['records']['english:1']['score']==4
 visit('#/journal');expect(page.locator('.journal-entry')).to_have_count(1)
 assert page.locator('.journal-entry script').count()==0
 page.evaluate("localStorage.removeItem('yixindao.growth-academy.v1')")
 page.reload();expect(page.locator('.journal-entry')).to_have_count(0)
 page.locator('#import-file').set_input_files(str(backup))
 expect(page.locator('.journal-entry')).to_have_count(1)
 invalid=OUT/'invalid.json';invalid.write_text('{"schema":999,"records":{}}')
 page.locator('#import-file').set_input_files(str(invalid))
 expect(page.locator('#toast')).to_contain_text('导入失败')
 expect(page.locator('.journal-entry')).to_have_count(1)
 visit('#/projects');page.locator('[data-filter=priority]').click()
 expect(page.locator('.project-card')).to_have_count(3)
 page.locator('#project-search').fill('写作');expect(page.locator('.project-card')).to_have_count(1)
 visit('#/english');page.locator('#lesson-search').fill('一分钟介绍')
 expect(page.locator('.lesson-row')).to_have_count(3)
 with page.expect_download() as d: page.locator('[data-act=export-course]').click()
 md=OUT/'english-course.md';d.value.save_as(str(md));assert '最终报告' in md.read_text()
 for width in [375,390,768,1024,1920]:
  page.set_viewport_size({'width':width,'height':900})
  for route in ['','#/english/1','#/papers/4','#/journal','#/resources']:
   visit(route)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,route,'overflow')
 page.set_viewport_size({'width':390,'height':844});visit('')
 page.screenshot(path=str(OUT/'mobile.png'),full_page=True)
 visit('#/english/1');page.screenshot(path=str(OUT/'lesson-mobile.png'),full_page=True)
 page.locator('[data-act=toggle-toc]').click();expect(page.locator('#sidebar')).to_be_visible()
 page.locator('[data-act=toggle-toc]').click();expect(page.locator('#sidebar')).not_to_be_visible()
 assert not errors,errors
 report={'course_counts':dict(counts),'total_units':sum(n for _,n in counts),'js_errors':errors,'tested_widths':[375,390,768,1024,1440,1920],'passed':['routes','first-middle-last lessons','no horizontal overflow','completion gate','notes and score persistence','safe text rendering','JSON export and import','invalid import rejection','course Markdown download','course and project search','mobile navigation']}
 (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print(json.dumps(report,ensure_ascii=False));browser.close()
http.shutdown()
