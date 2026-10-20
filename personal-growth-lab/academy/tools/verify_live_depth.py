"""Check actual published bytes, not merely that a commit exists."""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import time
import urllib.request

root = Path(__file__).resolve().parents[1]
out = Path(os.environ.get('DEPTH_TEST_OUTPUT', '/tmp/academy-depth-qa'))
committed = subprocess.check_output(['git', 'show', 'HEAD:personal-growth-lab/academy/index.html'], text=True)
if 'assets/depth-reader.js' not in committed:
    report = {'status': 'candidate-only', 'live_verified': False, 'reason': 'Detailed entrypoint has not yet been activated.'}
    (out / 'live-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('Candidate quality run: public entrypoint intentionally unchanged.')
    raise SystemExit(0)
base = 'https://zbyloveyj.github.io/personal-growth-lab/academy/'
files = ['index.html', 'assets/depth.css'] + ['assets/depth-' + x + '.js' for x in
        ['core', 'english', 'writing', 'coding', 'research', 'visual', 'neuro', 'career', 'papers', 'thinking', 'life', 'reader']]
expected = {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in files}
last = []
for attempt in range(1, 17):
    records = []
    for name in files:
        url = base + ('' if name == 'index.html' else name) + '?edition=20261020d&check=' + expected[name][:12]
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'GrowthAcademy-Release-Verification/1.0', 'Cache-Control': 'no-cache'})
            with urllib.request.urlopen(request, timeout=25) as response:
                payload, status = response.read(), response.status
            digest = hashlib.sha256(payload).hexdigest()
            records.append({'path': name, 'status': status, 'sha256': digest, 'matches_commit': digest == expected[name]})
        except Exception as error:
            records.append({'path': name, 'error': str(error), 'matches_commit': False})
    if all(row['matches_commit'] for row in records):
        report = {'status': 'passed', 'live_verified': True, 'base_url': base, 'files_checked': len(records),
                  'commit': os.environ.get('GITHUB_SHA'), 'records': records}
        (out / 'live-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        print('LIVE PAGES VERIFIED: every detailed asset and entrypoint matches the tested commit.\n' + json.dumps(report, indent=2), flush=True)
        break
    last = records
    print(f'Publication check {attempt}: not all expected bytes are public yet.', flush=True)
    if attempt < 16:
        time.sleep(15)
else:
    (out / 'live-report.json').write_text(json.dumps({'status': 'failed', 'records': last}, indent=2), encoding='utf-8')
    raise RuntimeError('Public Pages did not match the tested detailed edition within this verification run.')
