#!/usr/bin/env python3
"""Final functional acceptance using isolated test data and a simulated microphone."""
from pathlib import Path
import json,threading,functools,http.server,os,tempfile
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
QA=Path(os.environ.get('RUNNER_TEMP',tempfile.gettempdir()))/'growth-quality'
QA.mkdir(parents=True,exist_ok=True)
KEY='yixw_practice_lab_2026_v1'
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

def main():
    lessons=json.loads((ROOT/'data/curriculum-v3.json').read_text())
    assert all(x['edition']=='2026.10.20-final' for x in lessons)
    assert lessons[6]['lines']==lessons[0]['lines']
    assert '另有一人尚未回复' in lessons[9]['sample']
    assert all('……' not in s for x in lessons for s in x['lines'])
    assert '共12分' in next(r['rule'] for r in lessons[4]['assessment'] if r['name']=='情境表达')
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever,daemon=True).start()
    base=f'http://127.0.0.1:{srv.server_port}/'
    try:
        with sync_playwright() as p:
            b=p.chromium.launch(headless=True,args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
            ctx=b.new_context(permissions=['microphone'],accept_downloads=True,viewport={'width':1440,'height':950})
            pg=ctx.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
            for d in range(1,22):
                pg.goto(base+f'?day={d:02d}');pg.wait_for_selector('.lesson-title')
                assert pg.locator('.guided-task').count()==3
                assert pg.locator('#score-total').inner_text()=='未评分',(d,pg.locator('#score-total').inner_text())
                assert pg.locator('.answer-panel[open]').count()==0
            pg.goto(base+'?day=01');assert pg.evaluate(f'localStorage.getItem("{KEY}")') is None
            pg.fill('#score-0','0');pg.locator('#score-0').blur();assert '1/7' in pg.locator('#score-total').inner_text()
            pg.fill('#score-0','');pg.locator('#score-0').blur();assert pg.locator('#score-total').inner_text()=='未评分'
            for i in range(7):
                pg.fill(f'#score-{i}','999');pg.locator(f'#score-{i}').blur()
            assert pg.locator('#score-total').inner_text()=='100 / 100'
            pg.fill('#day-notes','验收记录：保留原始证据');pg.locator('[data-check="0"]').check();pg.click('#mark-complete');pg.reload()
            assert pg.input_value('#day-notes')=='验收记录：保留原始证据'
            assert pg.locator('[data-check="0"]').is_checked()
            assert pg.locator('#score-total').inner_text()=='100 / 100'
            pg.goto(base);assert '不计算跨课均分' in pg.locator('.record-main').inner_text()
            with pg.expect_download() as result:pg.click('#export-progress')
            saved=QA/'test-records.json';result.value.save_as(saved)
            assert json.loads(saved.read_text())['lessons']['1']['notes']=='验收记录：保留原始证据'
            pg.evaluate('localStorage.clear()');pg.reload();pg.on('dialog',lambda x:x.accept())
            pg.locator('#import-file').set_input_files(saved);pg.wait_for_timeout(400)
            pg.goto(base+'?day=01');assert pg.input_value('#day-notes')=='验收记录：保留原始证据'
            pg.click('#record-start');pg.wait_for_timeout(1500);assert pg.locator('#record-stop').is_enabled()
            with pg.expect_download() as result:pg.click('#record-stop')
            result.value.save_as(QA/'test-audio.webm');assert (QA/'test-audio.webm').stat().st_size>100
            assert pg.locator('.recording-result audio').count()==1
            assert '再次下载' in pg.locator('.recording-result a').inner_text()
            for w in [360,390,768,1440]:
                pg.set_viewport_size({'width':w,'height':900})
                for d in [1,5,10,14,21]:
                    pg.goto(base+f'?day={d:02d}');pg.wait_for_selector('.lesson-title')
                    assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(w,d)
                if w in [390,1440]:
                    pg.goto(base+'?day=01');pg.screenshot(path=str(QA/f'final-reader-{w}.png'))
            assert not errors,errors
            b.close()
        result={'edition':'2026.10.20-final','readers':21,'content_regressions':'pass','unscored_zero_partial_full':'pass','progress_notes_and_checks':'pass','export_import':'pass','simulated_microphone_download_and_recovery':'pass','viewport_widths':[360,390,768,1440],'scope':'Automated browser checks; real microphone hardware and every browser are not claimed.'}
        (QA/'FINAL-ACCEPTANCE.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
        print(json.dumps(result,ensure_ascii=False),flush=True)
    finally:srv.shutdown()
if __name__=='__main__':main()
