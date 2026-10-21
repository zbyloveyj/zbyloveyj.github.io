'use strict';
(() => {
 const $=id=>document.getElementById(id), E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const safe=url=>{try{const u=new URL(url);return u.protocol==='https:'?E(u.href):'#';}catch{return '#';}};
 const link=(url,label)=>`<a href="${safe(url)}" target="_blank" rel="noopener noreferrer">${E(label)} ↗</a>`;
 const age=date=>(Date.now()-Date.parse(date))/86400000;
 const selected=new Set();let data,monitor={sources:{}},loading=false;
 const ids=['query','country','direction','tier','status','sort'];
 function review(l){
  const o=l.opportunity,m=monitor.sources?.[o.url];
  const stale=!Number.isFinite(age(o.verifiedAt))||age(o.verifiedAt)>data.reviewWindowDays;
  const expired=o.deadline&&Date.parse(o.deadline+'T23:59:59Z')<Date.now();
  const changed=m?.reviewStamp===o.verifiedAt&&m?.changed;
  const failed=m?.reviewStamp===o.verifiedAt&&m.state!=='ok';
  const reason=expired?'公告截止日期已过':stale?'内容核验已超过30天':changed?'机会来源文本有变化':failed?'机会来源本次未能读取':'';
  return {status:reason?'unknown':o.status,reason};
 }
 function evidenceMonitor(l){
  const rows=l.sources.map(s=>monitor.sources?.[s.url]).filter(Boolean);
  const changed=rows.filter(m=>m.changed).length,failed=rows.filter(m=>m.state!=='ok').length;
  return rows.length?`${changed}条来源变化 · ${failed}条读取异常`:'来源巡检待建立';
 }
 function card(l){const r=review(l);return `<article class="lab-card" id="lab-${E(l.id)}"><div class="card-top"><div class="card-meta"><span>${E(l.country)}</span><span>${E(data.tiers[l.tier])}</span></div><h3>${E(l.name)}</h3><p class="institution">${E(l.institution)}</p><div class="tags">${l.directions.map(t=>`<span>${E(t)}</span>`).join('')}</div><p class="question">${E(l.question)}</p><span class="status ${r.status}">${E(data.statuses[r.status])}</span>${r.reason?`<p class="review-note">待复核：${E(r.reason)}</p>`:''}<div class="date">内容核验 ${E(l.verifiedAt)} · ${E(evidenceMonitor(l))}</div></div><div class="card-actions"><label><input type="checkbox" data-compare="${E(l.id)}" ${selected.has(l.id)?'checked':''} aria-label="比较 ${E(l.name)}">加入比较</label><a href="#lab-${E(l.id)}" data-open="${E(l.id)}">定位此卡 ↗</a></div><details><summary>展开完整证据卡 · ${l.papers.length}篇代表作</summary><div class="details-body"><h4>当前任职 · 公开事实</h4><p>${E(l.role)}</p><h4>持续产出与技术优势</h4><p>${E(l.strength)}</p><ul>${l.platforms.map(x=>`<li>${E(x)}</li>`).join('')}</ul><h4>能力衔接 · 编辑分析</h4><p>${E(l.fit)}</p><h4>需要补足</h4><ul>${l.gaps.map(x=>`<li>${E(x)}</li>`).join('')}</ul><h4>可实施的第一个项目</h4><p>${E(l.bridge)}</p><h4>适配边界</h4><p>${E(l.risk)}</p><h4>博士后机会</h4><p>${E(l.opportunity.summary)}</p><p>${link(l.opportunity.url,'核对官方机会来源')}</p><p class="small">${E(l.opportunity.verifiedAt)}核验时：${E(data.statuses[l.opportunity.status])}；截止日：${E(l.opportunity.deadline||'未确认')}。${r.reason?E(r.reason)+'，当前须重新核验。':''}</p><h4>博士联合培养 / 访问</h4><p>${E(l.opportunity.visit)}</p><h4>代表性论文 · 阅读入口</h4>${l.papers.map(p=>`<div class="paper">${link(p.url,p.title)}<small>${E(p.venue)} · ${E(p.year)} · ${E(p.kind)} · ${E(p.review)}<br>书目信息核验 ${E(p.verifiedAt)}</small><p>${E(p.why)}</p></div>`).join('')}<h4>官方证据与核验范围</h4>${l.sources.map(s=>{const m=monitor.sources?.[s.url];return `<div class="source">${link(s.url,s.label)}<p>${E(s.claim)}</p><small>内容核验 ${E(s.verifiedAt)} · ${E(s.access)}${m?`<br>网页检查 ${E(m.checkedAt)} · ${m.state==='ok'?(m.changed?'有变化，待内容复核':'未检测到文本变化'):'读取异常，不代表岗位关闭'}`:''}</small></div>`;}).join('')}</div></details></article>`;}
 function populate(){
  const opts=(id,values)=>{const v=$(id).value;$(id).innerHTML=$(id).options[0].outerHTML+values.map(([k,t])=>`<option value="${E(k)}">${E(t)}</option>`).join('');$(id).value=v;};
  opts('country',[...new Set(data.labs.map(l=>l.country))].map(x=>[x,x]));
  opts('direction',[...new Set(data.labs.flatMap(l=>l.directions))].sort().map(x=>[x,x]));
  opts('tier',Object.entries(data.tiers));opts('status',Object.entries(data.statuses));
 }
 function render(){if(!data)return;
  const q=$('query').value.trim().toLocaleLowerCase();
  let list=data.labs.filter(l=>(!q||[l.name,l.institution,l.question,l.fit,l.bridge,...l.platforms,...l.directions].join(' ').toLocaleLowerCase().includes(q))&&(!$('country').value||l.country===$('country').value)&&(!$('direction').value||l.directions.includes($('direction').value))&&(!$('tier').value||l.tier===$('tier').value)&&(!$('status').value||review(l).status===$('status').value));
  const sort=$('sort').value;list.sort((a,b)=>sort==='country'?a.country.localeCompare(b.country,'zh')||a.tier.localeCompare(b.tier):sort==='date'?b.verifiedAt.localeCompare(a.verifiedAt)||a.name.localeCompare(b.name):a.tier.localeCompare(b.tier)||a.country.localeCompare(b.country,'zh')||a.name.localeCompare(b.name));
  $('result-count').textContent=`显示 ${list.length} / ${data.labs.length} 个研究团队`;
  $('cards').innerHTML=list.length?list.map(card).join(''):'<p class="empty">没有符合全部条件的团队。试试清空一个筛选条件。</p>';
  renderComparison();
 }
 function renderComparison(){const labs=data.labs.filter(l=>selected.has(l.id));$('compare-bar').hidden=!labs.length;$('selected-count').textContent=`已选 ${labs.length} / 4 组`;
  if(!labs.length){$('comparison').hidden=true;return;}
  const rows=[['国家 / 机构',l=>E(l.country+' · '+l.institution)],['衔接层级',l=>E(data.tiers[l.tier])],['问题与技术优势',l=>E(l.question)+'<p>'+E(l.strength)+'</p>'],['技术平台',l=>E(l.platforms.join('；'))],['能力契合',l=>E(l.fit)],['技能缺口',l=>E(l.gaps.join('；'))],['起步项目',l=>E(l.bridge)],['当前机会',l=>`<b>${E(data.statuses[review(l).status])}</b><p>${E(review(l).reason)}</p><p>${E(l.opportunity.summary)}</p>${link(l.opportunity.url,'官方来源')}`],['联合培养 / 访问',l=>E(l.opportunity.visit)],['不确定性',l=>E(l.risk)],['核验日期',l=>E(l.verifiedAt)]];
  $('compare-table').innerHTML=`<table><caption>${labs.length}组公开证据比较；指导质量、实际数据权限和接收资格仍需确认。</caption><thead><tr><th scope="col">比较维度</th>${labs.map(l=>`<th scope="col">${E(l.name)}</th>`).join('')}</tr></thead><tbody>${rows.map(([t,f])=>`<tr><th scope="row">${t}</th>${labs.map(l=>`<td>${f(l)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
 }
 function openHash(){const id=location.hash.slice(1);if(!id.startsWith('lab-'))return;const l=data?.labs.find(x=>'lab-'+x.id===id);if(!l)return;
  if(!$(id)){ $('filters').reset();render(); }const el=$(id);el.querySelector('details').open=true;el.scrollIntoView();
 }
 async function json(url){const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json();}
 async function load(){if(loading)return;loading=true;$('refresh').disabled=true;
  try{
   const next=await json('data/labs.json');if(next.schemaVersion!==1||!Array.isArray(next.labs))throw Error('数据格式不兼容');data=next;
   // The public repository is the live monitor feed: token-generated commits do not rebuild Pages.
   const raw='https://raw.githubusercontent.com/zbyloveyj/zbyloveyj.github.io/main/personal-growth-lab/academy/data/lab-monitor.json';
   const results=await Promise.allSettled([json(raw),json('data/lab-monitor.json')]);
   monitor=results.filter(x=>x.status==='fulfilled'&&x.value.schemaVersion===1).map(x=>x.value).sort((a,b)=>(b.checkedAt||'').localeCompare(a.checkedAt||''))[0]||{sources:{}};
   for(const id of selected)if(!data.labs.some(l=>l.id===id))selected.delete(id);
   populate();$('stats').innerHTML=`<div><b>${data.labs.length}</b><span>研究团队</span></div><div><b>${new Set(data.labs.map(l=>l.country)).size}</b><span>国家</span></div><div><b>${data.labs.reduce((n,l)=>n+l.papers.length,0)}</b><span>代表论文</span></div>`;
   const monitorDate=monitor.checkedAt?new Date(monitor.checkedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})+' 北京时间':'待首次运行';
   $('freshness').textContent=`证据版本 ${data.edition} · 网页巡检 ${monitorDate}${monitor.checkedAt&&age(monitor.checkedAt)>3?'（超过3天未更新）':''} · 自动检查不等于岗位复核`;
   $('methodology').innerHTML='<ol>'+data.methodology.map(t=>`<li>${E(t)}</li>`).join('')+'</ol>';
   $('history').innerHTML=data.history.slice().reverse().slice(0,20).map(h=>`<p><b>${E(h.date)}</b> ${E(h.summary)}</p>`).join('');render();openHash();
  }catch(e){$('freshness').textContent='证据库读取失败，请稍后刷新。'+(data?'当前保留已加载内容。':'可使用页尾结构化数据入口。');if(!data)$('cards').innerHTML='<p class="empty">暂时无法载入数据。请刷新或稍后重试。</p>';}
  finally{loading=false;$('refresh').disabled=false;}
 }
 $('filters').addEventListener('submit',e=>e.preventDefault());$('filters').addEventListener('input',render);$('filters').addEventListener('reset',()=>setTimeout(render,0));
 $('cards').addEventListener('change',e=>{const id=e.target.dataset.compare;if(!id)return;if(e.target.checked&&selected.size>=4){e.target.checked=false;$('announce').textContent='最多比较4组，请先取消一组。';return;}e.target.checked?selected.add(id):selected.delete(id);renderComparison();});
 $('cards').addEventListener('click',e=>{const a=e.target.closest('[data-open]');if(a)document.getElementById('lab-'+a.dataset.open)?.querySelector('details').setAttribute('open','');});
 document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{ids.forEach(id=>$(id).value=id==='sort'?'tier':'');$('direction').value=b.dataset.preset;render();$('catalog').scrollIntoView();}));
 $('compare-open').addEventListener('click',()=>{$('comparison').hidden=false;$('comparison').scrollIntoView();$('comparison').querySelector('h2').focus({preventScroll:true});});
 $('compare-clear').addEventListener('click',()=>{selected.clear();render();});$('refresh').addEventListener('click',load);window.addEventListener('hashchange',openHash);load();
})();
