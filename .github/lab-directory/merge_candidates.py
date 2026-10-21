#!/usr/bin/env python3
"""Merge checked public directories into stable long-term candidate records."""
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
import argparse, collections, datetime, hashlib, json, re, unicodedata
parser=argparse.ArgumentParser(description='Build a reviewable candidate snapshot; never publish automatically.')
parser.add_argument('--baseline',type=Path,required=True,help='Current official labs.json; existing records are retained.')
parser.add_argument('--input-dir',type=Path,default=Path(__file__).resolve().parent)
parser.add_argument('--output-dir',type=Path,required=True,help='A separate review folder, never the official data directory.')
args=parser.parse_args()
INPUT=args.input_dir.resolve();OUTPUT=args.output_dir.resolve()
if OUTPUT==args.baseline.resolve().parent:parser.error('Use a separate review folder; review the diff before updating official data.')
OUTPUT.mkdir(parents=True,exist_ok=True)
data=json.loads(args.baseline.read_text())
DATE=datetime.datetime.now(datetime.timezone.utc).date().isoformat()

def norm_name(s):
    s=unicodedata.normalize('NFKD',s)
    s=''.join(c for c in s if not unicodedata.combining(c))
    s=re.sub(r'\b(professor|prof|dr|phd|md|ph\.d|m\.d)\.?\b','',s,flags=re.I)
    s=re.sub(r'[()\[\],.]',' ',s).lower()
    return ' '.join(s.split())

def canonical_url(url):
    u=urlsplit(url.strip()); host=u.netloc.lower().removeprefix('www.')
    if host=='med.stanford.edu' and u.path.startswith('/profiles/'):
        host='profiles.stanford.edu';path=u.path.removeprefix('/profiles')
    else:path=u.path
    path=re.sub(r'/index\.html?$','',path).rstrip('/')
    query=urlencode([(k,v) for k,v in parse_qsl(u.query) if not k.startswith('utm_')])
    return urlunsplit((u.scheme,host,path,query,u.fragment))

FIELDS={
 '基因组学与基因编辑':['基因组学'], '基因组学与生物医学':['生命科学与生物医学'], '基因组学与多组学':['基因组学','多组学'],
 '神经影像与脑网络':['神经影像'], '脑影像与医学影像':['生物医学成像'],
 '脑机接口与神经工程':['神经工程'],
 'AI与生物医学':['人工智能与生物医学'], 'AI for Biology':['AI for Biology'], 'AI for biology':['AI for Biology'],
 '微生物组与宿主互作':['微生物组'], '微生物组与感染':['微生物学与感染'], '微生物组与微生物学':['微生物学与感染'],
 '单细胞与空间组学':['单细胞与空间组学'], '单细胞/空间组学':['单细胞与空间组学'],
 '系统与合成生物学':['系统生物学','合成生物学'],
 'AI虚拟细胞':['AI虚拟细胞（AIVC）'], '生物信息学':['计算生物学'],
 '生物医学AI':['人工智能与生物医学'], '神经科学':['脑科学'], '精神疾病':['精神疾病与认知'], '合成生物学与再生医学':['合成生物学与再生医学'],
}

def fields(xs):
    ys=[]
    for x in xs:
        for y in FIELDS.get(x,[x]):
            if y not in ys:ys.append(y)
    return ys or ['生命科学']

def research_fields(x):
    """Conservative labels: broad directory membership is not a specific method."""
    fs=fields(x.get('fields',[]));summary=x.get('summary','')
    context=' '.join([summary,x.get('sourceTitle',''),x.get('institution','')])
    if '系统生物学' in fs and not re.search(r'systems\s+(?:and\s+synthetic\s+)?biolog|systems biomed|系统生物学',context,re.I):
        fs.remove('系统生物学')
    if '合成生物学与再生医学' in fs:
        fs.remove('合成生物学与再生医学')
        if re.search(r'synthetic biolog|合成生物',summary,re.I):fs.append('合成生物学')
    if re.search(r'stem cell|regenerat|developmental biolog|干细胞|再生医学',summary,re.I):fs.append('干细胞与发育再生')
    if re.search(r'biomaterial|tissue engineering|生物材料|组织工程',summary,re.I):fs.append('生物材料与组织工程')
    if re.search(r'cellular.{0,20}behavio|cell.{0,15}behavio',summary,re.I) and not re.search(r'neuro|brain|neural|神经|脑',context,re.I):
        fs=[f for f in fs if f!='脑科学']
        fs.append('分子与细胞生物学')
    if re.search(r'brain[ -](?:computer|machine) interface|\bBCI\b|\bBMI\b|脑机接口',summary,re.I):fs.append('脑机接口')
    if re.search(r'microbiom|microbiota|intestinal ecosystem|肠道微生态|微生物组',summary,re.I):fs.append('微生物组')
    if re.search(r'neuroimag|brain imag|\bfMRI\b|functional connectivity|神经影像|脑影像',summary,re.I):fs.append('神经影像')
    return list(dict.fromkeys(fs)) or ['生命科学与生物医学']

# Every cross-profile merge is backed by an official biography, not name equality.
CONFIRMED_IDENTITIES={
 'andrea ganna':{'urls':['https://www.dsgelab.org/','https://humantechnopole.it/en/people/andrea-ganna/'],'evidence':'https://humantechnopole.it/en/people/andrea-ganna/'},
 'ben lehner':{'urls':['https://www.sanger.ac.uk/person/lehner-ben/','https://www.crg.eu/en/programmes-groups/lehner-lab'],'evidence':'https://www.crg.eu/es/node/1397875'},
 'mark daly':{'urls':['https://www.broadinstitute.org/bios/mark-daly','https://www.helsinki.fi/en/researchgroups/human-disease-genetics'],'evidence':'https://www.broadinstitute.org/bios/mark-daly'},
 'piero carninci':{'urls':['https://humantechnopole.it/en/people/piero-carninci/','https://www.riken.jp/en/research/labs/ims/transcript_tech/index.html'],'evidence':'https://humantechnopole.it/en/people/piero-carninci/'},
 'helena kilpinen':{'urls':['https://www.helsinki.fi/en/researchgroups/cellular-genetics-of-disease','https://www.helsinki.fi/en/hilife-helsinki-institute-life-science/units/neuroscience-center/research-groups/cellular-genetics-disease'],'evidence':'https://www.helsinki.fi/en/hilife-helsinki-institute-life-science/units/neuroscience-center/research-groups/cellular-genetics-disease'},
}

def add_evidence(l,x):
    for key in ('aliases','roleStatus','directoryOnly','fieldEvidence','recordType','principalInvestigatorNotExtracted','affiliationNote'):
        if key in x and key not in l:l[key]=x[key]
    notes=[]
    if x.get('directoryOnly') or (x['url'].split('#')[0]==x['sourceUrl'].split('#')[0] and x.get('reviewMethod')!='manual_official_profile_web_read'):
        notes.append('资料入口指向官方目录中的记录，尚未单独核验个人网页。')
    if x.get('directoryCategory'):notes.append('官方目录分类：'+x['directoryCategory']+'。')
    if x.get('evidenceScope'):notes.append(x['evidenceScope'])
    if x.get('principalInvestigatorNotExtracted'):notes.append('官网以实验室名称列出，尚未单独核实负责人姓名。')
    if x.get('affiliationNote'):notes.append(x['affiliationNote'])
    if notes:l['directoryNote']=' '.join(dict.fromkeys([l.get('directoryNote','')]+notes)).strip()
    evidence=[]
    if x.get('researchEvidenceUrl'):
        evidence.append({'url':x['researchEvidenceUrl'],'label':'官方研究方向说明','kind':'official','verifiedAt':x.get('profileVerifiedAt') or x['verifiedAt'],'claim':'研究方向已依据个人网页的Research部分细化。'})
    for s in x.get('researchEvidenceSources',[])+x.get('additionalResearchSources',[]):
        if isinstance(s,str):s={'url':s}
        evidence.append(dict(s,kind='official',label=s.get('title') or '官方研究方向说明',claim='该研究者的研究方向证据。'))
    for extra in x.get('additionalSources',[])+x.get('additionalOfficialSources',[]):
        if isinstance(extra,str):extra={'url':extra}
        if isinstance(extra,dict):
            evidence.append({'url':extra.get('sourceUrl') or extra.get('url'),'label':extra.get('sourceTitle') or extra.get('title') or extra.get('institution') or '其他官方来源','kind':'official','verifiedAt':extra.get('verifiedAt') or x['verifiedAt'],'claim':'同一研究者的另一条官方来源；机构关联的性质以来源说明为准。'})
    if x.get('opportunityNote'):
        l['opportunity']['summary']=x['opportunityNote']+' 作为长期方向候选保留。'
        if x.get('opportunitySourceUrl'):evidence.append({'url':x['opportunitySourceUrl'],'label':'接收资格补充说明','kind':'official','verifiedAt':x['verifiedAt'],'claim':x['opportunityNote']})
    for s in evidence:
        u=s.get('url')
        if u and urlsplit(u).scheme in ('https','http') and not any(z['url']==u for z in l['sources']):
            l['sources'].append({'url':u,'label':s['label'],'kind':s['kind'],'verifiedAt':s.get('verifiedAt') or x['verifiedAt'],'claim':s['claim'],'access':'已读取官方公开资料'})
    for a in x.get('additionalAffiliations',[]):
        a=dict(a,institutionKey=inst(a['institution']),url=a.get('url') or x['sourceUrl'])
        if not any(z['institutionKey']==a['institutionKey'] for z in l.setdefault('affiliations',[])):l['affiliations'].append(a)

INSTITUTIONS={
 'Stanford University':'Stanford University',
 'Harvard University / affiliated hospitals':'Harvard University / affiliated hospitals',
 'Broad Institute / MIT / Harvard network':'Broad Institute',
 'McGill University / IPN network':'McGill University',
 'Massachusetts Institute of Technology':'MIT',
 'Westlake University, School of Life Sciences':'西湖大学 · 生命科学学院',
 'University of Queensland, Queensland Brain Institute':'University of Queensland · QBI',
 'Weizmann Institute of Science, Department of Brain Sciences':'Weizmann Institute of Science',
 'Okinawa Institute of Science and Technology (OIST)':'OIST',
 'A*STAR Genome Institute of Singapore':'A*STAR · Genome Institute of Singapore',
 'Garvan Institute of Medical Research':'Garvan Institute of Medical Research',
}

def inst(s):return INSTITUTIONS.get(s,s)

# These exact aliases refer to the existing detailed card's explicitly named PIs.
CORE_ALIASES={
'chang':['Edward F. Chang','Edward Chang'], 'nptl':['Frank Willett','Frank R. Willett','Jaimie Henderson','Jaimie M. Henderson'],
'bassett':['Dani S. Bassett','Danielle S. Bassett','Dani Bassett'],
'woolrich':['Mark Woolrich'], 'behrens':['Timothy Behrens','Timothy E. J. Behrens','Tim Behrens'],
'friston':['Karl Friston'], 'vandeville':['Dimitri Van De Ville'],
'micera':['Silvestro Micera'],'lacour':['Stéphanie P. Lacour','Stephanie Lacour'],
'eickhoff':['Simon B. Eickhoff','Simon Eickhoff'],'ritter':['Petra Ritter'],
'bethge':['Matthias Bethge'],'marquand':['André F. Marquand','Andre Marquand'],
'vangerven':['Marcel van Gerven'],'ramsey':['Nick F. Ramsey','Nick Ramsey'],
 'theis':['Fabian Theis','Fabian J. Theis'],'stegle':['Oliver Stegle'],'teichmann':['Sarah Teichmann','Sarah A. Teichmann']}
CORE_INST={'chang':'UCSF','nptl':'Stanford University','bassett':'University of Pennsylvania','woolrich':'University of Oxford','behrens':'University of Oxford','friston':'UCL','vandeville':'EPFL','micera':'EPFL','lacour':'EPFL','eickhoff':'Forschungszentrum Jülich / HHU Düsseldorf','ritter':'Charité / BIH','bethge':'University of Tübingen','marquand':'Radboud University / Radboudumc','vangerven':'Radboud University / Radboudumc','ramsey':'UMC Utrecht','theis':'Helmholtz Munich / TUM','stegle':'EMBL · Heidelberg','teichmann':'University of Cambridge'}

labs=data['labs'];byurl={};byname=collections.defaultdict(list);aliases={}
for l in labs:
    l.setdefault('evidenceLevel','reviewed' if l['id'] in CORE_INST else 'official_directory')
    l.setdefault('institutionKey',CORE_INST.get(l['id'],l['institution']))
    l.setdefault('profileUrl',l['sources'][0]['url']);l['candidateStatus']='long_term';l['directions']=fields(l['directions'])
    l['sources']=[dict(s,kind=s.get('kind','official')) for s in l['sources']]
    for n in CORE_ALIASES.get(l['id'],[]):aliases[norm_name(n)]=l
    for s in l['sources']:byurl[canonical_url(s['url'])]=l
    byname[norm_name(l['name'])].append(l)

allrows=[]
for filename in ['north_america.json','europe.json','asia_oceania.json']:
    p=INPUT/filename
    if p.exists():allrows+=json.loads(p.read_text())
merges=[];excluded=[];conflicts=[]
for x in allrows:
    if not x.get('name') or not x.get('url') or not x.get('sourceUrl'):
        excluded.append({'name':x.get('name'),'reason':'required evidence missing'});continue
    if urlsplit(x['url']).scheme not in ('https','http') or urlsplit(x['sourceUrl']).scheme!='https':
        excluded.append({'name':x['name'],'reason':'HTTPS official evidence required','url':x['url']});continue
    name=norm_name(x['name']);url=canonical_url(x['url']);ik=inst(x['institution'])
    source={'label':x.get('sourceTitle') or x['institution']+' official directory','url':x['sourceUrl'],'country':x['country'],'institution':x['institution'],'claim':'官方目录列出该研究者或研究组，并提供本条资料链接。收录不以当前有无招生或招聘为条件。','kind':'directory','verifiedAt':x['verifiedAt'],'access':'已读取官方目录；身份与目录关联核验'}
    # Same profile URL is strong identity evidence. Same name alone is insufficient across different institutions.
    match=aliases.get(name)
    same_url=byurl.get(url)
    if not match and same_url and norm_name(same_url['name'])==name:match=same_url
    identity=CONFIRMED_IDENTITIES.get(name)
    if not match and identity and url in [canonical_url(u) for u in identity['urls']]:
        match=next((l for l in byname.get(name,[]) if canonical_url(l.get('profileUrl','')) in [canonical_url(u) for u in identity['urls']]),None)
    if not match:
        candidates=[l for l in byname.get(name,[]) if l.get('institutionKey')==ik and l.get('country')==x['country']]
        # Preserve distinct people sharing a name when profiles are different (e.g. Westlake Jian Yang).
        match=next((l for l in candidates if canonical_url(l.get('profileUrl',''))==url),None)
    if match:
        if not any(s['url']==source['url'] for s in match['sources']):match['sources'].append(source)
        match['directions']=list(dict.fromkeys(match['directions']+research_fields(x)))
        if ik!=match.get('institutionKey'):
            aff={'institution':x['institution'],'institutionKey':ik,'country':x['country'],'url':x['url']}
            a=match.setdefault('affiliations',[])
            if not any(z['institutionKey']==ik for z in a):a.append(aff)
        add_evidence(match,x)
        if identity:
            match['identityMergeEvidence']=identity['evidence']
            if not any(s['url']==identity['evidence'] for s in match['sources']):match['sources'].append({'url':identity['evidence'],'label':'官方跨机构身份说明','kind':'official','verifiedAt':identity.get('verifiedAt','2026-10-21'),'claim':'官方传记明确同一PI的机构关联。','access':'已核对官方身份说明'})
        merges.append({'name':x['name'],'into':match['id'],'basis':identity['evidence'] if identity else 'explicit existing PI alias, or matching name and official profile URL'})
        continue
    slug=re.sub(r'[^a-z0-9]+','-',name).strip('-')[:65] or 'pi'
    id='pi-'+slug+'-'+hashlib.sha256(url.encode()).hexdigest()[:8]
    fs=research_fields(x);summary=x.get('summary','').strip()
    if summary in fs or summary=='；'.join(fs):summary='研究领域：'+'、'.join(fs)+'。'
    l={'id':id,'name':x['name'],'country':x['country'],'city':x.get('city',''),
       'institution':x['institution'],'institutionKey':ik,'role':x.get('role','') or x.get('roleStatus',''),
       'directions':fs,'tier':'D','evidenceLevel':'official_directory','candidateStatus':'long_term',
       'profileUrl':x['url'],'question':summary,'groupName':x.get('groupName',''),
       'verifiedAt':x['verifiedAt'],'directoryVerifiedAt':x.get('directoryVerifiedAt') or x['verifiedAt'],
       'fieldBasis':'方向来自该条目的官方研究说明或所属专题目录；不同证据深度在卡片内分别标注。',
       'opportunity':{'status':'unknown','summary':'长期方向候选；当前接收名额尚未核验。未发现招聘信息不影响收录。','url':x['url'],'deadline':None,'verifiedAt':None,'visit':'访问、博士联合培养和博士后资格待单独确认；可持续关注未来机会。'},
       'papers':[],'sources':[source], 'platforms':[], 'gaps':[]}
    add_evidence(l,x)
    labs.append(l);byurl[url]=l;byname[name].append(l)

# Report ambiguous names for human disambiguation instead of silently merging them.
for key,ls in byname.items():
    if len(ls)>1:conflicts.append({'name':key,'records':[{'id':l['id'],'name':l['name'],'institution':l['institution'],'url':l['profileUrl']} for l in ls]})

data['edition']=DATE.replace('-','.')+'-candidate-draft';data['generatedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
ndata=len(labs);ncore=sum(l['evidenceLevel']=='reviewed' for l in labs)
data['title']='全球科研团队长期候选库'
data['scope']=f'{ndata}个团队 / PI条目；按研究方向收录，不以当前招聘为前提。含{ncore}张代表作与适配证据卡，其余为官方名录核验条目。覆盖持续扩展，不构成全球排名。'
data['tiers']['D']='待逐条评估'
data['statuses']['unknown']='长期候选 · 机会待核验'
data['methodology']=[
 '收录依据是研究方向与官方团队/导师身份，无论当前是否招生或招聘均可保留为长期候选，支持提前一至两年规划。岗位状态只是附加信息；没有当前岗位不能推断未来没有机会，也不能承诺将来一定招生。',
 f'本版含{ncore}张详细证据卡与{ndata-ncore}条官方名录记录。详细卡含代表论文与适配分析；名录卡核实官方目录中的姓名、机构关联和资料入口，不代表已逐一审查全部成果、接收资格或指导质量。',
 '一个PI在多处任职时尽可能合并官方记录；同名但资料链接/任职不同者保留独立记录并继续核对。机构数按研究单元统计，跨院/兼职/联合任职的归属以官方目录为准。',
 '领域标签依据官方条目文字或专题目录。综合生命科学目录中的团队保留其真实方向，不自动归入AI虚拟细胞、计算生物学或脑机接口。宽泛目录标签仍需结合个人Research页面细筛。',
 'A、B、C是研究能力的衔接距离；D表示尚待逐条评估，不是实力评分。代表作证据反映已整理的阅读入口，不构成发文数量或引用排名。',
 'AI虚拟细胞（AIVC）按直接虚拟细胞项目、扰动预测方法与图谱/评估支撑区分；基础模型或单细胞研究不自动等同完整细胞模拟。',
 '接收信息分为明确招聘、明确可咨询和待核验。普通博士入学、访问博士/联合培养、博士后三类资格单独判断；旧公告和泛机构招聘不代表具体课题组当前有名额。',
 '官方目录和网页按计划巡检；个人资料分批轮巡。网页可访问/内容哈希变化不刷新人工内容核验日期，不自动确认岗位。机会超过30天、已截止或来源异常时显示待复核，研究团队仍保留在长期候选库。',
 '每周研究任务复核变化来源、补充相关团队和代表作，持续拓展国家与机构覆盖。只有实际核验后才更新内容日期；公开库不包含私人申请记录、联系材料或临床数据。'
]
data['history'].append({'date':DATE,'type':'candidate_draft','summary':f'生成{ndata}条候选草稿；保留基线记录，新增和合并结果须人工复核后才能发布。'})

# Source inventory is deduplicated by observed URL, with parsers traceable to their original source files.
manifest=[]
for filename in ['north_america_sources.json','europe-sources.json','asia_manifest.json']:
 p=INPUT/filename
 if p.exists():
  ms=json.loads(p.read_text());manifest+=(ms.get('sources',[]) if isinstance(ms,dict) else ms)
index={}
for m in manifest:
 u=m.get('url')
 if not u:continue
 row=dict(m);row['id']=m.get('sourceId') or m.get('id') or m.get('key') or hashlib.sha256(u.encode()).hexdigest()[:12]
 index[u]=row
for l in labs:
 for s in l['sources']:
  if s['kind']!='directory':continue
  r=index.setdefault(s['url'],{'id':'source-'+hashlib.sha256(s['url'].encode()).hexdigest()[:12],'url':s['url'],'title':s['label'],'country':l['country'],'institution':l['institution'],'retrievedAt':s['verifiedAt']})
  r.setdefault('recordIds',[])
  if l['id'] not in r['recordIds']:r['recordIds'].append(l['id'])
for r in index.values():r['includedCount']=len(r.get('recordIds',[]));r.pop('recordIds',None)
source_data={'schemaVersion':1,'edition':data['edition'],'purpose':'官方来源覆盖与复采依据；名录核验不等于招聘核验。','sources':list(index.values())}
(OUTPUT/'labs-candidate.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
(OUTPUT/'lab-sources-candidate.json').write_text(json.dumps(source_data,ensure_ascii=False,indent=2)+'\n')
report={'records':ndata,'detailed':ncore,'officialDirectory':ndata-ncore,'countries':dict(collections.Counter(l['country'] for l in labs)),'institutions':dict(collections.Counter(l['institutionKey'] for l in labs)), 'directions':dict(collections.Counter(t for l in labs for t in l['directions'])),'sources':len(index),'merges':merges,'ambiguousNames':conflicts,'excluded':excluded}
(OUTPUT/'merge-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['merges','institutions','ambiguousNames','excluded']},ensure_ascii=False,indent=2))
print('Merged',len(merges),'ambiguous names',len(conflicts))
