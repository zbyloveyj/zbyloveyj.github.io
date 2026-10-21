#!/usr/bin/env python3
"""Validate journal identities, evidence semantics, summary/detail joins and coverage.

Standard library only; read-only unless --report is explicitly supplied.
This validator rejects ambiguous CAS title joins and duplicate JIF years, even
when an arbitrary last-write summary happens to look internally consistent.
"""
from __future__ import annotations
import argparse
import collections
import json
import math
from pathlib import Path
import re
import sys
import unicodedata

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def norm(value):
    return ''.join(c for c in unicodedata.normalize('NFKC',str(value)).casefold() if c.isalnum())


def numeric(value):
    return not isinstance(value,bool) and isinstance(value,(int,float)) and math.isfinite(value)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir',type=Path,default=ROOT/'data')
    parser.add_argument('--report',type=Path)
    args=parser.parse_args()
    data=args.data_dir
    catalog=read(data/'catalog.json')
    evidence=read(data/'metric-evidence.json') if (data/'metric-evidence.json').exists() else {}
    publishers=read(data/'publisher-evidence.json').get('journals',[]) if (data/'publisher-evidence.json').exists() else []
    errors=collections.defaultdict(list)
    warnings=collections.defaultdict(list)
    counts=collections.Counter()
    index={}
    issn_ids=collections.defaultdict(set)
    safe_names=collections.defaultdict(set)
    for row in catalog['journals']:
        jid=row.get('id')
        if jid in index:errors['duplicate_source_id'].append(jid)
        index[jid]=row
        safe_names[norm(row.get('name'))].add(jid)
        for issn in row.get('issns',[]):issn_ids[issn].add(jid)
    for issn,ids in issn_ids.items():
        if len(ids)>1:errors['shared_issn_across_records'].append({'issn':issn,'ids':sorted(ids)})
    for row in publishers:
        ids=set().union(*(issn_ids[i] for i in row.get('issns',[]))) if row.get('issns') else set()
        if len(ids)==1:safe_names[norm(row['name'])].update(ids)
    cas_counts=collections.Counter(norm(row['name']) for row in evidence.get('cas',[]))
    seen=set()
    detail_count=0
    for shard in sorted((data/'details').glob('*.json')):
        records=read(shard)
        for jid,d in records.items():
            detail_count+=1
            if jid in seen:errors['duplicate_detail_id'].append(jid)
            seen.add(jid)
            s=index.get(jid)
            if not s:
                errors['orphan_detail'].append(jid);continue
            if d.get('id')!=jid or s.get('detailShard')!='details/'+shard.name:
                errors['invalid_shard_join'].append(jid)
            if s.get('name')!=d.get('name') or set(s.get('issns',[]))!=set(d.get('issns',[])):
                errors['summary_identity_mismatch'].append(jid)
            if not d.get('issns') or d.get('lastYear',0)<2023 or d.get('worksCount',0)<100:
                errors['catalog_filter_violation'].append(jid)
            years=[point['year'] for point in d.get('annual',[])]
            if len(years)!=len(set(years)):
                errors['duplicate_annual_year'].append(jid)
            if any(not numeric(p.get('count')) or p['count']<0 for p in d.get('annual',[])):
                errors['invalid_annual_count'].append(jid)
            latest=s.get('latestAnnual')
            if latest and not any(p['year']==latest['year'] and p['count']==latest['count'] for p in d.get('annual',[])):
                errors['annual_summary_mismatch'].append(jid)

            points=d.get('jif',[])
            jyears=collections.Counter(p.get('year') for p in points)
            if any(n>1 for n in jyears.values()):
                errors['duplicate_jif_year'].append({'id':jid,'name':d['name'],'points':points})
            for p in points:
                value=p.get('value');display=str(p.get('display') or '')
                if value is not None and (not numeric(value) or value<0):
                    errors['invalid_jif_number'].append({'id':jid,'point':p})
                if display.startswith('<') or display.upper() in ('N/A','NA','-'):
                    counts['censored_or_unavailable_jif_points']+=1
                    if value is not None:errors['censored_jif_coerced_to_number'].append({'id':jid,'point':p})
                if p.get('releaseYear') is not None and p['releaseYear']!=p['year']+1:
                    errors['jif_release_year_mismatch'].append({'id':jid,'point':p})
                if not p.get('source'):errors['unsourced_jif'].append(jid)
            if points:
                last=sorted(points,key=lambda p:p['year'])[-1]
                if s.get('jifValue')!=last.get('value') or s.get('jifYear')!=last['year']:
                    errors['jif_summary_mismatch'].append(jid)
                expected={str(p['year']):p.get('value') for p in points}
                if s.get('jifByYear')!=expected:errors['jif_history_summary_mismatch'].append(jid)
            elif any(s.get(k) is not None for k in ('jifValue','jifYear','jifByYear')):
                errors['stale_jif_summary'].append(jid)

            quartiles=[q for q in d.get('quartiles',[]) if q.get('system')=='JCR']
            by_category=collections.defaultdict(set)
            for q in quartiles:
                if not q.get('category','').strip():errors['empty_jcr_category'].append({'id':jid,'point':q})
                if q.get('quartile') not in ('Q1','Q2','Q3','Q4',None):
                    errors['invalid_jcr_quartile'].append({'id':jid,'point':q})
                if q.get('releaseYear') is not None and q['releaseYear']!=q['year']+1:
                    errors['jcr_release_year_mismatch'].append({'id':jid,'point':q})
                by_category[(q['year'],q.get('category'))].add(q.get('quartile'))
                if not q.get('source'):errors['unsourced_jcr_quartile'].append(jid)
            for key,values in by_category.items():
                # N/A in an alternate edition may coexist with one genuine
                # quartile. Two different non-null quartiles are unresolved.
                nonnull={v for v in values if v is not None}
                if len(nonnull)>1:
                    errors['conflicting_jcr_quartiles'].append({'id':jid,'year':key[0],'category':key[1],'values':sorted(nonnull)})
            if quartiles:
                latest_year=max(q['year'] for q in quartiles)
                expected={}
                for (year,category),values in by_category.items():
                    if year!=latest_year:continue
                    nonnull=sorted(v for v in values if v is not None)
                    expected[category]=nonnull[0] if len(nonnull)==1 else None
                if s.get('jcrByCategory')!=expected:
                    errors['jcr_category_summary_mismatch'].append({'id':jid,'expected':expected,'actual':s.get('jcrByCategory')})
            elif any(s.get(k) for k in ('jcrYear','jcrByCategory','jcrQuartiles')):
                errors['stale_jcr_summary'].append(jid)
            expected_wos=sorted({entry.get('name') for entry in d.get('indexing',[])
                                 if entry.get('name') in ('SCIE','SSCI','ESCI','AHCI')})
            if s.get('wosIndexes',[])!=expected_wos:
                errors['indexing_summary_mismatch'].append(jid)

            cas=d.get('cas')
            if cas:
                key=norm(cas.get('sourceTitle'))
                if safe_names.get(key,set())!={jid} or cas_counts.get(key,0)!=1:
                    errors['unsafe_cas_title_join'].append({'id':jid,'name':d['name'],'sourceTitle':cas.get('sourceTitle'),'matchedIds':sorted(safe_names.get(key,set()))})
                if cas.get('zone') not in (1,2,3,4):errors['invalid_cas_zone'].append(jid)
                if cas.get('level')!='unspecified':warnings['cas_level_requires_direct_evidence'].append(jid)
                if s.get('casZone')!=cas['zone'] or s.get('casYear')!=cas['year']:
                    errors['cas_summary_mismatch'].append(jid)
            elif any(s.get(k) is not None for k in ('casZone','casYear','casTop')):
                errors['stale_cas_summary'].append(jid)

            dj=d.get('doaj')
            if dj and not set(dj.get('issns',[]))&set(d.get('issns',[])):
                errors['doaj_issn_mismatch'].append(jid)
            first=[r for r in d.get('review',[]) if r.get('stage')=='submission_to_first_decision']
            if s.get('reviewDays') is not None and not any(r.get('days')==s['reviewDays'] for r in first):
                errors['first_decision_stage_mismatch'].append(jid)
            for r in d.get('review',[]):
                if not numeric(r.get('days')) or r['days']<0:errors['invalid_review_duration'].append({'id':jid,'point':r})
                if r.get('basis')=='DOAJ_publisher_report' and r.get('stage')!='submission_to_publication':
                    errors['doaj_duration_wrong_stage'].append(jid)

            for key,truth in {
                'jifJournals':bool(points),'numericJifJournals':any(p.get('value') is not None for p in points),
                'jifTrendJournals':len({p['year'] for p in points if p.get('value') is not None})>=2,
                'jcrJournals':bool(quartiles),'casJournals':bool(cas),'doajProfiles':bool(dj),
                'curatedJournals':bool(d.get('curated')),'reviewJournals':bool(d.get('review')),
                'submissionCountJournals':bool(d.get('submissionCounts')),'acceptanceRateJournals':bool(d.get('acceptance')),
                'publisherPublicationCountJournals':bool(d.get('publicationCounts')),
                'apcDeclaredJournals':bool(dj and dj.get('apc',{}).get('charged') is not None),
            }.items():
                if truth:counts[key]+=1
    if seen!=set(index):errors['missing_detail_ids'].extend(sorted(set(index)-seen))
    if len(index)!=catalog.get('meta',{}).get('journalCount'):errors['headline_count_mismatch'].append({'actual':len(index),'declared':catalog.get('meta',{}).get('journalCount')})
    for key,value in catalog.get('meta',{}).get('enrichment',{}).items():
        if key in counts and counts[key]!=value:
            errors['coverage_mismatch'].append({'key':key,'actual':counts[key],'declared':value})
    report={'status':'passed' if not errors else 'failed','journalCount':len(index),'detailCount':detail_count,
            'coverage':dict(counts),'errorCounts':{k:len(v) for k,v in errors.items()},
            'warningCounts':{k:len(v) for k,v in warnings.items()},'errors':dict(errors),'warnings':dict(warnings)}
    if args.report:
        args.report.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k not in ('errors','warnings')},ensure_ascii=False))
    sys.exit(1 if errors else 0)


if __name__=='__main__':main()
