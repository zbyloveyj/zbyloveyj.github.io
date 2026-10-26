#!/usr/bin/env python3
"""Check evidence boundaries, identity, long-term inclusion and rotating monitor."""
import gzip
import json
import unittest
from pathlib import Path
from urllib.parse import urlsplit
from monitor_labs import normalize, update_record, select_sources
from lab_data import load_catalog
ROOT=Path(__file__).resolve().parents[1]
CORE={'chang','nptl','bassett','woolrich','behrens','friston','vandeville','micera','lacour','eickhoff','ritter','bethge','marquand','vangerven','ramsey','theis','stegle','teichmann'}

class EvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data=load_catalog(ROOT/'data/labs.json')

    def test_identity_and_evidence_boundaries(self):
        data=self.data;labs=data['labs'];ids=[l['id'] for l in labs]
        self.assertEqual(len(ids),len(set(ids)))
        self.assertTrue(CORE.issubset(ids))
        self.assertGreaterEqual(len(labs),10000)
        self.assertGreaterEqual(len(set(l['country'] for l in labs)),15)
        for l in labs:
            self.assertTrue(l['name']);self.assertTrue(l['institution']);self.assertTrue(l['directions'])
            self.assertIn(l['candidateStatus'],('long_term','historical'))
            if l.get('roleStatus') in ('deceased','historical'):
                self.assertEqual(l['candidateStatus'],'historical')
            self.assertIn(l['tier'],data['tiers'])
            self.assertIn(l['opportunity']['status'],data['statuses'])
            self.assertIn(urlsplit(l['profileUrl']).scheme,('http','https'))
            self.assertTrue(l['sources']);self.assertTrue(l['verifiedAt'])
            for s in l['sources']+l['papers']:
                self.assertEqual(urlsplit(s['url']).scheme,'https')
                self.assertTrue(s['verifiedAt'])
            if l['evidenceLevel']=='reviewed':
                for k in ('role','question','strength','fit','bridge','risk'):
                    self.assertTrue(l[k],(l['id'],k))
                self.assertGreaterEqual(len(l['papers']),2)
                self.assertIn(l['opportunity']['url'],[s['url'] for s in l['sources']])
            else:
                self.assertIn(l['evidenceLevel'],('official_directory','research_profile','project_record'))
                self.assertEqual(l['tier'],'D')
                self.assertEqual(l['opportunity']['status'],'unknown')
                self.assertIsNone(l['opportunity']['verifiedAt'])
                self.assertEqual(l['papers'],[])
                if l['evidenceLevel']=='official_directory':
                    self.assertTrue(any(s['kind']=='directory' for s in l['sources']))
                elif l['evidenceLevel']=='research_profile':
                    self.assertTrue(l.get('evidenceScope'))
                    self.assertTrue(any(s['kind']=='research_profile' for s in l['sources']))
                else:
                    self.assertEqual(l['recordType'],'research_project_pi')
                    self.assertTrue(l.get('nihProfileId'))
                    self.assertTrue(l.get('projectEvidence'))
                    self.assertIsNone(l.get('profileVerifiedAt'))
                    self.assertTrue(any(s['kind']=='project_record' for s in l['sources']))

    def test_structured_dimensions_are_sourced_and_unknowns_stay_empty(self):
        dimensions={'research','methods','outputs','resources','translation','collaboration','training'}
        axes={'domains','methods','diseases','modalities','researchScales','studyDesigns'}
        for l in self.data['labs']:
            self.assertEqual(set(l['facets']),axes)
            self.assertEqual(set(l['facets']['domains']),set(l['directions']))
            for values in l['facets'].values():
                self.assertIsInstance(values,list)
                self.assertEqual(len(values),len(set(values)))
                self.assertTrue(all(isinstance(v,str) and v.strip() for v in values))
            for e in l['assessmentEvidence']:
                self.assertIn(e['dimension'],dimensions)
                self.assertTrue(e['summary']);self.assertTrue(e['verifiedAt'])
                self.assertEqual(urlsplit(e['url']).scheme,'https')
                # Each row must point to a known public source or the existing bibliography.
                self.assertIn(e['url'],[s['url'] for s in l['sources']+l['papers']],l['id'])
            self.assertNotIn('score',l)
            self.assertNotIn('privateNotes',l)

    def test_expansion_statistics_and_compressed_copy_are_consistent(self):
        data=self.data;update=data['latestExpansion'];labs=data['labs']
        self.assertEqual(update['baselineCount']+update['newCount'],len(labs))
        self.assertEqual(sum(l.get('firstIncludedEdition')==data['edition'] for l in labs),update['newCount'])
        self.assertEqual(sum(l.get('lastEnrichedEdition')==data['edition'] for l in labs),update['enrichedCount'])
        self.assertEqual(gzip.decompress((ROOT/'data/labs.json.gz').read_bytes()),(ROOT/'data/labs.json').read_bytes())
        self.assertLess((ROOT/'data/labs.json.gz').stat().st_size,(ROOT/'data/labs.json').stat().st_size/2)

    def test_chinese_coverage_aliases_and_homonyms(self):
        labs=self.data['labs'];china=[l for l in labs if l['country']=='中国']
        self.assertGreaterEqual(len(china),2000)
        names={n for l in labs for n in [l['name']]+l.get('aliases',[])}
        for name in ['颜宁','王晓东','邵峰','蒲慕明','韩家淮','冯建峰','崔再续','陈玲玲','李劲松','赵方庆','刘星吟']:
            self.assertIn(name,names)
        for l in labs:
            for alias in l.get('aliases',[]):
                self.assertNotIn('<',alias);self.assertNotIn('>',alias);self.assertLess(len(alias),160)
        for name,unit in [('李岩','生物物理研究所'),('周兵','上海药物研究所'),('杨帆','深圳先进技术研究院')]:
            rows=[l for l in labs if l['name']==name and unit in l['institution']]
            self.assertEqual(len(rows),2,(name,[(r['id'],r['profileUrl']) for r in rows]))
            self.assertNotEqual(rows[0]['id'],rows[1]['id'])

    def test_targeted_coverage_and_affiliation_corrections(self):
        labs=self.data['labs']
        for domain,minimum in [('微生物组',80),('计算精神病学',35),('医学人工智能',60),('代谢组学',10)]:
            self.assertGreaterEqual(sum(domain in l['directions'] for l in labs),minimum,domain)
        names=' '.join(l['name']+' '+' '.join(l.get('aliases',[])) for l in labs)
        for name in ['Rob Knight','Curtis Huttenhower','Jeffrey Gordon','Nicola Segata','Quentin Huys','Regina Barzilay','Marzyeh Ghassemi']:
            self.assertIn(name,names)
        # Awards and journal names are not individual research-field evidence;
        # Chinese "spatial organization" is not spatial omics.
        liu=next(l for l in labs if l['id']=='pi-xingyin-liu-d4776ef5')
        self.assertNotIn('生物物理学',liu['directions'])
        self.assertTrue({'肿瘤生物学','合成生物学'}.issubset(liu['directions']))
        cui=next(l for l in labs if l['name']=='崔再续')
        self.assertNotIn('单细胞与空间组学',cui['directions'])
        self.assertNotIn('空间组学',cui['facets']['modalities'])
        bassett=next(l for l in labs if l['id']=='bassett')
        self.assertIn('Yale',bassett['institution'])
        self.assertEqual(bassett['opportunity']['status'],'unknown')
        self.assertIsNone(bassett['opportunity']['verifiedAt'])
        self.assertTrue(bassett['formerAffiliations'])
        self.assertTrue(any('upenn' in s['url'] and s['kind']=='historical' for s in bassett['sources']))

    def test_source_inventory_and_long_term_policy(self):
        manifest=json.loads((ROOT/'data/lab-sources.json').read_text())
        urls={s['url'] for s in manifest['sources']}
        self.assertEqual(len(urls),len(manifest['sources']))
        for l in self.data['labs']:
            for s in l['sources']+l['papers']+l['assessmentEvidence']:
                self.assertIn(s['url'],urls)
                if s.get('kind')=='directory':
                    self.assertTrue(s.get('country'))
        daly=next(l for l in self.data['labs'] if l['name']=='Mark Daly')
        fimm=next(s for s in daly['sources'] if 'fimm-research-groups' in s['url'])
        self.assertEqual(fimm['country'],'芬兰')
        self.assertIn('无论当前是否招生或招聘',self.data['methodology'][0])

    def test_source_reading_limits_and_shared_group_identity(self):
        labs=self.data['labs']
        sources=json.loads((ROOT/'data/lab-sources.json').read_text())['sources']
        indexed=[s for s in sources if s.get('readMethod')=='official_domain_search_index']
        self.assertGreaterEqual(len(indexed),5)
        indexed_urls={s['url'] for s in indexed}
        for l in labs:
            for s in l['sources']:
                if s['url'] in indexed_urls:self.assertIn('未完整读取',s['access'])
        knight=next(s for s in sources if s['url']=='https://datascience.ucsd.edu/people/rob-knight/')
        self.assertEqual(knight['readMethod'],'web_open')
        self.assertIn('503',knight['provenance']['httpAttempt']['error'])
        roiser=next(l for l in labs if l['name']=='Jonathan Roiser')
        robinson=next(l for l in labs if l['name']=='Oliver Robinson')
        self.assertEqual(roiser['sharedGroup'],robinson['sharedGroup'])
        self.assertNotEqual(roiser['id'],robinson['id'])
        foster=next(l for l in labs if l['name']=='Jane Foster')
        mcmaster=next(a for a in foster['affiliations'] if a['institution']=='McMaster University')
        self.assertEqual(mcmaster['country'],'加拿大')
        self.assertEqual(mcmaster['status'],'part_time')
        mcmaster_source=next(s for s in foster['sources'] if 'experts.mcmaster.ca' in s['url'])
        self.assertEqual(mcmaster_source['country'],'加拿大')
        self.assertFalse(any(l['country']=='中国香港' for l in labs))
        ucl=[l for l in labs if l['institution']=='University College London' or l['institution'].startswith('University College London ·')]
        self.assertEqual({l['institutionKey'] for l in ucl},{'UCL'})
        bowang=next(l for l in labs if l['name']=='Bo Wang')
        self.assertIn('AI虚拟细胞（AIVC）',bowang['directions'])
        self.assertFalse(any('AI虚拟细胞' in l['directions'] for l in labs))

    def test_same_name_can_be_different_people(self):
        # Westlake explicitly lists two different Jian Yang research pages.
        rows=[l for l in self.data['labs'] if l['name'] in ('Jian Yang','Jian Yang, PhD') and 'Westlake' in l['institution']]
        self.assertEqual(len(rows),2)
        self.assertNotEqual(rows[0]['profileUrl'],rows[1]['profileUrl'])
        rows=[l for l in self.data['labs'] if l['name']=='Jun Ding']
        self.assertEqual(len(rows),2)
        self.assertEqual({l['country'] for l in rows},{'美国','加拿大'})

    def test_rotating_monitor_keeps_directory_priority_and_budget(self):
        rows=[]
        for i in range(5):
            rows.append({'evidenceLevel':'official_directory','verifiedAt':'2026-10-21',
              'profileUrl':f'https://example.edu/person/{i}',
              'sources':[{'url':'https://example.edu/faculty','kind':'directory','verifiedAt':'2026-10-21'}]})
        previous={'https://example.edu/person/0':{'checkedAt':'2026-10-21'}}
        items,known,pn,cn=select_sources({'labs':rows},previous,2)
        urls=[u for u,s in items]
        self.assertEqual(pn,1);self.assertEqual(cn,2);self.assertEqual(len(known),6)
        self.assertIn('https://example.edu/faculty',urls)
        self.assertNotIn('https://example.edu/person/0',urls)
        self.assertEqual(len(urls),3)

    def test_changes_persist_until_editorial_review(self):
        first=update_record({},'2026-10-21','t1',digest='a')
        changed=update_record(first,'2026-10-21','t2',digest='b')
        again=update_record(changed,'2026-10-21','t3',digest='b')
        self.assertFalse(first['changed']);self.assertTrue(again['changed'])
        reviewed=update_record(again,'2026-10-22','t4',digest='b')
        self.assertFalse(reviewed['changed'])

    def test_unknown_opportunity_does_not_erase_source_review_stamp(self):
        lab={'evidenceLevel':'reviewed','verifiedAt':'2026-10-21',
          'sources':[{'url':'https://example.edu/pi','kind':'research_profile','verifiedAt':'2026-10-21'}],
          'opportunity':{'url':'https://example.edu/pi','status':'unknown','verifiedAt':None}}
        items,known,pn,cn=select_sources({'labs':[lab]}, {}, 2)
        self.assertEqual(items,[('https://example.edu/pi','2026-10-21')])

    def test_failure_preserves_successful_evidence(self):
        first=update_record({},'review','t1',digest='a')
        failed=update_record(first,'review','t2',error='HTTP 403')
        self.assertEqual(failed['hash'],'a');self.assertEqual(failed['lastSuccessAt'],'t1')
        self.assertEqual(failed['state'],'error');self.assertEqual(failed['baselineHash'],'a')

    def test_normalize_ignores_navigation_and_scripts(self):
        self.assertEqual(normalize('<header>menu</header><main><h1>Postdoc</h1><script>random()</script><p>Open  now</p></main>'),'Postdoc Open now')

    def test_editorial_overrides_preserve_history_and_refresh_verified_outputs(self):
        labs={row['id']:row for row in self.data['labs']}
        bork=labs['pi-peer-bork-9df54a45']
        self.assertEqual(bork['roleStatus'],'deceased')
        self.assertEqual(bork['candidateStatus'],'historical')
        self.assertEqual(bork['roleVerifiedAt'],'2026-10-26')
        self.assertEqual(bork['opportunity']['status'],'unknown')
        self.assertIsNone(bork['opportunity']['verifiedAt'])
        self.assertTrue(any(s['url']=='https://www.embl.org/news/embl-announcements/in-remembrance-of-peer-bork/' for s in bork['sources']))
        ramsey=labs['ramsey']
        self.assertEqual(ramsey['verifiedAt'],'2026-10-26')
        self.assertEqual(ramsey['opportunity']['status'],'unknown')
        self.assertEqual(ramsey['opportunity']['verifiedAt'],'2026-10-26')
        expected={
            'https://researchinformation.umcutrecht.nl/en/publications/implanted-brain-computer-interface-functionality-during-nighttime/',
            'https://researchinformation.umcutrecht.nl/en/publications/optimal-positioning-and-size-of-high-density-electrocorticography/'
        }
        self.assertTrue(expected.issubset({p['url'] for p in ramsey['papers']}))
        self.assertTrue(expected.issubset({e['url'] for e in ramsey['assessmentEvidence'] if e['dimension']=='outputs'}))

if __name__=='__main__':unittest.main()
