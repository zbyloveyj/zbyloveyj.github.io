#!/usr/bin/env python3
"""Conservative public-source change monitor; never edits editorial vacancy status."""
import concurrent.futures
import hashlib
import json
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
LIMIT = 3_000_000

class Text(HTMLParser):
    def __init__(self):
        super().__init__(); self.parts=[]; self.skip=[]
    def handle_starttag(self, tag, attrs):
        if tag in ('script','style','noscript','svg','nav','footer','header'):
            self.skip.append(tag)
    def handle_endtag(self, tag):
        if tag in self.skip:
            self.skip = self.skip[:len(self.skip)-1-self.skip[::-1].index(tag)]
    def handle_data(self, value):
        if not self.skip: self.parts.append(value)

def normalize(html):
    parser=Text(); parser.feed(html)
    return re.sub(r'\s+', ' ', ' '.join(parser.parts)).strip()

def update_record(old, stamp, checked, digest=None, error=None):
    row=dict(old or {}); row.update(reviewStamp=stamp,checkedAt=checked)
    if error:
        row.update(state='error',error=error)
        # Keep prior successful hashes/change state. A fetch failure is not closure.
        return row
    if old.get('reviewStamp') != stamp or not old.get('baselineHash'):
        row.update(baselineHash=digest,baselineAt=checked)
    row.update(state='ok',hash=digest,lastSuccessAt=checked,
               changed=(digest != row['baselineHash']))
    row.pop('error',None)
    return row

def inspect(item, previous, checked):
    url,stamp=item
    old=previous.get(url,{})
    try:
        parsed=urlsplit(url)
        if parsed.scheme!='https' or not parsed.hostname: raise ValueError('invalid HTTPS source')
        req=Request(url,headers={'User-Agent':'GrowthAcademyEvidenceMonitor/1.0 (+https://zbyloveyj.github.io/personal-growth-lab/academy/labs.html)','Accept':'text/html,application/xhtml+xml'})
        with urlopen(req,timeout=22) as response:
            if urlsplit(response.url).scheme!='https': raise ValueError('non-HTTPS redirect')
            if 'html' not in response.headers.get('Content-Type',''): raise ValueError('non-HTML response')
            raw=response.read(LIMIT+1)
            if len(raw)>LIMIT: raise ValueError('response too large')
            text=normalize(raw.decode(response.headers.get_content_charset() or 'utf-8',errors='replace'))
            if len(text)<100 or any(s in text.lower() for s in ('just a moment...', 'verify you are human', 'enable javascript and cookies to continue')):
                raise ValueError('empty or challenge page')
        digest=hashlib.sha256(text.encode()).hexdigest()
        return url,update_record(old,stamp,checked,digest=digest)
    except Exception as exc:
        # Store bounded diagnostics only, not response bodies or credentials.
        error=f'HTTP {exc.code}' if isinstance(exc,HTTPError) else type(exc).__name__+': '+str(exc)[:100]
        return url,update_record(old,stamp,checked,error=error)

def main():
    data=json.loads((ROOT/'data/labs.json').read_text())
    dest=ROOT/'data/lab-monitor.json'
    previous=json.loads(dest.read_text()).get('sources',{}) if dest.exists() else {}
    sources={}
    for lab in data['labs']:
        for source in lab['sources']:
            sources[source['url']]=max(source['verifiedAt'], sources.get(source['url'],''))
        sources[lab['opportunity']['url']]=lab['opportunity']['verifiedAt']
    checked=datetime.now(timezone.utc).isoformat(timespec='seconds')
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        rows=dict(executor.map(lambda item:inspect(item,previous,checked),sources.items()))
    result={'schemaVersion':1,'checkedAt':checked,'meaning':'网页可访问性和正文哈希巡检；不等于科研事实或招聘资格复核。','sources':dict(sorted(rows.items()))}
    dest.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'sources':len(rows),'ok':sum(r['state']=='ok' for r in rows.values()),'changed':sum(bool(r.get('changed')) for r in rows.values()),'errors':sum(r['state']!='ok' for r in rows.values())}))

if __name__=='__main__': main()
