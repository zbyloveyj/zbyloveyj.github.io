#!/usr/bin/env python3
"""Check every lesson, PDF, schedule, score and download; optionally exercise the reader."""
from pathlib import Path
import argparse,hashlib,json,re,threading,functools,http.server,zipfile,urllib.request,time
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[1]

def check_files():
    lessons=json.loads((ROOT/'data/curriculum-v3.json').read_text())
    manifest=json.loads((ROOT/'downloads/pdf-manifest.json').read_text())
    assert [x['d'] for x in lessons]==list(range(1,22))
    assert len(manifest['lessons'])==21
    page_count=0
    for x,m in zip(lessons,manifest['lessons']):
        d=x['d'];plan=x['plan']
        assert plan[0]['start']==0 and plan[-1]['end']==60
        assert all(a['end']==b['start'] for a,b in zip(plan,plan[1:]))
        assert sum(v['max'] for v in x['assessment'])==100
        assert len(x['guided'])==len(x['transfer']['checks'])==3
        assert len(x['lines'])==6 and len(x['reading'])>=400
        f=ROOT/x['pdfPath'];raw=f.read_bytes();assert raw.startswith(b'%PDF-')
        assert hashlib.sha256(raw).hexdigest()==m['sha256']
        pdf=PdfReader(f);assert len(pdf.pages)==m['pages']==x['pdfPages']
        texts=[p.extract_text() for p in pdf.pages]
        assert '可打印打卡页' in texts[-1] and '下一次' in texts[-1]
        assert all(len(re.sub(r'\s','',t))>70 for t in texts)
        assert '\ufffd' not in ''.join(texts)
        assert len(re.findall('[\u4e00-\u9fff]',''.join(texts)))>2500
        assert '100' in ''.join(texts)
        for p in pdf.pages:
            fonts=p['/Resources'].get('/Font',{})
            for ref in fonts.values():
                font=ref.get_object();desc=font.get('/FontDescriptor')
                if '/DescendantFonts' in font:desc=font['/DescendantFonts'][0].get_object().get('/FontDescriptor')
                if desc:assert any(k in desc.get_object() for k in ['/FontFile','/FontFile2','/FontFile3'])
        page_count+=len(pdf.pages)
    merged=PdfReader(ROOT/manifest['collection']['path'])
    assert len(merged.pages)==manifest['collection']['pages'] and len(merged.pages)>=page_count
    with zipfile.ZipFile(ROOT/'downloads/21-daily-pdfs.zip') as z:
        assert len([n for n in z.namelist() if n.endswith('.pdf')])==21
        assert all(not n.lower().endswith(('.ttf','.otf','.ttc')) for n in z.namelist())
    print(json.dumps({'edition':manifest['edition'],'daily_pdfs':21,'lesson_pages':page_count,'collection_pages':len(merged.pages),'checks':'content, 60-minute plans, scores, embedded fonts, PDF hashes, separate check-in pages'},ensure_ascii=False))
    return manifest

def browser_check():
    from playwright.sync_api import sync_playwright
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(ROOT)))
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    base=f'http://127.0.0.1:{server.server_port}/';qa=ROOT/'quality';qa.mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={'width':1440,'height':1000});errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(base);page.wait_for_selector('.course-card');assert page.locator('.course-card').count()==21
        assert page.locator('.pdf-item').count()==21
        page.screenshot(path=str(qa/'desktop-home.png'))
        for d in range(1,22):
            page.goto(base+f'?day={d:02d}');page.wait_for_selector('.lesson-title')
            assert page.locator('.guided-task').count()==3
            assert page.locator('.assessment-table tbody tr').count()>=6
            assert page.locator('.lesson-download-banner a[download]').count()>=1
            assert page.locator('.answer-panel').count()>=5
            resp=page.request.get(base+f'downloads/pdf/Day-{d:02d}.pdf')
            assert resp.ok and resp.body().startswith(b'%PDF-')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            if d==1:page.screenshot(path=str(qa/'desktop-day01.png'))
        page.goto(base+'?day=01');page.fill('#day-notes','TEST: preserved local record');page.locator('[data-check="0"]').check();page.click('#mark-complete');page.reload();page.wait_for_selector('#day-notes')
        assert page.input_value('#day-notes')=='TEST: preserved local record'
        assert page.locator('[data-check="0"]').is_checked()
        assert '已完成' in page.locator('#mark-complete').inner_text()
        assert 'day=01' in page.url
        for width in [390,768]:
            page.set_viewport_size({'width':width,'height':844})
            for d in [1,2,10,15,19,21]:
                page.goto(base+f'?day={d:02d}');page.wait_for_selector('.lesson-title')
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(width,d)
                if width==390 and d==1:page.screenshot(path=str(qa/'mobile-day01.png'))
        assert not errors,errors
        browser.close()
    server.shutdown();print('Browser: 21 readers, 21 PDF responses, responsive layouts, local record persistence passed.')

def live_check():
    m=json.loads((ROOT/'downloads/pdf-manifest.json').read_text());base='https://zbyloveyj.github.io/personal-growth-lab/'
    def get(url):
        req=urllib.request.Request(url,headers={'User-Agent':'PersonalGrowthWorkbookQA/1.0','Cache-Control':'no-cache'})
        with urllib.request.urlopen(req,timeout=40) as r:return r.read()
    for i in range(15):
        try:
            online=json.loads(get(base+'downloads/pdf-manifest.json?edition='+m['edition']))
            assert online['edition']==m['edition']
            assert get(base+'data/edition-v3.js?v='+m['edition']).startswith(b'window.GROWTH_LESSONS')
            for v in online['lessons']:
                raw=get(base+v['path']+'?edition='+m['edition']);assert raw.startswith(b'%PDF-')
                assert hashlib.sha256(raw).hexdigest()==v['sha256'],v['path']
            for f in ['downloads/21-daily-pdfs.zip','downloads/21-days-complete-workbook.pdf','downloads/index.html']:
                assert len(get(base+f))>1000
            print('LIVE PASS: public reader and all 21 PDF bytes match the published manifest.');return
        except Exception as e:
            print('Awaiting public edition',i+1,str(e),flush=True);time.sleep(20)
    raise RuntimeError('Public deployment verification timed out')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--browser',action='store_true');parser.add_argument('--live',action='store_true');args=parser.parse_args()
    check_files()
    if args.browser:browser_check()
    if args.live:live_check()
