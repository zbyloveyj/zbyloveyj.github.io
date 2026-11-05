"""Exercise the classroom in an isolated test browser, never in a learner profile."""
import functools
import json
import os
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(os.environ.get('UKE_QA_OUTPUT', '/tmp/ukulele-qa'))
OUT.mkdir(parents=True, exist_ok=True)
KEY = 'yixindao.ukulele-academy.v1'


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
origin = f'http://127.0.0.1:{server.server_port}'
base = origin + '/personal-growth-lab/academy/ukulele-lab/'
errors = []
checks = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, locale='zh-CN', timezone_id='Asia/Shanghai', permissions=['microphone'])
    page = context.new_page()
    page.on('pageerror', lambda err: errors.append(str(err)))
    page.goto(base)
    expect(page.locator('#main h1')).to_be_visible()
    expect(page.locator('.mini-day')).to_have_count(30)
    assert page.evaluate('window.UKE_COURSE.lessons.length') == 30
    page.screenshot(path=str(OUT / 'home-desktop.png'), full_page=True)

    def visit(route):
        page.goto(base + route)
        expect(page.locator('#main')).to_be_visible()

    for day in range(1, 31):
        visit(f'#/day/{day}')
        expect(page.locator('.day-title h1')).to_be_visible()
        assert page.locator('[data-task]').count() >= 10
        expect(page.locator('.quiz-item')).to_have_count(2)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), ('day overflow', day)
    checks.append('all 30 lesson routes, task lists, quizzes, and desktop bounds')

    visit('#/day/1')
    expect(page.locator('#mark-done')).to_be_disabled()
    page.locator('[data-field="minutes"][data-scope="day"]').fill('50')
    page.locator('[data-field="evidence"][data-scope="day"]').fill('TEST-ONLY-day1.webm')
    page.locator('[data-field="note"][data-scope="day"]').fill('测试记录 <img src=x onerror=alert(1)>')
    for box in page.locator('[data-task]').all():
        box.check()
    page.locator('#mark-done').click()
    expect(page.locator('#mark-done')).to_contain_text('已完成')
    page.reload()
    expect(page.locator('[data-field="note"][data-scope="day"]')).to_have_value('测试记录 <img src=x onerror=alert(1)>')
    expect(page.locator('#mark-done')).to_contain_text('已完成')
    assert not page.locator('#main img[src=x]').count()
    assert page.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')).records['1'].done")
    expect(page.locator('#practical-status')).to_contain_text('仍待验证')
    page.locator('[data-task]').first.uncheck()
    expect(page.locator('#mark-done')).to_be_disabled()
    page.locator('[data-task]').first.check()
    page.locator('#mark-done').click()
    checks.append('save/reload, escaped notes, task completion separated from practical mastery')

    correct = page.evaluate('window.UKE_COURSE.lessons[0].quiz[0].answer')
    page.locator(f'[data-action="quiz"][data-question="0"][data-option="{correct}"]').click()
    expect(page.locator('.quiz-explanation').first).to_contain_text('正确')
    checks.append('knowledge quiz feedback')

    visit('#/assessment/an-jing')
    expect(page.locator('#assessment-result')).to_contain_text('未评')
    for dimension in ['rhythm', 'changes', 'coordination', 'pitch', 'structure']:
        page.locator(f'[data-action="score"][data-dimension="{dimension}"][data-score="4"]').click()
    expect(page.locator('#assessment-result')).to_contain_text('80')
    assert '自评达标' not in page.locator('#assessment-result').inner_text()
    page.locator('[data-scope="assessment"][data-field="complete"]').check()
    page.locator('[data-scope="assessment"][data-field="oneTake"]').check()
    page.locator('[data-scope="assessment"][data-field="restarts"]').fill('0')
    page.locator('[data-scope="assessment"][data-field="evidence"]').fill('TEST-ONLY-complete-an-jing.webm')
    page.locator('[data-scope="assessment"][data-field="bpm"]').fill('60')
    page.locator('[data-scope="assessment"][data-field="note"]').fill('测试数据，不是学习者成绩。')
    page.locator('[data-scope="assessment"][data-field="note"]').press('Tab')
    expect(page.locator('#assessment-result')).to_contain_text('自评达标')
    page.locator('[data-action="score"][data-dimension="pitch"][data-score="2"]').click()
    assert '自评达标' not in page.locator('#assessment-result').inner_text()
    page.locator('[data-action="score-clear"][data-dimension="pitch"]').click()
    expect(page.locator('#assessment-result')).to_contain_text('未评')
    checks.append('empty scores, 80-point gate, evidence requirements, weak dimension, clear score')

    visit('#/songs/an-jing')
    page.locator('[data-scope="plan"][data-field="version"]').fill('TEST-ONLY C调简化版')
    page.locator('[data-scope="plan"][data-field="key"]').fill('C')
    page.locator('[data-scope="plan"][data-field="key"]').press('Tab')
    page.reload()
    expect(page.locator('[data-scope="plan"][data-field="version"]')).to_have_value('TEST-ONLY C调简化版')
    checks.append('song-version notes persist')

    visit('#/day/18')
    expect(page.locator('.drill-bar')).to_have_count(8)
    assert all(' → ' in value for value in page.locator('.drill-bar strong').all_text_contents())
    visit('#/day/2')
    expect(page.locator('.drill-bar').first).to_contain_text('C')
    expect(page.locator('.drill-bar').nth(1)).to_contain_text('C')
    expect(page.locator('.drill-bar').nth(2)).to_contain_text('Am')
    visit('#/day/12')
    expect(page.locator('.drill-bar').first).to_contain_text('两次下扫')
    expect(page.locator('.drill-bar').nth(4)).to_contain_text('四次下扫')
    visit('#/day/26')
    expect(page.locator('.drill-bar').nth(2)).to_contain_text('第1拍不触弦')
    checks.append('two-beat/eight-beat chord timing, mixed patterns and omitted beat match lesson instructions')

    visit('#/tools')
    page.locator('[data-action="metronome"]').click()
    expect(page.locator('#metro-toggle')).to_contain_text('停止')
    page.locator('[data-action="audio-stop"]').first.click()
    page.locator('[data-action="record-start"]').first.click()
    expect(page.locator('[data-action="record-stop"]')).to_be_visible(timeout=15000)
    page.wait_for_timeout(1100)
    page.locator('[data-action="record-stop"]').click()
    expect(page.locator('#recording-dock audio')).to_be_visible()
    with page.expect_download() as download:
        page.locator('[data-action="record-download"]').click()
    download.value.save_as(str(OUT / 'test-microphone.webm'))
    assert (OUT / 'test-microphone.webm').stat().st_size > 100
    checks.append('metronome starts/stops; fake-microphone recording, playback control, and audio download')

    with page.expect_download() as download:
        page.locator('[data-action="export"]').first.click()
    backup = OUT / 'test-backup.json'
    download.value.save_as(str(backup))
    exported = json.loads(backup.read_text())
    exported_state = exported.get('state', exported)
    assert exported_state['records']['1']['metrics']['minutes'] == 50
    imported_context = browser.new_context(viewport={'width': 390, 'height': 844}, locale='zh-CN')
    mobile = imported_context.new_page()
    mobile.on('pageerror', lambda err: errors.append(str(err)))
    mobile.goto(base + '#/resources')
    mobile.locator('#import-file').set_input_files(str(backup))
    expect(mobile.locator('#toast')).to_contain_text('校验通过')
    mobile.goto(base + '#/day/1')
    expect(mobile.locator('[data-field="note"][data-scope="day"]')).to_have_value('测试记录 <img src=x onerror=alert(1)>')
    for route in ['#/', '#/roadmap', '#/day/1', '#/day/18', '#/day/30', '#/songs/an-jing', '#/assessment/an-jing', '#/insights', '#/tools', '#/resources', '#/handbook']:
        mobile.goto(base + route)
        expect(mobile.locator('#main')).to_be_visible()
        assert mobile.evaluate('document.documentElement.scrollWidth <= innerWidth'), ('mobile overflow', route)
    mobile.goto(base + '#/day/1')
    mobile.screenshot(path=str(OUT / 'day1-mobile.png'), full_page=True)
    mobile.goto(base)
    mobile.screenshot(path=str(OUT / 'home-mobile.png'), full_page=True)
    checks.append('JSON download/import in new browser context; eleven mobile routes fit 390px')

    visit('#/handbook')
    assert page.locator('#main').inner_text().count('第30天') >= 1
    page.emulate_media(media='print')
    page.pdf(path=str(OUT / 'ukulele-handbook-test.pdf'), format='A4', print_background=True)
    page.emulate_media(media='screen')
    checks.append('complete printable handbook')

    # Read-only academy integration: count and route; existing learner data is untouched.
    page.goto(origin + '/personal-growth-lab/academy/#/projects')
    expect(page.locator('.project-card')).to_have_count(13)
    expect(page.locator('.project-card a[href="#/ukulele"]').first).to_be_visible()
    page.locator('.project-card a[href="#/ukulele"]').first.click()
    page.wait_for_url('**/ukulele-lab/**')
    expect(page.locator('#main h1')).to_be_visible()
    checks.append('academy catalog has 13 courses and routes into the classroom')
    assert not errors, errors
    browser.close()

server.shutdown()
report = {'valid': True, 'checks': checks, 'page_errors': errors, 'recordings': 'synthetic test microphone, not learner performance'}
(OUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(report, ensure_ascii=False, indent=2))
