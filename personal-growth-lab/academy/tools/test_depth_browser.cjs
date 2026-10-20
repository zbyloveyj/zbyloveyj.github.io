'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../../../..'),out=process.env.DEPTH_TEST_OUTPUT||'/tmp/academy-depth-qa';
const base='http://127.0.0.1:8765/personal-growth-lab/academy/';
const server=spawn('python3',['-m','http.server','8765','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
let browser;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 for(let i=0;i<40;i++){try{if((await fetch(base)).ok)break;}catch(_){}if(i===39)throw Error('HTTP server did not start');await sleep(150);}
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 await context.addInitScript(()=>{const k='yixindao.growth-academy.v1';if(!localStorage.getItem(k))localStorage.setItem(k,JSON.stringify({schema:1,records:{'english:1':{tasks:[true,true,true,true],done:true,note:'LEGACY_NOTE_PRESERVED',artifact:'legacy-record.webm',score:4,updatedAt:'2026-10-20T08:00:00.000Z'}},last:{english:1}}));});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'#/english/1');await page.waitForSelector('#depth-handbook');
 assert.equal(await page.locator('#depth-handbook .depth-section').count(),10);
 assert.equal(await page.locator('#note').inputValue(),'LEGACY_NOTE_PRESERVED');
 assert.match(await page.locator('#lesson-state').textContent(),/已完成/);
 await page.locator('[data-task="0"]').uncheck();await page.reload();await page.waitForSelector('#depth-handbook');
 assert.equal(await page.locator('[data-task="0"]').isChecked(),false);
 assert.equal(await page.locator('#note').inputValue(),'LEGACY_NOTE_PRESERVED');
 const privateNote='PRIVATE_TEST_NOTE <script>window.UNSAFE_TEST=1</script> & 中文修订';
 await page.locator('#note').fill(privateNote);await page.reload();await page.waitForSelector('#depth-handbook');
 assert.equal(await page.locator('#note').inputValue(),privateNote);
 assert.equal(await page.evaluate(()=>window.UNSAFE_TEST),undefined);
 let event=page.waitForEvent('download');await page.locator('[data-act="export-lesson"]').click();let download=await event;
 let file=path.join(out,'sample-english-lesson.md');await download.saveAs(file);
 let text=fs.readFileSync(file,'utf8');assert(text.includes('逐句拆解与句法操作')&&text.includes('参考答案与纠错依据')&&text.includes(privateNote));
 event=page.waitForEvent('download');await page.locator('[data-act="export-data"]').click();download=await event;
 file=path.join(out,'learner-backup-test.json');await download.saveAs(file);
 const exported=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(exported.schema,1);assert.equal(exported.records['english:1'].note,privateNote);
 const imported={schema:1,records:{'english:1':{tasks:[true,true,true,true],done:true,note:'IMPORTED_NOTE',artifact:'restored.webm',score:5,updatedAt:'2026-10-21T08:00:00.000Z'}},last:{english:1}};
 await page.locator('#import-file').setInputFiles({name:'test-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});
 await page.waitForFunction(()=>document.getElementById('note')?.value==='IMPORTED_NOTE');
 assert.match(await page.locator('#lesson-state').textContent(),/已完成/);
 const originallyOpen=await page.locator('.depth-answer').evaluateAll(ds=>ds.map(d=>d.open));
 await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
 assert(await page.locator('.depth-answer').evaluateAll(ds=>ds.every(d=>d.open)));
 await page.emulateMedia({media:'print'});assert.equal(await page.locator('.depth-tools').isVisible(),false);
 await page.emulateMedia({media:'screen'});await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
 assert.deepEqual(await page.locator('.depth-answer').evaluateAll(ds=>ds.map(d=>d.open)),originallyOpen);
 await page.locator('#depth-handbook').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'english-desktop.png')});
 await page.goto(base+'#/english');await page.waitForSelector('[data-act="export-course"]');
 event=page.waitForEvent('download');await page.locator('[data-act="export-course"]').click();download=await event;
 file=path.join(out,'english-full-course.md');await download.saveAs(file);text=fs.readFileSync(file,'utf8');
 assert(text.includes('第90天')&&text.includes('逐句拆解与句法操作'));assert(!text.includes('IMPORTED_NOTE')&&!text.includes(privateNote));
 await page.goto(base+'#/coding/11');await page.waitForSelector('#depth-handbook');
 event=page.waitForEvent('download');await page.locator('[data-depth="code"]').first().click();download=await event;
 file=path.join(out,'downloaded-coding-11.py');await download.saveAs(file);text=fs.readFileSync(file,'utf8');assert(text.includes('copy.deepcopy')&&text.includes('assert pred.shape'));
 const counts={english:90,research:52,coding:24,papers:100,visual:24,writing:48,thinking:365,neuro:24,career:12,life:100},routes=[];
 for(const [id,n] of Object.entries(counts))for(const lesson of [1,Math.ceil(n/2),n]){
  await page.goto(base+'#/'+id+'/'+lesson);await page.waitForSelector('#depth-handbook');
  const sections=await page.locator('#depth-handbook .depth-section').count();assert(sections>=8&&sections<=10,id+':'+lesson);
  assert(await page.locator('#depth-handbook').innerText().then(x=>x.length>700));
  routes.push(id+':'+lesson);
 }
 const exportCoverage=await page.evaluate(()=>{
  let count=0,code=0;
  for(const c of ACADEMY.courses)for(const l of c.lessons){const md=ACADEMY_DEPTH.markdown(c.id,l.id);if(!l.detail.every(s=>md.includes(s.title)&&md.includes(s.body)))throw Error('Missing exported section '+c.id+':'+l.id);if(l.code){if(!md.includes(l.code.trimEnd()))throw Error('Code missing from export');code++;}count++;}
  return{lessons:count,code_examples:code};
 });assert.equal(exportCoverage.lessons,839);assert.equal(exportCoverage.code_examples,24);
 const layout=[];
 for(const width of [390,768,1440]){
  await page.setViewportSize({width,height:900});
  for(const route of ['english/1','coding/11','writing/5','thinking/365','life/74']){
   await page.goto(base+'#/'+route);await page.waitForSelector('#depth-handbook');
   const extent=await page.evaluate(()=>({viewport:innerWidth,body:document.documentElement.scrollWidth}));
   assert(extent.body<=extent.viewport+2,'Horizontal overflow: '+route+' at '+width+' '+JSON.stringify(extent));layout.push({width,route,...extent});
  }
 }
 await page.setViewportSize({width:390,height:844});await page.goto(base+'#/writing/1');await page.waitForSelector('#depth-handbook');await page.locator('#depth-handbook').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'writing-mobile.png')});
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'#/');await page.waitForSelector('.depth-edition');await page.screenshot({path:path.join(out,'academy-home.png')});
 assert.deepEqual(errors,[],'Browser JavaScript errors');
 const report={status:'passed',route_samples:routes.length,routes,legacy_note_and_tasks_preserved:true,note_escaped:true,backup_import_export:true,full_course_excludes_private_notes:true,complete_markdown_exports:exportCoverage,code_download:true,print_includes_answer_bodies:true,responsive_checks:layout,page_errors:errors};
 fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));console.log('BROWSER CHECKS PASSED\n'+JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.kill('SIGTERM');});
