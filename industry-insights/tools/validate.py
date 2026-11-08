#!/usr/bin/env python3
"""Check publication dates, archived evidence, capital types and deployable links."""
from pathlib import Path
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo
from urllib.parse import urlsplit, unquote
from html.parser import HTMLParser
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
TODAY = datetime.now(ZoneInfo('Etc/GMT-8')).date()
TRACKS = {'giants','frontier','capital'}
FINANCE = {'equity','mixed','grant','program','fundraise','acquisition','capex','contract','earnings'}

class HTML(HTMLParser):
    def __init__(self):
        super().__init__();self.links=[];self.ids=[]
    def handle_starttag(self, tag, attrs):
        d=dict(attrs)
        if d.get('id'):self.ids.append(d['id'])
        if tag in ('a','link','script','img') and (d.get('href') or d.get('src')):
            self.links.append(d.get('href') or d.get('src'))

def report_check(r, sectors):
    assert r['schemaVersion'] == 1
    start,end = (date.fromisoformat(r['period'][x]) for x in ('start','end'))
    assert start <= end and (end-start).days == 6
    assert datetime.fromisoformat(r['generatedAt']).tzinfo is not None
    assert r['entries'] and r['theses'] and r['coverageNote']
    ids = [e['id'] for e in r['entries']]
    assert len(ids) == len(set(ids)), 'Duplicate event ID'
    urls = []
    for e in r['entries']:
        assert re.fullmatch(r'[a-z0-9-]+',e['id'])
        assert e['window'] in {'week','context'}
        assert set(e['tracks']) <= TRACKS and e['tracks']
        assert set(e['sectors']) <= sectors and e['sectors']
        for k in ('title','fact','insight','nextCheck','evidence','region'):
            assert e[k].strip(), f'{e["id"]}: empty {k}'
        pub,verified = (date.fromisoformat(e[x]) for x in ('publishedDate','verifiedDate'))
        assert pub <= verified <= TODAY, f'Future date in {e["id"]}'
        if e['eventDate']:
            assert re.fullmatch(r'\d{4}-\d{2}(-\d{2})?',e['eventDate'])
            assert e['eventDate'] <= e['verifiedDate']
        if e['window'] == 'week':
            assert start <= pub <= end, f'Old news labeled current: {e["id"]}'
        assert e['sources'] and e['organizations']
        for s in e['sources']:
            assert urlsplit(s['url']).scheme == 'https' and urlsplit(s['url']).netloc
            assert s['label']
        urls.append(e['sources'][0]['url'])
        if 'capital' in e['tracks']:
            assert e['kind'] in FINANCE and e.get('finance'), f'Missing capital basis: {e["id"]}'
        if e.get('finance'):
            f=e['finance']
            for key in ('display','basis','stage','investors','use'):
                assert f[key].strip()
            for leg in f['legs']:
                assert leg['type'] in FINANCE - {'mixed'}
                assert leg['currency'] and leg['status']
                assert leg['amount'] is None or (isinstance(leg['amount'],(float,int)) and leg['amount']>0)
    assert len(urls) == len(set(urls)), 'Same primary event source counted twice'
    for thesis in r['theses']:
        assert thesis['title'] and thesis['text'] and thesis['evidenceIds']
        assert set(thesis['evidenceIds']) <= set(ids), 'Thesis has missing evidence'

def html_check(path):
    p=HTML();p.feed(path.read_text())
    assert len(p.ids)==len(set(p.ids)), f'Duplicate HTML IDs: {path}'
    for link in p.links:
        u=urlsplit(link)
        if u.scheme or u.netloc:continue
        target=(path.parent/unquote(u.path)).resolve() if u.path else path
        if target.is_dir():target=target/'index.html'
        assert target.is_relative_to(REPO) and target.is_file(), f'Broken local link {path}: {link}'
        if u.fragment and target.suffix=='.html':
            h=HTML();h.feed(target.read_text())
            assert u.fragment in h.ids, f'Broken fragment: {link}'

def main():
    watch=json.loads((ROOT/'data/watchlist.json').read_text())
    sectors={x['id'] for x in watch['sectors']}
    assert len(sectors)==len(watch['sectors'])
    current=json.loads((ROOT/'data/latest.json').read_text())
    report_check(current,sectors)
    arc=json.loads((ROOT/'data/archive.json').read_text())
    assert len({x['id'] for x in arc['issues']})==len(arc['issues'])
    for i in arc['issues']:
        assert re.fullmatch(r'data/issues/\d{4}-W\d{2}\.json',i['path'])
        r=json.loads((ROOT/i['path']).read_text())
        report_check(r,sectors)
        assert r['issue']==i['label'] and r['period']['end']==i['end']
    assert json.loads((ROOT/arc['issues'][0]['path']).read_text())==current
    for page in [ROOT/'index.html',ROOT/'latest.html',*(ROOT/'reports').glob('*.html'),*(ROOT/'research').glob('*.html')]:
        html_check(page)
    editorial=json.loads((ROOT/'data/research.json').read_text())
    assert editorial['schemaVersion']==1
    source_ids={s['id'] for s in editorial['sources']}
    assert len(source_ids)==len(editorial['sources'])
    assert len(editorial['articles'])>=10 and len(editorial['readings'])>=14
    assert {b['id'] for b in editorial['sectorBriefs']}==sectors
    article_ids=[a['id'] for a in editorial['articles']]
    assert len(article_ids)==len(set(article_ids))
    for a in editorial['articles']:
        body=a['dek']+''.join(p for section in a['sections'] for p in section['paragraphs'])
        assert len(body)==a['characterCount'] and len(body)>=1200, f'Incomplete long read: {a["id"]}'
        assert len(a['sections'])>=6 and len(a['takeaways'])>=3
        assert set(a['sectorIds'])<=sectors and set(a['sourceIds'])<=source_ids
        for section in a['sections']:
            assert set(section.get('sourceIds',[]))<=set(a['sourceIds'])
        assert a['url']=='research/'+a['id']+'.html' and (ROOT/a['url']).is_file()
    for b in editorial['sectorBriefs']:
        assert len(b['valueChain'])>=3 and len(b['indicators'])>=4 and len(b['risks'])>=3
        assert b['demand'] and b['bottleneck'] and b['capital'] and set(b['sourceIds'])<=source_ids
        assert b['url']=='research/sector-'+b['id']+'.html' and (ROOT/b['url']).is_file()
    for r in editorial['readings']:
        assert r['sourceId'] in source_ids and r['publisher'] and r['question']
    panorama=editorial['capitalPanorama']
    assert abs(sum(x['value'] for x in panorama['values'])-panorama['total'])<1e-8
    assert panorama['sourceId'] in source_ids and panorama['status']
    for page in ('index.html','personal-growth-lab/index.html','personal-growth-lab/academy/index.html'):
        assert 'industry-insights/' in (REPO/page).read_text(), f'Entry missing from {page}'
    status=json.loads((ROOT/'data/update-status.json').read_text())
    assert not status['enabled'] or status.get('automationId'), 'Enabled label without actual automation'
    subprocess.run(['node','--check',str(ROOT/'assets/insights.js')],check=True)
    subprocess.run(['node','--check',str(ROOT/'assets/insight-model.js')],check=True)
    subprocess.run(['node','--check',str(ROOT/'assets/editorial.js')],check=True)
    subprocess.run(['node',str(ROOT/'tools/test_model.cjs')],check=True)
    print(f'PASS: {len(current["entries"])} sourced events; capital bases; date windows; archives; HTML links; homepage entries; JS syntax.')
    print(f'PASS: {len(editorial["articles"])} complete long reads; {len(editorial["sectorBriefs"])} sector briefs; {len(editorial["readings"])} source guides; citations and capital chart.')

if __name__=='__main__':
    main()
