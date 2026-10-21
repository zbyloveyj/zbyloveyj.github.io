#!/usr/bin/env python3
"""Regression checks for editorial identity and evidence boundaries."""
import copy,json,subprocess,sys,tempfile,unittest
from pathlib import Path
SCRIPT=Path(__file__).with_name('enrich_candidates.py')
AXES=('domains','methods','diseases','modalities','researchScales','studyDesigns')
DATE='2026-10-21'
def lab():
    return dict(id='stable-original',name='Alex Example',country='美国',city='',institution='Primary University',institutionKey='Primary University',role='Professor',roleStatus='current',directions=['脑科学'],tier='D',evidenceLevel='research_profile',candidateStatus='long_term',profileUrl='https://primary.example.edu/alex',question='A sourced individual research question.',verifiedAt=DATE,opportunity=dict(status='unknown',summary='Not verified',url='https://primary.example.edu/alex',verifiedAt=None),papers=[],sources=[dict(url='https://primary.example.edu/alex',label='Personal research',claim='Individual research',kind='research_profile',institution='Primary University',country='美国',verifiedAt=DATE)],facets={a:['脑科学'] if a=='domains' else [] for a in AXES},assessmentEvidence=[],evidenceScope='Individual profile reviewed')
def row(**kw):
    r=dict(name='Alex Example',country='美国',institution='Network University',url='https://network.example.edu/alex',sourceUrl='https://network.example.edu/faculty',verifiedAt=DATE,title='Network member',roleStatus='unknown',fields=['认知神经科学'],summary='Directory text',evidenceLevel='official_directory',deepResearchVerified=False,evidenceScope='Official directory only',facets={a:[] for a in AXES})
    r.update(kw);return r
class MergeTests(unittest.TestCase):
    def build(self,base,rows,proof=None,success=True):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp);data=dict(schemaVersion=1,edition='baseline',labs=copy.deepcopy(base),methodology=['Long-term inclusion','Evidence levels'],history=[])
            payload={'base.json':data,'sources.json':{'sources':[]},'rows.json':rows,'proof.json':proof or [{'url':r['sourceUrl'],'readMethod':'fixture','reviewedAt':DATE} for r in rows]}
            for name,value in payload.items():(p/name).write_text(json.dumps(value))
            cmd=[sys.executable,str(SCRIPT),'--base',str(p/'base.json'),'--sources',str(p/'sources.json'),'--batches',str(p/'rows.json'),'--provenance',str(p/'proof.json'),'--output',str(p/'out.json'),'--manifest',str(p/'manifest.json'),'--report',str(p/'report.json'),'--edition','test-edition','--date',DATE,'--compact-output']
            result=subprocess.run(cmd,capture_output=True,text=True)
            if not success:self.assertNotEqual(result.returncode,0);return result.stderr
            self.assertEqual(result.returncode,0,result.stderr)
            return json.loads((p/'out.json').read_text()),json.loads((p/'report.json').read_text())
    def test_directory_supplement_cannot_downgrade_individual_profile(self):
        old=lab();new=row(existingId=old['id'],roleNote='Directory role is unverified',scopeNote='Directory only',profileLinkStatus='directory_fallback')
        data,report=self.build([old],[new]);r=data['labs'][0]
        for k in ['institution','profileUrl','question','evidenceLevel','role','roleStatus','evidenceScope']:self.assertEqual(r[k],old[k],k)
        self.assertIn('认知神经科学',r['directions']);self.assertEqual(report['newCount'],0);self.assertEqual(report['enrichedCount'],1)
        self.assertEqual(r['lastEnrichedEdition'],'test-edition')
        self.assertNotIn('roleNote',r);self.assertNotIn('scopeNote',r);self.assertNotIn('profileLinkStatus',r)
    def test_same_name_with_distinct_profiles_is_not_a_merge(self):
        a=row();b=row(url='https://other.example.edu/alex',sourceUrl='https://other.example.edu/faculty',institution='Other University')
        data,report=self.build([], [a,b]);self.assertEqual(len(data['labs']),2);self.assertNotEqual(data['labs'][0]['id'],data['labs'][1]['id']);self.assertEqual(report['newCount'],2)
    def test_name_and_link_correction_preserve_id_and_evidence_level(self):
        old=lab();u='https://primary.example.edu/alex-new';r=row(existingId=old['id'],canonicalName='Alex J. Example',url=u,sourceUrl=u,profileUrlCorrection=u,identitySources=[{'url':u,'claim':'Full name and identity read.'}])
        data,_=self.build([old],[r]);out=data['labs'][0]
        self.assertEqual(out['id'],old['id']);self.assertEqual(out['name'],'Alex J. Example');self.assertIn(old['name'],out['aliases']);self.assertEqual(out['profileUrl'],u);self.assertEqual(out['evidenceLevel'],'research_profile')
    def test_unread_identity_correction_is_rejected(self):
        u='https://unread.example.edu/alex';r=row(existingId='stable-original',canonicalName='Alex J. Example',identitySources=[{'url':u}])
        error=self.build([lab()],[r],success=False);self.assertIn('identity correction needs read source',error)
    def test_move_resets_old_opportunity_and_preserves_other_sources(self):
        old=lab();old['opportunity'].update(status='recruiting',verifiedAt=DATE)
        old['sources'].append(dict(url='https://upenn.edu/collaborator',label='Collaborator',claim='Unrelated collaborator research',kind='research_evidence',institution='Collaborating University',country='美国',verifiedAt=DATE))
        u='https://new.example.edu/alex';r=row(existingId=old['id'],url=u,sourceUrl=u,institution='New University',affiliationChange={'url':u,'summary':'Current role and prior institution verified.'})
        data,_=self.build([old],[r]);out=data['labs'][0]
        self.assertEqual(out['institution'],'New University');self.assertEqual(out['opportunity']['status'],'unknown');self.assertIsNone(out['opportunity']['verifiedAt']);self.assertEqual(out['formerAffiliations'][0]['institution'],'Primary University')
        self.assertEqual(out['sources'][0]['kind'],'historical');self.assertEqual(out['sources'][1]['kind'],'research_evidence')
    def test_announced_future_role_remains_unknown(self):
        r=row(title='Group leader, joining in 2027',roleStatus='unknown',roleNote='Future appointment, not a current role.')
        data,_=self.build([],[r]);self.assertEqual(data['labs'][0]['roleStatus'],'unknown');self.assertIsNone(data['labs'][0]['opportunity']['verifiedAt'])
    def test_shared_identity_role_and_research_url_retains_research_evidence(self):
        u='https://example.edu/individual'
        r=row(url=u,sourceUrl=u,roleSourceUrl=u,evidenceLevel='research_profile',deepResearchVerified=True,identitySources=[{'url':u,'claim':'Official bilingual identity confirmed.'}])
        data,_=self.build([],[r]);out=data['labs'][0]
        self.assertEqual(len(out['sources']),1);self.assertEqual(out['sources'][0]['kind'],'research_profile');self.assertIn('bilingual identity',out['sources'][0]['claim'])
if __name__=='__main__':unittest.main()
