'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),data=JSON.parse(fs.readFileSync(path.join(root,'data/labs.json')));
const M=require('../assets/lab-model.js');
(async()=>{
 const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}try{const type={'.js':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html'}[path.extname(file)]||'text/plain';res.setHeader('Content-Type',type);res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://raw.githubusercontent.com/**',r=>r.abort());
  const ready=async()=>{await page.waitForSelector('.lab-card');await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);};
  await page.goto(base+'/labs.html');await ready();
  assert.equal(await page.locator('.lab-card').count(),24);
  assert.match(await page.locator('#stats').innerText(),new RegExp(data.labs.length.toLocaleString('zh-CN')));
  assert.equal(await page.locator('#status').inputValue(),'');
  const totalPages=Math.ceil(data.labs.length/24);
  await page.locator(`#pagination [data-page="${totalPages}"]`).click();
  const lastId=await page.locator('.lab-card').first().getAttribute('id');
  await page.locator('.lab-card input[data-compare]').first().check();
  await page.locator('#pagination [data-page="1"]').first().click();
  for(const id of ['theis','stegle','chang'])await page.locator(`[data-compare="${id}"]`).check();
  await page.locator('[data-compare="bassett"]').click();assert.equal(await page.locator('[data-compare="bassett"]').isChecked(),false);
  await page.locator('#compare-open').click();assert.equal(await page.locator('#comparison').isVisible(),true);assert.equal(await page.locator('thead th').count(),5);
  await page.locator('#compare-clear').click();
  await page.getByRole('button',{name:'查看计算生物学 ↗'}).click();
  const compbio=data.labs.filter(l=>l.directions.includes('计算生物学')).length;
  assert.equal(await page.locator('.lab-card').count(),Math.min(24,compbio));
  await page.getByRole('button',{name:'重置筛选',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.lab-card').length===24);
  await page.locator('#country').selectOption('日本');
  const jp=data.labs.filter(l=>l.country==='日本'||(l.affiliations||[]).some(a=>a.country==='日本')).length;
  assert.match(await page.locator('#result-count').innerText(),new RegExp('筛选 '+jp.toLocaleString('zh-CN')+' 个'));
  const downloadPromise=page.waitForEvent('download');await page.locator('#export-results').click();const download=await downloadPromise;const out=await download.path();const csv=fs.readFileSync(out,'utf8');assert.equal(csv.trim().split('\r\n').length,jp+1);assert.match(csv,/长期候选/);
  await page.reload();await ready();assert.equal(await page.locator('#country').inputValue(),'日本');
  await page.getByRole('button',{name:'重置筛选',exact:true}).click();
  await page.locator('#query').fill('no-match-zzzz');assert.equal(await page.locator('.lab-card').count(),0);
  await page.locator('#query').fill('Edward F. Chang');assert.equal(await page.locator('.lab-card').count(),1);
  await page.locator('#lab-chang summary').click();assert.equal(await page.locator('#lab-chang details').getAttribute('open'),'');
  // A deep link to a record outside the first page must restore the correct page.
  await page.goto(base+'/labs.html#'+lastId);await ready();assert.equal(await page.locator('#'+lastId+' details').getAttribute('open'),'');
  // Changing the view after following a card must clear its old anchor, including on reload.
  await page.locator('#country').selectOption('日本');assert.equal(new URL(page.url()).hash,'');
  await page.reload();await ready();assert.equal(await page.locator('#country').inputValue(),'日本');
  await page.goto(base+'/labs.html?country=日本#'+lastId);await ready();assert.equal(await page.locator('#'+lastId+' details').getAttribute('open'),'');
  // A browser history entry without filters must restore defaults, not retain later filters.
  await page.evaluate(()=>history.pushState(null,'',location.pathname+'?country=日本'));
  await page.locator('#country').selectOption('日本');
  await page.evaluate(()=>{history.pushState(null,'',location.pathname);dispatchEvent(new PopStateEvent('popstate'));});
  assert.equal(await page.locator('#country').inputValue(),'');assert.equal(await page.locator('.lab-card').count(),24);
  // Cross-field filtering uses AND across axes, with persistent URL state.
  const cross=data.labs.find(l=>l.evidenceLevel==='research_profile'&&l.facets.methods.length&&l.facets.diseases.length&&l.facets.modalities.length);
  assert(cross,'Need one fully sourced cross-field profile for integration QA.');
  await page.locator('#advanced-filters summary').click();
  await page.locator('#direction').selectOption(cross.directions[0]);
  await page.locator('#method-filter').selectOption(cross.facets.methods[0]);
  await page.locator('#disease-filter').selectOption(cross.facets.diseases[0]);
  await page.locator('#modality-filter').selectOption(cross.facets.modalities[0]);
  const crossCount=data.labs.filter(l=>l.directions.includes(cross.directions[0])&&M.matchesFacets(l,{methods:cross.facets.methods[0],diseases:cross.facets.diseases[0],modalities:cross.facets.modalities[0]})).length;
  assert.match(await page.locator('#result-count').innerText(),new RegExp('筛选 '+crossCount.toLocaleString('zh-CN')+' 个'));
  await page.reload();await ready();assert.equal(await page.locator('#method-filter').inputValue(),cross.facets.methods[0]);
  await page.getByRole('button',{name:'重置筛选',exact:true}).click();
  await page.locator('#query').fill(cross.name);assert(await page.locator('#lab-'+cross.id).count());
  await page.locator('#lab-'+cross.id+' summary').click();
  assert.equal(await page.locator('#lab-'+cross.id+' .assessment-item').count(),7);
  assert(await page.locator('#lab-'+cross.id+' .assessment-item a').count()>0);
  // Explicit weights rank recorded tag coverage, with absent tags shown separately.
  await page.locator('#match-panel summary').click();
  await page.locator('#pref-domains').selectOption(cross.directions[0]);await page.locator('#weight-domains').selectOption('3');
  await page.locator('#pref-methods').selectOption(cross.facets.methods[0]);await page.locator('#weight-methods').selectOption('1');
  await page.locator('#apply-match').click();
  assert.match(await page.locator('#lab-'+cross.id+' .card-top .match-result').innerText(),/100%/);
  await page.reload();await ready();assert.equal(await page.locator('#weight-domains').inputValue(),'3');
  assert.equal(await page.locator('#sort').inputValue(),'match');
  await page.locator('#clear-match').click();
  // Asynchronous opportunity monitoring must not delete editorial role caveats.
  const withRoleNote=data.labs.find(l=>l.roleNote);
  await page.goto(base+'/labs.html?query='+encodeURIComponent(withRoleNote.name));await ready();
  assert((await page.locator('#lab-'+withRoleNote.id+' .details-body').textContent()).includes(withRoleNote.roleNote));
  await page.getByRole('button',{name:'重置筛选',exact:true}).click();
  await page.locator('#evidence').selectOption('research_profile');
  const researchCount=data.labs.filter(l=>l.evidenceLevel==='research_profile').length;
  assert.match(await page.locator('#result-count').innerText(),new RegExp('筛选 '+researchCount.toLocaleString('zh-CN')+' 个'));
  await page.getByRole('button',{name:'重置筛选',exact:true}).click();
  await page.locator('#direction').selectOption('医学人工智能');
  const medicalCount=data.labs.filter(l=>l.directions.includes('医学人工智能')).length;
  assert(medicalCount>=60);assert.match(await page.locator('#result-count').innerText(),new RegExp('筛选 '+medicalCount.toLocaleString('zh-CN')+' 个'));
  await page.getByRole('button',{name:'重置筛选',exact:true}).click();
  await page.locator('#advanced-filters').evaluate(el=>el.open=true);await page.locator('#match-panel').evaluate(el=>el.open=true);
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow at ${width}`);}
  const fixture=structuredClone(data);fixture.labs.find(l=>l.id==='chang').opportunity.verifiedAt='2000-01-01';
  await page.route('**/data/labs.json',r=>r.fulfill({json:fixture}));await page.goto(base+'/labs.html?query=Edward%20F.%20Chang');await ready();assert.match(await page.locator('#lab-chang .review-note').innerText(),/超过30天/);assert.equal(await page.locator('#lab-chang .status').innerText(),data.statuses.unknown);
  await page.unroute('**/data/labs.json');
  const currentFixture=structuredClone(data),chang=currentFixture.labs.find(l=>l.id==='chang');
  chang.opportunity.verifiedAt=new Date().toISOString().slice(0,10);chang.opportunity.deadline=null;
  await page.route('**/data/labs.json',r=>r.fulfill({json:currentFixture}));
  const changed={schemaVersion:1,checkedAt:new Date().toISOString(),sources:{[chang.opportunity.url]:{state:'ok',changed:true,reviewStamp:chang.opportunity.verifiedAt}}};
  await page.route('**/data/lab-monitor.json',r=>r.fulfill({json:changed}));await page.reload();await ready();assert.match(await page.locator('#lab-chang .review-note').innerText(),/有变化/);
  assert.equal(await page.evaluate(()=>localStorage.length),0);
  await page.unroute('**/data/lab-monitor.json');await page.unroute('**/data/labs.json');await page.goto(base+'/labs.html');await ready();
  // Private long-term notes use their own storage key and never enter public exports.
  await page.evaluate(()=>localStorage.setItem('academy.compatibility.fixture','keep-this-course-state'));
  await page.locator('#query').fill('Edward F. Chang');
  await page.locator('[data-save="chang"]').click();assert.equal(await page.locator('[data-save="chang"]').getAttribute('aria-pressed'),'true');
  await page.locator('#lab-chang summary').click();
  await page.locator('[data-stage="chang"]').selectOption('reading');
  const privateText='PRIVATE-NOTE-QA <script>window.noteInjected = true</script>\n准备阅读原始论文。';
  await page.locator('[data-note="chang"]').fill(privateText);
  assert.equal(await page.evaluate(()=>window.noteInjected),undefined);
  await page.reload();await ready();await page.locator('#lab-chang summary').click();
  assert.equal(await page.locator('[data-note="chang"]').inputValue(),privateText);assert.equal(await page.locator('[data-stage="chang"]').inputValue(),'reading');
  assert.equal(await page.evaluate(()=>localStorage.getItem('academy.compatibility.fixture')),'keep-this-course-state');
  assert(!page.url().includes('PRIVATE-NOTE-QA'));
  const publicDownloadPromise=page.waitForEvent('download');await page.locator('#export-results').click();const publicDownload=await publicDownloadPromise;
  assert(!fs.readFileSync(await publicDownload.path(),'utf8').includes('PRIVATE-NOTE-QA'));
  const backupPromise=page.waitForEvent('download');await page.locator('#export-notebook').click();const backup=await backupPromise;
  const backupText=fs.readFileSync(await backup.path(),'utf8'),backupData=M.validateNotebook(JSON.parse(backupText));
  assert.equal(backupData.entries[0].note,privateText);
  const newerNote=privateText+' Newer edit';await page.locator('[data-note="chang"]').fill(newerNote);
  await page.locator('#import-notebook').setInputFiles({name:'research-notebook.json',mimeType:'application/json',buffer:Buffer.from(backupText)});
  await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('已合并'));
  await page.locator('#lab-chang summary').click();assert.equal(await page.locator('[data-note="chang"]').inputValue(),newerNote);
  await page.locator('#import-notebook').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"entries":[]}')});
  await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('未导入'));
  assert.equal(await page.locator('[data-note="chang"]').inputValue(),newerNote);
  // Reading a backup is asynchronous: edits made while it is loading must survive.
  await page.evaluate(()=>{
    const original=File.prototype.text;
    File.prototype.text=function(){
      if(this.name!=='delayed-notebook.json')return original.call(this);
      window.notebookReadPending=true;
      return new Promise(resolve=>{window.finishNotebookRead=()=>{File.prototype.text=original;resolve(original.call(this));};});
    };
  });
  await page.locator('#import-notebook').setInputFiles({name:'delayed-notebook.json',mimeType:'application/json',buffer:Buffer.from(backupText)});
  await page.waitForFunction(()=>window.notebookReadPending);
  const duringImport='PRIVATE-NOTE-QA edited while backup is reading';
  await page.locator('[data-note="chang"]').fill(duringImport);
  await page.evaluate(()=>window.finishNotebookRead());
  await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('已合并'));
  await page.locator('#lab-chang details').evaluate(el=>el.open=true);
  assert.equal(await page.locator('[data-note="chang"]').inputValue(),duringImport);
  assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).entries.find(e=>e.id==='chang').note,M.storageKey),duringImport);
  // Two tabs must show the same current editor state before either continues typing.
  const second=await context.newPage();second.on('pageerror',e=>errors.push(e.message));
  await second.route('https://raw.githubusercontent.com/**',r=>r.abort());
  await second.goto(base+'/labs.html?query=Edward%20F.%20Chang');await second.waitForSelector('.lab-card');await second.waitForFunction(()=>!document.querySelector('#refresh').disabled);
  await second.locator('#lab-chang details').evaluate(el=>el.open=true);
  await second.locator('[data-note="chang"]').focus();
  const fromFirst='PRIVATE-NOTE-QA latest note from first tab';
  await page.locator('[data-note="chang"]').fill(fromFirst);
  await page.locator('[data-stage="chang"]').selectOption('preparing');
  await second.waitForFunction(note=>document.querySelector('[data-note="chang"]').value===note,fromFirst);
  await second.waitForFunction(()=>document.querySelector('[data-stage="chang"]').value==='preparing');
  assert.equal(await second.locator('#lab-chang details').getAttribute('open'),'');
  assert.equal(await second.evaluate(()=>document.activeElement===document.querySelector('[data-note="chang"]')),true);
  await second.locator('[data-note="chang"]').evaluate(el=>el.setSelectionRange(el.value.length,el.value.length));
  await second.locator('[data-note="chang"]').pressSequentially(' + second-tab edit');
  const fromSecond=fromFirst+' + second-tab edit';
  await page.waitForFunction(note=>document.querySelector('[data-note="chang"]').value===note,fromSecond);
  assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).entries.find(e=>e.id==='chang').note,M.storageKey),fromSecond);
  // Saved/stage filters respond to changes in the other tab, including an empty view.
  await page.locator('#collection').selectOption('saved');
  await second.locator('[data-save="chang"]').click();await page.waitForFunction(()=>document.querySelectorAll('.lab-card').length===0);
  await second.locator('[data-save="chang"]').click();await page.waitForFunction(()=>document.querySelectorAll('.lab-card').length===1);
  await page.locator('#advanced-filters').evaluate(el=>el.open=true);
  await page.locator('#stage-filter').selectOption('preparing');
  await second.locator('[data-stage="chang"]').selectOption('priority');await page.waitForFunction(()=>document.querySelectorAll('.lab-card').length===0);
  await second.locator('[data-stage="chang"]').selectOption('preparing');await page.waitForFunction(()=>document.querySelectorAll('.lab-card').length===1);
  await page.locator('#stage-filter').selectOption('');
  // Ordinary typing keeps the original focused editor; removing its final note updates membership.
  await page.locator('#collection').selectOption('notes');
  await page.locator('#lab-chang details').evaluate(el=>el.open=true);
  await page.locator('[data-note="chang"]').evaluate(el=>{window.activeNotebookEditor=el;el.focus();el.setSelectionRange(el.value.length,el.value.length);});
  await page.locator('[data-note="chang"]').pressSequentially(' without losing focus');
  assert.equal(await page.evaluate(()=>document.activeElement===window.activeNotebookEditor&&window.activeNotebookEditor.isConnected),true);
  await page.locator('[data-note="chang"]').fill('');
  assert.equal(await page.locator('.lab-card').count(),0);assert.match(await page.locator('#result-count').innerText(),/筛选 0 个/);assert.equal(await page.locator('#export-results').isDisabled(),true);
  await second.waitForFunction(()=>document.querySelector('[data-note="chang"]').value==='');
  await second.locator('[data-note="chang"]').fill('PRIVATE-NOTE-QA restored from second tab');await page.waitForFunction(()=>document.querySelectorAll('.lab-card').length===1);
  await second.locator('[data-note="chang"]').fill('');await page.waitForFunction(()=>document.querySelectorAll('.lab-card').length===0);
  await second.close();
  // The actual share button strips personal filters while retaining public matching preferences.
  await page.locator('#collection').selectOption('saved');
  await page.locator('#stage-filter').selectOption('preparing');
  await page.locator('#match-panel').evaluate(el=>el.open=true);
  await page.locator('#pref-domains').selectOption(cross.directions[0]);await page.locator('#weight-domains').selectOption('3');
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.sharedNotebookView=value;}}}));
  await page.locator('#share-view').click();
  const shared=new URL(await page.evaluate(()=>window.sharedNotebookView));
  assert.equal(shared.searchParams.get('query'),'Edward F. Chang');assert.equal(shared.searchParams.get('pref-domains'),cross.directions[0]);assert.equal(shared.searchParams.get('weight-domains'),'3');
  assert.equal(shared.searchParams.has('collection'),false);assert.equal(shared.searchParams.has('stage-filter'),false);assert(!shared.href.includes('PRIVATE-NOTE-QA'));
  await page.locator('#clear-match').click();
  await page.locator('#show-saved').click();assert.equal(await page.locator('.lab-card').count(),1);
  await page.locator('[data-save="chang"]').click();assert.equal(await page.locator('.lab-card').count(),0);
  await page.getByRole('button',{name:'重置筛选',exact:true}).click();
  const shots=process.env.LAB_SCREENSHOT_DIR;if(shots){fs.mkdirSync(shots,{recursive:true});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(shots,'labs-desktop.png')});await page.locator('#catalog').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(shots,'labs-catalog.png')});await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(shots,'labs-mobile.png')});}
  assert.deepEqual(errors,[]);console.log(`Browser QA passed: ${data.labs.length} records, pagination, cross-page comparison, multi-axis AND filters, research evidence, weighted matching, private notes, asynchronous backup merge, cross-tab editor/filter synchronization, share/export privacy, URL state, deep links, 320/390/768/1440px, freshness and long-term inclusion.`);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
