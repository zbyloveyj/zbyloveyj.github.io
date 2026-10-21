#!/usr/bin/env python3
"""Reproducible collection of public, official North American PI directories.

Requires Python >=3.9 and beautifulsoup4. Run with --refresh to download again.
Directory inclusion verifies membership only, not hiring, rank or PI availability.
"""
import argparse
import concurrent.futures
import datetime
import hashlib
import json
import re
import time
import unicodedata
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent
NOW = datetime.datetime.now(datetime.timezone.utc).isoformat()
DATE = NOW[:10]
REFRESH = False
MANIFEST = []
EXCLUDED = []
FETCH_META_PATH = ROOT / 'north_america_fetch_metadata.json'
FETCH_META = json.loads(FETCH_META_PATH.read_text()) if FETCH_META_PATH.exists() else {}
SOURCE_DATES = {}

RULES = {
    '脑机接口': r'brain[- ](?:computer|machine) interface|neuroprosthe|neural interface',
    '计算神经科学': r'computational neuroscience|theoretical neuroscience|neural computation|computational model.{0,60}(?:brain|neural)',
    '计算生物学': r'computational biology|bioinformatic|computational genomic|systems biology|statistical genetic',
    'AI与生物医学': r'machine learning|artificial intelligence|deep learning|foundation model',
    'AI虚拟细胞': r'virtual cell|cell foundation model',
    '单细胞与空间组学': r'single[- ]cell|spatial transcriptom|cell atlas|spatial genomic',
    '基因组学与基因编辑': r'genomic|genetic|crispr|gene edit|dna sequenc',
    '微生物组与宿主互作': r'microbiom|microbiot|host[- ]microb',
    '蛋白质与结构生物学': r'protein structur|protein design|structural biology',
    '神经影像与脑网络': r'neuroimag|\bfmri\b|functional connectivity|brain network|brain imag|mri analysis',
    '精神疾病与认知': r'psychiatr|schizophren|depress|bipolar|anxiety|autism',
    '神经退行性疾病': r'neurodegener|alzheimer|parkinson',
    '合成生物学': r'synthetic biology',
}

def clean(s):
    return re.sub(r'\s+', ' ', s or '').strip()

def soup(key, url):
    path = ROOT / (key + '.html')
    fetched_now = False
    if REFRESH or not path.exists():
        req = urllib.request.Request(url, headers={'User-Agent': 'LabDirectoryEvidence/1.0 (public research directory review)'})
        try:
            with urllib.request.urlopen(req, timeout=35) as r:
                body = r.read()
        except urllib.error.HTTPError as exc:
            # Some Janelia laboratories provide a home page without a member page.
            # Their laboratory identity is retained; no PI name is guessed.
            if exc.code == 404 and key.startswith('janelia_lab_') and key.endswith('_members'):
                body=b'<html><head><title>Member page unavailable</title></head><body></body></html>'
            else:
                raise
        path.write_bytes(body)
        fetched_now = True
    body = path.read_bytes()
    digest=hashlib.sha256(body).hexdigest()
    old=FETCH_META.get(key,{})
    if fetched_now:
        fetched_at=datetime.datetime.now(datetime.timezone.utc).isoformat()
        origin='http_fetch'
    elif old.get('sha256')==digest and old.get('url')==url:
        fetched_at=old['retrievedAt'];origin=old.get('timestampOrigin','preserved_fetch_metadata')
    else:
        fetched_at=datetime.datetime.fromtimestamp(path.stat().st_mtime,datetime.timezone.utc).isoformat()
        origin='original_cache_mtime'
    FETCH_META[key]=dict(url=url,retrievedAt=fetched_at,sha256=digest,timestampOrigin=origin)
    SOURCE_DATES[url]=fetched_at
    return BeautifulSoup(body, 'html.parser')

def manifest(key, url, title, institution, country, selector, count):
    path = ROOT / (key + '.html')
    MANIFEST.append(dict(sourceId=key, url=url, title=title, institution=institution,
        country=country, selector=selector, parser='collect_north_america.py',
        retrievedAt=FETCH_META[key]['retrievedAt'], timestampOrigin=FETCH_META[key]['timestampOrigin'],
        parsedAt=NOW, sha256=hashlib.sha256(path.read_bytes()).hexdigest(), extractedCount=count))

def fields(text, defaults=()):
    result = list(defaults)
    matches = {}
    for field, pattern in RULES.items():
        m = re.search(pattern, text, re.I)
        if m:
            if field not in result:
                result.append(field)
            matches[field] = m.group(0)
    return result, matches

def record(name, institution, country, city, url, source, source_title, body='', defaults=(), role=''):
    ff, ev = fields(body, defaults)
    fetched_at=SOURCE_DATES[source]
    return dict(name=clean(name), institution=institution, country=country, city=city,
        url=url.strip(), sourceUrl=source.strip(), sourceTitle=source_title, fields=ff,
        summary='；'.join(ff), role=clean(role), evidenceLevel='official_directory',
        verifiedAt=fetched_at[:10], directoryVerifiedAt=fetched_at, fieldEvidence=ev,
        evidenceScope='官网目录核验身份与机构关联；未核验岗位、经费或排名。')

def excluded(name, source, reason):
    EXCLUDED.append(dict(name=name, sourceUrl=source, reason=reason))

def stanford():
    key='stanford_neuro'; url='https://med.stanford.edu/neurogradprogram/people/faculty.html'
    s=soup(key,url); out={}
    for a in s.select('main h3 a[href]'):
        name=clean(a.get_text(' ',strip=True)); card=a.find_parent('div',class_='text')
        body=card.get_text(' ',strip=True) if card else name
        if re.search(r'emerit|deceased|in memoriam',body,re.I):
            excluded(name,url,'emeritus or memorial marker');continue
        if not name or name in out:continue
        target=urllib.parse.urljoin(url,a['href'])
        if '/intranet/' in target:
            # Keep the public official directory anchor, rather than manufacture a profile URL.
            target=url
        if '#https://' in target:target=target.split('#')[0]
        role=card.find('p').get_text(' ',strip=True) if card and card.find('p') else ''
        out[name]=record(name,'Stanford University','美国','Stanford',target,url,
            'Stanford Neurosciences PhD Program — Faculty',body,['脑科学'],role)
    manifest(key,url,'Stanford Neurosciences PhD Faculty','Stanford University','美国','main h3 a[href], nearest div.text; unique normalized name; exclude emeritus',len(out))
    return list(out.values())

def harvard():
    out=[]
    for page in range(16):
        key=f'harvard_neuro_{page}';url=f'https://pinphd.hms.harvard.edu/faculty?page={page}'
        s=soup(key,url); start=len(out)
        for c in s.select('article.page-card--hwp-person'):
            a=c.select_one('a.page-card__link'); role=c.select_one('.page-card__subheading'); body=c.select_one('.page-card__description')
            if not a:continue
            title=role.get_text(' ',strip=True) if role else ''
            name=clean(a.get_text(' ',strip=True))
            if re.search(r'emerit|deceased|in memoriam',title,re.I):
                excluded(name,url,'emeritus or memorial role');continue
            research=body.get_text(' ',strip=True) if body else ''
            out.append(record(name,'Harvard University / affiliated hospitals','美国','Boston / Cambridge',
                urllib.parse.urljoin(url,a['href']),url,'Harvard PhD Program in Neuroscience — Faculty',research,['脑科学'],title))
        manifest(key,url,f'Harvard PiN Faculty page {page+1}','Harvard University / affiliated hospitals','美国','article.page-card--hwp-person a.page-card__link; .page-card__subheading; .page-card__description',len(out)-start)
    return out

def mit():
    key='mit_faculty';url='https://bcs.mit.edu/faculty';s=soup(key,url);out=[]
    for a in s.select('a.name-link'):
        c=a.find_parent('div',class_='fcv-bottom'); body=c.get_text(' ',strip=True) if c else ''
        name=a.get_text(' ',strip=True)
        if re.search(r'emerit|deceased|in memoriam',body,re.I):
            excluded(name,url,'emeritus or memorial role');continue
        tags=['脑科学']
        if c and 'Computation' in [i.get_text(' ',strip=True) for i in c.select('.term-icon')]:tags.append('计算神经科学')
        role=c.select_one('.field--name-field-primary-job-title') if c else None
        out.append(record(name,'Massachusetts Institute of Technology','美国','Cambridge',
            urllib.parse.urljoin(url,a['href']),url,'MIT Brain and Cognitive Sciences — Faculty',body,tags,
            role.get_text(' ',strip=True) if role else ''))
    manifest(key,url,'MIT Brain and Cognitive Sciences Faculty','Massachusetts Institute of Technology','美国','a.name-link inside .fcv-bottom, research taxonomy .term-icon; exclude emeritus',len(out))
    return out

def broad():
    key='broad_members';url='https://www.broadinstitute.org/people/institute-members';s=soup(key,url);out=[]
    for c in s.select('.paragraph--type--team'):
        n=c.select_one('.field--name-field-team-name');r=c.select_one('.field--name-field-team-role')
        if not n:continue
        name=clean(n.get_text(' ',strip=True)).split(',')[0];role=clean(r.get_text(' ',strip=True)) if r else ''
        if 'Emerit' in role:
            excluded(name,url,'emeritus role');continue
        a=n.find('a',href=True);target=urllib.parse.urljoin(url,a['href']) if a else url
        research=''
        if a:
            bio_key='broad_bio_'+target.rstrip('/').split('/')[-1]
            bio=soup(bio_key,target)
            node=bio.select_one('.field--name-body')
            research=node.get_text(' ',strip=True) if node else ''
            manifest(bio_key,target,'Broad researcher biography: '+name,'Broad Institute / MIT / Harvard network','美国','.field--name-body; research keyword evidence',0)
        out.append(record(name,'Broad Institute / MIT / Harvard network','美国','Cambridge / Boston',target,url,
            'Broad Institute — Institute Members',research,['生命科学与生物医学'],role))
        if a:
            out[-1]['researchEvidenceSources']=[dict(url=target,verifiedAt=SOURCE_DATES[target],
                fields=list(out[-1]['fieldEvidence']))]
    manifest(key,url,'Broad Institute Members','Broad Institute / MIT / Harvard network','美国',
        '.paragraph--type--team .field--name-field-team-name; .field--name-field-team-role; exclude emeritus',len(out))
    return out

def mcgill():
    key='mcgill_ipn';url='https://www.apps.mni.mcgill.ca/ipn/ipnprofessors/';s=soup(key,url);out=[]
    for c in s.select('#result-stream > .row'):
        n=c.select_one('.super-title')
        if not n:continue
        raw=clean(n.get_text(' ',strip=True));parts=raw.split(', ',1)
        name=' '.join(parts[::-1]) if len(parts)==2 else raw
        body=c.get_text(' ',strip=True)
        links=c.select_one('.super-links');role=links.select_one('.title_group') if links else None
        role_text=role.get_text(' ',strip=True) if role else 'IPN supervisor directory member'
        if re.search(r'emerit|deceased|in memoriam|primary appointment at (?:UQAM|Université|Concordia)',body,re.I):
            excluded(name,url,'emeritus or explicit external primary appointment');continue
        a=next((x for x in c.select('a[href]') if x.get_text(strip=True)=='Website'),None)
        anchor=n.parent.get('id','')
        target=urllib.parse.urljoin(url,a['href']) if a else url+'#'+anchor
        research=c.select_one('.research-scroller');keywords=c.select('.keywords')
        research_text=research.get_text(' ',strip=True) if research else ''
        research_text+=' '+' '.join(k.get_text(' ',strip=True) for k in keywords)
        out.append(record(name,'McGill University / IPN network','加拿大','Montréal',target,url,
            'McGill Integrated Program in Neuroscience — Supervisor Directory',research_text,['脑科学'],role_text))
    manifest(key,url,'McGill IPN Supervisor Directory','McGill University / IPN network','加拿大',
        '#result-stream > .row with .super-title; .super-links Website; .research-scroller; .keywords; explicit emeritus/external-primary exclusions',len(out))
    return out

def janelia():
    key='janelia';url='https://www.janelia.org/people';s=soup(key,url);out=[]
    for a in s.select('span.lab-link a[href^="/lab/"]'):
        target=urllib.parse.urljoin(url,a['href']);labname=a.get_text(' ',strip=True)
        bio_key='janelia_'+a['href'].strip('/').replace('/','_')
        bio=soup(bio_key,target)
        parts=bio.select('.pane-custom-misc-custom-misc-featured-summary,.pane-node-body')
        research=' '.join(x.get_text(' ',strip=True) for x in parts)
        members=soup(bio_key+'_members',target+'/members')
        name=labname;role='Official Janelia laboratory';member_url=None
        for d in members.select('.data-container'):
            rr=d.select_one('.member-role');aa=d.select_one('.member-title a[href]')
            if rr and aa and re.search(r'group leader|research area head|executive director',rr.get_text(),re.I):
                name=aa.get_text(' ',strip=True);role=rr.get_text(' ',strip=True);member_url=urllib.parse.urljoin(url,aa['href']);break
        defaults=['脑科学'] if re.search(r'neuron|neural|brain|cortex|cortical|nervous',research,re.I) else ['细胞生物学与成像']
        r=record(name,'HHMI Janelia Research Campus','美国','Ashburn',target,url,'Janelia — Official Laboratories',research,defaults,role)
        r['labName']=labname
        if member_url:r['principalInvestigatorUrl']=member_url
        else:r['recordType']='laboratory';r['principalInvestigatorNotExtracted']=True
        out.append(r)
        manifest(bio_key,target,'Janelia laboratory: '+labname,'HHMI Janelia Research Campus','美国','.pane-custom-misc-custom-misc-featured-summary,.pane-node-body; linked member page .member-role Group Leader',0)
    manifest(key,url,'Janelia official laboratory navigation','HHMI Janelia Research Campus','美国','span.lab-link a[href^="/lab/"]; exclude project/support teams',len(out))
    return out

def other_neuro():
    out=[]
    key='princeton_pni';url='https://pni.princeton.edu/people/faculty';s=soup(key,url);start=len(out)
    for c in s.select('.content-list-item-details'):
        a=c.select_one('.field--name-title a[href]');role=c.select_one('.field--name-field-ps-people-position')
        if not a:continue
        rr=role.get_text(' ',strip=True) if role else ''
        if re.search(r'emerit',rr,re.I):continue
        if not re.search(r'professor',rr,re.I):continue
        out.append(record(a.get_text(' ',strip=True),'Princeton University','美国','Princeton',urllib.parse.urljoin(url,a['href']),url,
            'Princeton Neuroscience Institute — Faculty',c.get_text(' ',strip=True),['脑科学'],rr))
    manifest(key,url,'Princeton Neuroscience Institute Faculty','Princeton University','美国','.content-list-item-details; title link; professor role excluding emeritus',len(out)-start)
    key='columbia_zuckerman';url='https://zuckermaninstitute.columbia.edu/our-people';s=soup(key,url);start=len(out)
    h=next(h for h in s.find_all('h2') if h.get_text(strip=True)=='Principal Investigators')
    box=h.find_next_sibling('div',class_='bios-inner')
    for a in box.select('.card-content h5 a[href]'):
        name=re.sub(r',?\s*(?:PhD|MD|Ph\.D\.|M\.D\.)\b.*$','',a.get_text(' ',strip=True)).strip(', ')
        out.append(record(name,'Columbia University / Zuckerman Institute','美国','New York',urllib.parse.urljoin(url,a['href']),url,
            'Columbia Zuckerman Institute — Principal Investigators','',['脑科学'],'Principal Investigator'))
    manifest(key,url,'Columbia Zuckerman Principal Investigators','Columbia University','美国','h2 Principal Investigators next div.bios-inner .card-content h5 a; excludes Emeritus/platform/staff sections',len(out)-start)
    key='cmu_ni';url='https://www.cmu.edu/ni/people/faculty-directory';s=soup(key,url);start=len(out)
    for c in s.select('.BioCard__details'):
        a=c.select_one('.BioCard__name a[href]');role=c.select_one('.BioCard__title')
        if not a:continue
        rr=role.get_text(' ',strip=True) if role else ''
        if re.search(r'emerit|teaching|distinguished service',rr,re.I):continue
        if not re.search(r'professor',rr,re.I):continue
        out.append(record(a.get_text(' ',strip=True),'Carnegie Mellon University','美国','Pittsburgh',urllib.parse.urljoin(url,a['href']),url,
            'CMU Neuroscience Institute — Faculty',rr,['脑科学'],rr))
    manifest(key,url,'CMU Neuroscience Institute Faculty','Carnegie Mellon University','美国','.BioCard__details .BioCard__name a; professor excluding teaching/service/emeritus',len(out)-start)
    key='yale_neuro';url='https://medicine.yale.edu/neuroscience/people/';s=soup(key,url);start=len(out)
    for c in s.select('.profile-grid-item__content-container'):
        a=c.select_one('.profile-grid-item__name-container a[href]');role=c.select_one('.profile-grid-item__title')
        if not a:continue
        rr=role.get_text(' ',strip=True) if role else ''
        if re.search(r'emerit|lecturer|adjunct',rr,re.I):continue
        if not re.search(r'professor',rr,re.I):continue
        name=re.sub(r',.*$','',a.get_text(' ',strip=True)).strip()
        out.append(record(name,'Yale University','美国','New Haven',urllib.parse.urljoin(url,a['href']),url,
            'Yale Neuroscience — Faculty',rr,['脑科学'],rr))
    manifest(key,url,'Yale Neuroscience Faculty','Yale University','美国','.profile-grid-item__content-container name link and title; professor excluding emeritus/lecturer/adjunct',len(out)-start)
    return out

def arc():
    key='arc_team';url='https://arcinstitute.org/team';s=soup(key,url);out=[]
    data=json.loads(s.select_one('script#__NEXT_DATA__').get_text())['props']['pageProps']['data']
    for module in data['modules']:
        for tab in module.get('tabs',[]):
            if tab.get('title')!='Arc Investigators':continue
            for group in tab.get('subGroups',[]):
                for person in group.get('people',[]):
                    pi=person['staffMember'];target=person.get('labWebsiteUrl');role='; '.join(x['title'] for x in pi['jobTitle'])
                    if not target:continue
                    r=record(pi['fullName'],'Arc Institute / partner universities','美国','San Francisco Bay Area',urllib.parse.urljoin(url,target),url,
                        'Arc Institute — Arc Investigators',pi.get('description',''),['基因组学与生物医学'],role)
                    out.append(r)
    manifest(key,url,'Arc Institute Investigators','Arc Institute / partner universities','美国','__NEXT_DATA__.props.pageProps.data.modules[].tabs[title=Arc Investigators].subGroups[].people[]; labWebsiteUrl required; excludes operations/advisory boards',len(out))
    return out

def uw():
    key='uw_genome_faculty';url='https://www.gs.washington.edu/about/directory/faculty/';s=soup(key,url);out=[]
    for sec in s.select('section.profile-group'):
        if sec.get('id') not in ['profile-group-faculty','profile-group-other-training-faculty','profile-group-research-faculty']:continue
        for c in sec.select('.profile-card'):
            a=c.select_one('.profile-card__name-link');research=c.select_one('.profile-card__focus')
            if not a:continue
            r=record(a.get_text(' ',strip=True),'University of Washington','美国','Seattle',a['href'],url,
                'UW Genome Sciences — Faculty',research.get_text(' ',strip=True) if research else '',['基因组学与生物医学'],sec.find('h2').get_text(' ',strip=True))
            lab=next((a for a in c.select('.profile-card__links a[href]') if a.get_text(strip=True)=='lab website'),None)
            if lab:r['labUrl']=lab['href']
            out.append(r)
    manifest(key,url,'UW Genome Sciences Faculty','University of Washington','美国','section.profile-group Faculty/Other Training Faculty/Research Faculty; .profile-card__name-link; .profile-card__focus; excludes teaching/senior sections',len(out))
    return out

def nygc():
    key='nygc_faculty';url='https://www.nygenome.org/about-us/our-people/faculty-scientists/';s=soup(key,url);out=[]
    for c in s.select('main li._card'):
        name=c.find('h4');a=c.select_one('a.cover_link[href]');title=c.select_one('._featured_title')
        if not name or not a or not title:continue
        rr=title.get_text(' ',strip=True)
        if not re.search(r'Faculty',rr,re.I):continue
        nn=re.sub(r',.*$','',name.get_text(' ',strip=True)).strip()
        r=record(nn,'New York Genome Center / affiliated universities','美国','New York',a['href'],url,
            'New York Genome Center — Faculty & Scientists',c.get_text(' ',strip=True),['基因组学与生物医学'],rr)
        lab=next((a for a in c.select('a.tag[href]') if '/faculty-labs/' in a['href']),None)
        if lab:r['labUrl']=lab['href']
        out.append(r)
    manifest(key,url,'NYGC Faculty and Scientists','New York Genome Center / affiliated universities','美国','main li._card with featured title Faculty; h4 and a.cover_link; excludes scientists without faculty role',len(out))
    return out

def compbio():
    out=[]
    key='msk_compbio';url='https://www.mskcc.org/research/ski/programs/computational-biology';s=soup(key,url)
    for c in s.select('.msk-markup-research-people-list-laboratory li'):
        a=c.find('a',href=True)
        if not a:continue
        name=re.sub(r',.*$','',a.get_text(' ',strip=True)).strip()
        out.append(record(name,'Memorial Sloan Kettering Cancer Center','美国','New York',urllib.parse.urljoin(url,a['href']),url,
            'MSK Computational & Systems Biology — Our Faculty',c.get_text(' ',strip=True),['计算生物学'],'Computational & Systems Biology faculty'))
    manifest(key,url,'MSK Computational and Systems Biology Faculty','Memorial Sloan Kettering Cancer Center','美国','.msk-markup-research-people-list-laboratory li; first a[href]',len(out))
    for key,part in [('cmu_cbd_voting','voting-faculty.html'),('cmu_cbd_affiliated','affiliated-faculty.html')]:
        url='https://www.cmu.edu/cbd/people/'+part;s=soup(key,url);start=len(out)
        for a in s.select('#content a[href]'):
            if a.get_text(strip=True)!='View Profile':continue
            c=a.find_parent('div')
            if not c:continue
            h=c.find(['h2','h3','h4']) if 'voting' in part else c.find('strong')
            if not h:continue
            name=h.get_text(' ',strip=True);body=c.get_text(' ',strip=True)
            if re.search(r'teaching|emerit',body,re.I):continue
            role=c.find('strong') if 'voting' in part else (c.find_all('strong')[1] if len(c.find_all('strong'))>1 else None)
            out.append(record(name,'Carnegie Mellon University','美国','Pittsburgh',urllib.parse.urljoin(url,a['href']),url,
                'CMU Computational Biology — '+('Voting Faculty' if 'voting' in part else 'Affiliated Faculty'),body,['计算生物学'],
                role.get_text(' ',strip=True) if role else 'Affiliated Faculty'))
        manifest(key,url,'CMU Computational Biology Faculty','Carnegie Mellon University','美国','#content View Profile links; nearest card containing h2/h3/h4; exclude teaching/emeritus',len(out)-start)
    key='cornell_compbio';url='https://compbio.triiprograms.org/faculty-research/faculty-directory/';s=soup(key,url);start=len(out)
    for row in s.select('table.faculty tr'):
        td=row.find_all('td')
        if len(td)<7:continue
        raw=clean(td[1].get_text(' ',strip=True)).split('[')[0].strip()
        parts=raw.split(', ',1);name=' '.join(parts[::-1]) if len(parts)==2 else raw
        role=td[3].get_text(' ',strip=True)
        if re.search(r'emerit',role,re.I):continue
        institution=td[2].get_text(' ',strip=True)
        a=next((a for a in td[1].select('a[href]') if a.get_text(strip=True)=='site'),None)
        anchor=td[1].find('a',id=True)
        target=urllib.parse.urljoin(url,a['href']) if a else url+('#'+anchor['id'] if anchor else '')
        city='Ithaca' if institution=='Cornell University' else 'New York'
        out.append(record(name,institution,'美国',city,target,url,'Tri-Institutional Computational Biology & Medicine — Faculty Directory',
            td[5].get_text(' ',strip=True)+' '+td[6].get_text(' ',strip=True),['计算生物学'],role))
    manifest(key,url,'Tri-Institutional Computational Biology and Medicine Faculty','Cornell / Weill Cornell / MSK / Rockefeller','美国','table.faculty tr with seven td; name, institution, title, area-of-study and research cells; linked site',len(out)-start)
    manual_path=ROOT/'north_america_priority_additions.json'
    if manual_path.exists():
        additions=json.loads(manual_path.read_text())
        out.extend(additions)
        for r in additions:
            MANIFEST.append(dict(sourceId='manual_'+normalized_name(r['name']),url=r['sourceUrl'],
                title=r['sourceTitle'],institution=r['institution'],country=r['country'],
                selector='Official profile manually reviewed; immutable reviewed facts in north_america_priority_additions.json',
                parser='north_america_manual_review.py',retrievedAt=r['directoryVerifiedAt'],parsedAt=NOW,
                extractedCount=1,verificationMethod=r['reviewMethod']))
    return out

def enrich_research(rows):
    path=ROOT/'north_america_research_evidence.json'
    if not path.exists():return
    for p in json.loads(path.read_text()):
        match=[r for r in rows if normalized_name(r['name'])==normalized_name(p['name']) and r['institution']==p['institution']]
        if len(match)!=1:
            raise ValueError('Research evidence must match exactly one verified identity: '+p['name'])
        r=match[0]
        r['fields']=list(dict.fromkeys(r['fields']+p['fields']))
        r['summary']=p['summary']
        r.setdefault('researchEvidenceSources',[]).append(dict(url=p['sourceUrl'],fields=p['fields'],
            sourceExcerpt=p['sourceExcerpt'],verifiedAt=p['reviewedAt'],reviewMethod=p['reviewMethod']))
        MANIFEST.append(dict(sourceId='research_'+normalized_name(p['name']),url=p['sourceUrl'],
            title=p['sourceTitle'],institution=p['institution'],country=r['country'],
            selector='Manually reviewed official research description; immutable facts in north_america_research_evidence.json',
            parser='north_america_manual_review.py',retrievedAt=p['reviewedAt'],parsedAt=NOW,
            extractedCount=0,verificationMethod=p['reviewMethod']))

def stanford_genetics():
    out=[]
    sources=[('stanford_genetics_1','https://med.stanford.edu/genetics/people/Faculty1/Faculty1.html'),
        ('stanford_genetics_2','https://med.stanford.edu/genetics/people/Faculty1/genetics-faculty-f---l.html'),
        ('stanford_genetics_3','https://med.stanford.edu/genetics/people/Faculty1/genetics-faculty-m-z.html')]
    for key,url in sources:
        s=soup(key,url);start=len(out)
        for c in s.select('.profile-person-info'):
            a=c.select_one('.profile-name a[href]');title=c.select_one('.profile-title')
            if not a:continue
            role=title.get_text(' ',strip=True) if title else ''
            if re.search(r'emerit|lecturer',role,re.I):continue
            name=a.get_text(' ',strip=True)
            # Expanded CAP bio lies in the same profile item and supplies research keywords.
            parent=c.parent
            research=parent.get_text(' ',strip=True)
            out.append(record(name,'Stanford University','美国','Stanford',a['href'],url,
                'Stanford Department of Genetics — Faculty',research,['基因组学与生物医学'],role))
        manifest(key,url,'Stanford Genetics Faculty','Stanford University','美国','.profile-person-info .profile-name a; .profile-title; parent profile research biography',len(out)-start)
    return out

IDENTITY_PROOFS = {
    'paolaarlotta':'https://www.broadinstitute.org/bios/paola-arlotta',
    'gordonfishell':'https://www.broadinstitute.org/bios/gord-fishell',
    'annagreka':'https://www.broadinstitute.org/bios/anna-greka',
    'evanmacosko':'https://www.broadinstitute.org/bios/evan-macosko',
    'stevenamccarroll':'https://www.broadinstitute.org/bios/steve-mccarroll',
    'bethstevens':'https://www.broadinstitute.org/bios/beth-stevens',
    'guopingfeng':'https://www.broadinstitute.org/bios/guoping-feng',
    'morganhwatzesheng':'https://www.broadinstitute.org/bios/morgan-sheng',
    'fengzhang':'https://www.broadinstitute.org/bios/feng-zhang',
    'emerynealbrown':'https://pinphd.hms.harvard.edu/people/emery-neal-brown',
    'christophthaiss':'https://arcinstitute.org/team',
    'xianjundong':'https://medicine.yale.edu/neuroscience/profile/xianjun-dong/',
    'maryclaireking':'https://www.nygenome.org/about-us/our-people/faculty-scientists/',
    'chenxuzhu':'https://www.nygenome.org/about-us/our-people/faculty-scientists/',
    'tommaniatis':'https://www.nygenome.org/about-us/our-people/faculty-scientists/',
}

def normalized_name(name):
    aliases={'Emery N Brown':'Emery Neal Brown','Gord Fishell':'Gordon Fishell',
        'Steve McCarroll':'Steven A. McCarroll','Morgan Sheng':'Morgan Hwa-Tze Sheng'}
    name=aliases.get(name,name)
    n=unicodedata.normalize('NFKD',name).encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z0-9]','',n)

def main():
    global REFRESH
    p=argparse.ArgumentParser();p.add_argument('--refresh',action='store_true');args=p.parse_args();REFRESH=args.refresh
    rows=stanford()+harvard()+mit()+broad()+mcgill()+janelia()+other_neuro()+arc()+uw()+nygc()+compbio()+stanford_genetics()
    unique={}
    for r in rows:
        nk=normalized_name(r['name'])
        # Exact names alone are not an identity: e.g. Stanford and McGill have
        # different researchers both named Jun Ding. Cross-institution mergers
        # require an explicitly reviewed official dual-affiliation proof.
        institution=r['institution'].replace('Memorial Sloan Kettering Cancer Center','Memorial Sloan Kettering')
        k=nk if nk in IDENTITY_PROOFS else nk+'|'+institution
        if k in unique:
            existing=unique[k]
            if nk=='xianjundong' and r['institution']=='Yale University':
                existing,r=r,existing
                unique[k]=existing
                existing['affiliationNote']='Yale官网明确其为现任Yale副教授；Harvard记录为此前任职目录。'
            existing.setdefault('additionalOfficialSources',[]).append(dict(url=r['url'],sourceUrl=r['sourceUrl'],
                institution=r['institution'],directoryVerifiedAt=r['directoryVerifiedAt'],fields=r['fields']))
            existing['fields']=list(dict.fromkeys(existing['fields']+r['fields']))
            existing.setdefault('fieldEvidence',{}).update(r.get('fieldEvidence',{}))
            existing.setdefault('researchEvidenceSources',[]).extend(r.get('researchEvidenceSources',[]))
            existing['summary']='；'.join(existing['fields'])
            if nk in IDENTITY_PROOFS:existing['identityMergeEvidence']=IDENTITY_PROOFS[nk]
        else:unique[k]=r
    rows=list(unique.values())
    enrich_research(rows)
    (ROOT/'north_america.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
    (ROOT/'north_america_sources.json').write_text(json.dumps(dict(collectedAt=NOW,sources=MANIFEST,exclusions=EXCLUDED),ensure_ascii=False,indent=2)+'\n')
    FETCH_META_PATH.write_text(json.dumps(FETCH_META,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(dict(rawRecords=sum(s['extractedCount'] for s in MANIFEST),uniqueRecords=len(rows),sources=len(MANIFEST),excluded=len(EXCLUDED)),ensure_ascii=False))

if __name__=='__main__':main()
