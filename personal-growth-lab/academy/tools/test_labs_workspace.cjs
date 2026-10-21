'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),data=JSON.parse(fs.readFileSync(path.join(root,'data/labs.json')));
const M=require('../assets/lab-model.js'),D=require('../assets/lab-discovery.js');
const source=data.labs.find(l=>l.id==='chang')||data.labs.find(l=>D.similar(l,data.labs).length);
assert(source,'Workspace QA needs a sourced record with related-tag candidates.');
const hasCountry=(l,c)=>l.country===c||(l.affiliations||[]).some(a=>a.country===c);
const country='中国',direction='微生物组',countryTopic=data.labs.filter(l=>hasCountry(l,country)&&l.directions.includes(direction));
assert(countryTopic.length,'The Chinese microbiome discovery view must have candidates.');
(async()=>{
  const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}try{const type={'.js':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html','.gz':'application/gzip'}[path.extname(file)]||'text/plain';res.setHeader('Content-Type',type);res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try {
    const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Shanghai'}),errors=[];
    await context.route('https://raw.githubusercontent.com/**',r=>r.abort());
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    const ready=async p=>{await p.waitForSelector('.lab-card');await p.waitForFunction(()=>!document.querySelector('#refresh').disabled);};
    const reset=async p=>{await p.getByRole('button',{name:'重置筛选',exact:true}).click();};
    const editor=async p=>{await p.locator('#lab-'+source.id+' > details').evaluate(el=>el.open=true);};
    const entry=async p=>p.evaluate(({key,id})=>JSON.parse(localStorage.getItem(key)).entries.find(e=>e.id===id),{key:M.storageKey,id:source.id});
    const downloadText=async (p,selector)=>{const pending=p.waitForEvent('download');await p.locator(selector).click();return fs.readFileSync(await (await pending).path(),'utf8');};
    await page.goto(base+'/labs.html');await ready(page);

    // Named views include matching weights, survive reload and remain literal text.
    await page.locator('#country').selectOption(country);await page.locator('#direction').selectOption(direction);
    await page.locator('#match-panel').evaluate(el=>el.open=true);
    await page.locator('#pref-domains').selectOption(direction);await page.locator('#weight-domains').selectOption('3');
    await page.locator('#saved-views-panel').evaluate(el=>el.open=true);
    const viewName='国内微生物组 <img src=x onerror=window.viewInjected=1>';
    await page.locator('#view-name').fill(viewName);await page.locator('#save-view').click();
    assert.equal(await page.locator('[data-apply-view]').count(),1);
    const viewId=await page.locator('[data-apply-view]').getAttribute('data-apply-view');
    assert.equal(await page.locator('[data-apply-view] b').innerText(),viewName);assert.equal(await page.evaluate(()=>window.viewInjected),undefined);
    const viewOnlyBackup=M.validateNotebook(JSON.parse(await downloadText(page,'#export-notebook')));
    assert.equal(viewOnlyBackup.entries.length,0);assert.equal(viewOnlyBackup.savedViews.filter(v=>!v.deleted).length,1);
    await reset(page);await page.locator('#clear-match').click();await page.locator('#country').selectOption('日本');
    await page.locator('[data-apply-view="'+viewId+'"]').click();
    assert.equal(await page.locator('#country').inputValue(),country);assert.equal(await page.locator('#direction').inputValue(),direction);
    assert.equal(await page.locator('#weight-domains').inputValue(),'3');assert.equal(await page.locator('#pref-domains').inputValue(),direction);
    assert.match(await page.locator('#result-count').innerText(),new RegExp('筛选 '+countryTopic.length.toLocaleString('zh-CN')+' 个'));
    await page.reload();await ready(page);await page.locator('#saved-views-panel').evaluate(el=>el.open=true);
    assert.equal(await page.locator('[data-apply-view="'+viewId+'"]').count(),1);

    // Task text and review dates are local private fields, not public search metadata.
    await reset(page);await page.locator('#match-panel').evaluate(el=>el.open=true);await page.locator('#clear-match').click();
    await page.locator('#query').fill(source.name);await editor(page);
    await page.locator('[data-save="'+source.id+'"]').click();
    await page.locator('[data-stage="'+source.id+'"]').selectOption('reading');
    const action='PRIVATE-ACTION-QA <script>window.actionInjected=1</script>',note='PRIVATE-NOTE-WORKSPACE-QA';
    const today=await page.evaluate(()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');});
    await page.locator('[data-next-action="'+source.id+'"]').fill(action);
    await page.locator('[data-review-date="'+source.id+'"]').fill(today);
    await page.locator('[data-note="'+source.id+'"]').fill(note);
    assert.equal(await page.evaluate(()=>window.actionInjected),undefined);
    assert((await page.locator('#agenda-list').innerText()).includes(action));assert.match(await page.locator('#agenda-status').innerText(),/1 条计划已到复查日期/);
    await page.reload();await ready(page);await editor(page);
    assert.equal(await page.locator('[data-next-action="'+source.id+'"]').inputValue(),action);assert.equal(await page.locator('[data-review-date="'+source.id+'"]').inputValue(),today);
    assert.equal(await page.locator('[data-note="'+source.id+'"]').inputValue(),note);
    await page.locator('#advanced-filters').evaluate(el=>el.open=true);await page.locator('#review-filter').selectOption('due');
    assert.equal(await page.locator('.lab-card').count(),1);
    await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.workspaceShare=value;}}}));
    await page.locator('#share-view').click();
    const shared=new URL(await page.evaluate(()=>window.workspaceShare));
    for(const key of ['review-filter','stage-filter','collection','nextAction','reviewDate'])assert.equal(shared.searchParams.has(key),false,key+' is private');
    assert(!shared.href.includes('PRIVATE-ACTION-QA'));assert(!shared.href.includes('PRIVATE-NOTE'));
    const csv=await downloadText(page,'#export-results');assert(!csv.includes('PRIVATE-ACTION-QA'));assert(!csv.includes(note));assert(!csv.split('\r\n')[0].includes('复查日期'));
    const backupText=await downloadText(page,'#export-notebook'),backup=M.validateNotebook(JSON.parse(backupText));
    const backed=backup.entries.find(e=>e.id===source.id);assert.equal(backed.nextAction,action);assert.equal(backed.reviewDate,today);assert.equal(backed.note,note);assert(backup.savedViews.some(v=>v.id===viewId&&!v.deleted));

    // Import an original v1 backup without new fields, preserving newer plans and views.
    const other=data.labs.find(l=>l.id!==source.id);
    const legacy={type:M.notebookType,schemaVersion:1,entries:[{id:other.id,name:other.name,saved:false,stage:'watch',note:'Legacy reading note',updatedAt:'2001-01-01T00:00:00Z'},{id:source.id,name:source.name,saved:true,stage:'reading',note:'A newer edit from an original v1 client',updatedAt:new Date().toISOString()}]};
    await page.locator('#import-notebook').setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
    await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('已合并'));
    assert.equal((await entry(page)).nextAction,action);assert.equal((await entry(page)).reviewDate,today);
    assert.equal(await page.locator('[data-apply-view="'+viewId+'"]').count(),1);
    await page.locator('#review-filter').selectOption('');await editor(page);

    // Cross-tab field edits preserve focused text, new fields and deleted-view tombstones.
    const second=await context.newPage();second.on('pageerror',e=>errors.push(e.message));
    await second.goto(base+'/labs.html?query='+encodeURIComponent(source.name));await ready(second);await editor(second);
    await second.locator('[data-next-action="'+source.id+'"]').focus();
    const newerAction='PRIVATE-ACTION-QA revised in first tab';
    await page.locator('[data-next-action="'+source.id+'"]').fill(newerAction);
    await second.waitForFunction(({id,value})=>document.querySelector('[data-next-action="'+id+'"]').value===value,{id:source.id,value:newerAction});
    assert.equal(await second.evaluate(id=>document.activeElement===document.querySelector('[data-next-action="'+id+'"]'),source.id),true);
    await second.locator('[data-note="'+source.id+'"]').fill('PRIVATE-NOTE edited from second tab');
    await page.waitForFunction(id=>document.querySelector('[data-note="'+id+'"]').value==='PRIVATE-NOTE edited from second tab',source.id);
    assert.equal((await entry(page)).nextAction,newerAction);assert.equal((await entry(page)).reviewDate,today);
    await second.locator('#saved-views-panel').evaluate(el=>el.open=true);await second.locator('[data-remove-view="'+viewId+'"]').click();
    await page.waitForFunction(id=>!document.querySelector('[data-apply-view="'+id+'"]'),viewId);
    await page.locator('[data-next-action="'+source.id+'"]').fill(newerAction+' after view deletion');
    const afterDeletion=JSON.parse(await downloadText(page,'#export-notebook'));
    assert(afterDeletion.savedViews.find(v=>v.id===viewId)?.deleted,'An edit in another tab must not resurrect a deleted view.');
    await second.close();
    await page.locator('[data-review-next="'+source.id+'"]').click();
    const nextWeek=await page.evaluate(()=>{const d=new Date();d.setDate(d.getDate()+7);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');});
    assert.equal((await entry(page)).reviewDate,nextWeek);assert.match(await page.locator('#agenda-status').innerText(),/0 条计划已到复查日期/);
    await page.locator('#agenda-filter').selectOption('planned');await page.locator('[data-review-clear="'+source.id+'"]').click();
    assert.equal((await entry(page)).reviewDate,'');await page.locator('#agenda-filter').selectOption('tasks');assert.equal(await page.locator('#agenda-list .agenda-item').count(),1);

    // Similar records explain their shared tags and open real records outside current filters.
    await editor(page);await page.locator('[data-related="'+source.id+'"]').click();
    const expectedRelated=D.similar(source,data.labs),related=page.locator('#related-'+source.id);
    assert.equal(await related.locator('article').count(),expectedRelated.length);assert(expectedRelated.length>0);
    assert((await related.locator('.related-reason').first().innerText()).length>0);
    assert(!(await related.innerText()).includes('%'),'Related tags do not claim a scientific percentage rank.');
    const relatedId=expectedRelated[0].id;await related.locator('a[href="#lab-'+relatedId+'"]').click();
    await page.waitForSelector('#lab-'+relatedId+' details[open]');assert.equal(new URL(page.url()).hash,'#lab-'+relatedId);

    // Coverage counts follow the current filters, and empty-view recovery removes one condition.
    await reset(page);await page.locator('#country').selectOption(country);await page.locator('#direction').selectOption(direction);
    await page.locator('#coverage-panel').evaluate(el=>el.open=true);await page.locator('#coverage-scope').selectOption('filtered');
    const coverage=D.coverage(countryTopic),text=await page.locator('#coverage-context').innerText();
    assert(text.includes(countryTopic.length.toLocaleString('zh-CN')+' 条'));assert(text.includes(coverage.documentedProfiles.toLocaleString('zh-CN')+' 条已整理个人研究资料'));
    const coverageText=await page.locator('#filtered-coverage').innerText();assert(coverageText.includes(coverage.withMethods.toLocaleString('zh-CN')+' / '+coverage.total.toLocaleString('zh-CN')));
    await page.locator('#query').fill('qa-impossible-query-v6');
    const relaxation=page.locator('.empty [data-clear-filter="query"]');
    assert((await relaxation.innerText()).includes(countryTopic.length.toLocaleString('zh-CN')+' 条'));
    await relaxation.click();assert.equal(await page.locator('#query').inputValue(),'');assert.equal(await page.locator('#country').inputValue(),country);assert.equal(await page.locator('#direction').inputValue(),direction);
    assert.match(await page.locator('#result-count').innerText(),new RegExp('筛选 '+countryTopic.length.toLocaleString('zh-CN')+' 个'));
    await page.locator('#advanced-filters').evaluate(el=>el.open=true);await page.locator('#saved-views-panel').evaluate(el=>el.open=true);
    for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Workspace overflow at '+width);}
    assert.deepEqual(errors,[]);
    console.log('Workspace QA passed: named views, matching restore, private task/date planning, local-date agenda, v1 backup compatibility, cross-tab preservation and deletion, explained related records, scoped coverage, single-filter recovery and four viewport widths.');
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
