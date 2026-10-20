"""Verify public Pages bytes match the release; never post user data."""
import hashlib,json,time,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE='https://zbyloveyj.github.io/personal-growth-lab/academy/'
files=['index.html','assets/academy.css','assets/core.js','assets/english.js','assets/studio.js','assets/explore.js','assets/app.js','assets/papers.js','data/papers.js','downloads/starter_projects.py']
expected={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in files}
last={}
for attempt in range(24):
 last={}
 for p,want in expected.items():
  try:
   req=urllib.request.Request(BASE+p+'?release-check='+str(int(time.time())),headers={'User-Agent':'GrowthAcademyReleaseCheck'})
   with urllib.request.urlopen(req,timeout=30) as r: body=r.read();status=r.status
   actual=hashlib.sha256(body).hexdigest()
   if status!=200 or actual!=want:last[p]={'status':status,'hash_matches':actual==want}
  except Exception as e:last[p]=str(e)
 if not last:
  report={'url':BASE,'http_status':200,'files_verified':len(files),'sha256_match':True,'catalogue_items':len(json.loads((ROOT/'data/papers.js').read_text().split('=',1)[1].strip().rstrip(';')))}
  print(json.dumps(report,ensure_ascii=False,indent=2))
  break
 print('Waiting for published release:',json.dumps(last),flush=True);time.sleep(10)
else:raise SystemExit('Public release does not match checkout: '+json.dumps(last))
