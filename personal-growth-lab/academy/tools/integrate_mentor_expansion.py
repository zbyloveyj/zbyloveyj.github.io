#!/usr/bin/env python3
"""Merge reviewed profiles, UCAS programme entries and bounded NIH project data.

Use an immutable complete baseline and reviewed input files. This is an editorial
build, not a scheduled process that overwrites the published catalogue.
"""
import argparse
import collections
import copy
import gzip
import hashlib
import json
import re
import unicodedata
from pathlib import Path
from urllib.parse import urlsplit
from lab_data import write_catalog

AXES = ('domains', 'methods', 'diseases', 'modalities', 'researchScales', 'studyDesigns')
EDITION = '2026.10.21-mentor-v7'
DATE = '2026-10-21'
COUNTRY = {'中国大陆':'中国','中国台湾':'中国（台湾）','中国香港':'中国（香港）'}
UCAS = 'https://sais.ucas.ac.cn/index.php/zh/szdw/rhjs'


def unique(items):
    return list(dict.fromkeys(item for item in items if item))


def read_json(path):
    raw=path.read_bytes()
    return json.loads(gzip.decompress(raw) if path.suffix=='.gz' else raw)


def norm(value):
    value = ''.join(c for c in unicodedata.normalize('NFKD', value or '') if not unicodedata.combining(c))
    return re.sub(r'[^\w]', '', value.lower())


def person_tokens(value):
    value = re.sub(r'\b(?:ph\.?d\.?|m\.?d\.?|professor|prof\.?|dr\.?)\b', '', value, flags=re.I)
    value = unicodedata.normalize('NFKD', value)
    return re.findall('[a-z]+', value.lower())


def urlkey(url):
    p = urlsplit(url)
    return (p.hostname or '').removeprefix('www.').replace('ucas.edu.cn','ucas.ac.cn') + p.path.rstrip('/') + '?' + p.query


ORG_ALIASES = {
    'MIT':'Massachusetts Institute of Technology',
    'University of California San Francisco':'University of California, San Francisco',
    'University of California San Diego':'University of California, San Diego',
    'University of California Los Angeles':'University of California, Los Angeles',
    'University of California Berkeley':'University of California, Berkeley',
    'University of California Davis':'University of California, Davis',
    'University of California Irvine':'University of California, Irvine',
    'University of California Santa Barbara':'University of California, Santa Barbara',
    'University of California Santa Cruz':'University of California, Santa Cruz',
    'University of Wisconsin-Madison':'University of Wisconsin Madison',
    'University of North Carolina at Chapel Hill':'University of North Carolina Chapel Hill',
    'The University of Texas at Austin':'University of Texas Austin',
    'University of Texas at Austin':'University of Texas Austin',
    'University of Texas Southwestern Medical Center':'University of Texas Southwestern Med Ctr',
    'The Ohio State University':'Ohio State University',
    'The Pennsylvania State University':'Pennsylvania State University',
    'University of Pennsylvania':'University of Pennsylvania',
    'Washington University in St Louis':'Washington University',
    'Washington University in St. Louis':'Washington University',
    'Weill Cornell Medicine':'Weill Medical Coll of Cornell Univ',
    'Cornell University Weill Cornell Medicine':'Weill Medical Coll of Cornell Univ',
    'Harvard Medical School':'Harvard University',
    'Memorial Sloan Kettering':'Sloan-Kettering Institute for Cancer Res',
    'Memorial Sloan Kettering Cancer Center':'Sloan-Kettering Institute for Cancer Res',
    'UCL':'University College London',
    'University of Oxford':'University of Oxford',
    'King’s College London':'Kings College London',
    'University of Washington Seattle':'University of Washington',
    'New York University School of Medicine':'New York University School of Medicine',
}
ORG_MAP = {norm(k): norm(v) for k,v in ORG_ALIASES.items()}


def orgkey(value):
    key = norm(value)
    key = ORG_MAP.get(key, key)
    return key.removeprefix('the')


def orgkeys(lab):
    raw = [lab.get('institution',''), lab.get('institutionKey','')]
    raw += [a.get('institution','') for a in lab.get('affiliations',[])]
    parts=[]
    for value in raw:
        parts.extend([value, value.split(' · ')[0], value.split(', School')[0]])
        parts.extend(re.split(r'\s/\s', value))
    return {orgkey(s) for s in parts if s}


def exact_person_name(a,b):
    """Missing middle names/initials are not affirmative identity evidence."""
    a,b=person_tokens(a),person_tokens(b)
    return len(a)>=2 and a==b


def add_source(lab, source):
    old=next((s for s in lab['sources'] if s['url']==source['url']),None)
    if old is None:
        lab['sources'].append(source)
    elif source['kind']=='research_profile' and old['kind'] in ('profile','official','research_profile'):
        old.update(source)


def add_evidence(lab, evidence):
    known={(e['dimension'],e['url'],e['summary']) for e in lab['assessmentEvidence']}
    for row in evidence:
        key=(row['dimension'],row['url'],row['summary'])
        if key not in known:
            lab['assessmentEvidence'].append(row);known.add(key)


def append_facets(lab, facets):
    for axis in AXES:
        incoming=facets.get(axis,[])
        if axis=='domains':
            incoming=['AI虚拟细胞（AIVC）' if value=='AI虚拟细胞' else value for value in incoming]
        lab['facets'][axis]=unique(lab['facets'].get(axis,[])+incoming)
    lab['directions']=unique(lab['directions']+lab['facets']['domains'])
    lab['facets']['domains']=lab['directions'][:]


def empty_record(stable,name,country,institution,url,level):
    return {'id':stable,'name':name,'country':COUNTRY.get(country,country),
        'institution':institution,'institutionKey':institution,'profileUrl':url,
        'directions':[],'tier':'D','evidenceLevel':level,'candidateStatus':'long_term',
        'roleStatus':'unknown','verifiedAt':DATE,
        'opportunity':{'status':'unknown','verifiedAt':None,'url':url},
        'papers':[],'sources':[],'facets':{a:[] for a in AXES},'assessmentEvidence':[],
        'firstIncludedEdition':EDITION}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline',type=Path,required=True)
    parser.add_argument('--sources',type=Path,required=True)
    parser.add_argument('--profiles',type=Path,required=True)
    parser.add_argument('--ucas',type=Path,required=True)
    parser.add_argument('--nih',type=Path,required=True)
    parser.add_argument('--identity-review',type=Path,
        help='Optional reviewed cross-source blocked NIH profile IDs and current-role patches.')
    parser.add_argument('--output-dir',type=Path,required=True)
    parser.add_argument('--report',type=Path,required=True)
    args=parser.parse_args()
    data=json.loads(args.baseline.read_text())
    if data.get('dataParts'):
        raise ValueError('Export a complete standalone baseline with lab_data.py first.')
    labs=data['labs'];baseline_ids={l['id'] for l in labs};by_id={l['id']:l for l in labs}
    old_edition=data['edition'];enriched=set();new_ids=[];identity=[];held=[]
    original_counts=dict(collections.Counter(l['evidenceLevel'] for l in labs))
    manifest=json.loads(args.sources.read_text())
    source_map={s['url']:s for s in manifest['sources']}
    identity_review=json.loads(args.identity_review.read_text()) if args.identity_review else {}
    blocked_nih_ids={str(value) for value in identity_review.get('blockedCrossSourceIds',[])}
    allowed_nih_matches={str(entry['nihProfileId']):entry
                         for entry in identity_review.get('allowedCrossSourceMatches',[])}
    project_overrides={int(entry['projectId']):entry
                       for entry in identity_review.get('projectTagOverrides',[])}
    profiles=json.loads(args.profiles.read_text())['profiles']
    for row in profiles:
        lab=by_id[row['id']]
        if lab['name']!=row['name']:
            raise ValueError('Profile enrichment changed a stable identity')
        prior_level=lab['evidenceLevel']
        if lab['evidenceLevel']!='reviewed':
            lab['evidenceLevel']='research_profile'
            for key in ('profileUrl','question','researchSummary','researchModels','profileVerifiedAt','profileScope','evidenceScope','fieldBasis','affiliationNote'):
                if key in row:lab[key]=row[key]
        # The personal page can correct a broad directory's department label.
        if 'Westlake' in lab['institution'] and row.get('verification',{}).get('sourceAffiliation'):
            lab['institution']='Westlake University · '+row['verification']['sourceAffiliation']
            lab['institutionKey']='西湖大学'
        lab['aliases']=unique(lab.get('aliases',[])+row.get('aliases',[]))
        if prior_level=='official_directory':
            # A read individual profile supersedes inherited broad directory
            # tags. Keep the earlier classifications only as audit history;
            # deliberately unreviewed axes stay empty rather than being filled
            # from institution-level labels.
            lab['priorDirectoryDirections']=lab['directions'][:]
            lab['priorDirectoryFacets']=copy.deepcopy(lab['facets'])
            lab['directions']=[]
            lab['facets']={axis:[] for axis in AXES}
        append_facets(lab,{**row['facets'],'domains':unique(row['directions']+row['facets']['domains'])})
        for index,s in enumerate(row['sourceEvidence']):
            source={**s,'kind':'research_profile' if index==0 else 'identity'}
            add_source(lab,source)
            source_map.setdefault(s['url'],{'url':s['url'],'title':s['label'],'kind':source['kind'],
                'verifiedAt':s['verifiedAt'],'readMethod':'official_individual_page',
                **({'retrievedAt':row['verification']['fetchedAt'],'sha256':row['verification']['sourceSha256']} if index==0 else {})})
        add_evidence(lab,row['assessmentEvidence'])
        enriched.add(lab['id'])

    by_url=collections.defaultdict(dict);by_name=collections.defaultdict(dict)
    for lab in labs:
        for url in unique([lab['profileUrl']]+[s['url'] for s in lab['sources'] if s['kind'] not in ('directory','historical')]):
            by_url[urlkey(url)][lab['id']]=lab
        for name in unique([lab['name']]+lab.get('aliases',[])):
            by_name[norm(name)][lab['id']]=lab
    ucas=json.loads(args.ucas.read_text());ucas_new=ucas_existing=0
    for row in ucas['records']:
        unit=row['institution']
        if unit.startswith('中国科学院') and '大学' not in unit and unit.endswith('学院'):
            unit=unit.replace('中国科学院','中国科学院大学',1)
        matches=by_url[urlkey(row['profileUrl'])] if row['profileUrl']!=UCAS else {}
        basis='official directory name and the same dedicated profile URL'
        if len(matches)!=1:
            short=unit.replace('中国科学院','')
            matches={k:l for k,l in by_name[norm(row['name'])].items() if
                short in l['institution'] or l['institution'].replace('中国科学院','') in unit}
            basis='exact Chinese name and a unique matching official institute; no conflicting identity'
        if len(matches)>1:
            held.append({'source':'UCAS','name':row['name'],'institution':unit,'reason':'ambiguous existing same-name profiles','ids':list(matches)})
            continue
        lab=next(iter(matches.values()),None)
        if lab is None:
            stable='ucas-'+hashlib.sha256((row['name']+'|'+unit).encode()).hexdigest()[:12]
            lab=empty_record(stable,row['name'],'中国',unit,row['profileUrl'],'official_directory')
            lab.update(role='国科大交叉学院选题库列名导师',recordType='listed_supervisor',
                directoryVerifiedAt=DATE,evidenceScope=row['evidenceScope'],
                question='交叉培养选题：'+'、'.join(row['tracks'])+'；招生学科：'+'、'.join(row['subjects'])+'。具体个人研究问题待补充。')
            labs.append(lab);by_id[stable]=lab;new_ids.append(stable);ucas_new+=1
        else:
            enriched.add(lab['id']);ucas_existing+=1
            identity.append({'source':'UCAS','name':row['name'],'id':lab['id'],'basis':basis})
        tracks=[]
        if '脑机接口' in row['tracks']:tracks.append('脑机接口')
        if '生物制造' in row['tracks']:tracks.append('生物制造')
        if '人工智能' in row['tracks']:tracks.append('人工智能')
        append_facets(lab,{'domains':tracks})
        lab['programmeTracks']=unique(lab.get('programmeTracks',[])+row['tracks'])
        lab['programmeScope']='国科大交叉培养选题关联；不等同个人研究技术已逐项核验。'
        add_source(lab,{'url':UCAS,'label':'国科大交叉学院 · 2026年10月导师选题库',
            'kind':'directory','country':'中国','institution':unit,'verifiedAt':DATE,
            'claim':'列名导师；共同培养单位为'+unit+'；选题关联为'+'、'.join(row['tracks'])+'。当前名额另行确认。',
            'access':'读取官方完整导师表；保留培养项目关联范围'})
    source_map[UCAS]={'url':UCAS,'title':'国科大交叉学院2026年10月选题库导师名单',
        'country':'中国','kind':'directory','retrievedAt':ucas['retrievedAt'],'sha256':ucas['sha256'],
        'verifiedAt':DATE,'extractedCount':len(ucas['records']),'includedCount':ucas_new+ucas_existing,
        'readMethod':'official_directory_table','scope':'脑机接口、生物制造及生物医学相关AI交叉培养选题'}

    # Only a unique exact full name AND exact normalized institutional host
    # can join a project PI to an existing profile. Missing middle names or
    # different middle initials never imply identity. The independent review
    # can block specific ambiguous matches; grant hosts never overwrite a
    # previously documented personal affiliation.
    existing_index=collections.defaultdict(dict)
    for lab in labs:
        for name in unique([lab['name']]+lab.get('aliases',[])):
            tokens=person_tokens(name)
            if len(tokens)>=2:
                existing_index[(tokens[0],tokens[-1])][lab['id']]=lab
    nih=read_json(args.nih)
    nirows=nih.get('records',nih.get('labs',[]));nih_new=nih_existing=0
    merge_evidence={str(pid):entry for entry in nih.get('identityMerges',[])
                    for pid in entry['nihProfileIds']}
    role_updates={str(entry['nihProfileId']):entry
                  for entry in identity_review.get('officialRoleUpdates',[])}
    # Prevent a common first/last name at one host from merging two different PIs.
    incoming_names=collections.defaultdict(set)
    for row in nirows:
        tok=person_tokens(row['name'])
        if len(tok)>=2:incoming_names[(tok[0],tok[-1],orgkey(row['institution']))].add(row['nihProfileId'])
    for row in nirows:
        tok=person_tokens(row['name']);host=orgkey(row['institution']);matches=[]
        approved=allowed_nih_matches.get(str(row['nihProfileId']))
        if len(tok)>=2:
            for lab in existing_index[(tok[0],tok[-1])].values():
                names=[lab['name']]+lab.get('aliases',[])
                if host in orgkeys(lab) and any(exact_person_name(n,row['name']) for n in names):matches.append(lab)
        if approved or len(matches)==1 and len(incoming_names[(tok[0],tok[-1],host)])==1 and str(row['nihProfileId']) not in blocked_nih_ids:
            lab=by_id[approved['existingId']] if approved else matches[0]
            enriched.add(lab['id']);nih_existing+=1
            identity.append({'source':'NIH','name':row['name'],'nihProfileId':row['nihProfileId'],
                'id':lab['id'],'institution':row['institution'],
                'basis':approved['basis'] if approved else 'unique exact normalized full name and identical normalized institution; no conflicting incoming same-name identity; personal affiliation preserved',
                **({'evidenceUrl':approved['evidenceUrl'],'verifiedAt':approved['verifiedAt']} if approved else {})})
        else:
            stable='nih-'+str(row['nihProfileId'])
            lab=empty_record(stable,row['name'],row['country'],row['institution'],
                row.get('url') or row.get('sourceUrl') or row['researchProjects'][0]['url'],'project_record')
            lab.update(role='官方科研项目负责人（含共同PI）',recordType='research_project_pi',
                roleNote='项目单位及PI身份有据；现任主聘、博士指导资格与接收机会待核。',
                profileVerifiedAt=None,directoryVerifiedAt=None,
                evidenceScope='官方科研项目记录；主题自动提取，未逐人完成任职和个人研究复核。')
            labs.append(lab);by_id[stable]=lab;new_ids.append(stable);nih_new+=1
            if matches or len(tok)>=2 and len(incoming_names[(tok[0],tok[-1],host)])>1:
                held.append({'source':'NIH','name':row['name'],'nihProfileId':row['nihProfileId'],
                    'institution':row['institution'],'reason':'identity not automatically merged','ids':[l['id'] for l in matches]})
                if matches:
                    lab['identityReviewNote']='另有相同姓名的既有记录；项目单位不足以确认同人，暂分别保留，待进一步身份核对。'
                    lab['possibleIdentityMatches']=[{'id':other['id'],'name':other['name'],
                        'institution':other['institution']} for other in matches]
        lab.setdefault('nihProfileId',str(row['nihProfileId']))
        lab['nihProfileIds']=unique(lab.get('nihProfileIds',[])+[str(i) for i in row.get('nihProfileIds',[row['nihProfileId']])])
        lab['aliases']=unique(lab.get('aliases',[])+row.get('aliases',[])+([row['name']] if row['name']!=lab['name'] else []))
        append_facets(lab,row['facets'])
        lab['projectVerifiedAt']=DATE
        lab['projectFacetBasis']='项目标题和研究目标句自动提取；待个人研究复核。'
        if lab['evidenceLevel']=='project_record':lab['facetBasis']=lab['projectFacetBasis']
        projects=row.get('researchProjects',row.get('projectEvidence',[]))
        lab['projectsObserved']=row.get('projectsObserved',len(projects))
        public_projects=[];research=[]
        for project in projects:
            url=project['url'];title=project['title'];fy=project.get('fiscalYear')
            override=project_overrides.get(int(project['projectId']))
            if override:
                additions={axis:override.get(axis,[]) for axis in AXES}
                append_facets(lab,additions)
                for axis in AXES:
                    project.setdefault('facets',{})[axis]=unique(project.get('facets',{}).get(axis,[])+additions[axis])
                lab.setdefault('projectTagReviews',[]).append(override)
                research.append({'dimension':'research','summary':override['basis'],
                    'url':url,'verifiedAt':override['verifiedAt'],'basis':'独立审查补充的项目主题，未据此升级个人研究档案'})
            # Titles and curated technical keywords provide concrete reading
            # entrances. Long verbatim grant abstracts remain in local review.
            public={k:project[k] for k in ('projectId','projectNumber','title','url','fiscalYear','activityCode','startDate','endDate','isActiveAtRetrieval','organization','country','retrievedAt','isContactPi') if k in project}
            public_projects.append(public)
            explanation='项目：'+title
            research.append({'dimension':'research','summary':explanation,'url':url,
                'verifiedAt':DATE,'basis':'官方科研项目题目；主题标签由项目目标文本自动提取'})
            if project.get('facets',{}).get('methods'):
                research.append({'dimension':'methods','summary':'项目文本明确的方法：'+'、'.join(project['facets']['methods']),
                    'url':url,'verifiedAt':DATE,'basis':'项目研究目标文本'})
            add_source(lab,{'url':url,'label':'NIH RePORTER · '+str(fy or '')+' · '+str(project.get('projectNumber','')),
                'kind':'project_record','verifiedAt':DATE,'claim':'具名项目负责人和具体研究项目；不代表任职或招生资格。',
                'access':'官方项目API，保留项目标识和读取日期'})
            source_map.setdefault(url,{'url':url,'kind':'project_record','title':title,
                'projectId':project['projectId'],'verifiedAt':DATE,
                'retrievedAt':project.get('retrievedAt') or nih.get('retrievedAt'),
                'readMethod':'official_project_api'})
        lab['projectEvidence']=public_projects
        add_evidence(lab,research)
        if approved:
            url=approved['evidenceUrl']
            add_source(lab,{'url':url,'label':'跨来源同人核对 · '+approved['name'],'kind':'identity',
                'verifiedAt':approved['verifiedAt'],'claim':approved['basis'],
                'access':'官方个人资料或具名官方报道的针对性身份核对'})
            source_map.setdefault(url,{'url':url,'title':approved['name']+' · 跨来源身份核对',
                'kind':'identity','verifiedAt':approved['verifiedAt'],'readMethod':'official_identity_check'})
        if lab['evidenceLevel']=='project_record':
            lab['question']=projects[0]['title']
            lab['researchSummary']='项目题目：'+'；'.join(project['title'] for project in projects)
            lab['researchSummarySource']=projects[0]['url']
        elif not lab.get('researchSummary') and not lab.get('question'):
            lab['question']=projects[0]['title']
        for pid in lab['nihProfileIds']:
            entry=merge_evidence.get(pid)
            if entry:
                url=entry['sourceUrl']
                add_source(lab,{'url':url,'label':'重复项目档案的身份核对依据','kind':'identity',
                    'verifiedAt':entry['reviewedAt'],'claim':entry['basis'],
                    'access':'官方身份页或同一核心项目记录核对'})
                source_map.setdefault(url,{'url':url,'title':entry['name']+' · 身份核对',
                    'kind':'identity','verifiedAt':entry['reviewedAt'],'readMethod':'official_identity_check'})
            current=role_updates.get(pid)
            if current:
                url=current['profileUrl']
                lab['currentAppointment']={k:current[k] for k in ('institution','role','profileUrl','verifiedAt','note')}
                if lab['evidenceLevel']=='project_record':
                    lab['role']=current['role'];lab['roleStatus']='current';lab['roleVerifiedAt']=current['verifiedAt']
                    lab['roleNote']='已另核对现任：'+current['institution']+' · '+current['role']+'。'+current['note']+' 博士指导资格和接收机会待核。'
                    lab['affiliations']=[{'institution':current['institution'],'country':lab['country'],
                        'url':url,'type':'official_current_appointment','note':'另据当前官网核对的任职；主卡机构仍列项目依托单位。'}]
                add_source(lab,{'url':url,'label':'现任职位核对 · '+current['name'],'kind':'identity',
                    'verifiedAt':current['verifiedAt'],'claim':current['role']+' · '+current['institution'],
                    'access':'官方现任职务信息核对，未据此推断招生资格'})
                source_map.setdefault(url,{'url':url,'title':current['name']+' · 现任职位',
                    'kind':'identity','verifiedAt':current['verifiedAt'],'readMethod':'official_identity_check'})

    for stable in enriched:
        if stable in baseline_ids:by_id[stable]['lastEnrichedEdition']=EDITION
    counts=collections.Counter(l['evidenceLevel'] for l in labs)
    data.update(edition=EDITION,verifiedAt=DATE,
        scope=f'{len(labs)}条研究者/团队候选；{counts["official_directory"]}条官方名录、{counts["project_record"]}条科研项目证据、{counts["research_profile"]}份个人资料、{counts["reviewed"]}张适配卡。候选身份与当前接收机会分别核验。')
    data['latestExpansion']={'edition':EDITION,'previousEdition':old_edition,'date':DATE,
        'baselineCount':len(baseline_ids),'newCount':len(new_ids),'enrichedCount':len(enriched & baseline_ids),
        'personalProfilesEnriched':len(profiles),'ucasNew':ucas_new,'ucasEnriched':ucas_existing,
        'projectNew':nih_new,'projectEnriched':nih_existing}
    data['projectCollection']={'source':nih['source'],'retrievedAt':nih['retrievedAt'],
        'uniqueProjectsFetched':nih['stats']['uniqueProjectsFetched'],'includedPiRecords':len(nirows),
        'displayedProjectsPerPerson':nih['methodology']['projectsPerPersonDisplayed'],
        'scope':'本轮相关活跃科研项目的具名PI；项目数量不代表其全部科研产出或经费。',
        'documentation':nih['methodology']['documentation']}
    data['methodology'][1]=f'四类证据：官方目录{counts["official_directory"]}条，科研项目{counts["project_record"]}条，个人研究资料{counts["research_profile"]}份，代表作与适配卡{counts["reviewed"]}张。项目负责人不等于已确认的博士导师。'
    data['methodology'] += [
        '主导航合并为6个领域，具体方向按同义与相近标签分组。跨学科记录可属于多个主类，各类人数不能相加当作总人数。原始标签和证据保留。',
        'NIH项目候选仅选来源标记活跃、项目结束日未过、研究内容明确相关的独立科研项目负责人；不纳入F/K/T等培养项目及明确学生、博士后、行政支持身份。项目依托单位不自动等同现任主聘。',
        '科研项目主题由项目题目及研究目标句提取，并做歧义规则检查；这不是逐人阅读全文、审阅全部成果或确认导师资格。项目主题和具体题目用于进一步核查。',
        'NIH先按profile_id去重并合并有明确依据的重复档案；跨来源要求完整姓名及机构对应且无同名冲突，中间名缺失不视为同人证据，疑点保留待核。此轮新增主要来自美国科研项目，不能视为各国覆盖已经均衡或全球齐全。',
        '国科大目录记录的是选题库导师与共同培养单位关联；交叉培养方向不自动证明个人掌握全部相关技术，当前名额另行确认。',
        '全库采用带版本、数量与校验码的分片。必须全部加载成功后才显示完整统计；失败可重试，已有私人笔记仍保存在浏览器。']
    data['history'].append({'date':DATE,'type':'taxonomy-and-project-expansion',
        'summary':f'由{len(baseline_ids)}条扩充至{len(labs)}条，净增{len(new_ids)}条；补充{len(enriched & baseline_ids)}条已有资料，其中154份个人研究档案。主导航合并为6领域，补充国科大交叉培养导师与官方具名科研项目证据。'})
    manifest.update(edition=EDITION,sources=list(source_map.values()))
    args.output_dir.mkdir(parents=True,exist_ok=True)
    (args.output_dir/'lab-sources.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n')
    main_file,written=write_catalog(data,args.output_dir)
    report={'edition':EDITION,'baseline':len(baseline_ids),'total':len(labs),'ratio':len(labs)/len(baseline_ids),
        'baselineEvidence':original_counts,'evidence':dict(counts),'expansion':data['latestExpansion'],
        'countries':dict(collections.Counter(l['country'] for l in labs)),
        'sourceCount':len(source_map),'parts':len(main_file['dataParts']),
        'identityResolutions':identity,'unmergedIdentityReview':held,
        'baselineIdsPreserved':baseline_ids.issubset(by_id),
        'currentAppointmentsApplied':sum(bool(lab.get('currentAppointment')) for lab in labs),
        'projectManualReviewRecords':sum(bool(lab.get('projectTagReviews')) for lab in labs),
        'inputs':[{'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
            for path in (args.baseline,args.sources,args.profiles,args.ucas,args.nih,args.identity_review) if path],
        'rawBytes':sum(p['bytes'] for p in main_file['dataParts']),
        'compressedBytes':sum(p['compressedBytes'] for p in main_file['dataParts'])}
    args.report.parent.mkdir(parents=True,exist_ok=True)
    args.report.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ('identityResolutions','unmergedIdentityReview')},ensure_ascii=False,indent=2))


if __name__=='__main__':
    main()
