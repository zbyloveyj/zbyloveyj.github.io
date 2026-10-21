#!/usr/bin/env python3
"""Conservative public-source change monitor; never edits editorial vacancy status."""
import concurrent.futures
import argparse
import collections
import hashlib
import json
import re
import threading
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from lab_data import load_catalog

ROOT = Path(__file__).resolve().parents[1]
LIMIT = 3_000_000
NIH_LOCK = threading.Lock()
NIH_LAST_REQUEST = 0.0

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
        project = re.fullmatch(r'/project-details/(\d+)/?', parsed.path) if parsed.hostname == 'reporter.nih.gov' else None
        if project:
            # RePORTER pages are a JS shell. Inspect the official project API,
            # not the shell, and respect its <= 1 request/second recommendation.
            global NIH_LAST_REQUEST
            with NIH_LOCK:
                pause = max(0, 1.1 - (time.monotonic() - NIH_LAST_REQUEST))
                if pause:
                    time.sleep(pause)
                NIH_LAST_REQUEST = time.monotonic()
            payload={'criteria':{'appl_ids':[int(project.group(1))]},'limit':1,
                'include_fields':['ApplId','ProjectTitle','PrincipalInvestigators','Organization','IsActive','ProjectEndDate','AbstractText']}
            req=Request('https://api.reporter.nih.gov/v2/projects/search',data=json.dumps(payload).encode(),
                headers={'Content-Type':'application/json','User-Agent':'GrowthAcademyEvidenceMonitor/2.0'})
            with urlopen(req,timeout=30) as response:
                raw=response.read(LIMIT+1)
            if len(raw)>LIMIT:
                raise ValueError('project response too large')
            records=json.loads(raw).get('results',[])
            if len(records)!=1 or int(records[0].get('appl_id',0))!=int(project.group(1)):
                raise ValueError('official project not returned')
            digest=hashlib.sha256(json.dumps(records[0],ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
            row=update_record(old,stamp,checked,digest=digest)
            row['readMethod']='official_project_api'
            return url,row
        req=Request(url,headers={'User-Agent':'GrowthAcademyEvidenceMonitor/1.0 (+https://zbyloveyj.github.io/personal-growth-lab/academy/labs.html)','Accept':'text/html,application/xhtml+xml'})
        with urlopen(req,timeout=15) as response:
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

def select_sources(data, previous, max_profiles=96):
    """Always check evidence/rosters; rotate individual profile checks by oldest success."""
    priority = {}
    profiles = {}
    for lab in data['labs']:
        reviewed = lab.get('evidenceLevel', 'reviewed') == 'reviewed'
        for source in lab['sources']:
            url = source['url'].split('#')[0]
            if urlsplit(url).scheme != 'https':
                continue
            target = priority if reviewed or source.get('kind') == 'directory' else profiles
            target[url] = max(source['verifiedAt'], target.get(url, ''))
        if reviewed and lab['opportunity'].get('verifiedAt'):
            opportunity = lab['opportunity']
            url = opportunity['url'].split('#')[0]
            if urlsplit(url).scheme == 'https':
                priority[url] = max(opportunity['verifiedAt'], priority.get(url, ''))
        elif not reviewed:
            url = (lab.get('profileUrl') or '').split('#')[0]
            if urlsplit(url).scheme == 'https':
                profiles[url] = lab['verifiedAt']
    for url in priority:
        profiles.pop(url, None)
    ordered = sorted(profiles, key=lambda url: (previous.get(url, {}).get('checkedAt', ''), url))
    # Mix domains to keep a single blocked institutional host from occupying all workers.
    chosen = ordered[:max_profiles] if max_profiles >= 0 else ordered
    buckets = collections.defaultdict(list)
    for url, stamp in list(priority.items()) + [(url, profiles[url]) for url in chosen]:
        buckets[urlsplit(url).hostname].append((url, stamp))
    items = []
    while buckets:
        for host in list(buckets):
            items.append(buckets[host].pop(0))
            if not buckets[host]:
                del buckets[host]
    return items, set(priority) | set(profiles), len(priority), len(chosen)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--max-profiles', type=int, default=96)
    args = parser.parse_args()
    data=load_catalog(ROOT/'data/labs.json')
    dest=ROOT/'data/lab-monitor.json'
    previous=json.loads(dest.read_text()).get('sources',{}) if dest.exists() else {}
    items, all_urls, priority_count, profile_count = select_sources(data, previous, args.max_profiles)
    checked=datetime.now(timezone.utc).isoformat(timespec='seconds')
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        checked_rows=dict(executor.map(lambda item:inspect(item,previous,checked),items))
    # Retain each source's own check date. A batch date never implies all profiles were checked today.
    rows={url:row for url,row in previous.items() if url in all_urls}
    rows.update(checked_rows)
    result={'schemaVersion':1,'checkedAt':checked,'meaning':'每日巡检官方目录与详细证据；个人资料按最早检查时间分批轮巡。仅检查可访问性和正文变化，不等于科研事实或招生招聘资格复核。',
            'batch':{'checked':len(checked_rows),'prioritySources':priority_count,'rotatingProfiles':profile_count,'knownSources':len(all_urls),'neverChecked':len(all_urls-set(rows))},
            'sources':dict(sorted(rows.items()))}
    dest.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'sources':len(rows),'ok':sum(r['state']=='ok' for r in rows.values()),'changed':sum(bool(r.get('changed')) for r in rows.values()),'errors':sum(r['state']!='ok' for r in rows.values())}))

if __name__=='__main__': main()

