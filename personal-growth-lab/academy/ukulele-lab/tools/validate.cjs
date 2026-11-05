'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..'),scope={window:{}};
for(const file of ['course-data.js','music-data.js','progress.js'])vm.runInNewContext(fs.readFileSync(path.join(root,'assets',file),'utf8'),scope,{filename:file});
const {UKE_COURSE:C,UKE_MUSIC:M,UKE_PROGRESS:P}=scope.window;
const clean=x=>JSON.parse(JSON.stringify(x));
assert.equal(C.lessons.length,30,'thirty complete lessons');
assert.equal(new Set(C.lessons.map(l=>l.title)).size,30,'distinct daily goals');
assert.equal(M.rubric.reduce((n,r)=>n+r.weight,0),100);
assert.deepStrictEqual(clean(M.rubric.map(r=>r.id)),clean(P.SCORE_IDS));
assert.deepStrictEqual(clean(M.rubric.map(r=>r.weight)),clean(P.WEIGHTS));
assert.equal(M.songs.length,3);assert.equal(new Set(M.songs.map(s=>s.id)).size,3);
let tasks=0,questions=0,minutes=0;
for(const [i,l] of C.lessons.entries()){
 assert.equal(l.day,i+1);assert(l.goal.length>10);
 assert(l.concepts.length>=3&&l.concepts.every(c=>c.title&&c.body.length>60),`day ${l.day} substantial explanation`);
 assert(l.blocks.length>=5&&l.blocks.every(b=>b.steps.length>0&&b.steps.every(s=>s.length>10)),`day ${l.day} concrete steps`);
 assert.equal(new Set(l.blocks.map(b=>b.id)).size,l.blocks.length);
 assert.equal(l.blocks.reduce((n,b)=>n+b.minutes,0),l.minutes,`day ${l.day} time budget`);
 assert(l.minutes>=45&&l.minutes<=60);minutes+=l.minutes;
 assert(l.quiz.length>=2);questions+=l.quiz.length;
 for(const q of l.quiz){assert(q.options.length>=3);assert(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.options.length);assert(q.explanation.length>10);}
 for(const chord of [...l.chords,...l.drill.chords])assert(M.chords[chord],`day ${l.day} unknown chord ${chord}`);
 assert(M.patterns[l.pattern],`day ${l.day} unknown rhythm`);
 const span=l.drill.beatsPerChord||4;
 assert([2,4,8].includes(span),`day ${l.day} supported chord duration`);
 assert.equal(span,[2,3,4,9,10,16].includes(l.day)?8:l.day===18?2:4,`day ${l.day} intended chord-change timing`);
 if(l.drill.barPatterns){assert.equal(l.drill.barPatterns.length,l.drill.bars);for(const id of l.drill.barPatterns)assert(M.patterns[id]);}
 if([12,19].includes(l.day))assert.deepStrictEqual(clean(l.drill.barPatterns),['down2','down2','down2','down2','down4','down4','down4','down4']);
 if(l.drill.omitBeatIndices)for(const beat of l.drill.omitBeatIndices)assert(Number.isInteger(beat)&&beat>=0&&beat<l.drill.bars*4);
 if(l.day===26)assert.deepStrictEqual(clean(l.drill.omitBeatIndices),[8]);
 assert(l.song===null||M.songs.some(s=>s.id===l.song));
 assert(l.criteria.length>=3&&l.evidence&&l.fallback&&l.stretch);
 tasks+=P.stepKeys(l).length;
 const json=JSON.parse(fs.readFileSync(path.join(root,'course',`day${String(l.day).padStart(2,'0')}.json`),'utf8'));
 assert.deepStrictEqual(json,clean(l),`canonical day ${l.day} stale`);
}
for(const song of M.songs){assert(song.resources.length>0&&song.resources.every(r=>/^https:\/\//.test(r.url)));assert(song.approach.length>=3&&song.sectionPlan.length>=3);}
// Independently check the sounding pitch classes, rather than trusting fret labels.
const roots={C:0,D:2,E:4,F:5,G:7,A:9,B:11,'F#':6},open=[7,0,4,9];
for(const [name,c] of Object.entries(M.chords)){
 assert(c.frets.length===4&&c.fingers.length===4);
 const [,base,quality]=name.match(/^([A-G]#?)(.*)$/)||[];assert(base,`chord label ${name}`);
 const intervals={'':[0,4,7],m:[0,3,7],'7':[0,4,7,10],m7:[0,3,7,10],maj7:[0,4,7,11]}[quality];assert(intervals,name);
 const expected=new Set(intervals.map(v=>(roots[base]+v)%12));
 const actual=new Set(c.frets.map((f,j)=>(open[j]+f)%12));
 assert.deepStrictEqual([...actual].sort(),[...expected].sort(),`sounding chord ${name}`);
 c.frets.forEach((f,i)=>assert(f===0?c.fingers[i]===0:c.fingers[i]>=1&&c.fingers[i]<=4));
}
const strums={down2:[0,4],down4:[0,2,4,6],island:[0,2,3,5,6,7]};
for(const [id,onsets] of Object.entries(strums)){const p=M.patterns[id];assert.equal(p.steps.length,8);assert.deepStrictEqual(clean(p.steps.flatMap((s,i)=>s?[i]:[])),onsets);}
assert.deepStrictEqual(clean(M.patterns.pick4.strings),[3,2,1,2]);
assert.deepStrictEqual(clean(M.patterns.pick8.strings),[3,2,1,2,4,2,1,2]);
// False graduation and import corruption are the material risks for this classroom.
const empty=P.fresh();assert(!P.assess(P.freshAssessment()).passed);assert.equal(P.assess(P.freshAssessment()).score,null);
const a=P.freshAssessment();for(const k of P.SCORE_IDS)a.scores[k]=4;
Object.assign(a,{complete:true,oneTake:true,restarts:0,evidence:'my-complete-take.webm'});
assert.equal(P.assess(a).score,80);assert(P.assess(a).passed);
for(const missing of ['complete','oneTake','evidence','restarts']){const b=clean(a);b[missing]=missing==='evidence'?'':missing==='restarts'?null:false;assert(!P.assess(b).passed,missing);}
const weak=clean(a);for(const k of P.SCORE_IDS)weak.scores[k]=5;weak.scores.pitch=2;assert(P.assess(weak).score>=80);assert(!P.assess(weak).passed,'a high total must not conceal a weak dimension');
const zero=clean(a);for(const k of P.SCORE_IDS)zero.scores[k]=0;assert.equal(P.assess(zero).score,0);assert(!P.assess(zero).passed);
const r=P.freshRecord();r.done=true;r.metrics.minutes=50;assert(!P.lessonDone(C.lessons[0],r));for(const k of P.stepKeys(C.lessons[0]))r.tasks[k]=true;assert(P.lessonDone(C.lessons[0],r));
const bad=P.fresh();bad.records['1']=P.freshRecord();bad.records['1'].metrics.changesOk=17;bad.records['1'].metrics.changesTotal=16;assert(!P.validate(bad).ok);
assert(!P.validate({schema:1,records:{31:{}}}).ok);assert(!P.validate({app:'another-course',state:empty}).ok);
const invalidScore=clean(empty);invalidScore.assessments['an-jing']=clean(a);invalidScore.assessments['an-jing'].scores.rhythm='5';assert(!P.validate(invalidScore).ok);
const older=P.fresh(),newer=P.fresh();older.records['1']=clean(r);newer.records['1']=clean(r);older.records['1'].updatedAt='2026-11-04T00:00:00.000Z';newer.records['1'].updatedAt='2026-11-05T00:00:00.000Z';older.records['1'].note='old';newer.records['1'].note='new';
assert.equal(P.merge(older,newer).records['1'].note,'new');assert.equal(P.merge(newer,older).records['1'].note,'new');
const all=P.fresh();all.assessments['an-jing']=clean(a);all.assessments['qing-tian']=clean(a);assert(!P.stats(all,C,M).graduated);all.assessments.sadness=clean(a);assert(P.stats(all,C,M).graduated);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');for(const [,src]of html.matchAll(/<script[^>]*src="([^"]+)"/g))assert(fs.existsSync(path.join(root,src.split('?')[0])),src);
const result={valid:true,days:30,training_minutes:minutes,task_steps:tasks,questions,verified_chord_spellings:Object.keys(M.chords).length,rhythm_patterns:Object.keys(M.patterns).length,graduation_gates:'empty/missing/weak/zero/success checked',backup_merge:'newest per record; invalid input rejected'};
console.log(JSON.stringify(result,null,2));
