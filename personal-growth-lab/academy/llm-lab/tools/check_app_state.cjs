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
const records={};
for(const l of lessons.slice(0,14))records[l.day]={checks:l.lab.acceptance.map(()=>true),answers:l.quiz.map(q=>q.correct),submitted:true,done:true,note:`原有笔记 ${l.day}`,artifact:`runs/day${l.day}`,updatedAt:'2026-10-20T12:00:00Z'};
storage.set('yixindao.curatemicrobiota.v1',JSON.stringify({schema:1,project:'curatemicrobiota',records}));
vm.runInContext(fs.readFileSync(path.join(root,'assets/lab.js'),'utf8'),context);
assert.equal(context.window.CM_LAB.lessonCount,30);
assert.ok(host.innerHTML.includes('14/30'));
const restored=context.window.CM_LAB.normalize(JSON.parse(storage.get('yixindao.curatemicrobiota.v1')));
assert.equal(Object.keys(restored.records).length,14);
for(let d=1;d<=14;d++){
  assert.equal(restored.records[d].note,`原有笔记 ${d}`);
  assert.equal(restored.records[d].done,true);
  assert.equal(restored.records[d].quizScore,lessons[d-1].quiz.length);
}
context.location.hash='#/day/14';handlers.hashchange();
assert.ok(host.innerHTML.includes('href="#/day/15"'));
context.location.hash='#/day/30';handlers.hashchange();
assert.ok(host.innerHTML.includes(lessons[29].title));
assert.ok(host.innerHTML.includes('项目验收 →'));
context.location.hash='#/coverage';handlers.hashchange();
assert.equal((host.innerHTML.match(/class="coverage-topic"/g)||[]).length,43);
const damaged=JSON.parse(JSON.stringify(restored));
damaged.records[1].answers[0]=(lessons[0].quiz[0].correct+1)%4;
damaged.records[1].done=true;
damaged.records[31]={done:true};
const sanitized=context.window.CM_LAB.normalize(damaged);
assert.equal(sanitized.records[1].done,false);
assert.equal(sanitized.records[31],undefined);
assert.throws(()=>context.window.CM_LAB.normalize({schema:99,project:'curatemicrobiota',records:{}}));
console.log(JSON.stringify({status:'passed',lessons:30,legacy_records_preserved:14,coverage_topics:43,checks:['old progress','14-to-15 navigation','unit 30 route','coverage route','completion gate','invalid import']}));
