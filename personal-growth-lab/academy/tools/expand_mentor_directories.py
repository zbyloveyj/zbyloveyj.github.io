#!/usr/bin/env python3
"""Build reviewable, provenance-preserving NIH research-PI candidates.

This command never overwrites the public directory. NIH project investigators
are project-record evidence, not a claim of current faculty appointment,
doctoral-supervisor status, funding available to applicants, or recruitment.
Fellowship, career-development, training and construction awards are excluded.
Project abstracts are read locally for explicit thematic matches; the candidate
file retains short evidence excerpts, not complete abstracts.

API documentation: https://api.reporter.nih.gov/
Official rate recommendation: at most one request per second.
"""
from __future__ import annotations

import argparse
import collections
import datetime as dt
import gzip
import hashlib
import html
import json
import re
import time
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

API = 'https://api.reporter.nih.gov/v2/projects/search'
AGENCIES = ['NIMH','NINDS','NIA','NIAID','NIGMS','NHGRI','NIBIB','NIDDK',
            'NICHD','NIDA','NIAAA','NCI','NHLBI','NIEHS','NIDCD','NEI',
            'NIDCR','NIMHD','NLM','NINR','NCATS','NCCIH','OD']
# These represent independent research/project support. In particular no F/K/T,
# S10 equipment, C construction, or R13/U13 conference awards enter the query.
ACTIVITIES = ['R01','R03','R15','R16','R21','R24','R33','R35','R37','R56','R61',
              'R00','DP1','DP2','DP5','U01','U19','UG3','UH3','RF1','RM1',
              'P01','P20','P30','P50','U54','UM1']
FIELDS = ['ApplId','ProjectNum','ProjectTitle','PrincipalInvestigators','Organization',
          'ActivityCode','FiscalYear','ProjectEndDate','ProjectStartDate','IsActive',
          'PrefTerms','ProjectDetailUrl','AbstractText','OrganizationType']

# Only explicit text in the project's own title/abstract is used. Broad NIH
# membership, institute names and grant-recipient prestige add no domain tags.
DOMAIN_RULES = [
 ('微生物组', r'\b(?:microbiom\w*|microbiot\w*|metagenom\w*)\b'),
 ('微生物生态', r'\bmicrobial (?:ecolog\w*|communit\w*|ecosystem\w*)\b'),
 ('肠脑轴', r'\b(?:gut[- ]brain|gut[- ]microbiota[- ]brain|gut[- ]microbiome[- ]brain|microbiota[- ]gut[- ]brain|microbiome[- ]brain|brain[- ]gut)\b'),
 ('宿主-微生物互作',r'\bhost[- ](?:microb\w*|pathogen\w*|bacter\w*)\b'),
 ('微生物学',r'\b(?:microbiolog\w*|bacteriolog\w*|bacteriophage\w*|bacterial (?:infection\w*|pathogen\w*|species|strain\w*|communit\w*|ecolog\w*|coloni[sz]\w*|growth|cell\w*|genom\w*|transcriptom\w*|proteom\w*|metabol\w*|biofilm\w*|resistan\w*|physiolog\w*|evolution)|microbial (?:infection\w*|pathogen\w*|communit\w*|ecolog\w*|genom\w*|physiolog\w*|metabol\w*)|virolog\w*|viral (?:infection\w*|pathogen\w*|replication|disease\w*|evolution|assembly|entry|transmission)|fungal (?:infection\w*|pathogen\w*|disease\w*|cell\w*|growth|virulence|genom\w*))\b'),
 ('脑科学',r'\b(?:brain|neuron\w*|neural (?:circuit\w*|activit\w*|stem|develop\w*|progenitor\w*|tissue|plasticity|signal\w*|record\w*|coding|stimulation)|neuroscien\w*|neurobiolog\w*|neurodevelopment\w*|nervous system|peripheral nerve\w*|neuromodulat\w*|neurostimulat\w*|cognitive (?:function|impairment|control|decline|neuroscience|performance|aging|memory))\b'),
 ('计算神经科学',r'\b(?:computational neuroscience|neural computation|neural coding|neural decoding|neural circuit model\w*)\b'),
 ('脑机接口',r'\b(?:brain[- ]computer interface\w*|brain[- ]machine interface\w*|neuroprosthe\w*|neural interface\w*)\b'),
 ('神经影像',r'\b(?:neuroimaging|brain imaging|functional magnetic resonance|functional MRI|fMRI|connectom\w*)\b'),
 ('精神医学',r'\b(?:psychiatr\w*|schizophren\w*|bipolar (?:disorder\w*|illness|spectrum|affective|patient\w*)|major depress\w*|depressive disorder\w*|mental (?:illness|health|disorder\w*))\b'),
 ('计算精神病学',r'\bcomputational psychiatr\w*\b'),
 ('神经免疫',r'\b(?:neuroimmun\w*|neuroinflamm\w*|microglia\w*)\b'),
 ('免疫学',r'\b(?:immune|immunity|immunolog\w*|immunother\w*|immunopath\w*|immunomodul\w*|immunometabol\w*|inflamm\w*|cytokine\w*|T[- ]cell\w*|B[- ]cell\w*)\b'),
 ('代谢与营养',r'\b(?:metaboli\w*|nutrition\w*|glucose homeostasis|lipid metabolism|mitochondri\w*|oxidative phosphorylation|OXPHOS|bioenergetic\w*)\b'),
 ('代谢组学',r'\bmetabolom\w*\b'),
 ('基因组学',r'\b(?:genom\w*|epigenom\w*|transcriptom\w*|statistical genetics|human genetics|genetic (?:architecture|association\w*|variant\w*|epidemiolog\w*))\b'),
 ('单细胞与空间组学',r'\b(?:single[- ]cell (?:sequenc\w*|RNA\w*|transcriptom\w*|profil\w*|multiom\w*|genom\w*|analysis)|spatial (?:transcriptom\w*|proteom\w*|omic\w*)|scRNA[- ]?seq)\b'),
 ('计算生物学',r'\b(?:bioinformatic\w*|computational biolog\w*|systems biolog\w*|computational genom\w*|statistical genetic\w*|multi[- ]?omic\w*)\b'),
 ('AI for Biology',r'\b(?:machine learning|deep learning|artificial intelligence|foundation model\w*|large language model\w*)\b'),
 ('医学人工智能',r'\b(?:machine learning|deep learning|artificial intelligence|foundation model\w*|large language model\w*)\b'),
 ('AI虚拟细胞（AIVC）',r'\b(?:virtual cell\w*|digital cell\w*)\b'),
 ('单细胞基础模型',r'\b(?:single[- ]cell foundation model\w*|cellular foundation model\w*|cell foundation model\w*)\b'),
 ('生物医学工程',r'\b(?:bioengineer\w*|biomedical engineer\w*|biosensor\w*|bioelectronic\w*|biomaterial\w*|microfluidic\w*|tissue engineer\w*)\b'),
 ('合成生物学',r'\b(?:synthetic biolog\w*|genome engineer\w*|engineered (?:microb\w*|bacter\w*)|synthetic gene circuit\w*)\b'),
 ('细胞与分子生物学',r'\b(?:cell biolog\w*|cellular (?:mechanism\w*|process\w*|function\w*|state\w*|response\w*|signaling|signalling|metabol\w*|pathway\w*|heterogeneity|biology|component\w*|microenvironment\w*)|molecular mechanism\w*|stem cell\w*|cell differentiation|cell signaling|cell signalling|protein structure|structural biolog\w*|protein folding|proteom\w*|post[- ]?transcriptional|transcriptional regulation|gene regulation|rna regulation|rna biology|mirna|mrna|dna replication|dna repair|chromatin|gene expression|cell division|cell cycle|protein synthesis|rna processing|microtubule\w*|gametogene\w*|epigenetic\w*|post[- ]translational|protein engineer\w*|protein evolution|protein variant\w*|protein function\w*|protein specificity)\b'),
 ('生物统计与流行病学',r'\b(?:biostatistic\w*|epidemiolog\w*|causal inference|population health|statistical method\w*)\b'),
 ('衰老与疾病机制',r'\b(?:aging|ageing|senescen\w*|neurodegenerat\w*|Alzheimer\w*|Parkinson\w*)\b'),
]
METHOD_RULES = [
 ('宏基因组学',r'\bmetagenom\w*\b'),('单细胞分析',r'\b(?:single[- ]cell|scRNA[- ]?seq)\b'),
 ('多组学整合',r'\b(?:multi[- ]?omic\w*|integrative omic\w*)\b'),
 ('机器学习',r'\bmachine learning\b'),('深度学习',r'\bdeep learning\b'),
 ('因果推断',r'\bcausal inference\b'),('CRISPR扰动',r'\bCRISPR\b'),
 ('神经电生理',r'\b(?:electrophysiolog\w*|electrocorticograph\w*)\b'),
 ('神经解码',r'\b(?:neural decoding|brain decoding)\b'),
 ('光遗传学',r'\boptogenetic\w*\b'),('空间组学',r'\bspatial (?:transcriptom\w*|proteom\w*|omic\w*)\b'),
 ('质谱',r'\bmass spectrometr\w*\b'),('冷冻电镜',r'\bcryo[- ](?:EM|electron)\b'),
 ('基因编辑',r'\b(?:gene editing|genome editing)\b'),
 ('计算建模',r'\b(?:computational model\w*|mathematical model\w*)\b')]
DISEASE_RULES = [('抑郁症',r'\b(?:major depress\w*|depressive disorder\w*|clinical depression|treatment[- ]resistant depression|postpartum depression|late[- ]life depression|depressed patient\w*|patients with depression|depression and anxiety|anxiety and depression)\b'),
 ('精神分裂症',r'\bschizophren\w*\b'),('双相障碍',r'\bbipolar (?:disorder\w*|illness|spectrum|affective|patient\w*)\b'),
 ('自闭症',r'\bauti\w*\b'),('阿尔茨海默病',r'\bAlzheimer\w*\b'),
 ('帕金森病',r'\bParkinson\w*\b'),('炎症性肠病',r'\b(?:inflammatory bowel|Crohn\w*|ulcerative colitis)\b'),
 ('肥胖',r'\bobes\w*\b'),('糖尿病',r'\bdiabet\w*\b'),('肿瘤',r'\b(?:cancer|tumou?r\w*|carcinoma\w*)\b'),
 ('癫痫',r'\bepilep\w*\b'),('卒中',r'\bstroke\b'),('成瘾',r'\baddict\w*\b'),
 ('焦虑障碍',r'\banxiety\b'),('创伤后应激障碍',r'\b(?:post[- ]traumatic stress|PTSD)\b')]
MODALITY_RULES = [('fMRI',r'\b(?:fMRI|functional MRI|functional magnetic resonance)\b'),
 ('MRI',r'\b(?:MRI|magnetic resonance imaging)\b'),('EEG',r'\b(?:EEG|electroencephalograph\w*)\b'),
 ('MEG',r'\b(?:MEG|magnetoencephalograph\w*)\b'),('PET',r'\b(?:PET imaging|positron emission tomograph\w*)\b'),
 ('宏基因组',r'\bmetagenom\w*\b'),('转录组',r'\btranscriptom\w*\b'),
 ('蛋白质组',r'\bproteom\w*\b'),('代谢组',r'\bmetabolom\w*\b'),
 ('单细胞转录组',r'\b(?:single[- ]cell RNA|single[- ]cell transcriptom\w*|scRNA[- ]?seq)\b'),
 ('电子病历',r'\belectronic (?:health|medical) record\w*\b'),
 ('类器官',r'\borganoid\w*\b')]
DESIGN_RULES = [('纵向研究',r'\blongitudinal\b'),('队列研究',r'\bcohort\w*\b'),
 ('临床试验',r'\bclinical trial\w*\b'),('动物实验',r'\b(?:mouse model\w*|mice|murine|rat model\w*)\b'),
 ('扰动实验',r'\b(?:perturbation|perturbations)\b')]
COMPILED = {k:[(label,re.compile(pattern.lower(),re.ASCII)) for label,pattern in v] for k,v in {
 'domains':DOMAIN_RULES,'methods':METHOD_RULES,'diseases':DISEASE_RULES,
 'modalities':MODALITY_RULES,'studyDesigns':DESIGN_RULES}.items()}
EXCLUDED_TITLE = re.compile(r'^(?:administrative core|administration core|administrative coordination|research training|training program|conference|scientific meeting|equipment|construction|renovation)\b',re.I)
EXCLUDED_ROLE = re.compile(r'\b(?:post[- ]?doc\w*|research fellow|predoctoral\w*|student|trainee|intern|technician|technologist|coordinator|laboratory manager|lab manager|research assistant)\b(?!\s+professor)',re.I)
COUNTRIES = {'UNITED STATES':'美国','UNITED KINGDOM':'英国','CHINA':'中国大陆','CANADA':'加拿大','AUSTRALIA':'澳大利亚','GERMANY':'德国','FRANCE':'法国','SWEDEN':'瑞典','SWITZERLAND':'瑞士','NETHERLANDS':'荷兰','ITALY':'意大利','SPAIN':'西班牙','JAPAN':'日本','SOUTH KOREA':'韩国','KOREA, REPUBLIC OF':'韩国','ISRAEL':'以色列','INDIA':'印度','SOUTH AFRICA':'南非','BRAZIL':'巴西','NEW ZEALAND':'新西兰','DENMARK':'丹麦','FINLAND':'芬兰','NORWAY':'挪威','IRELAND':'爱尔兰','SINGAPORE':'新加坡','AUSTRIA':'奥地利','BELGIUM':'比利时','TAIWAN':'中国台湾','HONG KONG':'中国香港','PUERTO RICO':'波多黎各'}
COUNTRIES.update({'PERU':'秘鲁','KENYA':'肯尼亚','ARGENTINA':'阿根廷','UGANDA':'乌干达',
 'BOTSWANA':'博茨瓦纳','ZIMBABWE':'津巴布韦','GHANA':'加纳','NIGERIA':'尼日利亚',
 'THAILAND':'泰国','MALI':'马里','CAMBODIA':'柬埔寨','TANZANIA U REP':'坦桑尼亚',
 'CAMEROON':'喀麦隆','EGYPT':'埃及','MALAYSIA':'马来西亚','COSTA RICA':'哥斯达黎加',
 'TRINIDAD/TOBA':'特立尼达和多巴哥','MALAWI':'马拉维','CONGO DEM REP':'刚果（金）',
 'PAKISTAN':'巴基斯坦','HAITI':'海地','ECUADOR':'厄瓜多尔','TUNISIA':'突尼斯',
 'ICELAND':'冰岛','GREECE':'希腊','BANGLADESH':'孟加拉国'})

def clean(value):
    return re.sub(r'\s+',' ',html.unescape(str(value or ''))).strip()

def canonical_name(value):
    value=''.join(c for c in unicodedata.normalize('NFKD',value) if not unicodedata.combining(c))
    return ''.join(re.findall(r'\w+',value.lower()))

def title_name(pi):
    full=clean(' '.join(clean(pi.get(k,'')) for k in ('first_name','middle_name','last_name')))
    if not full:full=clean(pi.get('full_name',''))
    return full.title() if full.isupper() else full

def excluded_role(role):
    # Named/endowed fellowships and professors directing postdoctoral training
    # are not trainees. RePORTER job titles can reflect the original application;
    # none of these strings alone establishes a person's current appointment.
    if re.search(r'\b(?:professor|principal investigator|group leader|director|chair|senior scientist)\b',role,re.I):return False
    return bool(EXCLUDED_ROLE.search(role))

REVIEWED_IDENTITY_MERGES=[
 ('10063277','16208050','https://hsc.unm.edu/directory/bhaskar-kiran.html'),
 ('6867934','78801320','https://publichealth.jhu.edu/faculty/4363/nicole-baumgarth'),
 ('78539683','14610263','https://profiles.stanford.edu/tobias-lanz'),
 ('79122051','79683563','https://reporter.nih.gov/project-details/11358410'),
 ('10533030','10953634','https://learn.hms.harvard.edu/about/leadership-faculty/faculty/jamil-r-azzi'),
 ('10590765','78779475','https://www.med.unc.edu/microimm/people/lance-thurlow-phd/'),
 ('80311364','15185839','https://reporter.nih.gov/project-details/11563787'),
 ('10286550','8659693','https://connects.catalyst.harvard.edu/Profiles/profile/1252814'),
]

def project_key(project):
    number=project.get('projectNumber','')
    match=re.search(r'[A-Z][A-Z0-9]{2}[A-Z]{2}\d{6}',number)
    return match.group(0) if match else number or str(project['projectId'])

def merge_reviewed_identities(people):
    audit=[]
    for keep,other,source in REVIEWED_IDENTITY_MERGES:
        if keep not in people or other not in people:continue
        a,b=people[keep],people.pop(other)
        a['nihProfileIds']=list(dict.fromkeys(a.get('nihProfileIds',[keep])+b.get('nihProfileIds',[other])))
        a['aliases']=list(dict.fromkeys(a['aliases']+[b['name']]+b['aliases']))
        a['roleTitles']=list(dict.fromkeys(a['roleTitles']+b['roleTitles']))
        a['researchProjects'].extend(b['researchProjects'])
        a['projectsObserved']+=b['projectsObserved']
        for affiliation in b['projectAffiliations']:
            if not any(x['institution']==affiliation['institution'] for x in a['projectAffiliations']):a['projectAffiliations'].append(affiliation)
        audit.append({'name':a['name'],'nihProfileIds':a['nihProfileIds'],'sourceUrl':source,'reviewedAt':'2026-10-21','basis':'official individual identity and matching project/organization evidence; not a name-only merge'})
    return audit

def query_page(cache,agency,offset,refresh):
    path=cache/f'nih-{agency}-{offset:05d}.json.gz'
    meta_path=cache/f'nih-{agency}-{offset:05d}.meta.json'
    if path.exists() and meta_path.exists() and not refresh:
        return json.loads(gzip.decompress(path.read_bytes())),json.loads(meta_path.read_text())
    payload={'criteria':{'agencies':[agency],'is_agency_admin':True,
        'include_active_projects':True,'exclude_subprojects':True,'activity_codes':ACTIVITIES},
        'offset':offset,'limit':500,'include_fields':FIELDS,
        'sort_field':'appl_id','sort_order':'asc'}
    for attempt in range(5):
        try:
            req=urllib.request.Request(API,data=json.dumps(payload).encode(),headers={
                'Content-Type':'application/json','User-Agent':'AcademicMentorResearchDirectory/2.0 (public research metadata)'})
            start=time.monotonic()
            with urllib.request.urlopen(req,timeout=110) as response:raw=response.read()
            data=json.loads(raw)
            if 'results' not in data or 'meta' not in data:raise ValueError('missing documented response keys')
            stamp=dt.datetime.now(dt.timezone.utc).isoformat()
            meta={'url':API,'method':'POST','payload':payload,'retrievedAt':stamp,
                  'sha256':hashlib.sha256(raw).hexdigest(),'resultCount':len(data['results']),
                  'total':data['meta']['total'],'searchId':data['meta'].get('search_id')}
            path.write_bytes(gzip.compress(raw,mtime=0));meta_path.write_text(json.dumps(meta,ensure_ascii=False,indent=2))
            time.sleep(max(0,1.1-(time.monotonic()-start)))
            return data,meta
        except (urllib.error.URLError,TimeoutError,ValueError,ConnectionError) as error:
            if attempt==4:raise
            print(f'Retry {agency} {offset}: {type(error).__name__}',flush=True)
            time.sleep(min(15,2**attempt))
    raise RuntimeError('unreachable')

def labels(text,axis):
    lower=text.lower()
    return [label for label,rx in COMPILED[axis] if any(x in lower for x in GUARDS.get(label,('',))) and rx.search(lower)]

GUARDS={
 '微生物组':('microbi','metagen'),'微生物生态':('microbial',),'肠脑轴':('brain',),
 '宿主-微生物互作':('host',),'微生物学':('bacter','microbial','virol','viral','fung'),
 '脑科学':('brain','neuro','neural','synap','cogniti','nervous system','peripheral nerve'),
 '计算神经科学':('comput','neural coding','neural decoding'),'脑机接口':('interface','neuroprosthe'),
 '神经影像':('imaging','fmri','functional mri','functional magnetic','connectom'),
 '精神医学':('psychi','schizo','bipolar','depress','mental '),'计算精神病学':('computational psychiatr',),
 '神经免疫':('neuroimmun','neuroinflamm','microglia'),'免疫学':('immun','inflamm','cytok','t-cell','b-cell','t cell','b cell'),
 '代谢与营养':('metaboli','nutrition','glucose','lipid','mitochondri','oxidative phosphorylation','oxphos','bioenergetic'),'代谢组学':('metabolom',),
 '基因组学':('genom','transcriptom','genetic'),'单细胞与空间组学':('single','spatial','scrna'),
 '计算生物学':('bioinform','computational','systems biol','statistical genetic','omic'),
 'AI for Biology':('machine learning','deep learning','artificial intelligence','foundation model','large language model'),
 '医学人工智能':('machine learning','deep learning','artificial intelligence','foundation model','large language model'),
 'AI虚拟细胞（AIVC）':('virtual cell','digital cell','cellular foundation','cell foundation'),
 '单细胞基础模型':('foundation model',),
 '生物医学工程':('bioengineer','biomedical engineer','biosensor','bioelectronic','biomaterial','microfluidic','tissue engineer'),
 '合成生物学':('synthetic biol','genome engineer','engineered'),
 '细胞与分子生物学':('cell biolog','cellular','molecular mechanism','stem cell','cell differentiation','cell signaling','cell signalling','protein structure','structural biolog','protein folding','proteom','transcriptional','gene regulation','rna','dna','chromatin','gene expression','cell division','cell cycle','protein synthesis','microtubule','gametogene','epigenetic','translational','protein engineer','protein evolution','protein variant','protein function','protein specificity'),
 '生物统计与流行病学':('biostatistic','epidemiolog','causal inference','population health','statistical method'),
 '衰老与疾病机制':('aging','ageing','senescen','neurodegenerat','alzheimer','parkinson'),
 '宏基因组学':('metagenom',),'单细胞分析':('single','scrna'),'多组学整合':('omic',),
 '机器学习':('machine learning',),'深度学习':('deep learning',),'因果推断':('causal inference',),
 'CRISPR扰动':('crispr',),'神经电生理':('electrophysi','electrocortic'),
 '神经解码':('decoding',),'光遗传学':('optogen',),'空间组学':('spatial',),
 '质谱':('mass spectrom',),'冷冻电镜':('cryo',),'基因编辑':('editing',),
 '计算建模':('computational model','mathematical model'),
 '抑郁症':('depress',),'精神分裂症':('schizo',),'双相障碍':('bipolar',),
 '自闭症':('auti',),'阿尔茨海默病':('alzheimer',),'帕金森病':('parkinson',),
 '炎症性肠病':('inflammatory bowel','crohn','ulcerative colitis'),'肥胖':('obes',),'糖尿病':('diabet',),
 '肿瘤':('cancer','tumor','tumour','carcinoma'),'癫痫':('epilep',),'卒中':('stroke',),
 '成瘾':('addict',),'焦虑障碍':('anxiety',),'创伤后应激障碍':('traumatic stress','ptsd'),
 'fMRI':('fmri','functional mri','functional magnetic'),'MRI':('mri','magnetic resonance'),
 'EEG':('eeg','electroenceph'),'MEG':('meg','magnetoenceph'),'PET':('pet','positron emission'),
 '宏基因组':('metagenom',),'转录组':('transcriptom',),'蛋白质组':('proteom',),'代谢组':('metabolom',),
 '单细胞转录组':('single','scrna'),'电子病历':('electronic',),'类器官':('organoid',),
 '纵向研究':('longitudinal',),'队列研究':('cohort',),'临床试验':('clinical trial',),
 '动物实验':('mouse','mice','murine','rat model'),'扰动实验':('perturbation',)}

def research_focus(title,abstract):
    sentences=re.split(r'(?<=[.!?])\s+',clean(abstract))
    focus=[s for s in sentences if FOCUS_PATTERN.search(s)]
    focus=[s for s in focus if not re.search(r'\b(?:previous|previously|preliminary|our collaborators|we found|we showed|we demonstrated|we have shown|we have found)\b',s,re.I) or re.search(r'\b(?:we will|we propos\w*|specific aims?|objectives?|goals?)\b',s,re.I)]
    # If no research-aim sentences can be recognized, the specific title alone
    # is safer than assigning topics from broad introductory health statements.
    return title+' '+ ' '.join(focus)

def proposed_work(title,abstract):
    sentences=re.split(r'(?<=[.!?])\s+',clean(abstract))
    selected=[s for s in sentences if FOCUS_PATTERN.search(s) and not re.search(r'\b(?:previous|previously|preliminary|our collaborators|we found|we showed|we demonstrated|we have shown|we have found)\b',s,re.I)]
    return title+' '+' '.join(selected)

FOCUS_PATTERN=re.compile(r'\b(?:we (?:will|propose|plan|aim|hypothesize|seek|intend|investigate|study)|our (?:goal|objective|aim|hypothesis)|the (?:objective|goal|aim|hypothesis)|this (?:project|proposal|study|application)|specific aims?|aim\s*[1234]|seeks to|research focuses on|our research (?:focuses|will)|we test the hypothesis)\b',re.I)

def project_keywords(value):
    terms=[clean(t) for t in str(value or '').split(';') if clean(t)]
    relevant=re.compile(r'microbi|bacter|immun|inflamm|neuro|brain|synap|cognit|schizo|depress|bipolar|Alzheimer|Parkinson|genom|epigen|transcriptom|proteom|metabol|single.?cell|spatial|\b(?:RNA|mRNA|miRNA|tRNA|rRNA)\b|machine|deep learning|artificial|CRISPR|sequenc|mass spectrom|organoid|biomaterial|electro|magnetic|tomogra|stem cell|signaling|signalling|molecular|causal',re.I)
    specific=[t for t in terms if relevant.search(t)]
    return list(dict.fromkeys(specific))[:12]

def short_evidence(title,abstract):
    sentences=re.split(r'(?<=[.!?])\s+',clean(abstract))
    # Prefer an explicit aim / hypothesis over introductory burden statements.
    usable=[s for s in sentences if 40<len(s)<650 and re.search(r'\b(?:aim|hypothes|investigat|determine|develop|test|identif|understand|mechanism|propos)',s,re.I)]
    if not usable:usable=[s for s in sentences if 40<len(s)<650]
    return (usable[0] if usable else clean(abstract)[:450])[:450]

def compact_candidates(data):
    """Public assembly input: retain research facts without repeated boilerplate."""
    out={k:v for k,v in data.items() if k!='records'}
    out['methodology']['tagging']='Explicit project title and research-aim text, automatically extracted; not a reviewed personal research profile.'
    records=[]
    for r in data['records']:
        row={k:r[k] for k in ('name','nihProfileId','institution','country','evidenceLevel',
             'recordType','roleStatus','facets','projectsObserved','projectVerifiedAt')}
        if r.get('nihProfileIds'):row['nihProfileIds']=r['nihProfileIds']
        if r.get('aliases'):row['aliases']=r['aliases']
        if len(r.get('projectAffiliations',[]))>1:
            row['projectHosts']=[{'institution':a['institution'],'country':a['country']} for a in r['projectAffiliations']]
        row['researchProjects']=[]
        for p in r['researchProjects']:
            item={k:p[k] for k in ('projectId','title','url','activityCode','fiscalYear','endDate','isContactPi')}
            item['verifiedAt']=p['retrievedAt'][:10]
            if p.get('reportedRole'):item['reportedRole']=p['reportedRole']
            # Scientific terms are factual indexing metadata. The public card
            # links to the source abstract rather than reproducing its prose.
            item['keywords']=p.get('keywords',[])[:8]
            row['researchProjects'].append(item)
        records.append(row)
    out['records']=records
    return out

def classify_project(title,abstract):
    text=research_focus(title,abstract)
    domains=labels(text,'domains')
    if '神经影像' in domains and not re.search(r'\b(?:brain|neuro\w*|cogniti\w*|connectom\w*)\b',text,re.I):domains.remove('神经影像')
    if 'AI虚拟细胞（AIVC）' in domains:
        same_context=False
        for match in re.finditer(r'\b(?:virtual cell\w*|digital cell\w*)\b',text,re.I):
            window=text[max(0,match.start()-250):match.end()+250]
            if any(tag in labels(window,'domains') for tag in ('AI for Biology','医学人工智能')):same_context=True
        if not same_context:
            domains.remove('AI虚拟细胞（AIVC）')
            if '计算生物学' not in domains:domains.append('计算生物学')
    if any(x in domains for x in ('AI for Biology','医学人工智能')):
        if not re.search(r'\b(?:genom\w*|protein\w*|molecular|cellular|single[- ]cell|drug discovery|biolog\w*)\b',text,re.I):domains=[x for x in domains if x!='AI for Biology']
        clinical=re.compile(r'\b(?:clinical|patient\w*|diagnos\w*|medical|healthcare|health care|radiolog\w*|electronic health|electronic medical)\b',re.I)
        # A speculative benefit to disease prevention does not make molecular
        # machine learning a clinical-AI project. Application context must occur
        # in the specific title or in the same research-aim sentence as AI.
        medical_ai=any(clinical.search(s) and any(x in labels(s,'domains') for x in ('AI for Biology','医学人工智能')) for s in [title]+re.split(r'(?<=[.!?])\s+',text))
        if not medical_ai:domains=[x for x in domains if x!='医学人工智能']
    facets={axis:labels(text,axis) for axis in COMPILED if axis!='domains'}
    facets['domains']=domains;facets['researchScales']=[]
    work=proposed_work(title,abstract)
    facets['studyDesigns']=labels(work,'studyDesigns')
    if '临床试验' in facets['studyDesigns']:
        trial_in_title=bool(re.search(r'\b(?:(?:randomi[sz]ed|controlled|clinical)\s+trial\b)',title,re.I))
        conducts_trial=bool(re.search(r'\b(?:we will|we propose to|we plan to|will)\s+(?:conduct|perform|run|initiate|launch|implement|undertake|carry out)\b.{0,100}\bclinical trial\b',work,re.I))
        if not (trial_in_title or conducts_trial):facets['studyDesigns'].remove('临床试验')
    if '神经电生理' in facets['methods']:
        sentences=[s for s in re.split(r'(?<=[.!?])\s+',text) if re.search(r'electrophysiolog|electrocorticograph',s,re.I)]
        if not any(re.search(r'\b(?:neur\w*|brain|synapt\w*|cortica\w*|hippocamp\w*|cerebel\w*|retina\w*|nerve\w*|spinal|electrocorticograph\w*)\b',s,re.I) for s in sentences):facets['methods'].remove('神经电生理')
    return facets

def build(projects,manifest,args):
    people={};excluded=collections.Counter();today=args.as_of
    for sequence,p in enumerate(projects.values()):
        if sequence and sequence%5000==0:print(f'Classified {sequence}/{len(projects)} projects; {len(people)} candidate PIs',flush=True)
        title=clean(p.get('project_title'));abstract=clean(p.get('abstract_text'))
        if not p.get('is_active'):excluded['not_marked_active']+=1;continue
        if (p.get('project_end_date') or '')[:10] and p['project_end_date'][:10]<today:excluded['past_project_end']+=1;continue
        if EXCLUDED_TITLE.search(title):excluded['administrative_or_training_title']+=1;continue
        facets=classify_project(title,abstract);domains=facets['domains']
        if not domains:excluded['no_explicit_relevant_topic']+=1;continue
        org=p.get('organization') or {};org_name=clean(org.get('org_name'))
        country=COUNTRIES.get(org.get('org_country'),clean(org.get('org_country')))
        if not org_name or not country:excluded['missing_organization']+=1;continue
        url=p.get('project_detail_url') or f"https://reporter.nih.gov/project-details/{p['appl_id']}"
        # Artificial intelligence must be explicitly in the research description.
        # The general domain does not imply actual clinical deployment.
        project={'projectId':p['appl_id'],'projectNumber':p.get('project_num',''),
                 'title':title,'url':url,'fiscalYear':p.get('fiscal_year'),
                 'activityCode':p.get('activity_code'),
                 'startDate':(p.get('project_start_date') or '')[:10],
                 'endDate':(p.get('project_end_date') or '')[:10],
                 'isActiveAtRetrieval':True,'retrievedAt':p.get('_retrievedAt'),
                 'organization':org_name,'country':country,
                 'researchExcerpt':short_evidence(title,abstract),
                 'keywords':project_keywords(p.get('pref_terms')),
                 'directions':domains,'facets':facets}
        for pi in p.get('principal_investigators',[]):
            pid=pi.get('profile_id');name=title_name(pi);role=clean(pi.get('title'))
            if not pid or not name or len(name)<3:excluded['missing_pi_identity']+=1;continue
            if excluded_role(role):excluded['trainee_or_support_role']+=1;continue
            pid=str(pid)
            entry=people.setdefault(pid,{'name':name,'nihProfileId':pid,'aliases':[],
                 'evidenceLevel':'project_record','recordType':'research_project_pi',
                 'roleStatus':'unknown','candidateStatus':'long_term','researchProjects':[],
                 'projectsObserved':0,'facets':{axis:[] for axis in [*COMPILED,'researchScales']},
                 'projectAffiliations':[],'roleTitles':[]})
            if name!=entry['name'] and name not in entry['aliases']:entry['aliases'].append(name)
            if role and role not in entry['roleTitles']:entry['roleTitles'].append(role)
            entry['projectsObserved']+=1
            for axis,vals in facets.items():entry['facets'][axis]=list(dict.fromkeys(entry['facets'][axis]+vals))
            affiliation={'institution':org_name,'country':country,'url':url,'type':'funded_project_host'}
            if not any(x['institution']==org_name for x in entry['projectAffiliations']):entry['projectAffiliations'].append(affiliation)
            candidate=dict(project);candidate['isContactPi']=bool(pi.get('is_contact_pi'));candidate['reportedRole']=role
            entry['researchProjects'].append(candidate)
    identity_merges=merge_reviewed_identities(people)
    for entry in people.values():
        # Prefer newest award, then contact-PI projects, and de-duplicate project
        # numbers so annual award records do not inflate a research portfolio.
        ranked=sorted(entry['researchProjects'],key=lambda p:(p['fiscalYear'] or 0,p['isContactPi'],p['projectId']),reverse=True)
        selected=[];project_nums=set()
        entry['projectRecordsObserved']=entry['projectsObserved']
        entry['projectsObserved']=len({project_key(p) for p in ranked})
        for p in ranked:
            number=project_key(p)
            if number not in project_nums:selected.append(p);project_nums.add(number)
            if len(selected)>=2:break
        entry['researchProjects']=selected
        # The presented tags must be supported by the presented project evidence;
        # retained counts may encompass additional matching active projects.
        entry['facets']={axis:list(dict.fromkeys(v for p in selected for v in p['facets'][axis])) for axis in entry['facets']}
        primary=selected[0]
        entry.update({'institution':primary['organization'],'country':primary['country'],
           'url':primary['url'],'sourceUrl':primary['url'],
           'title':'NIH公开科研项目负责人（PI）',
           'roleNote':'NIH记录确认项目负责人身份；项目依托单位不等于已复核的现任主聘单位，博士指导资格和接收机会待核。',
           'summary':primary['title'],'researchSummary':primary['researchExcerpt'],
           'directions':entry['facets']['domains'],
           'verifiedAt':primary['retrievedAt'][:10],'projectVerifiedAt':primary['retrievedAt'][:10],
           'profileVerifiedAt':None,'directoryVerifiedAt':None,
           'identityBasis':'NIH RePORTER principal_investigators.profile_id',
           'researchBasis':'具体项目标题和摘要的明确主题；自动文本提取，未逐篇审阅论文或核实当前任职。',
           'facetBasis':'根据公开项目标题和研究目标句自动提取；标签描述项目主题，待个人研究与任职复核。',
           'deepResearchVerified':False,
           'sourceType':'official_funding_project'})
    output={'source':'NIH RePORTER official project records','schemaVersion':1,
      'asOf':today,'retrievedAt':max((m['retrievedAt'] for m in manifest),default=None),
      'methodology':{'documentation':'https://api.reporter.nih.gov/',
       'identity':'NIH profile_id followed by explicitly reviewed multi-ID identity merges; ambiguous cross-source names require separate review',
       'scope':'active independent research awards with explicit relevant project title/abstract themes',
       'notEstablished':['current faculty appointment','doctoral-supervisor status','available recruiting funds','current or future openings'],
       'excludedActivities':'F/K/T/C/S and R13/U13, plus administrative-title and trainee/support-role exclusions',
       'projectsPerPersonDisplayed':2,'projectEvidenceLevel':'project_record'},
      'identityMerges':identity_merges,
      'stats':{'uniqueProjectsFetched':len(projects),'uniquePIs':len(people),
               'excluded':dict(excluded),'countries':dict(collections.Counter(p['country'] for p in people.values())),
               'domains':dict(collections.Counter(t for p in people.values() for t in p['directions']))},
      'records':list(people.values())}
    Path(args.output).write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n')
    Path(args.output).with_suffix('.sources.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    if getattr(args,'compact_output',None):
        Path(args.compact_output).write_text(json.dumps(compact_candidates(output),ensure_ascii=False,separators=(',',':'))+'\n')
    print(json.dumps(output['stats'],ensure_ascii=False,indent=2),flush=True)

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--cache',required=True);ap.add_argument('--output',required=True)
    ap.add_argument('--compact-output',help='Optional concise input for public-directory assembly; no abstract prose')
    ap.add_argument('--as-of',required=True,help='Evidence-snapshot date; must correspond to actual retrieval')
    ap.add_argument('--agencies',nargs='+',default=AGENCIES)
    ap.add_argument('--refresh',action='store_true')
    args=ap.parse_args();cache=Path(args.cache)
    public_data=Path(__file__).resolve().parents[1]/'data'
    for target in [args.output,args.compact_output,args.cache]:
        if target and Path(target).resolve().is_relative_to(public_data):
            ap.error('Candidate outputs and source caches must stay outside the published data directory; integrate separately after review.')
    cache.mkdir(parents=True,exist_ok=True)
    projects={};manifest=[]
    for agency in args.agencies:
        first,meta=query_page(cache,agency,0,args.refresh);total=first['meta']['total']
        if total>15000:raise RuntimeError(f'{agency}: {total} exceeds official offset ceiling; partition criteria first')
        manifest.append(meta)
        for p in first['results']:
            p['_retrievedAt']=meta['retrievedAt'];projects[str(p['appl_id'])]=p
        print(f'{agency}: {total} projects; first page cached',flush=True)
        for offset in range(500,total,500):
            data,meta=query_page(cache,agency,offset,args.refresh);manifest.append(meta)
            if not data['results']:raise RuntimeError(f'unexpected empty page {agency} {offset}')
            for p in data['results']:
                p['_retrievedAt']=meta['retrievedAt'];projects[str(p['appl_id'])]=p
        print(f'{agency} complete; {len(projects)} unique project records so far',flush=True)
        # Checkpoint stays in scratch/cache and is reproducible from official pages.
        (cache/'progress.json').write_text(json.dumps({'agency':agency,'uniqueProjects':len(projects),'pages':len(manifest)}))
    build(projects,manifest,args)

if __name__=='__main__':main()
