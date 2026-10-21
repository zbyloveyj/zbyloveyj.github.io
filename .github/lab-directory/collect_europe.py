#!/usr/bin/env python3
"""Reproduce official-directory laboratory records; no bibliometric/rank claims.

Run with the primary Python runtime (lxml installed). --refresh refetches public
source pages. Names and profile URLs come from documented DOM selectors, and
field tags use only explicit local text or the specialist directory's scope.
"""
import argparse, concurrent.futures, datetime, json, pathlib, re, urllib.request, unicodedata
from urllib.parse import urljoin, urlsplit
from lxml import html

ROOT=pathlib.Path(__file__).resolve().parent
CACHE=ROOT/'europe-cache'
CACHE.mkdir(exist_ok=True)
TODAY=datetime.date.today().isoformat()
SOURCES=[]

def source(key,url,institution,country,parser,scope=None,city=''):
    d=dict(key=key,url=url,institution=institution,country=country,parser=parser,
           scope=scope or [],city=city)
    SOURCES.append(d)
    return d

for i in range(5):
    source('crick'+str(i),'https://www.crick.ac.uk/research/a-z-research-labs'+(f'?page={i}' if i else ''),
           'Francis Crick Institute','英国','crick',city='London')
source('sanger','https://www.sanger.ac.uk/people/faculty/','Wellcome Sanger Institute','英国','sanger',['基因组学'], 'Hinxton')
source('ki','https://ki.se/en/neuro/research/group-and-team-leaders-at-neuro-a-o','Karolinska Institutet · Department of Neuroscience','瑞典','ki',['脑科学'],'Stockholm')
source('champ','https://fchampalimaud.org/champalimaud-research','Champalimaud Foundation','葡萄牙','champ',city='Lisbon')
source('ista','https://www.ista.ac.at/en/research/','Institute of Science and Technology Austria (ISTA)','奥地利','ista',city='Klosterneuburg')
source('bric','https://www.bric.ku.dk/research-groups/','University of Copenhagen · BRIC','丹麦','bric',city='Copenhagen')
source('epfl','https://www.epfl.ch/schools/sv/bmi/brain-mind-institute/bmi-research/','EPFL · Brain Mind Institute','瑞士','epfl',['脑科学'],'Lausanne')
source('epfl-herzog-team','https://www.epfl.ch/labs/lpsy/team/','EPFL · Laboratory of Psychophysics','瑞士','verification',['脑科学'],'Lausanne')
source('vibai','https://vib.ai/en/vibai-labs','VIB.AI · Center for AI & Computational Biology','比利时','vibai',['计算生物学','AI for Biology'])
source('vibneuro','https://vibneuroscienceleuven.be/en/research/labs','VIB–KU Leuven · Center for Neuroscience','比利时','vibneuro',['脑科学'],'Leuven')
source('vibmolneuro','https://cmn.sites.vib.be/en/labs','VIB–UAntwerp · Center for Molecular Neurology','比利时','vibmolneuro',['脑科学'],'Antwerp')
source('fimm','https://www.helsinki.fi/en/hilife-helsinki-institute-life-science/units/fimm/research-fimm/fimm-research-groups','University of Helsinki · FIMM','芬兰','helsinki',city='Helsinki')
source('helsinkineuro','https://www.helsinki.fi/en/hilife-helsinki-institute-life-science/units/neuroscience-center/research-groups','University of Helsinki · Neuroscience Center','芬兰','helsinki',['脑科学'],'Helsinki')
source('mpbi','https://www.bi.mpg.de/labs','Max Planck Institute for Biological Intelligence','德国','mpbi',city='Martinsried / Seewiesen')
for i in range(3):
    source('paris'+str(i),'https://parisbraininstitute.org/paris-brain-institute-research-teams'+(f'?page={i}' if i else ''),'Paris Brain Institute','法国','paris',['脑科学'],'Paris')
source('nin-groups','https://nin.nl/research-groups/','Netherlands Institute for Neuroscience (KNAW)','荷兰','nin',['脑科学'],'Amsterdam')
source('ntnu','https://www.ntnu.edu/kavli/research','NTNU · Kavli Institute for Systems Neuroscience','挪威','ntnu',['脑科学'],'Trondheim')
for i in range(1,6):
    s=source('sib'+str(i),'https://www.sib.swiss/groups','SIB Swiss Institute of Bioinformatics · affiliated research group','瑞士','sib',['计算生物学'])
    s['page']=i
    s['dataEndpoint']='https://www.sib.swiss/index-search-ajax/paginate/groups'
source('ht','https://humantechnopole.it/en/ht-people/','Human Technopole','意大利','ht',city='Milan')
for key,slug,scope in [('crgsystems','systems-synthetic-biology',['系统生物学']),('crgcomp','computational-biology-health-genomics',['计算生物学','基因组学']),('crggen','genome-biology',['基因组学']),('crgcell','quantitative-cell-biology',['分子与细胞生物学'])]:
    source(key,'https://www.crg.eu/en/programme/programmes-groups/'+slug,'Centre for Genomic Regulation (CRG)','西班牙','crg',scope,'Barcelona')
source('mpkyb','https://www.kyb.tuebingen.mpg.de/faculty','Max Planck Institute for Biological Cybernetics','德国','mpkyb',['脑科学'],'Tübingen')
source('mpkybleaders','https://www.kyb.tuebingen.mpg.de/275821/researchgroupleader','Max Planck Institute for Biological Cybernetics','德国','mpkyb',['脑科学'],'Tübingen')
for site,country,city in [('barcelona','西班牙','Barcelona'),('grenoble','法国','Grenoble'),('hamburg','德国','Hamburg'),('heidelberg','德国','Heidelberg'),('ebi','英国','Hinxton'),('rome','意大利','Rome')]:
    source('embl-'+site,'https://www.embl.org/research/faculty/'+site+'/', 'EMBL'+('–EBI' if site=='ebi' else ' · '+city),country,'embl',['计算生物学'] if site=='ebi' else ['分子与细胞生物学'],city)

RULES=[
 ('脑科学',r'neuro|brain|synap|cogniti|circuit|memory|behavio|alzheimer|parkinson'),
 ('计算神经科学',r'computational neuroscience|neurotheory|theoretical neuroscience|neural dynamics|circuit dynamics'),
 ('脑机接口与神经工程',r'neuroengineering|neuroprosthe|brain.?computer|neurotechnolog'),
 ('AI for Biology',r'machine learning|artificial intelligence|deep learning|neuro.?ai|\bAI\b'),
 ('计算生物学',r'computational|bioinformatic|data science|theoretical biology|mathematical biology|quantitative biology'),
 ('单细胞与空间组学',r'single.cell|spatial biology|spatial genom|spatial transcript'),
 ('基因组学',r'genom|genetic|chromatin|epigen|gene regulation|transcript'),
 ('微生物组与感染',r'microbi|pathogen|infection|virus|viral|bacter|fung|yeast'),
 ('免疫与代谢',r'immun|metaboli|inflamm'),
 ('系统生物学',r'systems biology|cellular adaptive|organism|tissue|developmental|regenerati'),
 ('蛋白质与结构生物学',r'protein|proteom|structural|macromolecular|molecular machine'),
 ('脑影像与医学影像',r'imaging|neuroimaging|magnetic resonance|mri|microscopy'),
 ('肿瘤生物学',r'cancer|tumou?r|oncolog'),
 ('进化与生态',r'evolution|ecology|ecological'),
]

def txt(e):return ' '.join(e.text_content().split()) if e is not None else ''
def first(e,xp):
    z=e.xpath(xp);return z[0] if z else None
def fetch(s,force=False):
    p=CACHE/(s['key']+'.html')
    if p.exists() and not force:return
    try:
        if s['parser']=='sib':
            settings=dict(index='groups',label='Groups',langcode='en',results_per_page=20,results_view='result',pagination_auto=True,has_initial_content=False,no_result_initial_content=False)
            body=dict(query='',fields=dict(fields_of_activity=[],fields_of_application=[],city=[]),settings=settings,page=s['page'])
            endpoint='https://www.sib.swiss/index-search-ajax/paginate/groups'
            s['dataEndpoint']=endpoint
            req=urllib.request.Request(endpoint,data=json.dumps(body).encode(),headers={'Content-Type':'application/json','User-Agent':'Mozilla/5.0'})
            with urllib.request.urlopen(req,timeout=40) as r:d=json.load(r)
            p.write_text(d['results'],encoding='utf-8');return
        req=urllib.request.Request(s['url'],headers={'User-Agent':'Mozilla/5.0 (research directory verification)'})
        with urllib.request.urlopen(req,timeout=40) as r:
            p.write_bytes(r.read());s['resolvedUrl']=r.url
    except Exception as e:s['error']=str(e)

def record(s,name,url,summary='',fields=None):
    if not name or not url:return None
    name=re.sub(r'^(?:Professor |Prof\. |Dr |Dr\. )+','',name.strip())
    name=re.sub(r'\s*\(affiliated\)\s*','',name,flags=re.I)
    tags=list(s['scope'])
    for tag,pattern in RULES:
        if re.search(pattern,summary,re.I) and tag not in tags:tags.append(tag)
    for tag in fields or []:
        if tag not in tags:tags.append(tag)
    if not tags:tags=['分子与细胞生物学']
    # Lab names are compact factual descriptions, not copied long-form prose.
    return dict(name=name,institution=s['institution'],country=s['country'],city=s['city'],
                url=urljoin(s['url'],url),sourceUrl=s['url'],sourceTitle=s.get('title',s['institution']+' official research directory'),
                fields=tags,summary=summary,evidenceLevel='official_directory',verifiedAt=s.get('collectedAt',TODAY))

def parse(s):
    p=CACHE/(s['key']+'.html')
    if not p.exists():return []
    s['collectedAt']=datetime.datetime.fromtimestamp(p.stat().st_mtime,datetime.timezone.utc).date().isoformat()
    root=html.fromstring(p.read_bytes().decode('utf-8','replace'))
    s['title']=txt(first(root,'//title'));out=[];kind=s['parser']
    def add(*args,**kwargs):
        x=record(s,*args,**kwargs)
        if x:out.append(x)
    if kind=='crick':
        s['selector']='a[href*="/research/labs/"] with h3; name=h3; summary=p'
        for a in root.xpath('//a[contains(@href,"/research/labs/")][.//h3]'):
            desc=' '.join(txt(p) for p in a.xpath('.//p') if txt(p))
            if 'emeritus' not in desc.lower():add(txt(first(a,'.//h3')),a.get('href'),desc)
    elif kind=='sanger':
        s['selector']='a[href^="/person/"] with p.title, current faculty section only; stop before former faculty'
        for a in root.xpath('//a[starts-with(@href,"/person/")][.//p[@class="title"]]'):
            if 'Former' in txt(a):break
            name=txt(first(a,'.//p[@class="title"]'))
            add(name,a.get('href'),'基因组研究；列入 Sanger 当前 Faculty 名录。')
    elif kind=='ki':
        s['selector']='alphabetical group/PI tables: td[1] name, td[2] group URL, td[3] research area'
        for table in root.xpath('//table'):
            for tr in table.xpath('.//tr[td]'):
                td=tr.xpath('./td')
                if len(td)<3:continue
                a=first(td[1],'.//a')
                if a is None:a=first(td[0],'.//a')
                if a is not None:add(txt(td[0]),a.get('href'),txt(td[1])+' · '+txt(td[2]))
    elif kind=='champ':
        s['selector']='a[href*="/research/groups/"]; card text consists of research theme and surname Lab'
        for a in root.xpath('//a[contains(@href,"/research/groups/")]'):
            t=txt(a)
            if not t:continue
            # The official group label is retained where a full PI name is absent.
            name=txt(first(a,'.//p[@class="subtitle"]')) or t
            desc=txt(first(a,'.//p[@class="title"]')) or t
            add(name,a.get('href'),desc)
    elif kind=='ista':
        s['selector']='div.profile containing p.pname and p.pspecialization; keep life-science fields only'
        for box in root.xpath('//div[contains(concat(" ",normalize-space(@class)," ")," profile ")]'):
            n=txt(first(box,'.//p[@class="pname"]'));d=txt(first(box,'.//p[@class="pspecialization"]'))
            scopes=[txt(x) for x in box.xpath('.//span[@class="field_designator"]')]
            if not any(x in ['Cell Biology','Evolution & Ecology','Neuroscience'] for x in scopes):continue
            a=first(box,'.//div[contains(@class,"name_prof")]//a')
            if a is not None:add(n,a.get('href'),d)
    elif kind=='bric':
        s['selector']='div.rightbox-normal research group cards with h2 and linked image, excludes emeritus/affiliated collections'
        for box in root.xpath('//div[contains(@class,"rightbox-normal")]'):
            t=txt(first(box,'.//h2'));a=first(box,'.//a[@href]')
            if not re.search(r'\bgroup$',t,re.I):continue
            if a is not None:add(t,a.get('href'),' · '.join(txt(p) for p in box.xpath('.//p') if txt(p)))
    elif kind=='epfl':
        s['selector']='div.card > .card-body; h3 lab URL; PI parsed from directed/led/headed by Prof. in card paragraph'
        for box in root.xpath('//div[@class="card"]'):
            a=first(box,'.//h3/a');desc=' '.join(txt(p) for p in box.xpath('.//p'))
            if a is None or '/labs/' not in a.get('href',''):continue
            m=re.search(r'(?:directed|led|headed) by (?:(?:Prof\.?|Dr\.?|Professor)\s*)*([^,;.]+)',desc,re.I)
            n=m.group(1).strip() if m else txt(a)
            corrected=False
            # BMI misspells this PI's given name; use the lab's own team page.
            proof=CACHE/'epfl-herzog-team.html'
            if n=='Micheal Herzog' and proof.exists():
                team=html.fromstring(proof.read_bytes().decode('utf-8','replace'))
                head=first(team,'//a[contains(@href,"/labs/lpsy/team/herzog") and normalize-space(.)="Michael Herzog"]')
                if head is not None:n=txt(head);corrected=True
            add(n,a.get('href'),txt(a))
            if corrected:out[-1]['additionalSources']=['https://www.epfl.ch/labs/lpsy/team/']
    elif kind in ['vibneuro','vibmolneuro','vibai']:
        s['selector']='div.paragraph--type--image-column cards; title/image-alt gives PI, read-more gives official lab URL; foreign visiting PIs excluded'
        for box in root.xpath('//div[contains(@class,"paragraph--type--image-column") and not(contains(@class,"image-columns"))]'):
            a=first(box,'.//a[@href]');h=first(box,'.//h3');im=first(box,'.//img')
            if a is None or h is None:continue
            u=a.get('href');t=txt(h);host=urlsplit(u).netloc.lower()
            if not ('sites.vib.be' in host or host in ['holstegelab.eu','www.switchlab.org']):continue
            if 'open position' in t.lower():continue
            alt=im.get('alt','') if im is not None else ''
            alt=re.split(r',\s*Group|\s+group leader',alt,flags=re.I)[0]
            if 2<=len(alt.split())<=6 and 'lab' not in alt.lower() and '&amp;' not in alt:name=alt
            else:name=t
            # Only compact lab descriptors are quoted; longer research paragraphs inform tags.
            desc=txt(a) if kind=='vibai' else t
            add(name,u,desc)
            foot=txt(first(box,'.//div[contains(@class,"field--name-field-footnote")]'))
            if foot and kind=='vibai':
                out[-1]['institution']=foot+' · VIB.AI affiliated group'
            context=txt(box)
            for tag,pattern in RULES:
                if re.search(pattern,context,re.I) and tag not in out[-1]['fields']:out[-1]['fields'].append(tag)
    elif kind=='helsinki':
        s['selector']='ds-card[ds-heading][ds-url], using exposed official web-component attributes'
        for box in root.xpath('//ds-card[@ds-heading][@ds-url]'):
            name=box.get('ds-heading','').strip();desc=box.get('ds-description','').strip()
            if not desc:continue
            add(name,box.get('ds-url'),desc)
    elif kind=='mpbi':
        s['selector']='a.slide with div.desc > h2 PI and em research theme; emeritus flag preserved'
        for a in root.xpath('//a[contains(@class,"slide")][.//div[@class="desc"]/h2]'):
            name=txt(first(a,'.//h2'));theme=txt(first(a,'.//em'))
            if not theme:continue
            add(name,a.get('href'),theme)
            if 'Emeritus Group' in txt(a):out[-1]['roleStatus']='emeritus'
    elif kind=='paris':
        s['selector']='div.card-team: ul.card-team-leaders gives named co-PIs; h4 research theme; team link retained once'
        for box in root.xpath('//div[@class="card-team"]'):
            names=[txt(a) for a in box.xpath('.//ul[@class="card-team-leaders"]//a')]
            a=first(box,'.//a[contains(@href,"/paris-brain-institute-research-teams/")]')
            if a is not None and names:add(' / '.join(names),a.get('href'),txt(first(box,'.//h4')))
    elif kind=='nin':
        s['selector']='article.group-card h3, span.altname, and overlay-link; every named research group once'
        for box in root.xpath('//article[contains(@class,"group-card")]'):
            a=first(box,'.//a[contains(@class,"overlay-link")]')
            if a is not None:add(txt(first(box,'.//h3')),a.get('href'),txt(first(box,'.//span[@class="altname"]')))
    elif kind=='ntnu':
        s['selector']='research group cards with img and Group text; image alt supplies full PI when available; support group excluded'
        for a in root.xpath('//a[.//img]'):
            t=txt(a)
            if 'Group' not in t or 'Support Group' in t:continue
            im=first(a,'.//img');alt=im.get('alt','') if im is not None else ''
            name=re.split(r'\. Photo|Photo|\.',alt)[0].strip() or t.rstrip(':')
            add(name,a.get('href'),txt(a.getparent()).replace(t,'').strip())
    elif kind=='sib':
        s['title']='Our groups | SIB Swiss Institute of Bioinformatics'
        s['selector']='div.group-search-result (exact class token), .leader name/institution/city and h5 group; pure core service groups excluded'
        for box in root.xpath('//div[contains(concat(" ",normalize-space(@class)," ")," group-search-result ")]'):
            leaders=[txt(x).split(', ') for x in box.xpath('.//div[@class="leader"]')]
            if not leaders:continue
            themes=[txt(x) for x in box.xpath('.//div[contains(@class,"field--name-name")]')]
            if themes and all(x=='Core facilities / services' for x in themes):continue
            title=txt(first(box,'.//h5'));a=first(box,'.//a[@href]')
            if a is None:continue
            add(' / '.join(x[0] for x in leaders),a.get('href'),title+' · '+' / '.join(themes))
            old=out[-1]
            old['institution']=' / '.join(dict.fromkeys(', '.join(x[1:-1]) if len(x)>2 else 'SIB affiliated research group' for x in leaders))+' · SIB'
            old['city']=' / '.join(dict.fromkeys(x[-1] for x in leaders if len(x)>1))
    elif kind=='ht':
        s['selector']='li.ht-people-list-people-data with research-group membership class and Research Group Leader or scientific Research Centre Head/Director role; centre names from matching ht-rc radio-input labels; excludes administrative/platform staff'
        centres={}
        for opt in root.xpath('//input[starts-with(@data-id,"ht-rc-")]'):
            label=root.xpath('//label[@for=$id]',id=opt.get('id'))
            if label:centres[opt.get('data-id')]=txt(label[0])
        for box in root.xpath('//li[contains(@class,"ht-people-list-people-data")]'):
            if not re.search(r'ht-rg-\d',box.get('class','')):continue
            role=txt(first(box,'.//i'))
            if not re.search(r'Research Group Leader|Head of .*(?:Research Cent|Health Data Science Cent)|^Director$',role):continue
            a=first(box,'.//a[contains(@class,"people-text-name")]')
            if a is None:continue
            areas=list(dict.fromkeys(centres[c] for c in box.get('class','').split() if c in centres))
            add(txt(a),a.get('href'),' / '.join(areas)+' · '+role if areas else role)
    elif kind=='verification':
        s['selector']='Supplementary official team page used to verify PI name spelling; no additional candidate record'
    elif kind=='crg':
        s['selector']='div.clickable group cards with views-field-php full PI name and views-field-name group link; staff-scientist entries excluded'
        for box in root.xpath('//div[@class="clickable"]'):
            n=txt(first(box,'.//div[contains(@class,"views-field-php")]'))
            a=first(box,'.//div[contains(@class,"views-field-name")]//a')
            if a is not None and n:add(n,a.get('href'),' / '.join(s['scope'])+'；CRG 专题研究组目录收录。')
    elif kind=='mpkyb':
        s['selector']='div.name.first.tabcard-entry with employee link and named faculty/group leader role'
        for box in root.xpath('//div[contains(@class,"name first tabcard-entry")]'):
            a=first(box,'.//a[contains(@href,"/person/")]')
            if a is not None:add(txt(a),a.get('href'),txt(first(box,'.//div[@class="position"]')))
    elif kind=='embl':
        s['selector']='article.vf-profile with Group Leader, Senior Scientist or Director title; excludes service/technical teams'
        for box in root.xpath('//article[contains(@class,"vf-profile")]'):
            title=txt(first(box,'.//p[contains(@class,"job-title")]'))
            unit=txt(first(box,'.//p[@class="vf-profile__text"]'))
            a=first(box,'.//h3/a')
            if not re.search(r'Group Leader|Senior Scientist|Director General|Head of Research',title,re.I):continue
            if re.search(r'IT |Services|Infrastructure|Administration|Core Facilit',unit,re.I):continue
            if a is not None:add(txt(a),a.get('href'),unit or title)
    # URL-based de-duplication within each source, using site host independent of scheme/trailing fragment.
    unique={}
    for x in out:
        k=(x['name'].lower(),urlsplit(x['url']).netloc.lower())
        if k not in unique:unique[k]=x
    return list(unique.values())

def main():
    a=argparse.ArgumentParser();a.add_argument('--refresh',action='store_true');opts=a.parse_args()
    with concurrent.futures.ThreadPoolExecutor(6) as pool:list(pool.map(lambda s:fetch(s,opts.refresh),SOURCES))
    out=[]
    for s in SOURCES:
        items=parse(s);s['recordCount']=len(items);out.extend(items)
        print(s['key'],len(items),s.get('error',''),flush=True)
    unique={}
    def normname(t):return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',t).encode('ascii','ignore').decode().lower())
    def laburl(u):
        a=urlsplit(u);h=a.netloc.lower().replace('www.','');p=a.path.rstrip('/')
        if h in ['switchlab.org','switchlab.sites.vib.be']:return 'switchlab.sites.vib.be'
        return h+(p[:-3] if p.endswith('/en') else p)
    for x in out:
        # Site-specific standalone lab URLs can identify joint leaders. Never
        # collapse people merely because they share a generic directory URL.
        lu=laburl(x['url'])
        if '.sites.vib.be' in lu or lu.startswith('embl.org/people/person/') or lu.startswith('ebi.ac.uk/people/person/'):
            key=('individual_lab_url',lu)
        else:key=('name_and_profile',normname(x['name']),lu)
        if key not in unique:unique[key]=x
        else:
            old=unique[key]
            old['fields']=list(dict.fromkeys(old['fields']+x['fields']))
            old.setdefault('additionalSources',[]).append(x['sourceUrl'])
            if normname(old['name'])!=normname(x['name']):
                old.setdefault('aliases',[]).append(x['name'])
                if not re.search(r'\blab\b|\bgroup\b',x['name'],re.I):
                    old['name']+=' / '+x['name']
            if old['institution']!=x['institution']:
                old.setdefault('additionalAffiliations',[]).append(dict(institution=x['institution'],country=x['country'],city=x['city']))
    out=list(unique.values())
    (ROOT/'europe.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
    (ROOT/'europe-sources.json').write_text(json.dumps(SOURCES,ensure_ascii=False,indent=2),encoding='utf-8')
    print('TOTAL',len(out),'countries',sorted(set(x['country'] for x in out)))

if __name__=='__main__':main()
