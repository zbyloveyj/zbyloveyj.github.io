'use strict';
const assert=require('node:assert/strict'),D=require('../assets/lab-discovery.js');
const source={id:'source',name:'José Researcher',institution:'Example Institute',profileUrl:'https://www.example.edu/jose/?utm_source=directory',directions:['脑科学','微生物组'],facets:{methods:['宏基因组学'],diseases:['抑郁症'],modalities:['fMRI'],researchScales:['人群'],studyDesigns:['纵向队列']}};
const record=(id,overrides={})=>({id,name:'Researcher '+id,institution:'Institute '+id,directions:[],facets:{},roleStatus:'current',...overrides});
const pool=[
  source,
  record('same-profile',{profileUrl:'http://example.edu/jose',directions:['微生物组']}),
  record('same-name',{name:'Jose Researcher',institution:'Example Institute',directions:['微生物组']}),
  record('historical',{roleStatus:'historical',directions:['微生物组']}),
  record('deceased',{roleStatus:'deceased',directions:['微生物组']}),
  record('broad-only',{directions:['脑科学']}),
  record('modality-only',{facets:{modalities:['fMRI'],researchScales:['人群']}}),
  record('empty'),
  record('topic-only',{directions:['微生物组']}),
  record('method-and-disease',{facets:{methods:['宏基因组学'],diseases:['抑郁症']}}),
  record('full',{directions:['微生物组','脑科学'],facets:source.facets})
];
const before=JSON.stringify(pool),results=D.similar(source,pool);
assert.deepEqual(results.map(r=>r.id),['full','method-and-disease','topic-only']);
assert.equal(JSON.stringify(pool),before,'Discovery does not mutate records or add hidden rank fields.');
assert.deepEqual(results[1].shared,[{axis:'methods',values:['宏基因组学']},{axis:'diseases',values:['抑郁症']}]);
assert(!results[0].shared.some(r=>r.values.includes('脑科学')),'A broad shared label is not presented as specific matching evidence.');
assert(!results[0].shared.some(r=>r.values.includes('missing')));
assert.deepEqual(D.similar(record('unrecorded'),pool),[],'Missing tags cannot establish similarity or a negative ability judgement.');
assert.deepEqual(D.similar(source,pool,{limit:0}),[]);
assert.equal(D.similar(source,pool,{limit:1}).length,1);
const duplicates=[record('a',{name:'One',institution:'A',profileUrl:'https://example.edu/one',directions:['微生物组']}),record('b',{name:'Alias',institution:'B',profileUrl:'https://www.example.edu/one/?utm_campaign=x',directions:['微生物组']}),record('c',{name:'One',institution:'A',directions:['微生物组']}),record('d',{name:'One',institution:'Different Institute',directions:['微生物组']})];
assert.deepEqual(D.similar(source,duplicates).map(r=>r.id),['a','d'],'Results collapse a shared individual profile and same-name same-institution duplicate, preserving namesakes elsewhere.');
const directory='https://example.edu/faculty';
const directorySource={...source,profileUrl:directory,sources:[{kind:'directory',url:directory}]};
const differentPeople=['a','b'].map(id=>record(id,{profileUrl:directory,sources:[{kind:'directory',url:directory}],directions:['微生物组']}));
assert.equal(D.similar(directorySource,differentPeople).length,2,'A shared faculty directory is not a shared personal identity.');
const verifiedNamesake=record('namesake',{name:source.name,institution:source.institution,profileUrl:'https://example.edu/another-jose',directions:['微生物组']});
assert.deepEqual(D.similar(source,[verifiedNamesake]).map(r=>r.id),['namesake'],'Distinct personal profiles preserve verified same-name same-institution researchers.');
const groupPeople=['pi-a','pi-b'].map(id=>record(id,{profileUrl:'https://example.edu/research/group',sharedGroup:'Example multi-PI research group',sources:[{kind:'research_profile',url:'https://example.edu/research/group'}],directions:['微生物组']}));
assert.equal(D.similar(source,groupPeople).length,2,'A declared shared group page does not collapse different named PIs.');
assert.deepEqual(D.similar(groupPeople[0],groupPeople).map(r=>r.id),['pi-b'],'The other named PI can be discovered from a shared group source record.');
const tiePool=Array.from({length:12},(_,i)=>record('tie-'+String(i).padStart(2,'0'),{directions:['微生物组']}));
assert.equal(D.similar(source,tiePool,{limit:999}).length,6);
assert.deepEqual(D.similar(source,tiePool).map(r=>r.id),D.similar(source,tiePool.slice().reverse()).map(r=>r.id),'Ties are stable independently of incoming directory order.');
const docs=[
 record('dir',{evidenceLevel:'official_directory',country:'中国',institution:'A',roleStatus:'unknown',facets:{methods:[]},assessmentEvidence:[{dimension:'research',summary:'Official profile describes research',url:'https://example.edu/dir'},{dimension:'research',summary:'Second research statement',url:'https://example.edu/research'}]}),
 record('profile',{evidenceLevel:'research_profile',country:'中国',institution:'A',affiliations:[{country:'英国',institution:'B'}],facets:{methods:['宏基因组学'],diseases:['抑郁症'],modalities:['fMRI']},assessmentEvidence:[{dimension:'methods',summary:'A documented method',url:'https://example.edu/method'},{dimension:'research',summary:'Unsafe URL is not evidence',url:'javascript:alert(1)'}]}),
 record('legacy',{country:'英国',institution:'B',roleStatus:undefined,papers:[{title:'A representative paper',url:'https://doi.org/10.1000/example'}]})
];
const coverage=D.coverage(docs);
assert.equal(coverage.total,3);assert.equal(coverage.directories,1);assert.equal(coverage.researchProfiles,1);assert.equal(coverage.reviewed,1);assert.equal(coverage.documentedProfiles,2);
assert.equal(coverage.withMethods,1);assert.equal(coverage.withResearchEvidence,1);assert.equal(coverage.dimensions.research,1);assert.equal(coverage.dimensions.methods,1);assert.equal(coverage.unknownRoles,2);assert.equal(coverage.withRepresentativePapers,1);assert.equal(coverage.countryCount,2);assert.equal(coverage.institutionCount,2);
assert.equal(D.coverage([]).total,0);assert.equal(D.coverage([]).withMethods,0);assert.equal(D.coverage(null).total,0);
console.log('Discovery QA passed: explained tag overlap, weak-signal exclusion, identity deduplication, stable bounded recommendations, transparent evidence coverage and empty inputs.');
