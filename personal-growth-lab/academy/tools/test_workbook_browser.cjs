'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../../..'),out=process.env.WORKBOOK_QA_DIR||'/tmp/academy-workbook-qa';
const base='http://127.0.0.1:8766/personal-growth-lab/academy/';
const server=spawn('python3',['-m','http.server','8766','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});let browser;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 for(let i=0;i<40;i++){try{if((await fetch(base)).ok)break;}catch(_){}if(i===39)throw Error('server not available');await pause(150);}
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 await context.addInitScript(()=>{const key='yixindao.growth-academy.v1';if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({schema:1,records:{'english:1':{tasks:[true,true,true,true],done:true,note:'LEGACY_PRESERVED',artifact:'old.webm',score:4,updatedAt:'2026-10-20T01:00:00Z'}},last:{english:1}}));});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'#/english/1');await page.waitForSelector('#depth-handbook');
 assert.equal(await page.locator('#note').inputValue(),'LEGACY_PRESERVED');
 assert.match(await page.locator('#lesson-state').innerText(),/已完成/);
 assert.equal(await page.locator('#depth-handbook').count(),1);
 assert(await page.locator('#depth-handbook').innerText().then(t=>t.includes('逐句带读')));
 const order=await page.evaluate(()=>{const sheet=document.querySelector('.lesson-sheet'),book=sheet.querySelector('#depth-handbook'),task=sheet.querySelector('#task-list');return Boolean(book.compareDocumentPosition(task)&Node.DOCUMENT_POSITION_FOLLOWING);});assert(order);
 await page.locator('[data-task="0"]').uncheck();await page.reload();await page.waitForSelector('#depth-handbook');
 assert.equal(await page.locator('[data-task="0"]').isChecked(),false);
 const note='PRIVATE_NOTE <script>window.UNSAFE=1</script> 中文练习';await page.locator('#note').fill(note);await page.reload();await page.waitForSelector('#depth-handbook');
 assert.equal(await page.locator('#note').inputValue(),note);assert.equal(await page.evaluate(()=>window.UNSAFE),undefined);
 let ev=page.waitForEvent('download');await page.locator('[data-act="export-lesson"]').click();let d=await ev;let dest=path.join(out,'test-lesson-export.md');await d.saveAs(dest);
 let txt=fs.readFileSync(dest,'utf8');assert(txt.includes(note)&&txt.includes('逐句带读')&&txt.includes('完整参考'));
 ev=page.waitForEvent('download');await page.locator('[data-act="export-data"]').click();d=await ev;dest=path.join(out,'test-state-backup.json');await d.saveAs(dest);assert.equal(JSON.parse(fs.readFileSync(dest,'utf8')).records['english:1'].note,note);
 const state={schema:1,records:{'english:1':{tasks:[true,true,true,true],done:true,note:'IMPORTED_PRIVATE_NOTE',artifact:'restored.webm',score:5,updatedAt:'2027-01-01T00:00:00Z'}},last:{english:1}};
 await page.locator('#import-file').setInputFiles({name:'state.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(state))});await page.waitForFunction(()=>document.getElementById('note')?.value==='IMPORTED_PRIVATE_NOTE');
 assert.equal(await page.locator('#depth-handbook').count(),1);
 const opens=await page.locator('.depth-answer').evaluateAll(ds=>ds.map(d=>d.open));await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));assert(await page.locator('.depth-answer').evaluateAll(ds=>ds.every(d=>d.open)));
 await page.emulateMedia({media:'print'});assert.equal(await page.locator('.depth-tools').isVisible(),false);await page.emulateMedia({media:'screen'});await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));assert.deepEqual(await page.locator('.depth-answer').evaluateAll(ds=>ds.map(d=>d.open)),opens);
 await page.locator('[data-workbook="answers"]').click();assert(await page.locator('.depth-answer').evaluateAll(ds=>ds.every(d=>d.open)));await page.locator('[data-workbook="answers"]').click();
 await page.goto(base+'#/english');await page.waitForSelector('[data-act="export-course"]');ev=page.waitForEvent('download');await page.locator('[data-act="export-course"]').click();d=await ev;dest=path.join(out,'test-course-export.md');await d.saveAs(dest);txt=fs.readFileSync(dest,'utf8');assert(txt.includes('第90天')&&txt.includes('完整参考'));assert(!txt.includes('IMPORTED_PRIVATE_NOTE')&&!txt.includes(note));
 await page.goto(base+'#/coding/11');await page.waitForSelector('#depth-handbook');
 ev=page.waitForEvent('download');await page.locator('[data-workbook="solution-code"]').click();d=await ev;dest=path.join(out,'download-solution.py');await d.saveAs(dest);txt=fs.readFileSync(dest,'utf8');assert(txt.includes('snapshot restoration passed'));
 ev=page.waitForEvent('download');await page.locator('[data-workbook="base-code"]').click();d=await ev;dest=path.join(out,'download-base.py');await d.saveAs(dest);txt=fs.readFileSync(dest,'utf8');assert(txt.includes('best_validation_loss'));
 const codeSections=await page.evaluate(()=>ACADEMY.courses.find(c=>c.id==='coding').lessons[10].detail.flatMap((s,i)=>s.code?[{i,code:s.code}]:[]));assert.equal(codeSections.length,2);
 for(const item of codeSections){ev=page.waitForEvent('download');await page.locator(`[data-workbook-code="${item.i}"]`).click();d=await ev;dest=path.join(out,'section-'+item.i+'.py');await d.saveAs(dest);assert.equal(fs.readFileSync(dest,'utf8'),item.code);}
 await page.goto(base+'#/visual/1');await page.waitForSelector('#depth-handbook');ev=page.waitForEvent('download');await page.locator('[data-workbook-code]').click();d=await ev;dest=path.join(out,'download-visual.py');await d.saveAs(dest);assert(fs.readFileSync(dest,'utf8').includes('fig.savefig'));
 const counts={english:90,coding:24,writing:48,research:52,visual:24,neuro:24,thinking:365,career:12,life:100,papers:100},routes=[];
 for(const [id,n] of Object.entries(counts))for(const lesson of [1,Math.ceil(n/2),n]){
  await page.goto(base+'#/'+id+'/'+lesson);await page.waitForSelector('#depth-handbook');const count=await page.locator('#depth-handbook .depth-section').count();assert(count>=8&&count<=18);routes.push(id+':'+lesson);
 }
 const coverage=await page.evaluate(()=>{let lessons=0,codes=0;for(const c of ACADEMY.courses)for(const l of c.lessons){const md=ACADEMY_WORKBOOK.markdown(c.id,l.id);for(const s of l.detail){if(!md.includes(s.body))throw Error('body missing '+c.id+':'+l.id);if(s.code){if(!md.includes(s.code.trimEnd()))throw Error('code missing');codes++;}}lessons++;}return{lessons,codes};});assert.equal(coverage.lessons,839);assert.equal(coverage.codes,59);
 const layouts=[];
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});for(const route of ['english/1','coding/11','writing/1','papers/1','life/74']){await page.goto(base+'#/'+route);await page.waitForSelector('#depth-handbook');const dim=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));assert(dim.scroll<=dim.w+2,route+' overflow '+JSON.stringify(dim));layouts.push({width,route,...dim});}}
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'#/writing/1');await page.waitForSelector('#depth-handbook');await page.locator('.depth-example').filter({hasText:'六点过后'}).first().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'writing-full-example-desktop.png')});
 await page.goto(base+'#/coding/11');await page.waitForSelector('#depth-handbook');await page.locator('.depth-section').filter({hasText:'代码带读｜从输入'}).first().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'coding-walkthrough-desktop.png')});
 await page.setViewportSize({width:390,height:844});await page.goto(base+'#/english/1');await page.waitForSelector('#depth-handbook');await page.locator('#depth-handbook').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'english-mobile.png')});
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'#/');await page.waitForSelector('.depth-edition');await page.screenshot({path:path.join(out,'workbook-home.png')});
 assert.deepEqual(errors,[]);
 const report={status:'passed',version:'2026.10.20.3-workbook',route_samples:routes,full_export:coverage,legacy_records_preserved:true,note_reload_and_escaping:true,backup_roundtrip:true,course_export_has_no_private_notes:true,code_download_matches_selected_section:true,print_answers_expand_and_restore:true,responsive:layouts,page_errors:errors};
 fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));console.log('WORKBOOK BROWSER TESTS PASSED\n'+JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.kill('SIGTERM');});
