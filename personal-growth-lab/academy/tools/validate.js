'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..');
global.window=global;
for(const p of ['assets/core.js','assets/english.js','assets/studio.js','assets/explore.js','data/papers.js','assets/papers.js'])vm.runInThisContext(fs.readFileSync(path.join(root,p),'utf8'),{filename:p});
const expected={english:90,coding:24,writing:48,research:52,visual:24,neuro:24,thinking:365,career:12,life:100,papers:100};
assert.equal(ACADEMY.courses.length,10);
for(const c of ACADEMY.courses){
 assert.equal(c.lessons.length,expected[c.id],c.id);
 assert.equal(new Set(c.lessons.map(l=>l.title)).size,c.lessons.length,c.id+' duplicate titles');
 for(const [i,l] of c.lessons.entries()){
  assert.equal(l.id,i+1);assert(l.title&&l.concept&&l.output&&l.stage);assert(l.tasks.length>=3);assert(l.criteria.length>=3);
  assert(l.tasks.every(t=>typeof t==='string'&&t.length>10));
  for(const r of l.refs||[])assert(ACADEMY.resources[r],r);
  if(l.download)assert(fs.existsSync(path.join(root,l.download)));
 }
}
assert.equal(ACADEMY.courses.reduce((s,c)=>s+c.lessons.length,0),839);
assert.equal(ACADEMY.courses.filter(c=>c.priority).length,3);
assert.equal(new Set(PAPER_CATALOG.map(p=>p.pmid)).size,PAPER_CATALOG.length);
if(process.argv.includes('--full-catalog'))assert.equal(PAPER_CATALOG.length,100);
console.log(JSON.stringify({projects:expected,total_units:839,bibliography_items:PAPER_CATALOG.length,priority:['english','coding','writing'],valid:true},null,2));
