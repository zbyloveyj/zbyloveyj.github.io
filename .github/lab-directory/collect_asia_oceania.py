#!/usr/bin/env python3
"""Extract PI/group identities from public official directories; never infer hiring.

Uses lxml. Cached HTML is the audit input; --refresh reads official public sources.
Field labels are derived only from the displayed group title or directory category.
"""
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from zoneinfo import ZoneInfo
from lxml import html
import argparse, hashlib, json, re

ROOT=Path(__file__).resolve().parent
CACHE=ROOT/'asia-sources'
TODAY=datetime.now(ZoneInfo('Asia/Shanghai')).date().isoformat()
DATES=ROOT/'asia-source-dates.json'
SOURCE_DATES=json.loads(DATES.read_text()) if DATES.exists() else {}
SOURCES={
 'riken_heads':('https://www.riken.jp/en/research/pilist/','RIKEN','日本','table tr: named laboratory heads; CBS/IMS/BDR and selected bio/medical AIP; exclude support, platforms, closed groups'),
 'riken_bdr':('https://www.bdr.riken.jp/en/research/labs/index.html','RIKEN BDR','日本','a.p-member__item with named PI; reject Closed and duplicate leaders'),
 'oist':('https://www.oist.jp/research/research-units','Okinawa Institute of Science and Technology (OIST)','日本','article > a research-unit cards; named faculty; relevant unit-title keywords; exclude adjunct/emeritus'),
 'westlake':('https://lifesciences.westlake.edu.cn/faculty/','Westlake University, School of Life Sciences','中国','static listData JavaScript object literals; extract quoted keys only, never execute script'),
 'qbi_leaders':('https://qbi.uq.edu.au/qbi-group-leaders','University of Queensland, Queensland Brain Institute','澳大利亚','a.card__link[href*=profile] with nonempty title in official group-leader directory'),
 'astar_gis':('https://www.a-star.edu.sg/gis/our-people/faculty-staff','A*STAR Genome Institute of Singapore','新加坡','Next Flight serialized JSON block_profile_listing profile_items; published page permalink; deduplicate named leaders'),
 'weizmann_neurofaculty':('https://www.weizmann.ac.il/brain-sciences/faculty-members','Weizmann Institute of Science, Department of Brain Sciences','以色列','h3 faculty cards before Professor Emeritus heading; retain official homepage and research-topic labels'),
 'garvan':('https://www.garvan.org.au/research/labs-groups','Garvan Institute of Medical Research','澳大利亚','official directory public search index: type Lab or Group with named leaders; one record per group'),
 'hkust':('https://life-sci.hkust.edu.hk/faculty-members/','Hong Kong University of Science and Technology, Division of Life Science','中国（香港）','h3 linked names under research-faculty headings; exclude teaching/support and affiliated sections to avoid inactive affiliates'),
 'kaist':('https://bcs.kaist.ac.kr/sub020101','KAIST, Department of Brain and Cognitive Sciences','韩国','h4.name within .info cards; official detail URL and explicit .info-tag research terms'),
 'snu':('https://bcs.snu.ac.kr/sub3_1_a.php','Seoul National University, Department of Brain and Cognitive Sciences','韩国','.prof-item cards with .prof-tit big name and institution-linked lab homepage; no hiring filter'),
 'astar_bii':('https://www.a-star.edu.sg/bii/people/our-researchers','A*STAR Bioinformatics Institute','新加坡','Next Flight block_profile_listing: named research-group leaders and their department titles; exclude Data Management support role; source directory serves as profile when no separate page exists')
}

def clean(x):
 return ' '.join((x.text_content() if hasattr(x,'text_content') else str(x or '')).split())

def name_clean(x):
 x=clean(x)
 x=re.sub(r'^(Professor|Prof\.|Associate Professor|Assistant Professor|A/Prof|Dr\.?|Mr\.)\s+','',x)
 x=re.split(r',?\s+(?:Ph\.D\.|PhD|M\.D\.|D\.V\.M\.|Dr\. rer\.)',x)[0].rstrip(', ')
 return x

def labels(text,base=()):
 t=text.lower();ls=list(base)
 rules=[
  (r'neuro|neural|brain|cogniti|connectom|neuron|synap|sensory|memory|somnol','脑科学'),
  (r'computational neuro|theoretical neuro|neural computation|brain intelligence|neural circuits and computation','计算神经科学'),
  (r'brain.computer|brain.robot|neural interface|neural prosthe|brain.machine','脑机接口'),
  (r'psychiatr|mental health','精神疾病'),
  (r'bioinformatic|computational|biological complexity|quantitative biology|simulation','计算生物学'),
  (r'genom|genetic|transcript|epigen|rna|dna','基因组学与多组学'),
  (r'single.cell|single cell|spatial (?:omic|transcript)|spatial and single','单细胞与空间组学'),
  (r'\bai\b|artificial intelligence|machine learning|deep learning','AI for biology'),
  (r'microbiom|microb|intestinal ecosystem|symbio|bacteri','微生物组与微生物学'),
  (r'immun|inflamm','免疫学'),
  (r'systems bio|cell systems|biosystem|systems gen','系统生物学'),
  (r'protein|structural bio|molecular design','蛋白质与结构生物学'),
  (r'synthetic bio|cell.free protein|bioengineering|regeneration|stem cell|organoid','合成生物学与再生医学'),
  (r'metabol|lipid|nutrition','代谢与营养'),
 ]
 for regex,label in rules:
  if re.search(regex,t) and label not in ls:ls.append(label)
 return ls or ['分子与细胞生物学']

def source_date(key):
 value=SOURCE_DATES.get(key,'')
 if not re.fullmatch(r'\d{4}-\d{2}-\d{2}',value):
  raise RuntimeError(f'Missing recorded fetch date for {key}; run --refresh. Parsing alone cannot verify a source today.')
 return value

def doc(key):
 path=CACHE/(key+'.html')
 if not path.exists():raise RuntimeError(f'Missing source cache {path.name}; first run requires --refresh.')
 return html.fromstring(path.read_bytes())

records=[]
def add(key,name,url,summary='',fields=None,institution=None,city='',**extras):
 source,inst,country,rule=SOURCES[key]
 name=name_clean(name)
 if not name or not url:return
 records.append({'name':name,'institution':institution or inst,'country':country,'city':city,
  'url':urljoin(source,url),'sourceUrl':source,'sourceTitle':(institution or inst)+' — official research group / faculty directory',
  'fields':fields or labels(summary),'summary':summary,'evidenceLevel':'official_directory','verifiedAt':source_date(key),**extras})

def parse_riken():
 closed=set()
 for a in doc('riken_bdr').xpath('//a[contains(@class,"p-member__item")]'):
  n=a.xpath('.//p[contains(@class,"name")]')
  if n and re.search(r'closed',clean(a),re.I):closed.add(clean(n[0]))
 for tr in doc('riken_heads').xpath('//tr'):
  td=tr.xpath('./td')
  if len(td)!=3:continue
  n,inst,title=map(clean,td)
  selected=any(x in inst for x in ['(CBS)','(IMS)','(BDR)'])
  if '(AIP)' in inst and re.search(r'biolog|genom|medic|health|brain',title,re.I):selected=True
  if not selected:continue
  if re.search(r'support|resources division|platform|collaboration center|magnet development|advanced multi.omics technology division',title,re.I):continue
  a=td[2].xpath('.//a[@href]')
  if not a:continue
  name=' '.join(n.split(', ')[::-1]) if ', ' in n else n
  if name in closed:continue
  add('riken_heads',name,a[0].get('href'),title,labels(title,['脑科学'] if '(CBS)' in inst else []),institution=inst)
 # BDR's local directory includes recently founded ECL units absent from the global table.
 for a in doc('riken_bdr').xpath('//a[contains(@class,"p-member__item")]'):
  ps=a.xpath('.//p');n=a.xpath('.//p[contains(@class,"name")]')
  if not n or len(ps)<2:continue
  title=clean(ps[-1]);name=clean(n[0])
  if re.search(r'closed|platform|society',title,re.I):continue
  add('riken_bdr',name,a.get('href'),title,labels(title),institution='RIKEN Center for Biosystems Dynamics Research (BDR)')

def parse_oist():
 for key in ['oist']+[f'oist_{i}' for i in range(1,6)]:
  for card in doc(key).xpath('//article'):
   link=card.xpath('./a[contains(@href,"/research/research-units/")]');h=card.xpath('.//h3');p=card.xpath('.//p[contains(@class,"font-bold")]')
   if not link or not h or not p:continue
   title=clean(h[0]);name=clean(p[-1]);alltext=clean(card)
   if re.search(r'adjunct|emeritus',alltext,re.I):continue
   if title=='Marine Biophysics Unit':continue
   if not re.search(r'neuro|brain|synap|cognit|cell|molecular|genom|genetic|epigen|biolog|bioengineer|microb|protein|membran|development|complexity|biophysics',title,re.I):continue
   add('oist',name,link[0].get('href'),title,labels(title),city='Okinawa',directoryPage=urljoin(SOURCES['oist'][0],f'?page={key.split("_")[-1]}') if '_' in key else SOURCES['oist'][0])

def parse_westlake():
 text=(CACHE/'westlake.html').read_text()
 chunk=text.split('listData: [',1)[1]
 for block in re.findall(r'\{[^{}]+\}',chunk):
  fields=dict((k,json.loads(v)) for k,v in re.findall(r'([A-Za-z_]+)\s*:\s*("(?:[^"\\]|\\.)*")',block))
  if not all(x in fields for x in ['name','url','laboratory']):continue
  title=fields['laboratory'];program='; '.join(x for x in [fields.get('program'),fields.get('secondProgram')] if x)
  if not title or not re.search(r'Professor|Investigator',fields.get('desc','')):continue
  add('westlake',fields['name'],fields['url'],title,labels(title+'; '+program),city='Hangzhou',directoryCategory=program)

def parse_qbi():
 seen=set()
 for a in doc('qbi_leaders').xpath('//a[contains(@href,"/profile/")]'):
  name=clean(a)
  if not name or name in seen:continue
  seen.add(name)
  add('qbi_leaders',name,a.get('href'),'',fields=['脑科学'],city='Brisbane')

def find_pages(x):
 if isinstance(x,dict):
  if 'blocks' in x and 'permalink' in x:yield x
  for v in x.values():yield from find_pages(v)
 elif isinstance(x,list):
  for v in x:yield from find_pages(v)

def flight_pages(d):
 for script in d.xpath('//script'):
  t=script.text or ''
  if not t.startswith('self.__next_f.push('):continue
  try:p=json.loads(t[len('self.__next_f.push('):].rstrip(');'))
  except (ValueError,TypeError):continue
  if len(p)<2 or not isinstance(p[1],str):continue
  for line in p[1].splitlines():
   s=line.split(':',1)[-1]
   if not s or s[0] not in '[{':continue
   try:yield from find_pages(json.loads(s))
   except ValueError:pass

def parse_gis():
 for page in flight_pages(doc('astar_gis')):
  if page.get('permalink')!='/gis/our-people/faculty-staff':continue
  for b in page.get('blocks',[]):
   if b.get('collection')!='block_profile_listing':continue
   cat=b['item'].get('group_title','')
   for p in b['item'].get('profile_items',[]):
    linked=p.get('page') or {}
    if linked.get('status')!='published' or not linked.get('permalink'):continue
    add('astar_gis',p['title'],linked['permalink'],'',labels(cat,['基因组学与多组学']),city='Singapore',directoryCategory=cat)

def parse_weizmann():
 d=doc('weizmann_neurofaculty')
 for h in d.xpath('//h2|//h3'):
  if h.tag=='h2' and re.search(r'emeritus|memoriam',clean(h),re.I):break
  if h.tag!='h3':continue
  parent=h.getparent()
  anchors=parent.xpath('.//a[contains(text(),"Homepage")]')
  if not anchors:continue
  topics=[clean(x) for x in parent.xpath('.//div[contains(@class,"field--name-name")]')]
  add('weizmann_neurofaculty',clean(h),anchors[0].get('href'),'; '.join(topics),labels(' '.join(topics),['脑科学']),city='Rehovot')

def parse_garvan():
 p=CACHE/'garvan_records.json'
 if not p.exists():raise RuntimeError('Missing Garvan record payload; run --refresh rather than silently omit these groups.')
 for hit in json.loads(p.read_text()).get('hits',[]):
  if hit.get('type') not in ['Lab','Group']:continue
  leaders=hit.get('leaders') or []
  names=[]
  for leader in leaders:
   n=(leader.get('first_name','')+' '+leader.get('last_name','')).strip()
   if n:names.append(n)
  if not names or not hit.get('url'):continue
  desc=(hit.get('card') or {}).get('card_summary','')
  summary=hit['title']
  tags=labels(summary+' '+desc)
  add('garvan',' / '.join(names),hit['url'],summary,tags,city='Sydney',groupName=hit['title'])

def parse_hkust():
 section=''
 for h in doc('hkust').xpath('//h3|//h4'):
  if h.tag=='h4':section=clean(h);continue
  if not re.search('PROFESSORS|DIVISION HEAD',section) or re.search('TEACHING|AFFILIATED',section):continue
  a=h.xpath('.//a[contains(@href,"/team/")]')
  if not a:continue
  add('hkust',clean(h),a[0].get('href'),'',fields=['分子与细胞生物学'],city='Hong Kong',directoryCategory=section)

def parse_kaist():
 for h in doc('kaist').xpath('//h4[@class="name"]'):
  card=h.getparent().getparent();a=card.xpath('.//a[contains(@href,"/sub020101/view/")]')
  if not a:continue
  topics=[clean(x) for x in card.xpath('.//ul[@class="info-tag"]/li')]
  add('kaist',clean(h),a[0].get('href'),'; '.join(topics),labels(' '.join(topics),['脑科学']),city='Daejeon')

def parse_snu():
 for card in doc('snu').xpath('//div[@class="prof-item"]'):
  n=card.xpath('.//div[@class="prof-tit"]/big')
  a=card.xpath('.//a[starts-with(@href,"http") and not(contains(@href,"snu.ac.kr/personal"))]')
  text=card.xpath('.//div[@class="txt"]')
  if not n or not a:continue
  add('snu',clean(n[0]).split(' — ')[0],a[0].get('href'),'',labels(' '.join(clean(x) for x in text),['脑科学']),city='Seoul')

def parse_bii():
 for page in flight_pages(doc('astar_bii')):
  if page.get('permalink')!='/bii/people/our-researchers':continue
  for b in page['blocks']:
   if b.get('collection')!='block_profile_listing':continue
   for p in b['item'].get('profile_items',[]):
    des=p.get('designations') or [];departments=[x['department'] for x in des if x.get('department')]
    if not departments or 'Data Management' in departments:continue
    name=re.sub(r'\s*\(Head\)$','',p['title'].strip())
    title='; '.join(dict.fromkeys(departments))
    add('astar_bii',name,SOURCES['astar_bii'][0],title,labels(title,['计算生物学']),city='Singapore',directoryOnly=True)

def enrich_profiles(rows):
 log=ROOT/'asia-profiles-log.json'
 if not log.exists():return
 logs={r['url']:r for r in json.loads(log.read_text()) if r.get('status')==200}
 for row in rows:
  meta=logs.get(row['url'])
  if not meta:continue
  p=ROOT/'asia-profiles'/meta['file']
  if not p.exists():continue
  # A directory refresh must not renew older, separately fetched profile evidence.
  fetched_at=meta.get('fetchedAt','')
  if not re.match(r'^\d{4}-\d{2}-\d{2}(?:T|$)',fetched_at):continue
  body=p.read_bytes()
  if not meta.get('sha256') or hashlib.sha256(body).hexdigest()!=meta['sha256']:continue
  row['profileVerifiedAt']=fetched_at[:10]
  row['profileStatus']=200
  d=html.fromstring(body);pieces=[];active=False
  for el in d.xpath('//h2|//h3|//h4|//p|//li'):
   text=clean(el)
   if el.tag.startswith('h'):
    if re.search('publication|related news|address|contact|honou?r|award|experience',text,re.I):active=False
    elif re.search('^research|^our research',text,re.I):active=True
    continue
   if active and not el.xpath('.//p|.//li'):pieces.append(text)
  research=' '.join(pieces)
  if not research:continue
  base=[x for x in row['fields'] if x!='分子与细胞生物学']
  row['fields']=labels(research,base)
  # These are short factual subject terms extracted from the PI's research
  # section, not from other people's publications or global site navigation.
  concepts=[(r'alzheimer','阿尔茨海默病'),(r'neurodegener','神经退行性疾病'),(r'neurodevelop','神经发育'),
    (r'single.cell','单细胞'),(r'spatial (?:omic|transcript)','空间组学'),(r'genom','基因组学'),
    (r'epigen','表观遗传'),(r'microbiom','微生物组'),(r'metagenom','宏基因组'),
    (r'machine learning|deep learning|artificial intelligence','人工智能'),(r'computational','计算建模'),
    (r'stem cell','干细胞'),(r'gene.editing','基因编辑'),(r'gene regulation','基因调控'),
    (r'\brna\b|transcript','RNA与转录调控'),(r'immun','免疫学'),(r'cancer|tumou?r','肿瘤生物学'),
    (r'protein|structural biol','蛋白质与结构'),(r'neuro|neural|synap','神经科学'),
    (r'metabol','代谢'),(r'cell fate','细胞命运'),(r'dna repair','DNA修复'),(r'membrane','细胞膜'),
    (r'drug','药物发现')]
  topics=[cn for regex,cn in concepts if re.search(regex,research,re.I)][:6]
  if topics:row['summary']='研究关键词：'+'、'.join(topics)+'。'
  # GIS displays the actual laboratory name separately from research prose.
  for p in d.xpath('//div[@class="description"]/p'):
   match=re.search(r'>\s*(Laboratory[^>]+)',clean(p))
   if match:
    row['groupName']=match.group(1).strip();break
  row['researchEvidenceUrl']=row['url']

def collect():
 for fn in [parse_riken,parse_oist,parse_westlake,parse_qbi,parse_gis,parse_weizmann,parse_garvan,parse_hkust,parse_kaist,parse_snu,parse_bii]:fn()
 out=[];seen=set()
 for row in records:
  # Two distinct Westlake faculty are named Jian Yang. Their official URLs are
  # identity evidence and must take precedence over a name-only duplicate key.
  key=(row['url'],row['country']) if 'westlake.edu.cn' in row['sourceUrl'] else (re.sub('[^a-z0-9]','',row['name'].lower()),row['country'])
  if key in seen:continue
  seen.add(key);out.append(row)
 enrich_profiles(out)
 return out

def refresh():
 work={k:v[0] for k,v in SOURCES.items()}
 work.update({f'oist_{i}':f'https://www.oist.jp/research/research-units?page={i}' for i in range(1,6)})
 updated_dates=dict(SOURCE_DATES)
 def fetch(kv):
  key,url=kv
  with urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0 (public research directory verification)'}),timeout=40) as r:
   body=r.read()
  dest=CACHE/(key+'.html');staged=dest.with_suffix('.html.tmp')
  staged.write_bytes(body);staged.replace(dest)
  # Garvan's HTML only locates the actual data payload; it is not that payload.
  if key!='garvan':updated_dates[key]=TODAY
  return key
 CACHE.mkdir(exist_ok=True)
 with ThreadPoolExecutor(5) as pool:
  for k in pool.map(fetch,work.items()):print('fetched',k)
 # The public search-only credential is read from the site's published JS bundle.
 d=doc('garvan');srcs=d.xpath('//script[contains(@src,"pages/research/labs-groups")]/@src')
 if not srcs:raise RuntimeError('Garvan data bundle was not found; cached records and their date remain unchanged.')
 with urlopen(urljoin(SOURCES['garvan'][0],srcs[0]),timeout=30) as r:
  js=r.read().decode()
 m=re.search(r'\("([A-Z0-9]{10})","([a-z0-9]{32})"\)',js)
 if not m:raise RuntimeError('Garvan public search configuration was not found; cached records and their date remain unchanged.')
 app,key=m.groups()
 req=Request(f'https://{app.lower()}-dsn.algolia.net/1/indexes/main_production_lab_group?query=&hitsPerPage=1000',headers={'X-Algolia-Application-Id':app,'X-Algolia-API-Key':key})
 with urlopen(req,timeout=30) as r:payload=r.read()
 result=json.loads(payload)
 hits=result.get('hits') if isinstance(result,dict) else None
 if not isinstance(hits,list) or not hits:
  raise RuntimeError('Garvan returned no valid record payload; cached records and their date remain unchanged.')
 valid=[h for h in hits if isinstance(h,dict) and h.get('type') in ['Lab','Group'] and h.get('title') and h.get('url')
        and any(isinstance(p,dict) and (p.get('first_name') or p.get('last_name')) for p in (h.get('leaders') or []))]
 if not valid or result.get('nbPages',1)>1:
  raise RuntimeError('Garvan payload is incomplete or has no named research groups; cached records and their date remain unchanged.')
 dest=CACHE/'garvan_records.json';staged=dest.with_suffix('.json.tmp')
 staged.write_bytes(payload);staged.replace(dest)
 updated_dates['garvan']=TODAY
 staged_dates=DATES.with_suffix('.json.tmp')
 staged_dates.write_text(json.dumps(updated_dates,ensure_ascii=False,indent=2)+'\n');staged_dates.replace(DATES)
 SOURCE_DATES.clear();SOURCE_DATES.update(updated_dates)

if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--refresh',action='store_true');ap.add_argument('--output',default='asia_oceania.json',help='Candidate filename inside this maintenance directory only');args=ap.parse_args()
 output=(ROOT/args.output).resolve()
 if output.parent!=ROOT or output.suffix!='.json':ap.error('--output must be a JSON filename inside this maintenance directory')
 if output.name in {'north_america_priority_additions.json','north_america_research_evidence.json'}:ap.error('--output cannot overwrite reviewed evidence')
 if args.refresh:refresh()
 rows=collect();output.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
 manifest=[]
 for key,(url,inst,country,rule) in SOURCES.items():
  manifest.append({'id':'asia-'+key,'url':url,'institution':inst,'country':country,'retrievedAt':source_date(key),'parser':rule,'extractedCount':sum(r['sourceUrl']==url for r in rows),'script':'collect_asia_oceania.py'})
 (ROOT/'asia_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 print('Total',len(rows))
 for x in manifest:print(x['institution'],x['extractedCount'])
