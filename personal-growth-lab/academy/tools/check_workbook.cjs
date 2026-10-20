'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.WORKBOOK_QA_DIR||'/tmp/academy-workbook-qa';fs.mkdirSync(out,{recursive:true});
const original=['assets/core.js','assets/english.js','assets/studio.js','assets/explore.js','data/papers.js','assets/papers.js'];
const depths=['core','english','writing','coding','research','visual','neuro','career','papers','thinking','life','capstone'].map(x=>'assets/depth-'+x+'.js');
const workbooks=['core','english','writing','coding','research','neuro','visual','thinking','life','career','papers'].map(x=>'assets/workbook-'+x+'.js');
const context={console};context.window=context;vm.createContext(context);
for(const f of [...original,...depths])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),context,{filename:f});
const previous=Object.fromEntries(context.ACADEMY.courses.map(c=>[c.id,c.lessons.map(l=>({id:l.id,tasks:l.tasks.length,characters:l.detail.reduce((n,s)=>n+s.body.length,0)}))]));
for(const f of workbooks)vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),context,{filename:f});
const A=context.ACADEMY,counts={english:90,coding:24,writing:48,research:52,visual:24,neuro:24,thinking:365,career:12,life:100,papers:100};
assert.equal(A.version,'2026.10.20.3-workbook');assert.equal(A.courses.length,10);
const stats=[];let total=0,base=0,solutions=0,visual=0;
for(const c of A.courses){
 assert.equal(c.lessons.length,counts[c.id]);let chars=[];let sections=[];
 for(const [i,l] of c.lessons.entries()){
  assert.equal(l.id,previous[c.id][i].id);assert.equal(l.tasks.length,previous[c.id][i].tasks);
  assert.equal(l.workbook,true,c.id+':'+l.id+' not enhanced');
  assert(l.detail.length>=8&&l.detail.length<=18,c.id+':'+l.id+' invalid section count');
  assert(l.detail.some(s=>s.kind==='answer'));assert(l.detail.some(s=>s.kind==='exercise'));
  for(const s of l.detail)assert(typeof s.body==='string'&&s.body.length>25&&s.title,c.id+':'+l.id+' empty section');
  const length=l.detail.reduce((n,s)=>n+s.body.length,0);chars.push(length);sections.push(l.detail.length);
  if(!(c.id==='thinking'&&l.id===365))assert(length>previous[c.id][i].characters,c.id+':'+l.id+' body was not expanded');
  for(const r of l.refs||[])assert(A.resources[r],'unknown reference '+r);
  for(const [field,folder] of [['code','base'],['solutionCode','solutions'],['visualCode','visual']])if(l[field]){
   const dir=path.join(out,'programs',folder);fs.mkdirSync(dir,{recursive:true});
   const name=c.id+'-'+String(l.id).padStart(3,'0')+'.py';fs.writeFileSync(path.join(dir,name),l[field]);
   if(folder==='base')base++;if(folder==='solutions')solutions++;if(folder==='visual')visual++;
  }
 }
 stats.push({id:c.id,lessons:c.lessons.length,section_min:Math.min(...sections),section_max:Math.max(...sections),body_characters_min:Math.min(...chars),body_characters_max:Math.max(...chars),previous_body_total:previous[c.id].reduce((n,l)=>n+l.characters,0),new_body_total:chars.reduce((a,b)=>a+b,0)});total+=c.lessons.length;
}
assert.equal(total,839);assert.equal(base,24);assert.equal(solutions,24);assert.equal(visual,11);
const writing=A.courses.find(c=>c.id==='writing');
const fullTexts=writing.lessons.map(l=>l.detail.find(s=>s.title.startsWith('完整范例'))?.body);
assert(fullTexts.every(t=>t&&t.length>400));assert.equal(new Set(fullTexts).size,12);
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
if(!html.includes('assets/workbook-reader.js')){
 html=html.replace(/<script defer src="assets\/depth-reader\.js[^>]*><\/script>\s*/,'');
 const tags=workbooks.map(f=>'<script defer src="'+f+'?v=20261020w3"></script>').join('\n');
 html=html.replace(/(<script defer src="assets\/app\.js[^>]*><\/script>)/,tags+'\n$1\n<script defer src="assets/workbook-reader.js?v=20261020w3"></script>');
 html=html.replace('</head>','<link rel="stylesheet" href="assets/workbook.css?v=20261020w3">\n</head>');
 html=html.replace('详细教学版 2026.10.20.2','实操教材版 2026.10.20.3');
 fs.writeFileSync(path.join(root,'index.html'),html);
}
assert(!html.includes('assets/depth-reader.js'),'both reader versions present');
for(const f of workbooks)assert(html.includes(f),'module not active '+f);
const report={version:A.version,total_lessons:total,course_statistics:stats,record_ids_and_task_counts_preserved:true,base_programs:base,solution_programs:solutions,chart_programs:visual,complete_original_writing_examples:12};
fs.writeFileSync(path.join(out,'content-report.json'),JSON.stringify(report,null,2));
fs.writeFileSync(path.join(out,'curriculum.json'),JSON.stringify(A));
fs.writeFileSync(path.join(out,'candidate-index.html'),html);
fs.cpSync(path.join(root,'assets'),path.join(out,'site','assets'),{recursive:true});fs.mkdirSync(path.join(out,'site','data'),{recursive:true});fs.copyFileSync(path.join(root,'data','papers.js'),path.join(out,'site','data','papers.js'));fs.copyFileSync(path.join(root,'index.html'),path.join(out,'site','index.html'));
console.log('WORKBOOK STRUCTURE AND COVERAGE PASSED\n'+JSON.stringify(report,null,2));
