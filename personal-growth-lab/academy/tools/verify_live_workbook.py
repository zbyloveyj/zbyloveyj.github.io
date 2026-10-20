"""Verify actual public bytes after activation; candidate runs remain explicitly un-published."""
from pathlib import Path
import hashlib
import json
import os
import re
import subprocess
import time
import urllib.request

root=Path(__file__).resolve().parents[1]
out=Path(os.environ.get('WORKBOOK_QA_DIR','/tmp/academy-workbook-qa'))
committed=subprocess.check_output(['git','show','HEAD:personal-growth-lab/academy/index.html'],text=True)
if 'assets/workbook-reader.js' not in committed:
    result={'status':'candidate-only','live_verified':False,'reason':'Workbook entrypoint is not yet activated.'}
    (out/'live-report.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print('CANDIDATE VERIFIED LOCALLY; NOT CLAIMING PUBLIC ACTIVATION')
    raise SystemExit(0)
files=['index.html']
for name in re.findall(r'(?:src|href)="((?:assets|data)/[^"?]+)',committed):
    if name.endswith(('.js','.css')) and name not in files: files.append(name)
expected={name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in files}
base='https://zbyloveyj.github.io/personal-growth-lab/academy/'
for attempt in range(16):
    records=[]
    for name in files:
        url=base+('' if name=='index.html' else name)+'?workbook=3&sha='+expected[name][:16]
        try:
            request=urllib.request.Request(url,headers={'User-Agent':'GrowthAcademy-Workbook-Verification/1.0','Cache-Control':'no-cache'})
            with urllib.request.urlopen(request,timeout=25) as response:
                content,status=response.read(),response.status
            digest=hashlib.sha256(content).hexdigest()
            records.append({'path':name,'status':status,'matches_commit':digest==expected[name],'sha256':digest})
        except Exception as e:
            records.append({'path':name,'matches_commit':False,'error':str(e)})
    if all(r['matches_commit'] for r in records):
        report={'status':'passed','live_verified':True,'version':'2026.10.20.3-workbook','commit':os.environ.get('GITHUB_SHA'),
                'base_url':base,'files_checked':len(records),'records':records}
        (out/'live-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        print('LIVE WORKBOOK VERIFIED\n'+json.dumps(report,indent=2),flush=True)
        break
    print('Public files do not yet all match the tested commit: '+str(attempt+1),flush=True)
    if attempt<15: time.sleep(15)
else:
    (out/'live-report.json').write_text(json.dumps({'status':'failed','records':records},indent=2),encoding='utf-8')
    raise RuntimeError('Live workbook did not match the tested entrypoint and assets')
