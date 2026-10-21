#!/usr/bin/env python3
import json
import unittest
from pathlib import Path
from urllib.parse import urlsplit
from monitor_labs import normalize, update_record
ROOT=Path(__file__).resolve().parents[1]

class EvidenceTests(unittest.TestCase):
    def test_editorial_integrity(self):
        data=json.loads((ROOT/'data/labs.json').read_text())
        ids=[]
        for lab in data['labs']:
            ids.append(lab['id'])
            for key in ('role','question','strength','fit','bridge','risk','verifiedAt'):
                self.assertTrue(lab[key],(lab['id'],key))
            self.assertIn(lab['tier'],data['tiers'])
            self.assertIn(lab['opportunity']['status'],data['statuses'])
            self.assertGreaterEqual(len(lab['papers']),2)
            self.assertGreaterEqual(len(lab['sources']),2)
            self.assertIn(lab['opportunity']['url'],[s['url'] for s in lab['sources']])
            for source in lab['sources']+lab['papers']:
                self.assertEqual(urlsplit(source['url']).scheme,'https')
                self.assertTrue(source['verifiedAt'])
            self.assertTrue(lab['opportunity']['visit'])
        self.assertEqual(len(ids),len(set(ids)))
        self.assertGreaterEqual(len(ids),18)
        self.assertEqual(len(set(l['country'] for l in data['labs'])),5)
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
