#!/usr/bin/env python3
"""Merge manually reviewed research profiles without treating openings as eligibility.

This is an editorial build step, not a crawler. Every input claim must have been
checked against the cited source. Ambiguous identities stop automatic merging.
Pass an immutable base snapshot when rebuilding the same reviewed batch.
"""
import argparse, copy, hashlib, json, re, unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

AXES=('domains','methods','diseases','modalities','researchScales','studyDesigns')
DIMS=('research','methods','outputs','resources','translation','collaboration','training')
LABELS={'研究问题':'research','研究方向':'research','方法':'methods','方法与技术':'methods','代表成果':'outputs','代表贡献':'outputs','开放资源':'resources','转化':'translation','临床转化':'translation','跨学科合作':'collaboration','培养':'training','培养与申请':'training'}
ALIASES={
 'domains':{'医学AI':'医学人工智能','医疗AI':'医学人工智能','AI医学':'医学人工智能','人工智能医学':'医学人工智能','医疗人工智能':'医学人工智能','计算精神病':'计算精神病学','计算精神医学':'计算精神病学','数字精神病学':'数字精神医学','数字精神医疗':'数字精神医学','肠-脑轴':'肠脑轴','微生物-肠-脑轴':'肠脑轴','微生物组-肠-脑轴':'肠脑轴','神经免疫学':'神经免疫','微生物生态学':'微生物生态','宿主微生物互作':'宿主-微生物互作','代谢组':'代谢组学','AI for Biology':'AI for Biology'},
 'methods':{'宏基因组分析':'宏基因组学','宏基因组测序':'宏基因组学','计算模型':'计算建模','数学/计算建模':'计算建模','强化学习建模':'强化学习','机器学习/深度学习':'机器学习与深度学习','深度神经网络':'深度学习','多组学分析':'多组学整合','贝叶斯模型':'贝叶斯建模','贝叶斯推断':'贝叶斯建模'},
 'diseases':{'抑郁障碍':'抑郁症','抑郁':'抑郁症','自闭症谱系障碍':'自闭症','精神分裂症/精神病':'精神病与精神分裂症','阿尔茨海默氏病':'阿尔茨海默病','阿尔茨海默症':'阿尔茨海默病','帕金森氏病':'帕金森病','肥胖症':'肥胖','IBD':'炎症性肠病','炎症性肠病（IBD）':'炎症性肠病','癌症':'肿瘤','癌症/肿瘤':'肿瘤','衰老与老化':'衰老'},
 'modalities':{'电子健康记录':'电子病历','电子医疗记录':'电子病历','EHR':'电子病历','电子健康记录（EHR）':'电子病历','脑电':'EEG','脑电图':'EEG','脑磁图':'MEG','功能磁共振':'fMRI','功能磁共振成像':'fMRI','磁共振成像':'MRI','计算机断层扫描':'CT','病理图像':'病理影像','组织病理图像':'病理影像','基因组数据':'基因组','转录组数据':'转录组','代谢组数据':'代谢组','宏基因组数据':'宏基因组','行为任务数据':'行为数据'},
 'researchScales':{'细胞水平':'细胞','个体水平':'个体','群体水平':'人群','人群队列':'人群','分子水平':'分子','微生物群':'微生物群落'},
 'studyDesigns':{'临床队列':'队列研究','纵向队列':'纵向研究','动物模型':'动物实验','人体研究':'人类研究','方法学开发':'方法开发','计算方法开发':'方法开发'}
}
LEGACY_FACETS={
 'chang':(['神经解码','神经电生理'],['瘫痪'],['ECoG','微电极记录'],['神经回路','人类'],['临床研究']),
 'nptl':(['神经解码','神经电生理'],['瘫痪'],['微电极记录'],['神经回路','人类'],['临床研究']),
 'bassett':(['网络控制理论','图论','连接组分析'],[],['连接组'],['神经回路','全脑'],['计算建模']),
 'woolrich':(['隐马尔可夫模型','生成模型'],[],['fMRI','MEG','EEG'],['全脑'],['方法开发']),
 'behrens':(['计算建模','行为实验'],[],['行为数据','神经电生理'],['神经回路'],['机制研究']),
 'friston':(['贝叶斯建模','动态因果建模','主动推断'],[],['神经影像'],['神经回路','全脑'],['计算建模']),
 'vandeville':(['图信号处理','连接组分析'],[],['fMRI','MEG','EEG'],['全脑'],['方法开发']),
 'micera':(['神经刺激','感觉反馈','神经接口'],[],['神经电生理'],['周围神经','人类'],['人体实验']),
 'lacour':(['微加工','柔性生物电子'],[],[],['材料','组织'],['动物实验','体外实验']),
 'eickhoff':(['机器学习','元分析','脑区分区'],[],['神经影像'],['全脑','人群'],['方法开发']),
 'ritter':(['全脑仿真','连接组分析'],[],['EEG','fMRI','连接组'],['全脑'],['计算建模']),
 'bethge':(['深度学习','持续学习','域泛化'],[],['神经数据'],[],['模型评估']),
 'marquand':(['常模建模','贝叶斯建模'],['精神疾病'],['神经影像','行为数据'],['个体','人群'],['方法开发']),
 'vangerven':(['深度学习','动力系统建模'],[],['神经数据','行为数据'],['神经回路'],['计算建模']),
 'ramsey':(['神经解码','神经接口'],['瘫痪'],['ECoG','fMRI'],['人类'],['纵向研究','临床研究']),
 'theis':(['单细胞分析','多组学整合','扰动预测'],[],['单细胞转录组','空间组学','多组学'],['细胞'],['方法开发','模型评估']),
 'stegle':(['多组学整合','因果推断','CRISPR扰动'],[],['单细胞转录组','空间组学','多组学'],['细胞'],['扰动实验','方法开发']),
 'teichmann':(['单细胞分析','细胞图谱构建','扰动预测评估'],[],['单细胞转录组','空间转录组'],['细胞','组织'],['图谱构建','模型评估'])
}
# Explicit editorial identity resolution, never a first/last-name-only merge.
IDENTITY_OVERRIDES={'Russ Altman':'pi-russ-b-altman-9572d3b0'}
SCOPE_TEXT={
 'official_individual_research':'已读取个人或研究组的官方Research介绍；仅记录可归属于该人的研究、方法与成果，接收名额另行核验。',
 'official_individual_research_within_program':'已读取官方项目页中明确归属于该人的研究说明；并非仅凭项目成员身份推断方向。',
 'official_profile_research':'已逐人阅读官方个人或研究组资料；方法、应用与评价项依据具体文字，缺项留待补充。',
 'official_directory_research':'已核对官方专题目录中该人的身份及个人研究简介；未逐条审阅全部个人主页、论文或接收资格。'
}
SCOPE_TEXT.update({
 'official_individual_research_search_index':'已核对官方个人研究页的可检索研究内容；直接请求被拒绝，未读取该页完整正文。具体标签限于检索实际返回的内容。',
 'official_profile_and_research_output':'结合官方个人资料与明确归属于该人的研究成果核验；不据共同作者列表自动扩充领域。',
 'official_profile_and_lab_research_outputs':'结合官方个人资料与实验室研究成果核验，具体证据按各自出处记录。'
})
# Parent categories are a navigation taxonomy. They do not add scientific claims.
DOMAIN_PARENTS={
 '临床机器学习':['医学人工智能'],'医学影像 AI':['医学人工智能'],'医学影像AI':['医学人工智能'],
 '可信医疗 AI':['医学人工智能'],'可信医疗AI':['医学人工智能'],'临床人工智能':['医学人工智能'],
 '医学基础模型':['医学人工智能'],'计算病理':['医学人工智能'],'AI 药物发现':['医学人工智能','AI for Biology'],
 'AI药物发现':['医学人工智能','AI for Biology'],'眼科AI':['医学人工智能'],'临床自然语言处理':['医学人工智能'],
 '数字精神健康':['数字精神医学'],'单细胞组学':['单细胞与空间组学'],'空间组学':['单细胞与空间组学'],
 '脑细胞图谱':['单细胞与空间组学'],'网络神经科学':['计算神经科学'],
 '土壤微生物组':['微生物组'],'植物微生物组':['微生物组'],'人工智能与精神病学':['医学人工智能']
}
ALIASES['methods'].update({'动态因果模型':'动态因果建模','行为计算建模':'计算建模','神经生理学':'神经电生理','电生理':'神经电生理','临床队列研究':'队列研究','动物疾病建模':'动物疾病模型','机制实验':'机制研究'})
ALIASES['diseases'].update({'ADHD':'注意缺陷多动障碍','PTSD':'创伤后应激障碍','焦虑症':'焦虑障碍','双相情感障碍':'双相障碍'})
ALIASES['modalities'].update({'行为任务':'行为数据','行为':'行为数据','知觉行为任务':'行为数据','认知任务':'行为数据','脑影像':'神经影像','电生理':'神经电生理','全切片病理':'病理影像','组织病理':'病理影像','蛋白组':'蛋白质组','代谢数据':'代谢组','多模态医学影像':'医学影像','可穿戴设备':'可穿戴数据','可穿戴活动记录':'可穿戴数据'})
ALIASES['studyDesigns'].update({'机制实验':'机制研究','动物研究':'动物实验','临床前实验':'临床前研究','临床观察':'观察性研究','临床观察研究':'观察性研究','观察研究':'观察性研究','人群队列':'队列研究','前瞻性队列研究':'前瞻性队列','前瞻性纵向队列':'前瞻性队列','临床人群研究':'人类研究','人群研究':'人类研究'})

def unique(xs):return list(dict.fromkeys(x for x in xs if x))
def namekey(name):
    s=''.join(c for c in unicodedata.normalize('NFKD',name) if not unicodedata.combining(c)).lower()
    s=re.sub(r'\b(ph\.?\s?d|m\.?d|professor|prof|dr|msc|mbbs)\b','',s)
    return ''.join(re.findall(r'\w+',s))
def canon(url):
    p=urlsplit(url);return urlunsplit(('https',p.netloc.lower().removeprefix('www.'),p.path.rstrip('/'),p.query,p.fragment))
def tags(axis,items):return unique(ALIASES.get(axis,{}).get(str(x).strip(),str(x).strip()) for x in items or [])
def source_ok(url):return urlsplit(url).scheme=='https'
def source_proof(provenance,url):return provenance.get(canon(url),provenance.get(canon(url.split('#')[0]),{}))
def read(path):return json.loads(Path(path).read_text())
def write(path,obj):Path(path).parent.mkdir(parents=True,exist_ok=True);Path(path).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
def unknown_opportunity(url,summary=None):
    return {'status':'unknown','summary':summary or '长期方向候选；当前招生、招聘与接收名额尚未核验。没有当前岗位不影响收录。','url':url,'deadline':None,'verifiedAt':None,'visit':'普通博士、访问/联合培养与博士后资格须按机构和项目分别核实；不推断未来一定有名额。'}
def append_evidence(l,rows):
    ev=l.setdefault('assessmentEvidence',[]);seen={(e['dimension'],e['summary'],e['url']) for e in ev}
    for e in rows:
        e=copy.deepcopy(e);e['dimension']=LABELS.get(e['dimension'],e['dimension'])
        if e['dimension'] not in DIMS or not e.get('summary') or not source_ok(e.get('url','')) or not e.get('verifiedAt'):raise ValueError(('invalid evidence',l['name'],e))
        key=(e['dimension'],e['summary'],e['url'])
        if key not in seen:ev.append(e);seen.add(key)

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--base',required=True);ap.add_argument('--sources',required=True);ap.add_argument('--batches',nargs='+',required=True)
    ap.add_argument('--output',required=True);ap.add_argument('--manifest',required=True);ap.add_argument('--report',required=True)
    ap.add_argument('--provenance',nargs='*',default=[])
    ap.add_argument('--institution-aliases',default=str(Path(__file__).with_name('institution-aliases.json')))
    ap.add_argument('--edition',required=True);ap.add_argument('--date',required=True)
    args=ap.parse_args();data=read(args.base);manifest=read(args.sources);labs=data['labs'];before={l['id'] for l in labs};byid={l['id']:l for l in labs}
    institution_aliases=read(args.institution_aliases) if Path(args.institution_aliases).exists() else {}
    provenance={}
    for path in args.provenance:
        for source in read(path):
            if not source_ok(source.get('url','')) or not source.get('readMethod'):raise ValueError(('invalid provenance',source))
            provenance[canon(source['url'])]=source
    old_fields=Counter(t for l in labs for t in l['directions']);new_ids=[];enriched=[];resolutions=[];batch_counts={};role_changes=[]
    for l in labs:
        l['directions']=tags('domains',l['directions']);l.setdefault('facets',{a:[] for a in AXES});l['facets']['domains']=l['directions'][:]
        l.setdefault('assessmentEvidence',[]);l.setdefault('roleStatus','unknown')
        if l['roleStatus']=='unknown' and re.search(r'\b(emeritus|emerita)\b|荣休|名誉教授',l.get('role',''),re.I):l['roleStatus']='emeritus'
        elif l['roleStatus']=='unknown' and re.search(r'\b(professor|principal investigator|group leader)\b|教授|研究员',l.get('role',''),re.I):l['roleStatus']='current'
        l.setdefault('facetBasis','原记录方向来自官方条目或专题目录；细分方法、疾病和数据 / 实验模态尚未逐项补齐。')
        if l['evidenceLevel']=='reviewed' and not l['assessmentEvidence']:
            refs=l['sources'];research=next((s for s in refs if any(w in s['claim'] for w in ('研究','方向','方法'))),refs[0]);src=research['url'];date=research['verifiedAt']
            rows=[dict(dimension='research',summary=l['question'],url=src,verifiedAt=date,basis='已有详细证据卡结构化整理'),dict(dimension='methods',summary='；'.join(l.get('platforms',[])),url=src,verifiedAt=date,basis='已有详细证据卡结构化整理')]
            rows += [dict(dimension='outputs',summary=p['title']+' — '+p.get('why',''),url=p['url'],verifiedAt=p['verifiedAt'],basis='原代表作证据') for p in l['papers']]
            for s in refs:
                if '开源实现' in s['claim']:rows.append(dict(dimension='resources',summary=s['claim'],url=s['url'],verifiedAt=s['verifiedAt']))
            append_evidence(l,rows)
            for axis,values in zip(AXES[1:],LEGACY_FACETS.get(l['id'],([],[],[],[],[]))):l['facets'][axis]=tags(axis,values)
            l['facetBasis']='细分标签由原有已核验代表作与技术平台整理；保留原内容核验日期。'
    for batch in args.batches:
        rows=read(batch);rows=rows.get('records',rows.get('labs',[])) if isinstance(rows,dict) else rows;batch_counts[Path(batch).name]=len(rows)
        for r in rows:
            if not r.get('name') or not r.get('institution') or not r.get('sourceUrl') or not r.get('verifiedAt'):raise ValueError(('missing required input',r))
            if not source_ok(r['sourceUrl']):raise ValueError(('source must be HTTPS',r['name'],r['sourceUrl']))
            existing=r.get('existingId') or IDENTITY_OVERRIDES.get(r['name']);l=None
            if existing:
                if existing not in byid:raise ValueError(('unknown stable id',existing,r['name']))
                l=byid[existing];resolutions.append({'name':r['name'],'id':existing,'basis':'explicit reviewed identity'})
            if l is None:
                candidates=[x for x in labs if namekey(x['name'])==namekey(r['name']) and canon(x['profileUrl'])==canon(r['url'])]
                if len(candidates)==1:l=candidates[0];resolutions.append({'name':r['name'],'id':l['id'],'basis':'same normalized name and exact personal URL'})
                elif len(candidates)>1:raise ValueError(('ambiguous matching profiles',r['name']))
            directory=r.get('evidenceLevel')=='official_directory' or r.get('deepResearchVerified') is False
            new_level='official_directory' if directory else 'research_profile'
            if l is None:
                slug=re.sub(r'[^a-z0-9]+','-',unicodedata.normalize('NFKD',r['name']).encode('ascii','ignore').decode().lower()).strip('-') or 'researcher'
                stable='pi-'+slug+'-'+hashlib.sha256((namekey(r['name'])+'|'+canon(r['url'])).encode()).hexdigest()[:8]
                if stable in byid:raise ValueError(('unexpected id collision',stable))
                l=dict(id=stable,name=r['name'],country=r['country'],city=r.get('city',''),institution=r['institution'],institutionKey=r['institution'],role=r.get('title',r.get('role','')),directions=[],tier='D',evidenceLevel=new_level,candidateStatus='long_term',profileUrl=r['url'],question=r.get('summary',''),groupName='',verifiedAt=r['verifiedAt'],opportunity=unknown_opportunity(r['url']),papers=[],sources=[],platforms=[],gaps=[],facets={a:[] for a in AXES},assessmentEvidence=[])
                labs.append(l);byid[stable]=l;new_ids.append(stable)
                change=r.get('affiliationChange')
                if change:
                    if not source_ok(change.get('url','')):raise ValueError(('affiliation change needs source',r['name']))
                    l['affiliationNote']=change.get('summary','')
                    status=change.get('previousStatus','former')
                    related={'institution':change.get('previousInstitution',''),'country':change.get('previousCountry',r['country']),'status':status,'note':change.get('summary',''),'url':change.get('relatedUrl',change['url']),'verifiedAt':r['verifiedAt']}
                    l.setdefault('formerAffiliations' if status=='former' else 'affiliations',[]).append(related)
                    role_changes.append({'id':l['id'],'name':r['name'],'from':related['institution'],'to':r['institution'],'relatedStatus':status,'source':change['url']})
            else:
                if l['id'] in before:enriched.append(l['id'])
                if r['name']!=l['name']:l['aliases']=unique(l.get('aliases',[])+[l['name'],r['name']])
                if l['evidenceLevel']!='reviewed' and not directory:l['evidenceLevel']='research_profile'
                change=r.get('affiliationChange')
                if change:
                    if not change.get('url') or not source_ok(change['url']):raise ValueError(('affiliation change needs source',r['name']))
                    old=l['institution'];l.setdefault('formerAffiliations',[]).append({'institution':old,'country':l['country'],'status':'former','note':change.get('summary',''),'url':change['url'],'verifiedAt':r['verifiedAt']})
                    l['affiliations']=[a for a in l.get('affiliations',[]) if a['institution']!=old]
                    for s in l['sources']:
                        if 'upenn.edu' in s['url'] or 'complexsystemsupenn.com' in s['url']:s['claim']='历史任职阶段的资料；当前单位已变更。'+s['claim'];s['kind']='historical';s['label']='历史资料 · '+s['label']
                    l['institution']=r['institution'];l['institutionKey']=r['institution'];l['country']=r['country'];l['city']=r.get('city','');l['profileUrl']=r['url']
                    l['opportunity']=unknown_opportunity(r['url'],'任职单位已变更，原机构接收说明不沿用；当前单位的博士后、访问与联合培养资格须重新核验。')
                    l['affiliationNote']=change.get('summary','')
                    role_changes.append({'id':l['id'],'name':r['name'],'from':old,'to':r['institution'],'source':change['url']})
                elif l['evidenceLevel']!='reviewed':
                    # A detailed primary profile may refine a broad institutional directory.
                    # Do not call an unverified former institution a current affiliation.
                    if l['institution']!=r['institution']:l['affiliationNote']='主机构采用本次个人研究资料；原目录关联保留在来源区，网络或院系名称不能自动解释为独立任职。'
                    l['institution']=r['institution'];l['institutionKey']=r['institution'];l['country']=r['country'];l['city']=r.get('city','');l['profileUrl']=r['url']
                if r.get('summary') and l['evidenceLevel']!='reviewed':l['question']=r['summary']
            l['verifiedAt']=r['verifiedAt'];l['profileVerifiedAt']=r['verifiedAt'] if not directory else l.get('profileVerifiedAt')
            if directory:l['directoryVerifiedAt']=r['verifiedAt']
            if r.get('title') or r.get('role'):l['role']=r.get('title') or r['role']
            if r.get('roleStatus'):l['roleStatus']={'active':'current','emeritus_active':'emeritus'}.get(r['roleStatus'],r['roleStatus'])
            else:l.setdefault('roleStatus','unknown')
            if l['roleStatus'] not in ('current','emeritus','retired','visiting','industry','historical','deceased','unknown'):raise ValueError(('unrecognized role',r['name'],l['roleStatus']))
            if l['roleStatus'] in ('historical','deceased'):l['candidateStatus']='historical';l['opportunity']=unknown_opportunity(r['url'],'历史研究贡献条目，不作为当前接收或未来招生候选。')
            l['aliases']=unique(l.get('aliases',[])+r.get('aliases',[]))
            l['directions']=tags('domains',l['directions']+r.get('fields',[])+r.get('facets',{}).get('domains',[]))
            for a in AXES:l['facets'][a]=tags(a,l['facets'].get(a,[])+r.get('facets',{}).get(a,[]))
            l['facets']['domains']=l['directions'][:]
            raw_scope=r.get('evidenceScope','已读取官方研究资料；缺少的信息继续留待核验。')
            l['evidenceScope']=SCOPE_TEXT.get(raw_scope,raw_scope)
            l['fieldBasis']=l['evidenceScope'];l['facetBasis']='结构化标签依据本条'+('官方个人研究页的搜索索引内容，未读取该页完整正文。' if raw_scope=='official_individual_research_search_index' else '官方专题目录中明确归属于个人的研究简介。' if directory else '个人 / 研究组官方研究介绍。')+'没有记录的维度不代表该能力不存在。'
            for k in ('roleNote','scopeNote','profileLinkStatus','sharedGroup','profileScope','linkedProfileUrl','profileFetchVerifiedAt','recordType'):
                if r.get(k):l[k]=r[k]
            ev=copy.deepcopy(r.get('assessmentEvidence',[]))
            if not any(e['dimension'] in ('research','研究问题') for e in ev) and r.get('summary') and not directory:ev.append(dict(dimension='research',summary=r['summary'],url=r['sourceUrl'],verifiedAt=r['verifiedAt']))
            if r.get('facets',{}).get('methods') and not any(e['dimension'] in ('methods','方法','方法与技术') for e in ev):ev.append(dict(dimension='methods',summary='官方条目明确的方法标签：'+'、'.join(tags('methods',r['facets']['methods']))+'。',url=r['sourceUrl'],verifiedAt=r['verifiedAt'],basis='逐人研究介绍' if not directory else '专题目录中该人研究简介'))
            append_evidence(l,ev)
            needed={r['sourceUrl']:{'label':r.get('sourceTitle',r['name']+' — 官方研究介绍'),'claim':l['evidenceScope'],'kind':'directory' if directory else 'research_profile'}}
            if r.get('roleSourceUrl') and source_ok(r['roleSourceUrl']):needed[r['roleSourceUrl']]={'label':r['name']+' — 官方任职资料','claim':'具体职务与机构归属的核验来源。','kind':'profile'}
            if r['url']!=r['sourceUrl'] and source_ok(r['url']) and source_proof(provenance,r['url']) and r.get('profileLinkStatus') not in ('unavailable','404','directory_fallback'):needed[r['url']]={'label':r['name']+' — 官方身份 / 资料入口','claim':'个人身份及资料入口；研究结论以具体证据来源为准。','kind':'profile'}
            if r.get('affiliationChange'):
                for key in ('url','announcementUrl','relatedUrl'):
                    url=r['affiliationChange'].get(key)
                    if url and url not in needed:
                        needed[url]={'label':r['name']+' — 任职变更依据','claim':r['affiliationChange']['summary'],'kind':'profile'}
                        if key=='relatedUrl':needed[url].update(institution=r['affiliationChange']['previousInstitution'],country=r['affiliationChange'].get('previousCountry',r['country']))
            for e in ev:
                if e['url'] not in needed:needed[e['url']]={'label':r['name']+' — '+dict(research='研究问题',methods='方法',outputs='代表成果',resources='资源',translation='转化',collaboration='合作',training='培养').get(LABELS.get(e['dimension'],e['dimension']),'研究证据'),'claim':e['summary'],'kind':'research_evidence'}
            for url,v in needed.items():
                if any(s['url']==url for s in l['sources']):continue
                method=source_proof(provenance,url).get('readMethod')
                access='已核对官方域名的搜索索引内容；未完整读取该页正文。' if method=='official_domain_search_index' else '已读取官方'+('专题目录' if directory else '个人/研究组资料或原始研究说明')
                l['sources'].append(dict(url=url,verifiedAt=r['verifiedAt'],access=access,**{'country':r.get('sourceCountry',r['country']),'institution':r['institution'],**v}))
            for s in l['sources']:
                if source_proof(provenance,s['url']).get('readMethod')=='official_domain_search_index':s['access']='已核对官方域名的搜索索引内容；未完整读取该页正文。'
    for l in labs:
        parents=[p for d in l['directions'] for p in DOMAIN_PARENTS.get(d,[])]
        if '代谢组学' in l['facets']['methods'] or any(v in l['facets']['modalities'] for v in ('代谢组','脂质组')):parents.append('代谢组学')
        l['directions']=unique(l['directions']+parents);l['facets']['domains']=l['directions'][:]
        if parents:l['taxonomyNote']='上位方向依据细分研究主题归类；代谢组学也包含明确使用代谢组或脂质组数据的交叉团队。具体研究重点以个人介绍为准。'
        for record in [l]+l.get('affiliations',[])+l.get('formerAffiliations',[])+l['sources']:
            if record.get('country')=='中国香港':record['country']='中国（香港）'
        for affiliation in [l]+l.get('affiliations',[]):
            raw=affiliation.get('institution','');key=affiliation.get('institutionKey',raw)
            affiliation['institutionKey']=institution_aliases.get(raw,institution_aliases.get(key,key))
    # Identity audit: report same-name records for editorial resolution, never collapse by name alone.
    groups=defaultdict(list)
    for l in labs:groups[namekey(l['name'])].append(l)
    duplicates=[{'name':g[0]['name'],'records':[{'id':l['id'],'institution':l['institution'],'url':l['profileUrl']} for l in g]} for g in groups.values() if len(g)>1 and any(l['id'] in new_ids for l in g)]
    detailed=sum(l['evidenceLevel']=='reviewed' for l in labs);profiles=sum(l['evidenceLevel']=='research_profile' for l in labs);dirs=len(labs)-detailed-profiles
    data.update(edition=args.edition,verifiedAt=args.date,title='全球科研导师与研究团队长期候选库',scope=f'{len(labs)}条导师 / 团队候选记录；{profiles}份个人研究资料、{detailed}张代表作与适配卡及{dirs}条官方名录。共同带组的导师分别保留，不代表独立实验室数量。当前招聘不作为收录条件。')
    data['evaluationDimensions']={k:v for k,v in zip(DIMS,['研究问题','方法与技术','代表成果','开放资源','实验 / 临床转化','跨学科合作','培养与申请路径'])}
    data['facetAxes']={k:v for k,v in zip(AXES,['研究方向','研究方法','疾病 / 健康问题','数据 / 实验模态','研究尺度','研究设计'])}
    data['methodology'][1]=f'三层证据：{dirs}条官方名录核验、{profiles}份个人研究资料、{detailed}张代表作与适配证据卡。资料覆盖不等于科研实力；任职核验不代表当前有名额。'
    data['methodology'].insert(4,'七项评价分别提供来源：研究问题、方法、代表成果、资源、转化、合作、培养；来源时效另列。缺项代表尚未整理，不凭声誉填满，也不合成导师实力总分。')
    data['methodology'].insert(5,'交叉筛选使用已记录标签。自选权重的匹配率为已匹配权重占全部所选权重的比例，仅反映已知标签覆盖，不表示录取概率或指导质量。')
    data['methodology'].append('收藏、准备阶段与笔记只保存在当前浏览器的独立名单空间；可导出和导入备份，不进入公开数据、CSV或分享链接。')
    summary=f'由{len(before)}条扩充至{len(labs)}条；新增{len(new_ids)}位/组，补充{len(set(enriched))}条已有资料。新增计算精神病学、医学人工智能、神经免疫、代谢组等精细标签，加入六轴交叉筛选、七项证据比较及个人关注笔记。'
    data['history'].append({'date':args.date,'type':'research-depth-expansion','summary':summary})
    # Manifest records only traceable public source metadata, never full scraped pages.
    source_map={s['url']:s for s in manifest['sources']};url_ids=defaultdict(set)
    for l in labs:
        bibliography=[dict(url=p['url'],label=p['title'],kind='research_output',verifiedAt=p['verifiedAt']) for p in l['papers']]
        supplemental=[dict(url=e['url'],label=l['name']+' — '+e['dimension'],kind='research_evidence',verifiedAt=e['verifiedAt']) for e in l['assessmentEvidence']]
        for s in l['sources']+bibliography+supplemental:
            url_ids[s['url']].add(l['id'])
            if s['url'] not in source_map:
                sid='review-'+hashlib.sha256(s['url'].encode()).hexdigest()[:12]
                source_map[s['url']]={'sourceId':sid,'id':sid,'url':s['url'],'title':s['label'],'institution':s.get('institution',l['institution']),'country':s.get('country',l['country']),'kind':s['kind'],'verifiedAt':s['verifiedAt'],'parser':'editorial individual-source review','selector':'Individual Research / About / official profile, or explicitly attributed entry in a specialist directory','timestampOrigin':'actual editorial content review; not HTTP status'}
    for url,s in source_map.items():
        s['includedCount']=len(url_ids[url])
        if s.get('country')=='中国香港':s['country']='中国（香港）'
        proof=source_proof(provenance,url)
        if proof:
            s['provenance']={k:v for k,v in proof.items() if k!='url'}
            s['readMethod']=proof['readMethod']
            if proof.get('reviewedAt'):s['reviewedAt']=proof['reviewedAt']
    manifest.update(edition=args.edition,purpose='官方名录与个人研究证据来源；个人任职、研究资料和接收机会分开核验。',sources=list(source_map.values()))
    fields=Counter(t for l in labs for t in l['directions']);coverage={d:sum(any(e['dimension']==d for e in l['assessmentEvidence']) for l in labs) for d in DIMS}
    report=dict(edition=args.edition,baselineCount=len(before),total=len(labs),newCount=len(new_ids),enrichedCount=len(set(enriched)),newIds=new_ids,enrichedIds=sorted(set(enriched)),batchCounts=batch_counts,evidenceLevels=dict(Counter(l['evidenceLevel'] for l in labs)),roleStatuses=dict(Counter(l['roleStatus'] for l in labs)),dimensions=coverage,facetValues={a:len({v for l in labs for v in l['facets'][a]}) for a in AXES},directions=dict(fields.most_common()),previousDirections=dict(old_fields),identityResolutions=resolutions,potentialDuplicateNames=duplicates,affiliationChanges=role_changes)
    report['countryCount']=len({a['country'] for l in labs for a in [l]+l.get('affiliations',[]) if a.get('country')})
    report['institutionFilterCount']=len({a['institutionKey'] for l in labs for a in [l]+l.get('affiliations',[])})
    report['sourceCount']=len(source_map)
    report['sourceReadMethods']=dict(Counter(s.get('readMethod','previous review metadata') for s in source_map.values()))
    write(args.output,data);write(args.manifest,manifest);write(args.report,report)
    print(json.dumps({k:report[k] for k in ('total','newCount','enrichedCount','evidenceLevels','dimensions','facetValues','potentialDuplicateNames')},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
