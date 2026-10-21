from pathlib import Path
from urllib.request import urlopen,Request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timezone
import json,hashlib
ROOT=Path(__file__).resolve().parent;D=ROOT/'asia-profiles';D.mkdir(exist_ok=True)
rows=json.loads((ROOT/'asia_oceania.json').read_text())
selected=[r for r in rows if any(x in r['institution'] for x in ['Hong Kong University','Genome Institute'])]
def get(row):
 u=row['url'];key=hashlib.sha256(u.encode()).hexdigest()[:20];dest=D/(key+'.html')
 try:
  with urlopen(Request(u,headers={'User-Agent':'Mozilla/5.0 (public academic profile verification)'}),timeout=25) as resp:
   body=resp.read();status=resp.status;resolved_url=resp.url
  fetched_at=datetime.now(timezone.utc).isoformat()
  staged=dest.with_suffix('.html.tmp');staged.write_bytes(body);staged.replace(dest)
  return {'name':row['name'],'url':u,'status':status,'resolvedUrl':resolved_url,'file':dest.name,
          'fetchedAt':fetched_at,'sha256':hashlib.sha256(body).hexdigest()}
 except Exception as e:return {'name':row['name'],'url':u,'error':str(e)}
with ThreadPoolExecutor(6) as pool:
 result=list(pool.map(get,selected))
(ROOT/'asia-profiles-log.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print('Profiles',len(result),'OK',sum(x.get('status')==200 for x in result),'Failed',[x for x in result if 'error' in x])
