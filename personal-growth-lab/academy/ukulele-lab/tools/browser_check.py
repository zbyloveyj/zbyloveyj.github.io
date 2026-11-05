"""End-to-end classroom QA in isolated profiles with synthetic audio only.

Run in GitHub Actions, where Chromium can bind its sandbox sockets. Do not run
this browser process in the constrained authoring workspace. No private account
is used, no external login is clicked, and no learner recording is accessed.
"""
import array
import functools
import hashlib
import json
import math
import os
import struct
import sys
import threading
import traceback
import wave
import zipfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[4]
COURSE = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('UKE_QA_OUTPUT', '/tmp/ukulele-qa'))
FIXTURES = OUT / 'fixtures'
FIXTURES.mkdir(parents=True, exist_ok=True)
KEY = 'yixindao.ukulele-academy.v1'
OTHER_KEY = 'yixindao.growth-academy.v1'
errors, checks, api_requests, asset_errors = [], [], [], []


def write_wav(name, seconds, signal, rate=48000):
    values = array.array('h', (round(max(-1, min(1, signal(i / rate))) * 32767)
                               for i in range(round(seconds * rate))))
    if sys.byteorder != 'little':
        values.byteswap()
    target = FIXTURES / name
    with wave.open(str(target), 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(rate)
        output.writeframes(values.tobytes())
    return target


def fixture_audio():
    c4 = 440 * 2 ** ((60 - 69) / 12)
    def tone(frequency):
        return lambda t: 0.23 * math.sin(2 * math.pi * frequency * t)
    def pulse(t):
        age = (t - 0.5) % 1.0
        return 0 if t < 0.5 or age > 0.09 else 0.48 * min(1, age / 0.0015) * math.exp(-age / 0.016) * math.sin(2 * math.pi * 650 * age)
    return {
        'microphone': write_wav('fake-microphone-c4.wav', 24, tone(c4)),
        'correct': write_wav('fixture-c4.wav', 3, tone(c4)),
        'wrong': write_wav('fixture-c-sharp4.wav', 3, tone(c4 * 2 ** (1 / 12))),
        'rhythm': write_wav('fixture-60bpm.wav', 16, pulse),
        'silence': write_wav('fixture-silence.wav', 3, lambda _: 0),
        'mixed': write_wav('fixture-mixed.wav', 16, lambda t: pulse(t) + 0.05 * math.sin(2 * math.pi * 330 * t)),
    }


def legacy_state():
    lesson = json.loads((COURSE / 'course/day29.json').read_text())
    stamp = '2026-01-01T00:00:00.000Z'
    record = {'tasks': {f"{block['id']}:{i}": True for block in lesson['blocks'] for i in range(len(block['steps']))},
              'quiz': [], 'metrics': {'minutes': 48, 'bpm': 60, 'changesOk': None, 'changesTotal': None, 'stops': None, 'rhythmBars': None},
              'criteria': [], 'evidence': 'TEST-ONLY-legacy-day29.webm', 'note': 'TEST-ONLY 旧版第29课记录应保留', 'done': True, 'updatedAt': stamp}
    return {'schema': 1, 'createdAt': stamp, 'updatedAt': stamp, 'lastDay': 29,
            'records': {'29': record}, 'assessments': {}, 'songPlans': {}}


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def observe(page):
    page.on('pageerror', lambda err: errors.append({'url': page.url, 'message': str(err)}))
    page.on('request', lambda request: api_requests.append(request.url) if urlparse(request.url).path.startswith('/api/') else None)
    page.on('response', lambda response: asset_errors.append({'url': response.url, 'status': response.status})
            if response.status >= 400 and '/ukulele-lab/assets/' in response.url else None)


def fit_viewport(page, label):
    bad = page.evaluate("""() => ({overflow:document.documentElement.scrollWidth-innerWidth,
      elements:[...document.querySelectorAll('#main *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1)
      .slice(0,8).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.slice(0,70)}))})""")
    assert bad['overflow'] <= 1, (label, bad)


def rows(page):
    return page.evaluate('async () => (await window.UKE_RECORDINGS.list()).map(r => window.UKE_RECORDINGS.metadata(r))')


def wait_analysis(page, filename):
    page.wait_for_function("""async name => (await window.UKE_RECORDINGS.list()).some(r =>
      r.fileName===name && r.persisted===true && r.analysis && !r.analysisError)""", arg=filename, timeout=45000)
    expect(page.locator('#studio-panel [data-studio="record"]')).to_be_enabled(timeout=45000)
    result = next(r for r in rows(page) if r['fileName'] == filename)
    assert result['analysis']['schema'] == 1
    assert result['analysis']['quality']['score'] is None
    return result


def upload(page, file, mode, bpm=60, note='C4'):
    page.locator(f'[data-studio="mode"][data-mode="{mode}"]').click()
    page.locator('#studio-bpm').fill(str(bpm))
    if mode == 'single-note':
        page.locator('#studio-note').select_option(note)
    page.locator('#studio-upload').set_input_files(str(file))
    result = wait_analysis(page, file.name)
    expect(page.locator('#studio-result h3')).to_contain_text(file.name)
    assert result['config']['mode'] == mode
    return result


def play_saved_audio(page, selector):
    audio = page.locator(selector)
    expect(audio).to_be_visible()
    page.wait_for_function('selector => document.querySelector(selector)?.readyState >= 1', arg=selector)
    # Use the real native media control; do not replace HTMLMediaElement.play.
    audio.click(position={'x': 20, 'y': 20})
    page.wait_for_function('selector => {const a=document.querySelector(selector);return a && !a.paused && a.currentTime>0.02}', arg=selector, timeout=10000)
    audio.evaluate('a => a.pause()')
    assert audio.get_attribute('src').startswith('blob:')


def run():
    fixtures = fixture_audio()
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = f'http://127.0.0.1:{server.server_port}'
    base = origin + '/personal-growth-lab/academy/ukulele-lab/'
    old = legacy_state()
    other = {'schema': 1, 'records': {'english:1': {'tasks': [True, False, False], 'done': False,
              'note': 'TEST-ONLY unrelated English progress', 'artifact': '', 'score': None,
              'updatedAt': '2026-01-01T00:00:00.000Z'}}, 'last': {'english': 1}}
    other_raw = json.dumps(other, ensure_ascii=False, separators=(',', ':'))
    report = {'valid': False, 'checks': checks, 'page_errors': errors, 'asset_errors': asset_errors,
              'private_api_requests': api_requests, 'recordings': 'synthetic PCM fixtures and Chromium fake-media capture only'}
    page = context = browser = p = None
    try:
        p = sync_playwright().start()
        browser = p.chromium.launch(headless=True, args=[
            '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
            '--use-file-for-fake-audio-capture=' + str(fixtures['microphone'])])
        context = browser.new_context(viewport={'width': 1440, 'height': 1000}, locale='zh-CN', timezone_id='Asia/Shanghai', permissions=['microphone'])
        context.tracing.start(screenshots=True, snapshots=True, sources=True)
        context.add_init_script("""(() => {
          if(location.origin!==ORIGIN)return;
          if(!localStorage.getItem(KEY))localStorage.setItem(KEY,JSON.stringify(LEGACY));
          if(!localStorage.getItem(OTHER))localStorage.setItem(OTHER,OTHER_RAW);
          window.__ukeQaMediaCalls=0;
          const get=navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
          if(get)navigator.mediaDevices.getUserMedia=(...args)=>{window.__ukeQaMediaCalls++;return get(...args)};
        })()""".replace('ORIGIN', json.dumps(origin)).replace('OTHER_RAW', json.dumps(other_raw))
          .replace('OTHER', json.dumps(OTHER_KEY)).replace('LEGACY', json.dumps(old, ensure_ascii=False)).replace('KEY', json.dumps(KEY)))
        page = context.new_page()
        observe(page)
        page.set_default_timeout(12000)
        page.goto(base)
        expect(page.locator('#main h1')).to_be_visible()
        expect(page.locator('.mini-day')).to_have_count(30)
        assert page.evaluate('window.UKE_COURSE.lessons.length') == 30
        assert page.evaluate('window.__ukeQaMediaCalls') == 0, 'opening a classroom must not open the microphone'
        assert page.evaluate('window.UKE_APP.getState().records["29"]') == old['records']['29']
        page.screenshot(path=str(OUT / 'home-desktop.png'), full_page=True)
        checks.append('v1 progress loads unchanged and microphone is not requested on page open')

        def visit(route):
            page.goto(base + route)
            expect(page.locator('#main')).to_be_visible()
            page.wait_for_function('() => window.UKE_APP && window.UKE_STUDIO')

        for day in range(1, 31):
            visit(f'#/day/{day}')
            expect(page.locator('.day-title h1')).to_be_visible()
            assert page.locator('[data-task]').count() >= 10
            expect(page.locator('.quiz-item')).to_have_count(2)
            expect(page.locator('#studio-panel')).to_be_visible()
            fit_viewport(page, f'desktop day {day}')
        checks.append('all 30 lesson routes, substantive tasks, quizzes, studio mounts and desktop bounds')

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
        expect(page.locator('#practical-status')).to_contain_text('仍待验证')
        page.locator('[data-task]').first.uncheck()
        expect(page.locator('#mark-done')).to_be_disabled()
        page.locator('[data-task]').first.check()
        page.locator('#mark-done').click()
        correct = page.evaluate('window.UKE_COURSE.lessons[0].quiz[0].answer')
        page.locator(f'[data-action="quiz"][data-question="0"][data-option="{correct}"]').click()
        expect(page.locator('.quiz-explanation').first).to_contain_text('正确')
        checks.append('legacy check-in persistence, escaped notes, quiz explanations and separate practical mastery')

        visit('#/assessment/an-jing')
        expect(page.locator('#assessment-result')).to_contain_text('未评')
        for dimension in ['rhythm', 'changes', 'coordination', 'pitch', 'structure']:
            page.locator(f'[data-action="score"][data-dimension="{dimension}"][data-score="4"]').click()
        expect(page.locator('#assessment-result')).to_contain_text('80')
        expect(page.locator('#assessment-result .badge')).to_have_text('待完善 / 继续补练')
        assert not page.evaluate('window.UKE_PROGRESS.assess(window.UKE_APP.getState().assessments["an-jing"]).passed')
        page.locator('[data-scope="assessment"][data-field="complete"]').check()
        page.locator('[data-scope="assessment"][data-field="oneTake"]').check()
        page.locator('[data-scope="assessment"][data-field="restarts"]').fill('0')
        page.locator('[data-scope="assessment"][data-field="evidence"]').fill('TEST-ONLY-complete-an-jing.webm')
        page.locator('[data-scope="assessment"][data-field="bpm"]').fill('60')
        page.locator('[data-scope="assessment"][data-field="note"]').fill('测试数据，不是学习者成绩。')
        page.locator('[data-scope="assessment"][data-field="note"]').press('Tab')
        expect(page.locator('#assessment-result .badge')).to_have_text('自评达标')
        assert page.evaluate('window.UKE_PROGRESS.assess(window.UKE_APP.getState().assessments["an-jing"]).passed')
        page.locator('[data-action="score"][data-dimension="pitch"][data-score="2"]').click()
        expect(page.locator('#assessment-result .badge')).to_have_text('待完善 / 继续补练')
        assert not page.evaluate('window.UKE_PROGRESS.assess(window.UKE_APP.getState().assessments["an-jing"]).passed')
        page.locator('[data-action="score-clear"][data-dimension="pitch"]').click()
        expect(page.locator('#assessment-result')).to_contain_text('未评')
        checks.append('blank/manual scores, 80-point gate, evidence gate, weak dimension and reset')

        for song_id, total in [('an-jing', 90), ('qing-tian', 85), ('sadness', 92)]:
            visit('#/songs/' + song_id)
            expect(page.locator('.score-page h1')).to_be_visible()
            expect(page.locator('.score-summary')).to_contain_text(str(total) + '小节')
            expected_bars = page.evaluate('(id) => window.UKE_SCORES.songs.find(s=>s.id===id).sections.reduce((n,s)=>n+s.bars.length,0)', song_id)
            expect(page.locator('[data-score-bar]')).to_have_count(expected_bars)
            assert page.locator('.score-bar .score-beats span').count() == expected_bars * 4
            with page.expect_download() as download:
                page.locator(f'a[download][href="downloads/score-{song_id}.html"]').click()
            downloaded_score = OUT / f'score-{song_id}.html'
            download.value.save_as(str(downloaded_score))
            assert downloaded_score.stat().st_size > 1000
            fit_viewport(page, 'desktop score ' + song_id)
        checks.append('three in-course scores, complete form totals, four-beat tiles and real offline-score downloads')

        visit('#/songs/an-jing')
        page.locator('details.song-teaching > summary').click()
        page.locator('[data-scope="plan"][data-field="version"]').fill('TEST-ONLY C调简化版')
        page.locator('[data-scope="plan"][data-field="key"]').fill('C')
        page.locator('[data-scope="plan"][data-field="key"]').press('Tab')
        page.reload()
        page.locator('details.song-teaching > summary').click()
        expect(page.locator('[data-scope="plan"][data-field="version"]')).to_have_value('TEST-ONLY C调简化版')
        page.locator('#score-section').select_option('outro')
        page.locator('#score-bpm').fill('180')
        page.locator('#score-capo').select_option('2')
        page.locator('#score-follow').uncheck()
        page.locator('#score-loop').check()
        page.locator('[data-sheet="play"]').click()
        expect(page.locator('#score-play-status')).to_contain_text('预备')
        page.wait_for_function("""() => document.querySelector('[data-score-bar="outro:0"]')?.classList.contains('active')""", timeout=10000)
        expect(page.locator('.score-beats span.active')).to_have_count(1)
        expect(page.locator('#score-play-status')).to_contain_text('第2轮', timeout=15000)
        page.locator('[data-sheet="stop"]').click()
        expect(page.locator('#score-play-status')).to_contain_text('停止')
        expect(page.locator('.score-bar.active')).to_have_count(0)
        page.locator('#score-bpm').fill('0')
        page.locator('[data-sheet="play"]').click()
        expect(page.locator('#score-play-status')).to_contain_text('30–180')
        checks.append('song-version notes, real WebAudio score playback, count-in, active bar/beat, loop and invalid BPM')

        for day in [11, 15, 17, 18]:
            visit(f'#/day/{day}')
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
        checks.append('updated half-bar/eight-beat lesson timing, density switch and deliberate omitted beat')

        visit('#/tools')
        assert page.evaluate('window.__ukeQaMediaCalls') == 0
        page.locator('[data-action="metronome"]').click()
        expect(page.locator('#metro-toggle')).to_contain_text('停止')
        page.locator('[data-action="audio-stop"]').first.click()
        page.locator('[data-studio="mode"][data-mode="single-note"]').click()
        page.locator('#studio-note').select_option('C4')
        page.locator('#studio-bpm').fill('180')
        page.locator('#studio-panel [data-studio="record"]').click()
        expect(page.locator('#studio-live-status')).to_contain_text('正在录制', timeout=15000)
        expect(page.locator('[data-studio-beat].active')).to_have_count(1)
        assert page.evaluate('window.__ukeQaMediaCalls') == 1
        page.wait_for_timeout(3200)  # Actual MediaRecorder capture time, not mocked completion.
        page.locator('#studio-panel [data-studio="stop"]').click()
        page.wait_for_function('async () => (await window.UKE_RECORDINGS.list()).some(r=>r.source==="recorded" && r.persisted && r.analysis)', timeout=45000)
        expect(page.locator('#studio-panel [data-studio="record"]')).to_be_enabled(timeout=45000)
        recorded = next(r for r in rows(page) if r['source'] == 'recorded')
        assert recorded['duration'] > 2.5 and recorded['size'] > 1000
        assert recorded['analysis']['pitch']['status'] == 'ok'
        assert recorded['analysis']['pitch']['score'] >= 80
        assert recorded['analysis']['quality']['score'] is None
        expect(page.locator('#studio-live-status')).to_contain_text('刷新页面后仍可回听')
        expect(page.locator('.analysis-facts')).to_contain_text('音分')
        recording_id = recorded['id']
        recorded_selector = f'#studio-recent [data-recording-id="{recording_id}"]'
        with page.expect_download() as download:
            page.locator(recorded_selector + ' [data-studio="download"]').click()
        recorded_file = OUT / 'test-mediarecorder.webm'
        download.value.save_as(str(recorded_file))
        assert recorded_file.stat().st_size == recorded['size']
        page.reload()
        expect(page.locator(recorded_selector)).to_be_visible()
        play_saved_audio(page, recorded_selector + ' audio')
        assert next(r for r in rows(page) if r['id'] == recording_id)['analysis']['pitch']['status'] == 'ok'
        checks.append('real getUserMedia/MediaRecorder capture from fake PCM, Worker analysis, IndexedDB save, reload, native playback and download')

        visit('#/recordings')
        correct_audio = upload(page, fixtures['correct'], 'single-note')
        assert correct_audio['analysis']['pitch']['status'] == 'ok'
        assert correct_audio['analysis']['pitch']['score'] >= 90
        assert abs(correct_audio['analysis']['pitch']['centsMedian']) < 8
        expect(page.locator('.analysis-facts')).to_contain_text('音分')
        wrong_audio = upload(page, fixtures['wrong'], 'single-note')
        assert wrong_audio['analysis']['pitch']['status'] == 'ok'
        assert wrong_audio['analysis']['pitch']['score'] <= 20
        assert wrong_audio['analysis']['pitch']['centsMedian'] > 80
        expect(page.locator('[data-studio="seek"]').first).to_be_visible()
        page.locator('[data-studio="seek"]').first.click()
        page.wait_for_function('() => [...document.querySelectorAll(".recording-row audio")].some(a=>!a.paused)', timeout=10000)
        page.evaluate('() => document.querySelectorAll("audio").forEach(a=>a.pause())')
        rhythm_audio = upload(page, fixtures['rhythm'], 'rhythm')
        assert rhythm_audio['analysis']['rhythm']['status'] == 'ok'
        assert rhythm_audio['analysis']['rhythm']['score'] >= 90
        assert rhythm_audio['analysis']['rhythm']['onsetCount'] == 16
        assert rhythm_audio['analysis']['rhythm']['grid']['meanDeviationMs'] < 15
        expect(page.locator('.analysis-facts')).to_contain_text('偏差')
        silent_audio = upload(page, fixtures['silence'], 'single-note')
        assert silent_audio['analysis']['pitch']['score'] is None
        assert silent_audio['analysis']['pitch']['status'] == 'unscorable'
        expect(page.locator('.analysis-dimension').filter(has_text='单音音准')).to_contain_text('无法评分')
        page.screenshot(path=str(OUT / 'analysis-desktop.png'), full_page=True)
        checks.append('uploaded correct/wrong-note and rhythm WAVs use actual DSP; measured issue links play; silence remains unscorable')

        visit('#/assessment/qing-tian')
        expect(page.locator('#assessment-result')).to_contain_text('未评')
        mixed_audio = upload(page, fixtures['mixed'], 'mixed')
        assert all(mixed_audio['analysis'][part]['score'] is None for part in ['quality', 'rhythm', 'pitch', 'chord'])
        assessment = page.evaluate('window.UKE_APP.getState().assessments["qing-tian"]')
        assert all(value is None for value in assessment['scores'].values())
        assert not assessment['complete'] and not assessment['oneTake'] and assessment['restarts'] is None
        assert fixtures['mixed'].name in assessment['evidence']
        expect(page.locator('#assessment-result')).to_contain_text('未评')
        assert not page.evaluate('window.UKE_APP.getSummary().graduated')
        assert page.evaluate('window.UKE_APP.getState().records["29"]') == old['records']['29']
        assert page.evaluate('(key) => localStorage.getItem(key)', OTHER_KEY) == other_raw
        checks.append('mixed recording attaches evidence without scoring the five song dimensions, graduation or altering old/other-course progress')

        visit('#/recordings')
        source_rows = rows(page)
        expected_ids = {r['id'] for r in source_rows}
        assert len(expected_ids) == 6
        with page.expect_download() as download:
            page.locator('[data-studio="backup"]').click()
        archive = OUT / 'complete-test-backup.zip'
        download.value.save_as(str(archive))
        with zipfile.ZipFile(archive) as bundle:
            assert bundle.testzip() is None
            manifest = json.loads(bundle.read('manifest.json'))
            assert manifest['app'] == 'yixindao.ukulele.audio-backup'
            assert manifest['schema'] == 1
            assert len(manifest['recordings']) == len(expected_ids)
            assert manifest['progress']['records']['29'] == old['records']['29']
            audio_hashes = {}
            for row in manifest['recordings']:
                payload = bundle.read(row['archivePath'])
                assert len(payload) == row['size'] > 0
                audio_hashes[row['id']] = hashlib.sha256(payload).hexdigest()
                if row['id'] == recording_id:
                    assert payload == recorded_file.read_bytes()
                elif row['source'] == 'uploaded':
                    assert payload == (FIXTURES / row['fileName']).read_bytes()
            # Corrupt actual audio bytes while retaining the original CRC.
            info = bundle.getinfo(manifest['recordings'][0]['archivePath'])
            damaged = bytearray(archive.read_bytes())
            name_length, extra_length = struct.unpack_from('<HH', damaged, info.header_offset + 26)
            audio_start = info.header_offset + 30 + name_length + extra_length
            damaged[audio_start + 50] ^= 0x40
            corrupt_archive = OUT / 'corrupt-test-backup.zip'
            corrupt_archive.write_bytes(damaged)
        with page.expect_download() as download:
            page.locator('[data-action="export"]').first.click()
        json_backup = OUT / 'legacy-compatible-progress.json'
        download.value.save_as(str(json_backup))
        exported = json.loads(json_backup.read_text())
        assert exported['state']['records']['1']['metrics']['minutes'] == 50
        assert 'recordings' not in exported['state']
        checks.append('standard ZIP contains byte-identical encoded microphone audio and uploaded WAVs, reports and v1 progress; JSON backup remains compatible')

        mobile_context = browser.new_context(viewport={'width': 390, 'height': 844}, locale='zh-CN', timezone_id='Asia/Shanghai')
        mobile = mobile_context.new_page()
        observe(mobile)
        mobile.set_default_timeout(12000)
        mobile.goto(base + '#/resources')
        mobile.locator('#import-file').set_input_files(str(json_backup))
        expect(mobile.locator('#toast')).to_contain_text('校验通过')
        mobile.goto(base + '#/day/1')
        expect(mobile.locator('[data-field="note"][data-scope="day"]')).to_have_value('测试记录 <img src=x onerror=alert(1)>')
        mobile.evaluate("""() => {const s=window.UKE_PROGRESS.fresh(),r=window.UKE_PROGRESS.freshRecord();r.note='TEST-ONLY destination record';s.records['2']=r;window.UKE_APP.importState(s)}""")
        mobile.goto(base + '#/recordings')
        assert rows(mobile) == []
        mobile.locator('#studio-restore').set_input_files(str(archive))
        expect(mobile.locator('#toast')).to_contain_text('备份已恢复', timeout=45000)
        mobile.wait_for_function('async n => (await window.UKE_RECORDINGS.list()).length===n', arg=len(expected_ids), timeout=30000)
        mobile.reload()
        expect(mobile.locator('#recording-library .recording-row')).to_have_count(len(expected_ids))
        assert {r['id'] for r in rows(mobile)} == expected_ids
        assert mobile.evaluate('window.UKE_APP.getState().records["2"].note') == 'TEST-ONLY destination record'
        assert mobile.evaluate('window.UKE_APP.getState().records["29"]') == old['records']['29']
        hashes_after = mobile.evaluate("""async () => {const result={};for(const r of await window.UKE_RECORDINGS.list()){
          const h=await crypto.subtle.digest('SHA-256',await r.blob.arrayBuffer());result[r.id]=[...new Uint8Array(h)].map(v=>v.toString(16).padStart(2,'0')).join('');}return result}""")
        assert hashes_after == audio_hashes
        play_saved_audio(mobile, f'#recording-library [data-recording-id="{correct_audio["id"]}"] audio')
        awaitable_patch = {'id': correct_audio['id'], 'label': 'TEST-ONLY newer local recording label'}
        mobile.evaluate('async x => window.UKE_RECORDINGS.update(x.id,{label:x.label})', awaitable_patch)
        mobile.locator('#studio-restore').set_input_files(str(archive))
        expect(mobile.locator('#toast')).to_contain_text('备份已恢复', timeout=45000)
        assert next(r for r in rows(mobile) if r['id'] == correct_audio['id'])['label'] == awaitable_patch['label']
        assert len(rows(mobile)) == len(expected_ids)
        mobile.locator('#studio-restore').set_input_files(str(corrupt_archive))
        expect(mobile.locator('#toast')).to_contain_text('校验失败', timeout=30000)
        assert {r['id'] for r in rows(mobile)} == expected_ids
        assert mobile.evaluate('window.UKE_APP.getState().records["2"].note') == 'TEST-ONLY destination record'
        checks.append('ZIP restore in a fresh mobile profile survives reload/playback, preserves every audio hash and newer local data, and rejects corrupt audio without deleting records')

        mobile.goto(base + '#/recordings')
        mobile.locator(f'#recording-library [data-recording-id="{rhythm_audio["id"]}"] [data-studio="analysis"]').click()
        expect(mobile.locator('#studio-result')).to_contain_text(fixtures['rhythm'].name)
        fit_viewport(mobile, 'mobile restored audio analysis')
        mobile.screenshot(path=str(OUT / 'recordings-mobile.png'), full_page=True)
        for route in ['#/', '#/roadmap', '#/day/1', '#/day/18', '#/day/30', '#/songs/an-jing', '#/songs/qing-tian', '#/songs/sadness', '#/assessment/an-jing', '#/insights', '#/tools', '#/resources', '#/handbook', '#/recordings', '#/account']:
            mobile.goto(base + route)
            expect(mobile.locator('#main')).to_be_visible()
            fit_viewport(mobile, '390px ' + route)
        mobile.goto(base + '#/songs/qing-tian')
        mobile.screenshot(path=str(OUT / 'score-mobile.png'), full_page=True)
        mobile.goto(base)
        mobile.screenshot(path=str(OUT / 'home-mobile.png'), full_page=True)
        for route in ['#/recordings', '#/songs/qing-tian', '#/day/1']:
            mobile.set_viewport_size({'width': 360, 'height': 800})
            mobile.goto(base + route)
            fit_viewport(mobile, '360px ' + route)
        checks.append('15 mobile routes at 390px plus critical studio/score/lesson at 360px; restored audio analysis remains visible')

        denied_context = browser.new_context(viewport={'width': 390, 'height': 844}, locale='zh-CN')
        denied_context.add_init_script("navigator.mediaDevices.getUserMedia = async () => {throw new DOMException('QA denied microphone','NotAllowedError')}")
        denied = denied_context.new_page()
        observe(denied)
        denied.goto(base + '#/recordings')
        denied.locator('#studio-panel [data-studio="record"]').click()
        expect(denied.locator('#studio-live-status')).to_contain_text('麦克风权限未开放')
        expect(denied.locator('[data-studio="upload"]')).to_be_enabled()
        expect(denied.locator('#studio-panel [data-studio="record"]')).to_be_enabled()
        assert rows(denied) == []
        checks.append('permission-denied branch gives a usable upload fallback and does not create a phantom recording')
        denied_context.close()

        visit('#/account')
        assert page.evaluate('window.UKE_CLOUD.isCloud') is False
        expected_login = page.evaluate('window.UKE_CLOUD_CONFIG.origin + "/classroom/#/account"')
        expect(page.locator('.cloud-login').first).to_have_attribute('href', expected_login)
        assert expected_login.startswith('https://')
        assert not api_requests, api_requests
        checks.append('public classroom login points to the real private classroom without calling private APIs')

        visit('#/handbook')
        assert '第30天' in page.locator('#main').inner_text()
        page.emulate_media(media='print')
        page.pdf(path=str(OUT / 'ukulele-handbook-test.pdf'), format='A4', print_background=True)
        page.emulate_media(media='screen')
        checks.append('complete printable 30-day handbook')

        page.goto(origin + '/personal-growth-lab/academy/#/projects')
        expect(page.locator('.project-card')).to_have_count(13)
        expect(page.locator('.project-card a[href="#/ukulele"]').first).to_be_visible()
        page.locator('.project-card a[href="#/ukulele"]').first.click()
        page.wait_for_url('**/ukulele-lab/**')
        expect(page.locator('#main h1')).to_be_visible()
        assert page.evaluate('window.UKE_APP.getState().records["29"]') == old['records']['29']
        assert page.evaluate('(key) => JSON.parse(localStorage.getItem(key)).records["english:1"].note', OTHER_KEY) == other['records']['english:1']['note']
        checks.append('academy catalog retains 13 courses, routes to v2, and preserves unrelated English data')
        assert not errors, errors
        assert not asset_errors, asset_errors
        assert not api_requests, api_requests
        report['valid'] = True
        report['saved_audio_count'] = len(expected_ids)
        report['audio_bytes_roundtrip'] = 'SHA-256 equal for all recordings in an independent browser context'
        context.tracing.stop(path=str(OUT / 'trace.zip'))
        context = None
        browser.close()
        browser = None
    except Exception:
        report['failure'] = traceback.format_exc()
        if page is not None:
            try:
                page.screenshot(path=str(OUT / 'failure.png'), full_page=True)
                (OUT / 'failure.html').write_text(page.content())
            except Exception:
                pass
        if context is not None:
            try:
                context.tracing.stop(path=str(OUT / 'trace.zip'))
            except Exception:
                pass
        raise
    finally:
        if browser is not None:
            try:
                browser.close()
            except Exception:
                pass
        if p is not None:
            p.stop()
        server.shutdown()
        (OUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    run()
