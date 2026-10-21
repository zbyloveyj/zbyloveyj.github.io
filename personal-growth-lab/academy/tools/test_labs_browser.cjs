'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),data=JSON.parse(fs.readFileSync(path.join(root,'data/labs.json')));
(async()=>{
 const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}try{const type={'.js':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html'}[path.extname(file)]||'text/plain';res.setHeader('Content-Type',type);res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
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
  const shots=process.env.LAB_SCREENSHOT_DIR;if(shots){fs.mkdirSync(shots,{recursive:true});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(shots,'labs-desktop.png')});await page.locator('#catalog').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(shots,'labs-catalog.png')});await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(shots,'labs-mobile.png')});}
  assert.deepEqual(errors,[]);console.log(`Browser QA passed: ${data.labs.length} records, pagination, cross-page comparison, country filter, CSV completeness, URL state, deep links, 320/390/768/1440px, freshness and long-term inclusion.`);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
