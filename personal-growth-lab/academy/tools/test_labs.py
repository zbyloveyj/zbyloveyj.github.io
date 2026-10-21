#!/usr/bin/env python3
"""Check evidence boundaries, identity, long-term inclusion and rotating monitor."""
import json
import unittest
from pathlib import Path
from urllib.parse import urlsplit
from monitor_labs import normalize, update_record, select_sources
ROOT=Path(__file__).resolve().parents[1]
CORE={'chang','nptl','bassett','woolrich','behrens','friston','vandeville','micera','lacour','eickhoff','ritter','bethge','marquand','vangerven','ramsey','theis','stegle','teichmann'}

class EvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data=json.loads((ROOT/'data/labs.json').read_text())

    def test_identity_and_evidence_boundaries(self):
        data=self.data;labs=data['labs'];ids=[l['id'] for l in labs]
        self.assertEqual(len(ids),len(set(ids)))
        self.assertTrue(CORE.issubset(ids))
        self.assertGreaterEqual(len(labs),1000)
        self.assertGreaterEqual(len(set(l['country'] for l in labs)),15)
        for l in labs:
            self.assertTrue(l['name']);self.assertTrue(l['institution']);self.assertTrue(l['directions'])
            self.assertEqual(l['candidateStatus'],'long_term')
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
                self.assertEqual(l['evidenceLevel'],'official_directory')
                self.assertEqual(l['tier'],'D')
                self.assertEqual(l['opportunity']['status'],'unknown')
                self.assertIsNone(l['opportunity']['verifiedAt'])
                self.assertEqual(l['papers'],[])
                self.assertTrue(any(s['kind']=='directory' for s in l['sources']))

    def test_source_inventory_and_long_term_policy(self):
        manifest=json.loads((ROOT/'data/lab-sources.json').read_text())
        urls=[s['url'] for s in manifest['sources']]
        self.assertEqual(len(urls),len(set(urls)))
        for l in self.data['labs']:
            for s in l['sources']:
                if s['kind']=='directory':
                    self.assertIn(s['url'],urls)
                    self.assertTrue(s.get('country'))
        daly=next(l for l in self.data['labs'] if l['name']=='Mark Daly')
        fimm=next(s for s in daly['sources'] if 'fimm-research-groups' in s['url'])
        self.assertEqual(fimm['country'],'芬兰')
        self.assertIn('无论当前是否招生或招聘',self.data['methodology'][0])

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

    def test_failure_preserves_successful_evidence(self):
        first=update_record({},'review','t1',digest='a')
        failed=update_record(first,'review','t2',error='HTTP 403')
        self.assertEqual(failed['hash'],'a');self.assertEqual(failed['lastSuccessAt'],'t1')
        self.assertEqual(failed['state'],'error');self.assertEqual(failed['baselineHash'],'a')

    def test_normalize_ignores_navigation_and_scripts(self):
        self.assertEqual(normalize('<header>menu</header><main><h1>Postdoc</h1><script>random()</script><p>Open  now</p></main>'),'Postdoc Open now')

if __name__=='__main__':unittest.main()
