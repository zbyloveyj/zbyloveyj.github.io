#!/usr/bin/env python3
"""Join public evidence to the catalog; exact ISSN first, unique names only for CAS.

No statistical surrogate is converted into JIF, no missing number becomes zero,
and a publication duration is never converted into a first-decision duration.
"""
from pathlib import Path
import argparse
import collections
import gzip
import json
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[1]

def norm_name(s):
    return ''.join(c for c in unicodedata.normalize('NFKC', str(s)).casefold() if c.isalnum())

def unique(items):
    seen=set()
    result=[]
    for item in items:
        key=json.dumps(item,ensure_ascii=False,sort_keys=True)
        if key not in seen:
            result.append(item)
            seen.add(key)
    return result

def write_json(path, obj):
    text=json.dumps(obj,ensure_ascii=False,separators=(',',':'),allow_nan=False)
    temp=path.with_suffix(path.suffix+'.tmp')
    temp.write_text(text,encoding='utf-8')
    temp.replace(path)

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--data-dir',type=Path,default=ROOT/'data')
    ap.add_argument('--doaj',type=Path)
    args=ap.parse_args()
    data=args.data_dir
    catalog=json.loads((data/'catalog.json').read_text())
    metric_path=data/'metric-evidence.json'
    evidence=json.loads(metric_path.read_text() if metric_path.exists() else gzip.decompress(metric_path.with_suffix('.json.gz').read_bytes()))
    publisher=json.loads((data/'publisher-evidence.json').read_text())
    doaj=json.loads(args.doaj.read_text()) if args.doaj else {'metadata':{},'journals':[]}
    sources=evidence['sources']
    checked=evidence['checkedAt']
    index={x['id']:x for x in catalog['journals']}
    by_issn={issn:x['id'] for x in catalog['journals'] for issn in x['issns']}
    name_ids=collections.defaultdict(set)
    for s in catalog['journals']:
        name_ids[norm_name(s['name'])].add(s['id'])
    # A PDF title fragment must never become a CAS identity alias.
    cas_name_ids={key:set(ids) for key,ids in name_ids.items()}
    for row in publisher['journals']:
        ids={by_issn[i] for i in row.get('issns',[]) if i in by_issn}
        if len(ids)==1:
            cas_name_ids.setdefault(norm_name(row['name']),set()).update(ids)
    updates=collections.defaultdict(dict)
    audit={'checkedAt':checked,'matched':{},'ambiguous':{},'unmatched':{},'publisherJifConflicts':[]}

    # A source can incorrectly merge distinct titles/ISSN families upstream.
    # Detect this from complete independent JCR title cells before joining metrics.
    identity_groups=collections.defaultdict(dict)
    for row in evidence['jcr']:
        ids={by_issn[i] for i in row['issns'] if i in by_issn}
        if len(ids)!=1:continue
        jid=next(iter(ids)); key=norm_name(row['name'])
        group=identity_groups[jid].setdefault(key,{'names':set(),'issns':set(),'pages':set()})
        group['names'].add(row['name']);group['issns'].update(row['issns']);group['pages'].add(row['page'])
    identity_guard={}
    for jid,groups in identity_groups.items():
        values=list(groups.values())
        if not any(a['issns'].isdisjoint(b['issns']) for i,a in enumerate(values) for b in values[i+1:]):continue
        safe=[g for key,g in groups.items() if cas_name_ids.get(key)=={jid}]
        identity_guard[jid]={'catalogTitle':index[jid]['name'],
          'allowedIssns':sorted(set().union(*(g['issns'] for g in safe)) if safe else set()),
          'matchedTitles':sorted(set().union(*(g['names'] for g in safe)) if safe else set()),
          'groups':[{'names':sorted(g['names']),'issns':sorted(g['issns']),'pages':sorted(g['pages'])} for g in values],
          'note':'OpenAlex 将不同刊名或更名前后刊名的 ISSN 归入同一来源；仅采用与完整主刊名一致的指标证据。年度索引量可能混合身份，请另行核实。',
          'source':sources['jcr']['url'],'checkedAt':checked}
    audit['identityReviews']=identity_guard

    def ids_for(issns):
        return {by_issn[i] for i in issns if i in by_issn and
          (by_issn[i] not in identity_guard or i in identity_guard[by_issn[i]]['allowedIssns'])}

    # JCR categories and indexing come from one period-specific snapshot.
    q_match=0
    for row in evidence['jcr']:
        ids=ids_for(row['issns'])
        if len(ids)!=1:
            continue
        jid=next(iter(ids)); q_match+=1
        u=updates[jid]
        u.setdefault('quartiles',[]).append({'system':'JCR','year':2025,'releaseYear':2026,
          'category':row['category'],'quartile':row['quartile'],'source':sources['jcr']['url'],
          'sourceTitle':row['name'],'sourceISSNs':row['issns'],'indexes':row['indexes'],
          'page':row['page'],'checkedAt':checked,'basis':'institutional_JCR_snapshot'})
        for ix in row['indexes']:
            u.setdefault('indexing',[]).append({'name':ix,'status':'listed_in_snapshot','year':2025,
              'sourceDate':'2026-06','source':sources['jcr']['url'],'checkedAt':checked})
        if row['name']:
            name_ids[norm_name(row['name'])].add(jid)
    audit['matched']['jcrCategoryRows']=q_match

    # PDF columns use release years: release 2026 corresponds to metric year 2025.
    jf_match=0
    for row in evidence['jif']:
        ids=ids_for([row['issn']]) if row['issn'] else cas_name_ids.get(norm_name(row['name']),set())
        if len(ids)!=1:
            continue
        jid=next(iter(ids)); jf_match+=1
        u=updates[jid]
        if row['name']:
            name_ids[norm_name(row['name'])].add(jid)
        for year in (2024,2025):
            raw=row.get('jif'+str(year))
            if raw in (None,'N/A'):
                continue
            number=None
            if re.fullmatch(r'\d+(?:\.\d+)?',raw):
                number=float(raw)
            u.setdefault('jif',[]).append({'year':year,'value':number,'display':raw,
              'releaseYear':year+1,'source':sources['jif']['url'],'page':row['page'],
              'sourceTitle':row['name'],'sourceISSN':row['issn'],
              'checkedAt':checked,'basis':'institutional_JCR_transcription'})
    audit['matched']['jifRows']=jf_match

    # Public CAS attachment omits ISSN and subject level. Do not guess either.
    cas_norm=collections.Counter(norm_name(x['name']) for x in evidence['cas'])
    cas_miss=[];cas_amb=[];cas_match=0
    for row in evidence['cas']:
        key=norm_name(row['name']); ids=cas_name_ids.get(key,set())
        if len(ids)!=1 or cas_norm[key]!=1:
            (cas_amb if ids else cas_miss).append(row['name'])
            continue
        jid=next(iter(ids));cas_match+=1
        u=updates[jid]
        u['cas']={'year':2025,'zone':row['zone'],'top':row['top'],'level':'unspecified',
          'source':sources['cas']['url'],'sourceTitle':row['name'],'sourceRow':row['row'],
          'checkedAt':checked,'matchMethod':'unique_normalized_title',
          'note':'高校公开参考表未注明大类/小类，且不含 ISSN；仅唯一规范化刊名匹配。'}
        u.setdefault('quartiles',[]).append({'system':'CAS','year':2025,
          'category':'源表未注明学科层级','quartile':str(row['zone'])+'区','level':'unspecified',
          'source':sources['cas']['url'],'checkedAt':checked,'matchMethod':'unique_normalized_title'})
    audit['matched']['casJournals']=cas_match
    audit['unmatched']['cas']=cas_miss
    audit['ambiguous']['cas']=cas_amb

    # DOAJ data is publisher reported; preserve snapshot and record update dates.
    doaj_by_id=collections.defaultdict(list)
    for row in doaj['journals']:
        ids=ids_for(row.get('issns',[]))
        if len(ids)==1:
            doaj_by_id[next(iter(ids))].append(row)
    doaj_conflicts=[]
    for jid,rows in doaj_by_id.items():
        if len(rows)>1 and len({norm_name(x['name']) for x in rows})>1:
            doaj_conflicts.append({'id':jid,'names':[r['name'] for r in rows]})
            continue
        row=max(rows,key=lambda r:str(r.get('metadataUpdatedAt') or ''))
        # Keep the full compact source record in the detail shard, never in the index.
        updates[jid]['doaj']=row
    audit['matched']['doajJournals']=len(doaj_by_id)-len(doaj_conflicts)
    audit['ambiguous']['doaj']=doaj_conflicts

    unmatched_pub=[]
    for row in publisher['journals']:
        ids=ids_for(row.get('issns',[]))
        if len(ids)!=1:
            unmatched_pub.append(row['name']);continue
        jid=next(iter(ids));u=updates[jid]
        for p in row.get('jif',[]):
            old=[x for x in u.get('jif',[]) if x['year']==p['year']]
            for x in old:
                if x.get('value') is not None and x['value']!=p['value']:
                    audit['publisherJifConflicts'].append({'id':jid,'name':row['name'],'year':p['year'],'institution':x['value'],'publisher':p['value']})
        u['publisherEvidence']=row
    audit['unmatched']['publisher']=unmatched_pub

    counts=collections.Counter()
    for shard in sorted((data/'details').glob('*.json')):
        records=json.loads(shard.read_text())
        for jid,d in records.items():
            u=updates.get(jid,{})
            # This script replaces only its own managed evidence, preserving base metadata.
            # Clear removed or rejected matches too, so reruns cannot preserve stale evidence.
            managed_detail=('jif','quartiles','indexing','cas','doaj','curated','scope','scopeSource',
              'notes','articleTypes','review','acceptance','apc','publicationCounts','submissionCounts',
              'uniqueSubmittingAuthors','jcrRanks','fiveYearJif','sourceConflicts','reportedJif',
              'jifValue','jifYear','jcrYear','jcrByCategory','casZone','casYear','casTop','casLevel',
              'jifConflicts','jifSourceStatements','identityReview')
            for field in managed_detail:d.pop(field,None)
            if jid in identity_guard:
                d['identityReview']=identity_guard[jid]
                d['warnings']=unique(d.get('warnings',[])+[identity_guard[jid]['note']])
            s=index[jid]
            managed_summary=('jifValue','jifYear','jifText','jifByYear','jcrYear','jcrByCategory',
              'jcrCategories','jcrQuartiles','wosIndexes','indexingNames','casZone','casYear',
              'casTop','casLevel','reviewDays','peerReviewDays','publicationDays','publicationStatistic',
              'languages','hasDOAJProfile','apcCharged','apcUSD','hasOtherFees','doajUpdatedAt',
              'hasSubmissionCount','hasAcceptanceRate','curated')
            for field in managed_summary:s.pop(field,None)
            if jid in identity_guard:s['warnings']=unique(s.get('warnings',[])+[identity_guard[jid]['note']])
            if d.get('apcUSD') is not None:s['apcUSD']=d['apcUSD']
            for field in ('jif','quartiles','indexing'):
                if field in u:d[field]=unique(u[field])
            if 'cas' in u:d['cas']=u['cas']
            if 'doaj' in u:d['doaj']=u['doaj']
            pub=u.get('publisherEvidence')
            if pub:
                d['curated']=True
                for key in ('scope','scopeSource','notes','articleTypes','review','acceptance','apc','publicationCounts','submissionCounts','uniqueSubmittingAuthors','jcrRanks','fiveYearJif','sourceConflicts','reportedJif','jifConflicts','jifSourceStatements'):
                    if key in pub:d[key]=pub[key]
                if pub.get('homepage'):d['homepage']=pub['homepage']
                byyear={x['year']:x for x in d.get('jif',[])}
                byyear.update({x['year']:{**x,'releaseYear':x['year']+1,'basis':'publisher'} for x in pub.get('jif',[])})
                d['jif']=sorted(byyear.values(),key=lambda x:x['year'])
                d['indexing']=unique(d.get('indexing',[])+pub.get('indexing',[]))
            if 'doaj' in d:
                dj=d['doaj'];tm=dj.get('publicationTime',{})
                w=tm.get('averageWeeks')
                rev=[r for r in d.get('review',[]) if r.get('basis')!='DOAJ_publisher_report']
                if isinstance(w,(int,float)) and w>0:
                    rev.append({'stage':'submission_to_publication','days':w*7,'originalWeeks':w,
                      'statistic':'publisher_reported_average','period':None,'source':dj.get('doajUrl') or dj.get('source'),
                      'checkedAt':checked,'sourceDate':doaj.get('metadata',{}).get('snapshotAt','2026-09-20'),
                      'recordUpdatedAt':dj.get('metadataUpdatedAt'),'basis':'DOAJ_publisher_report'})
                d['review']=rev
            s['curated']=bool(d.get('curated'))
            jifs=sorted(d.get('jif',[]),key=lambda x:x['year'])
            if jifs:
                last=jifs[-1]
                s['jifValue']=last.get('value');s['jifYear']=last['year'];s['jifText']=last.get('display')
                s['jifByYear']={str(x['year']):x.get('value') for x in jifs}
            q=[x for x in d.get('quartiles',[]) if x['system']=='JCR']
            if q:
                y=max(x['year'] for x in q);q=[x for x in q if x['year']==y]
                s['jcrYear']=y;s['jcrByCategory']={x['category']:x['quartile'] for x in q}
                s['jcrCategories']=sorted(s['jcrByCategory'])
                s['jcrQuartiles']=sorted({x['quartile'] for x in q if x['quartile']})
            s['wosIndexes']=sorted({x['name'] for x in d.get('indexing',[]) if x['name'] in ('SCIE','SSCI','ESCI','AHCI')})
            s['indexingNames']=sorted({x['name'] for x in d.get('indexing',[])})
            if d.get('cas'):
                ca=d['cas'];s.update(casZone=ca['zone'],casYear=ca['year'],casTop=ca['top'],casLevel=ca['level'])
            # Only unqualified first decisions are used for the first-decision filter.
            first=[x for x in d.get('review',[]) if x['stage']=='submission_to_first_decision']
            if first:s['reviewDays']=first[0]['days']
            else:s.pop('reviewDays',None)
            external=[x for x in d.get('review',[]) if x['stage'] in ('first_decision_with_review','submission_to_first_post_review_decision','submission_to_first_decision_after_review')]
            if external:s['peerReviewDays']=external[0]['days']
            publication=[x for x in d.get('review',[]) if x['stage']=='submission_to_publication']
            if publication:
                # Prefer recent explicit publisher statistics; DOAJ remains a separate detail row.
                best=next((x for x in publication if x.get('basis')!='DOAJ_publisher_report'),publication[0])
                s['publicationDays']=best['days'];s['publicationStatistic']=best['statistic']
            dj=d.get('doaj')
            if dj:
                s['languages']=dj.get('languages',[])
                s['hasDOAJProfile']=True
                a=dj.get('apc',{});s['apcCharged']=a.get('charged')
                for price in a.get('prices',[]):
                    if price.get('currency')=='USD':s['apcUSD']=price.get('amount',price.get('value'))
                s['hasOtherFees']=dj.get('otherFees',{}).get('charged')
                s['doajUpdatedAt']=dj.get('metadataUpdatedAt')
            if d.get('apc'):
                for price in d['apc']:
                    if price.get('currency')=='USD':s['apcUSD']=price.get('value',price.get('amount'))
            if d.get('submissionCounts'):s['hasSubmissionCount']=True
            if d.get('acceptance'):s['hasAcceptanceRate']=True
            d.update({k:s[k] for k in ('jifValue','jifYear','jcrYear','jcrByCategory','casZone','casYear','casTop','casLevel','curated') if k in s})
            for key,truth in {
                'jifJournals':bool(jifs),'numericJifJournals':any(x.get('value') is not None for x in jifs),
                'jifTrendJournals':sum(x.get('value') is not None for x in jifs)>=2,
                'jcrJournals':bool(q),'casJournals':bool(d.get('cas')),'curatedJournals':bool(d.get('curated')),
                'doajProfiles':bool(dj),'reviewJournals':bool(d.get('review')),'publisherReviewJournals':bool(pub and pub.get('review')),
                'submissionCountJournals':bool(d.get('submissionCounts')),'acceptanceRateJournals':bool(d.get('acceptance')),
                'publisherPublicationCountJournals':bool(d.get('publicationCounts')),'apcDeclaredJournals':bool(dj and dj.get('apc',{}).get('charged') is not None)
            }.items():
                if truth:counts[key]+=1
        write_json(shard,records)
    catalog['meta']['enrichment']=dict(counts)
    catalog['meta']['jifYears']=[2024,2025]
    catalog['meta']['jcrMetricYear']=2025
    catalog['meta']['jcrReleaseYear']=2026
    catalog['meta']['casEditionYear']=2025
    catalog['meta']['casLevel']='unspecified_in_institutional_source'
    catalog['meta']['metricSources']=sources
    catalog['meta']['doajSnapshot']=doaj.get('metadata',{})
    # The license belongs to each component; OpenAlex CC0 does not license other sources.
    catalog['meta']['license']='Component-specific; see data sources'
    catalog['meta']['coverageNote']=f"{len(index):,} 条跨学科期刊候选；各指标的覆盖率分别披露。新刊、小刊、缺少 ISSN 或近期索引记录的期刊可能未纳入。不是征稿白名单。"
    write_json(data/'catalog.json',catalog)
    meta=json.loads((data/'catalog-meta.json').read_text())
    meta.update(catalog['meta'])
    write_json(data/'catalog-meta.json',meta)
    audit['coverage']=dict(counts)
    write_json(data/'enrichment-audit.json',audit)
    print(json.dumps({'coverage':dict(counts),'matched':audit['matched'],'publisherJifConflicts':audit['publisherJifConflicts'],'unmatchedPublishers':unmatched_pub,'casAmbiguous':len(cas_amb)},ensure_ascii=False))

if __name__=='__main__':main()
