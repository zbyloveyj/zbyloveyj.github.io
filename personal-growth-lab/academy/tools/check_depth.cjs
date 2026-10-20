'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.DEPTH_TEST_OUTPUT||'/tmp/academy-depth-qa';fs.mkdirSync(out,{recursive:true});
const original=['assets/core.js','assets/english.js','assets/studio.js','assets/explore.js','data/papers.js','assets/papers.js'];
const detailed=['core','english','writing','coding','research','visual','neuro','career','papers','thinking','life','capstone'].map(x=>'assets/depth-'+x+'.js');
const context={console};context.window=context;vm.createContext(context);
for(const f of original)vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),context,{filename:f});
const old=Object.fromEntries(context.ACADEMY.courses.map(c=>[c.id,c.lessons.map(l=>({id:l.id,tasks:l.tasks.length}))]));
for(const f of detailed)vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),context,{filename:f});
const A=context.ACADEMY;
const expected={english:90,research:52,coding:24,papers:100,visual:24,writing:48,thinking:365,neuro:24,career:12,life:100};
assert.equal(A.courses.length,10);assert.equal(A.version,'2026.10.20.2-detailed');
const stats=[];let total=0;
for(const c of A.courses){
 assert.equal(c.lessons.length,expected[c.id],c.id+' count');
 let lengths=[];
 for(const [i,l] of c.lessons.entries()){
  assert.equal(l.id,old[c.id][i].id,'lesson ID changed');
  assert.equal(l.tasks.length,old[c.id][i].tasks,'task count changed: '+c.id+':'+l.id);
  assert(l.detail.length>=8&&l.detail.length<=10,c.id+':'+l.id+' sections');
  assert(l.detail.some(s=>s.kind==='answer'),'answer section missing');
  assert(l.detail.some(s=>s.kind==='exercise'),'exercise section missing');
  const titles=l.detail.map(s=>s.title);assert.equal(new Set(titles).size,titles.length,'repeated headings');
  for(const s of l.detail){assert(s.title&&s.body&&s.body.length>30,'empty or trivial section');}
  assert(l.minutes>=25&&l.minutes<=180);assert(l.criteria.length>=5);
  lengths.push(l.detail.reduce((n,s)=>n+s.body.length,0));
  assert(lengths.at(-1)>=650,c.id+':'+l.id+' insufficient body');
  for(const k of l.refs||[])assert(A.resources[k],'unknown resource '+k);
 }
 const caseBodies=c.lessons.map(l=>l.detail.find(s=>s.title.startsWith('01')).body);
 assert.equal(new Set(caseBodies).size,c.lessons.length,'duplicated lesson entry case '+c.id);
 stats.push({course:c.id,lessons:c.lessons.length,min_body_characters:Math.min(...lengths),max_body_characters:Math.max(...lengths),total_body_characters:lengths.reduce((a,b)=>a+b,0)});
 total+=c.lessons.length;
}
assert.equal(total,839);
const coding=A.courses.find(c=>c.id==='coding');
const exampleDir=path.join(out,'python');fs.mkdirSync(exampleDir,{recursive:true});
for(const l of coding.lessons){assert(l.code&&l.code.includes('assert'),'no runnable assertions');fs.writeFileSync(path.join(exampleDir,'coding-'+String(l.id).padStart(2,'0')+'.py'),l.code);}
assert.equal(new Set(coding.lessons.map(l=>l.code)).size,24);
const index=path.join(root,'index.html');let html=fs.readFileSync(index,'utf8');
if(!html.includes('assets/depth-reader.js')){
 html=html.replace('</head>','<link rel="stylesheet" href="assets/depth.css?v=20261020d">\n</head>');
 const tags=detailed.map(f=>'<script defer src="'+f+'?v=20261020d"></script>').join('\n');
 html=html.replace(/(<script defer src="assets\/app\.js[^>]*><\/script>)/,tags+'\n$1\n<script defer src="assets/depth-reader.js?v=20261020d"></script>');
 fs.writeFileSync(index,html);
}
const report={version:A.version,total_lessons:total,courses:stats,old_ids_preserved:true,old_task_counts_preserved:true,python_examples:24};
fs.writeFileSync(path.join(out,'content-report.json'),JSON.stringify(report,null,2));
fs.writeFileSync(path.join(out,'curriculum.json'),JSON.stringify(A));
console.log('ACADEMY CONTENT CHECK PASSED\n'+JSON.stringify(report,null,2));
