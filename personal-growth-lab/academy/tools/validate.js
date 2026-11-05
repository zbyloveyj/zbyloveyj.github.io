'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const siteRoot=path.resolve(root,'../..');
const readJSON=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
function localPath(url,page){
 const name=decodeURIComponent(url.split(/[?#]/)[0]);
 return name.startsWith('/')?path.join(siteRoot,name.slice(1)):path.resolve(root,path.dirname(page),name);
}
function pageScripts(page){
 const html=fs.readFileSync(path.join(root,page),'utf8');
 return [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)].flatMap(([,src])=>{
  if(/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(src))return [];
  const file=localPath(src,page);
  assert(fs.existsSync(file)&&fs.statSync(file).isFile(),`${page}: missing script ${src}`);
  return [path.relative(root,file).split(path.sep).join('/')];
 });
}
const scripts=pageScripts('index.html');
const catalogSources=['assets/core.js','assets/english.js','assets/studio.js','assets/explore.js','data/papers.js','assets/papers.js','assets/curatemicrobiota-bridge.js','assets/agent-bridge.js','assets/ukulele-bridge.js'];
for(const p of [...catalogSources,'assets/app.js'])assert(scripts.includes(p),`index.html: missing catalog script ${p}`);
for(const p of catalogSources)assert(scripts.indexOf(p)<scripts.indexOf('assets/app.js'),`${p} must load before the academy app`);
global.window=global;
// Load the catalog in the same order as the published page, without running DOM code.
for(const p of scripts.filter(p=>catalogSources.includes(p)))vm.runInThisContext(fs.readFileSync(path.join(root,p),'utf8'),{filename:p});
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

// The independent classrooms are published too: a bridge alone is not a course.
const release=readJSON('release.json');
const external=ACADEMY.externalCourses||[];
assert.equal(external.length,3,'external course count');
const allCourses=[...ACADEMY.courses,...external];
assert.equal(new Set(allCourses.map(c=>c.id)).size,allCourses.length,'duplicate course IDs');
const allExpected={...expected,llm:39,agent:30,ukulele:30};
const runtimes={};
let checkedScripts=scripts.length;
for(const [id,dir,globalName,bodyKey] of [['llm','llm-lab','CM_COURSE','sections'],['agent','agent-lab','AGENT_COURSE','concepts'],['ukulele','ukulele-lab','UKE_COURSE','concepts']]){
 const course=external.find(c=>c.id===id);
 assert(course,`missing ${id} bridge`);
 assert.equal(course.lessons.length,allExpected[id],`${id}: bridge lesson count`);
 const entry=localPath(course.external,'index.html');
 assert.equal(path.join(entry,'index.html'),path.join(root,dir,'index.html'),`${id}: bridge entry path`);
 const ownScripts=pageScripts(`${dir}/index.html`);
 checkedScripts+=ownScripts.length;
 const runtimePath=`${dir}/assets/course-data.js`;
 assert(ownScripts.includes(runtimePath),`${dir}/index.html must load its course data`);
 assert.equal(release[`${id}_project`].path,`${dir}/`,`${id}: release entry path`);
 const sandbox={window:{}};
 vm.runInNewContext(fs.readFileSync(path.join(root,runtimePath),'utf8'),sandbox,{filename:runtimePath});
 // Copy data out of the VM realm so structural comparisons use normal objects.
 const data=JSON.parse(JSON.stringify(sandbox.window[globalName]));
 runtimes[id]=data;
 assert.equal(data.lessons.length,course.lessons.length,`${id}: runtime/bridge count mismatch`);
 const canonicalFiles=fs.readdirSync(path.join(root,dir,'course')).filter(p=>/^day\d+\.json$/.test(p));
 assert.equal(canonicalFiles.length,data.lessons.length,`${id}: canonical lesson count`);
 for(const [i,lesson] of data.lessons.entries()){
  const day=i+1,sourcePath=`${dir}/course/day${String(day).padStart(2,'0')}.json`;
  assert.equal(lesson.day,day,`${id}: runtime lesson numbering`);
  assert.equal(course.lessons[i].id,day,`${id}: bridge lesson numbering`);
  assert.equal(course.lessons[i].title,lesson.title,`${id} day ${day}: bridge title mismatch`);
  assert(Array.isArray(lesson[bodyKey])&&lesson[bodyKey].length,`${id} day ${day}: missing lesson body`);
  assert.deepStrictEqual(lesson,readJSON(sourcePath),`${sourcePath}: rebuild the published course-data.js`);
 }
 assert.equal(release[`${id}_project`].lessons,data.lessons.length,`${id}: release lesson count`);
}
const manifest=readJSON('llm-lab/course-manifest.json');
const config=readJSON('llm-lab/course-config.json');
const llm=runtimes.llm;
assert.deepStrictEqual(llm.config,config,'LLM runtime configuration is stale');
assert.equal(manifest.version,llm.version,'LLM manifest version');
assert.equal(manifest.lessons,llm.lessons.length,'LLM manifest lesson count');
assert.equal(config.expected_lessons,llm.lessons.length,'LLM configured lesson count');
for(const field of ['core_lessons','advanced_lessons','supplemental_lessons']){
 assert.equal(manifest[field],config[field],`LLM manifest ${field}`);
 assert.equal(release.llm_project[field],manifest[field],`LLM release ${field}`);
}
assert.equal(manifest.core_lessons+manifest.advanced_lessons+manifest.supplemental_lessons,manifest.lessons,'LLM lesson groups must cover every lesson');
const topics=llm.coverage.groups.reduce((n,g)=>n+g.topics.length,0);
assert.equal(manifest.coverage_topics,topics,'LLM manifest knowledge coverage');
assert.equal(release.llm_project.coverage_topics,topics,'LLM release knowledge coverage');
assert.equal(manifest.independent_checkpoints,llm.audit.checkpoints.length,'LLM manifest checkpoints');
assert.equal(allCourses.length,13,'complete academy project count');
const totalUnits=allCourses.reduce((n,c)=>n+c.lessons.length,0);
assert.equal(totalUnits,938,'complete academy unit count');
assert.equal(release.projects,allCourses.length,'release project count');
assert.equal(release.units,totalUnits,'release total unit count');
console.log(JSON.stringify({projects:allExpected,total_units:totalUnits,bibliography_items:PAPER_CATALOG.length,priority:['english','coding','writing'],external_source_lessons:runtimes.llm.lessons.length+runtimes.agent.lessons.length+runtimes.ukulele.lessons.length,checked_script_references:checkedScripts,valid:true},null,2));

// The new music classroom has additional performance-gate and backup checks.
require('./../ukulele-lab/tools/validate.cjs');
