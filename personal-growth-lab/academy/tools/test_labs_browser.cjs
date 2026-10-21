'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),data=JSON.parse(fs.readFileSync(path.join(root,'data/labs.json')));
(async()=>{
 const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}try{const type={'.js':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html'}[path.extname(file)]||'text/plain';res.setHeader('Content-Type',type);res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Keep tests deterministic: do not depend on public GitHub monitor network.
  await page.route('https://raw.githubusercontent.com/**',r=>r.abort());
  await page.goto(base+'/labs.html');await page.waitForSelector('.lab-card');
  assert.equal(await page.locator('.lab-card').count(),data.labs.length);
  await page.getByRole('button',{name:'查看计算生物学 ↗'}).click();assert.equal(await page.locator('.lab-card').count(),data.labs.filter(l=>l.directions.includes('AI虚拟细胞（AIVC）')).length);
  await page.getByRole('button',{name:'重置筛选',exact:true}).click();await page.waitForFunction(n=>document.querySelectorAll('.lab-card').length===n,data.labs.length);
  for(const id of ['theis','stegle','ritter','chang'])await page.locator(`[data-compare="${id}"]`).check();
  await page.locator('[data-compare="bassett"]').click();assert.equal(await page.locator('[data-compare="bassett"]').isChecked(),false);
  await page.locator('#compare-open').click();assert.equal(await page.locator('#comparison').isVisible(),true);assert.equal(await page.locator('thead th').count(),5);
  await page.locator('#query').fill('no-match-zzzz');assert.equal(await page.locator('.lab-card').count(),0);
  await page.locator('#query').fill('Chang');assert.equal(await page.locator('.lab-card').count(),1);
  await page.locator('#lab-chang summary').click();assert.equal(await page.locator('#lab-chang details').getAttribute('open'),'');
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow at ${width}`);}
  await page.locator('#compare-clear').click();await page.reload();await page.waitForSelector('.lab-card');assert.equal(await page.evaluate(()=>localStorage.length),0);
  const fixture=structuredClone(data);const old=fixture.labs.find(l=>l.id==='chang');old.opportunity.verifiedAt='2000-01-01';
  await page.route('**/data/labs.json',r=>r.fulfill({json:fixture}));await page.reload();await page.waitForSelector('#lab-chang');assert.match(await page.locator('#lab-chang .review-note').innerText(),/超过30天/);assert.equal(await page.locator('#lab-chang .status').innerText(),'招聘状态未知');
  await page.unroute('**/data/labs.json');
  const changed={schemaVersion:1,checkedAt:new Date().toISOString(),sources:{[old.opportunity.url]:{state:'ok',changed:true,reviewStamp:data.labs.find(l=>l.id==='chang').opportunity.verifiedAt}}};
  await page.route('**/data/lab-monitor.json',r=>r.fulfill({json:changed}));await page.reload();await page.waitForSelector('#lab-chang');assert.match(await page.locator('#lab-chang .review-note').innerText(),/有变化/);
  assert.deepEqual(errors,[]);console.log('Lab browser QA passed: filtering, comparison limit, empty search, details, mobile/tablet/desktop, no local storage, stale and changed evidence.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
