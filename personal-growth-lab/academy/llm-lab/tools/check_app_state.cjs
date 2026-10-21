/* State/route regression checks; layout and interaction are checked in browser.
 * Uses the real course and app in an isolated JS context, without user storage.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const handlers = {};
const host = {innerHTML:'', focus(){}};
const storage = new Map();
const context = {
  window:{addEventListener:(name,fn)=>handlers[name]=fn,scrollTo(){}},
  document:{getElementById:()=>host,querySelectorAll:()=>[],addEventListener(){},title:''},
  location:{hash:'#/'},
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
  setTimeout(){},clearTimeout(){},TextEncoder,TextDecoder,console
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'assets/course-data.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(root,'assets/evidence-data.js'),'utf8'),context);
const lessons=context.window.CM_COURSE.lessons;
const total=context.window.CM_COURSE.config.expected_lessons;
const legacyCount=30;
const records={};
for(const l of lessons.slice(0,legacyCount))records[l.day]={checks:l.lab.acceptance.map(()=>true),answers:l.quiz.map(q=>q.correct),submitted:true,done:true,note:`原有笔记 ${l.day}`,artifact:`runs/day${l.day}`,updatedAt:'2026-10-20T12:00:00Z'};
storage.set('yixindao.curatemicrobiota.v1',JSON.stringify({schema:1,project:'curatemicrobiota',records}));
vm.runInContext(fs.readFileSync(path.join(root,'assets/lab.js'),'utf8'),context);
assert.equal(context.window.CM_LAB.lessonCount,total);
assert.ok(host.innerHTML.includes(`${legacyCount}/${total}`));
const restored=context.window.CM_LAB.normalize(JSON.parse(storage.get('yixindao.curatemicrobiota.v1')));
assert.equal(Object.keys(restored.records).length,legacyCount);
for(let d=1;d<=legacyCount;d++){
  assert.equal(restored.records[d].note,`原有笔记 ${d}`);
  assert.equal(restored.records[d].done,true);
  assert.equal(restored.records[d].quizScore,lessons[d-1].quiz.length);
}
context.location.hash='#/day/14';handlers.hashchange();
assert.ok(host.innerHTML.includes('href="#/day/15"'));
context.location.hash='#/day/30';handlers.hashchange();
assert.ok(host.innerHTML.includes(lessons[29].title));
assert.ok(host.innerHTML.includes('href="#/day/31"'));
for(let day=31;day<=total;day++){
  context.location.hash=`#/day/${day}`;handlers.hashchange();
  assert.ok(host.innerHTML.includes(lessons[day-1].title));
  assert.equal(restored.records[day],undefined);
}
assert.ok(host.innerHTML.includes('项目验收 →'));
context.location.hash='#/coverage';handlers.hashchange();
const topicCount=context.window.CM_COURSE.coverage.groups.reduce((n,g)=>n+g.topics.length,0);
assert.equal((host.innerHTML.match(/class="coverage-topic"/g)||[]).length,topicCount);
context.location.hash='#/audit';handlers.hashchange();
assert.equal((host.innerHTML.match(/class="audit-gap"/g)||[]).length,9);
assert.equal((host.innerHTML.match(/class="audit-checkpoint"/g)||[]).length,12);
assert.ok(host.innerHTML.includes('不会把阅读记录自动换算为掌握程度'));
context.location.hash='#/project';handlers.hashchange();
assert.ok(host.innerHTML.includes('curatemicrobiota.local_service serve'));
assert.ok(host.innerHTML.includes('curatemicrobiota.local_service client'));
const damaged=JSON.parse(JSON.stringify(restored));
damaged.records[1].answers[0]=(lessons[0].quiz[0].correct+1)%4;
damaged.records[1].done=true;
damaged.records[total+1]={done:true};
const sanitized=context.window.CM_LAB.normalize(damaged);
assert.equal(sanitized.records[1].done,false);
assert.equal(sanitized.records[total+1],undefined);
assert.throws(()=>context.window.CM_LAB.normalize({schema:99,project:'curatemicrobiota',records:{}}));
console.log(JSON.stringify({status:'passed',lessons:total,legacy_records_preserved:legacyCount,coverage_topics:topicCount,independent_checkpoints:12,checks:['all thirty old records preserved','14-to-15 and 30-to-31 navigation','all supplemental routes','coverage and audit routes','local service commands','completion gate','invalid import']}));
