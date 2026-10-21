'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const E = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safe = url => { try { const u = new URL(url); return ['https:','http:'].includes(u.protocol) ? E(u.href) : '#'; } catch { return '#'; } };
  const link = (url, label) => `<a href="${safe(url)}" target="_blank" rel="noopener noreferrer">${E(label)} ↗</a>`;
  const norm = s => String(s || '').normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase();
  const age = date => (Date.now() - Date.parse(date)) / 86400000;
  const level = l => l.evidenceLevel || 'reviewed';
  const institution = l => l.institutionKey || l.institution;
  const institutions = l => [...new Set([institution(l), ...(l.affiliations || []).map(a => a.institutionKey || a.institution)].filter(Boolean))];
  const countries = l => [...new Set([l.country, ...(l.affiliations || []).map(a => a.country)].filter(Boolean))];
  const profile = l => l.profileUrl || l.sources?.[0]?.url || l.opportunity?.url;
  const evidenceLabel = l => level(l) === 'reviewed' ? '代表作与适配已整理' : '官方团队名录';
  const ids = ['query','country','institution','direction','evidence','tier','status','sort','page-size'];
  const selected = new Set();
  let data, monitor = {sources:{}}, filtered = [], page = 1, loading = false, restored = false, toastTimer;

  function notify(message) { $('announce').textContent = message; $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500); }
  function review(l) {
    const o = l.opportunity || {status:'unknown'};
    if (level(l) !== 'reviewed') return {status:'unknown', reason:''};
    const m = monitor.sources?.[o.url];
    const stale = !Number.isFinite(age(o.verifiedAt)) || age(o.verifiedAt) > data.reviewWindowDays;
    const expired = o.deadline && Date.parse(o.deadline + 'T23:59:59Z') < Date.now();
    const changed = m?.reviewStamp === o.verifiedAt && m?.changed;
    const failed = m?.reviewStamp === o.verifiedAt && m.state !== 'ok';
    const reason = expired ? '公告截止日期已过' : stale ? `内容核验已超过${data.reviewWindowDays}天` : changed ? '机会来源文本有变化' : failed ? '机会来源本次未能读取' : '';
    return {status:reason ? 'unknown' : o.status, reason};
  }
  function evidenceMonitor(l) {
    const rows = (l.sources || []).map(s => monitor.sources?.[s.url]).filter(Boolean);
    const changed = rows.filter(m => m.changed).length, failed = rows.filter(m => m.state !== 'ok').length;
    return rows.length ? `${changed}条变化 · ${failed}条读取异常` : '自动巡检待建立';
  }
  function sourceDetails(l) {
    return (l.sources || []).map(s => {
      const m = monitor.sources?.[s.url];
      return `<div class="source">${link(s.url, s.label)}<p>${E(s.claim)}</p><small>内容核验 ${E(s.verifiedAt)} · ${E(s.access || '官方公开来源')}${m ? `<br>网页检查 ${E(m.checkedAt?.slice(0,10))} · ${m.state === 'ok' ? (m.changed ? '有变化，待内容复核' : '未检测到文本变化') : '读取异常'}` : ''}</small></div>`;
    }).join('');
  }
  function reviewedDetails(l, r) {
    return `<h4>当前任职 · 公开事实</h4><p>${E(l.role)}</p><h4>持续产出与技术优势</h4><p>${E(l.strength)}</p><ul>${(l.platforms || []).map(x=>`<li>${E(x)}</li>`).join('')}</ul><h4>能力衔接 · 编辑分析</h4><p>${E(l.fit)}</p><h4>需要补足</h4><ul>${(l.gaps || []).map(x=>`<li>${E(x)}</li>`).join('')}</ul><h4>可实施的第一个项目</h4><p>${E(l.bridge)}</p><h4>适配边界</h4><p>${E(l.risk)}</p><h4>博士后机会</h4><p>${E(l.opportunity.summary)}</p><p>${link(l.opportunity.url,'核对官方机会来源')}</p><p class="small">${E(l.opportunity.verifiedAt)}核验时：${E(data.statuses[l.opportunity.status])}；截止日：${E(l.opportunity.deadline || '未确认')}。${r.reason ? E(r.reason)+'，当前须重新核验。' : ''}</p><h4>博士联合培养 / 访问</h4><p>${E(l.opportunity.visit)}</p><h4>代表性论文 · 阅读入口</h4>${(l.papers || []).map(p=>`<div class="paper">${link(p.url,p.title)}<small>${E(p.venue)} · ${E(p.year)} · ${E(p.kind)} · ${E(p.review)}<br>书目信息核验 ${E(p.verifiedAt)}</small><p>${E(p.why)}</p></div>`).join('')}`;
  }
  function directoryDetails(l) {
    const affiliations = (l.affiliations || []).filter(a => a.institution !== l.institution);
    return `<h4>官方名录收录依据</h4><p>${E(l.directoryNote || '官方研究组或导师目录列有该条目，并提供课题组或个人资料链接。')}</p>${l.role ? `<p>${E(l.role)}</p>` : ''}${l.groupName ? `<p>研究组：${E(l.groupName)}</p>` : ''}<h4>研究方向</h4><p>${E(l.question || '请由官方资料页查看具体研究问题。')}</p><p class="small">${E(l.fieldBasis || '方向依据官方条目或所属专题目录；宽泛标签不能代替个人研究方向复核。')}</p>${affiliations.length ? `<h4>其他官方目录记录</h4>${affiliations.map(a=>`<p>${E(a.institution)} · ${E(a.country)}${a.url ? ' · '+link(a.url,'官方记录') : ''}</p>`).join('')}` : ''}<h4>代表成果与研究适配</h4><p>尚未逐条整理代表论文、技术平台与适配分析。可先从官方资料页的 Publications / Research 继续筛选。</p><h4>接收信息 · 可选参考</h4><p>${E(l.opportunity?.summary || '本条尚未核验接收名额。')}</p><p>博士、博士后与联合培养资格需分别核实；当前无名额不影响长期收录。</p>`;
  }
  function card(l) {
    const r = review(l), detailed = level(l) === 'reviewed';
    return `<article class="lab-card ${detailed ? 'reviewed' : 'directory'}" id="lab-${E(l.id)}"><div class="card-top"><div class="card-meta"><span>${E(countries(l).join(' / '))}</span><span>${E(detailed ? data.tiers[l.tier] : '研究适配待评估')}</span></div><span class="evidence-badge ${detailed ? 'reviewed' : ''}">${E(evidenceLabel(l))}</span><h3>${E(l.name)}</h3><p class="institution">${E(l.institution)}${l.affiliations?.length ? ` <span class="affiliation-note">+${l.affiliations.length}条关联记录</span>` : ''}</p><div class="tags">${l.directions.map(t=>`<button type="button" data-direction="${E(t)}">${E(t)}</button>`).join('')}</div><p class="question">${E(l.question || '官方目录已收录；具体研究问题请查阅团队资料。')}</p><div class="card-links">${link(profile(l),'官方团队 / PI资料')}<span class="status ${r.status}">${E(data.statuses[r.status])}</span></div>${r.reason ? `<p class="review-note">待复核：${E(r.reason)}</p>` : ''}<div class="date">${detailed ? '内容核验' : '名录核验'} ${E(l.verifiedAt)} · ${E(evidenceMonitor(l))}</div></div><div class="card-actions"><label><input type="checkbox" data-compare="${E(l.id)}" ${selected.has(l.id) ? 'checked' : ''} aria-label="比较 ${E(l.name)}">加入比较</label><a href="#lab-${E(l.id)}" data-open="${E(l.id)}">定位此卡 ↗</a></div><details><summary>${detailed ? `展开完整证据卡 · ${(l.papers || []).length}篇代表作` : '展开官方来源与核验范围'}</summary><div class="details-body">${detailed ? reviewedDetails(l,r) : directoryDetails(l)}<h4>官方证据与核验范围</h4>${sourceDetails(l)}</div></details></article>`;
  }
  function counts(values) { const m = new Map(); for (const v of values) m.set(v,(m.get(v)||0)+1); return [...m].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0],'zh')); }
  function populate() {
    const opts = (id, entries) => { const v = $(id).value; $(id).innerHTML = $(id).options[0].outerHTML + entries.map(([k,t])=>`<option value="${E(k)}">${E(t)}</option>`).join(''); $(id).value = [...$(id).options].some(o=>o.value===v) ? v : ''; };
    opts('country', counts(data.labs.flatMap(countries)).map(([c,n])=>[c,`${c} (${n})`]));
    opts('institution', counts(data.labs.flatMap(institutions)).map(([c,n])=>[c,`${c} (${n})`]));
    opts('direction', counts(data.labs.flatMap(l=>l.directions)).map(([c,n])=>[c,`${c} (${n})`]));
    opts('tier',Object.entries(data.tiers)); opts('status',Object.entries(data.statuses));
    const topics = ['脑科学','脑机接口','计算生物学','AI虚拟细胞（AIVC）','单细胞与空间组学','神经影像','微生物组','基因组学'];
    $('quick-filters').innerHTML = topics.map(t=>{const n=data.labs.filter(l=>l.directions.includes(t)).length; return n ? `<button type="button" data-direction="${E(t)}" aria-pressed="false">${E(t)} <span>${n}</span></button>` : '';}).join('');
  }
  function restoreUrl() {
    const p = new URLSearchParams(location.search);
    resetFilters();
    for (const id of ids) { const v = p.get(id); if(v !== null && (id === 'query' || [...$(id).options].some(o=>o.value===v))) $(id).value=v; }
    page = Math.max(1,Math.floor(Number(p.get('page')))||1);
  }
  function resetFilters() { for(const id of ids) $(id).value=id==='sort'?'evidence':id==='page-size'?'24':''; }
  function syncUrl({preserveHash=false}={}) {
    const p = new URLSearchParams();
    for(const id of ids) { const v=$(id).value; if(v && !(id==='sort'&&v==='evidence') && !(id==='page-size'&&v==='24')) p.set(id,v); }
    if(page>1)p.set('page',page);
    const search=p.toString(); history.replaceState(null,'',location.pathname+(search?'?'+search:'')+(preserveHash?location.hash:''));
  }
  function getFiltered() {
    const q = norm($('query').value.trim()).split(/\s+/).filter(Boolean);
    const list = data.labs.filter(l => q.every(t=>l._search.includes(t)) && (!$('country').value || countries(l).includes($('country').value)) && (!$('institution').value || institutions(l).includes($('institution').value)) && (!$('direction').value || l.directions.includes($('direction').value)) && (!$('evidence').value || level(l)===$('evidence').value) && (!$('tier').value || l.tier===$('tier').value) && (!$('status').value || review(l).status===$('status').value));
    const sort=$('sort').value;
    list.sort((a,b)=> sort==='name' ? a.name.localeCompare(b.name) : sort==='country' ? a.country.localeCompare(b.country,'zh') || a.name.localeCompare(b.name) : sort==='institution' ? institution(a).localeCompare(institution(b)) || a.name.localeCompare(b.name) : sort==='date' ? b.verifiedAt.localeCompare(a.verifiedAt) || a.name.localeCompare(b.name) : Number(level(b)==='reviewed')-Number(level(a)==='reviewed') || (a.tier||'D').localeCompare(b.tier||'D') || a.name.localeCompare(b.name));
    return list;
  }
  function render({resetPage=false,preserveHash=false}={}) {
    if(!data)return;
    if(resetPage)page=1;
    filtered=getFiltered(); const size=Number($('page-size').value)||24, pages=Math.max(1,Math.ceil(filtered.length/size)); page=Math.min(page,pages);
    const start=(page-1)*size, visible=filtered.slice(start,start+size);
    $('result-count').textContent = `共 ${data.labs.length.toLocaleString('zh-CN')} 个团队 / PI · 筛选 ${filtered.length.toLocaleString('zh-CN')} 个${filtered.length ? ` · 显示 ${start+1}–${Math.min(start+size,filtered.length)}` : ''}`;
    $('cards').innerHTML=visible.length ? visible.map(card).join('') : '<p class="empty">没有符合全部条件的团队。请清空一个筛选条件或换个关键词。</p>';
    $('pagination').hidden=pages<=1;
    const numbers=[...new Set([1,page-1,page,page+1,pages].filter(n=>n>=1&&n<=pages))].sort((a,b)=>a-b);
    let previous=0;const buttons=numbers.map(n=>{const gap=previous&&n-previous>1?'<span aria-hidden="true">…</span>':'';previous=n;return `${gap}<button type="button" data-page="${n}" ${n===page?'aria-current="page"':''}>${n}</button>`;}).join('');
    $('pagination').innerHTML=`<button type="button" data-page="${page-1}" ${page===1?'disabled':''}>← 上一页</button><div class="page-numbers">${buttons}</div><button type="button" data-page="${page+1}" ${page===pages?'disabled':''}>下一页 →</button><span class="page-info">第 ${page} / ${pages} 页</span>`;
    $('export-results').disabled=!filtered.length;
    const active=ids.filter(id=>!['sort','page-size'].includes(id)&&$(id).value);
    $('active-filters').innerHTML=active.map(id=>`<button type="button" data-clear-filter="${id}">${E(id==='query'?$('query').value:$(id).selectedOptions[0].text)} ×</button>`).join('');
    document.querySelectorAll('#quick-filters [data-direction]').forEach(b=>b.setAttribute('aria-pressed',String($('direction').value===b.dataset.direction)));
    syncUrl({preserveHash}); renderComparison();
  }
  function renderComparison() {
    const labs=data.labs.filter(l=>selected.has(l.id));$('compare-bar').hidden=!labs.length;$('selected-count').textContent=`已选 ${labs.length} / 4 组`;
    if(!labs.length){$('comparison').hidden=true;return;}
    const unknown='尚未逐条核验';
    const rows=[['国家 / 机构',l=>E(countries(l).join(' / ')+' · '+institutions(l).join('；'))],['证据深度',l=>E(evidenceLabel(l))],['研究方向',l=>E(l.directions.join('；'))],['研究问题',l=>E(l.question||unknown)],['代表作',l=>(l.papers||[]).length?l.papers.map(p=>link(p.url,p.title)).join('<br>'):unknown],['衔接层级',l=>E(data.tiers[l.tier]||'待评估')],['技术优势',l=>E(l.strength||unknown)],['能力契合',l=>E(l.fit||unknown)],['技能缺口',l=>E((l.gaps||[]).join('；')||unknown)],['起步项目',l=>E(l.bridge||unknown)],['博士后机会',l=>`<b>${E(data.statuses[review(l).status])}</b><p>${E(review(l).reason)}</p><p>${E(l.opportunity?.summary||unknown)}</p>${link(l.opportunity?.url||profile(l),'官方来源')}`],['联合培养 / 访问',l=>E(l.opportunity?.visit||unknown)],['核验日期',l=>E(l.verifiedAt)],['官方资料',l=>link(profile(l),'团队 / PI资料')]];
    $('compare-table').innerHTML=`<table><caption>${labs.length}组公开证据比较；指导质量、数据权限和接收资格需进一步确认。</caption><thead><tr><th scope="col">比较维度</th>${labs.map(l=>`<th scope="col">${E(l.name)}</th>`).join('')}</tr></thead><tbody>${rows.map(([t,f])=>`<tr><th scope="row">${t}</th>${labs.map(l=>`<td>${f(l)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  function renderCoverage() {
    const detailed=data.labs.filter(l=>level(l)==='reviewed').length;
    const cs=counts(data.labs.flatMap(countries));const is=counts(data.labs.flatMap(institutions));
    $('stats').innerHTML=`<div><b>${data.labs.length.toLocaleString('zh-CN')}</b><span>团队 / PI条目</span></div><div><b>${cs.length}</b><span>国家 / 地区</span></div><div><b>${is.length}</b><span>机构 / 研究单元</span></div><div><b>${detailed}</b><span>含代表作证据卡</span></div>`;
    $('coverage-note').textContent=`${data.labs.length-detailed}条官方名录 + ${detailed}张详细证据卡 · 同一PI合并展示`;
    $('evidence-summary').innerHTML=`<div><b>广泛发现 <span>${data.labs.length-detailed}</span></b><p>官方PI / 研究组目录确认身份与来源；具体成果、适配与机会继续核验。</p></div><div><b>深入了解 <span>${detailed}</span></b><p>已整理代表论文、技术平台、衔接路径与机会来源；可直接横向比较。</p></div>`;
    $('country-overview').innerHTML=cs.map(([c,n])=>`<button type="button" data-country="${E(c)}">${E(c)}<b>${n}</b></button>`).join('');
    const sources=new Map();
    for(const l of data.labs) for(const s of l.sources||[]) {if(s.kind!=='directory')continue; const row=sources.get(s.url)||{url:s.url,label:s.label,country:s.country||l.country,ids:new Set(),date:s.verifiedAt};row.ids.add(l.id);sources.set(s.url,row);}
    $('source-list').innerHTML=[...sources.values()].sort((a,b)=>b.ids.size-a.ids.size).map(s=>`<article><h3>${link(s.url,s.label)}</h3><p>${E(s.country)} · 本库收录 ${s.ids.size} 条候选记录</p><p class="small">名录核验 ${E(s.date)}</p></article>`).join('')||'<p>详细证据卡已在各条目中提供官方来源。</p>';
  }
  function openHash() {
    const id=location.hash.slice(1); if(!id.startsWith('lab-')||!data)return;
    const target=data.labs.find(l=>'lab-'+l.id===id); if(!target)return;
    let index=filtered.findIndex(l=>l.id===target.id);
    if(index<0){resetFilters();filtered=getFiltered();index=filtered.findIndex(l=>l.id===target.id);}
    page=Math.floor(index/(Number($('page-size').value)||24))+1;render({preserveHash:true});
    const el=$(id); if(el){el.querySelector('details').open=true;el.scrollIntoView({block:'start'});}
  }
  async function json(url) {const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json();}
  async function load() {
    if(loading)return;loading=true;$('refresh').disabled=true;
    try {
      const next=await json('data/labs.json'); if(next.schemaVersion!==1||!Array.isArray(next.labs))throw Error('数据格式不兼容');
      data=next;for(const l of data.labs)l._search=norm([l.name,l.institution,l.groupName,l.question,l.fit,l.bridge,l.role,l.searchTerms,...(l.aliases||[]),...(l.platforms||[]),...l.directions,...institutions(l),...countries(l)].join(' '));
      for(const id of selected)if(!data.labs.some(l=>l.id===id))selected.delete(id);
      populate();if(!restored){restoreUrl();restored=true;}
      renderCoverage();$('methodology').innerHTML='<ol>'+data.methodology.map(t=>`<li>${E(t)}</li>`).join('')+'</ol>';
      $('history').innerHTML=data.history.slice().reverse().slice(0,20).map(h=>`<p><b>${E(h.date)}</b> ${E(h.summary)}</p>`).join('');
      render({preserveHash:true});openHash();$('freshness').textContent=`证据版本 ${data.edition} · 正在读取自动巡检批次…`;
      const raw='https://raw.githubusercontent.com/zbyloveyj/zbyloveyj.github.io/main/personal-growth-lab/academy/data/lab-monitor.json';
      const results=await Promise.allSettled([json(raw),json('data/lab-monitor.json')]);
      monitor=results.filter(x=>x.status==='fulfilled'&&x.value.schemaVersion===1).map(x=>x.value).sort((a,b)=>(b.checkedAt||'').localeCompare(a.checkedAt||''))[0]||{sources:{}};
      const date=monitor.checkedAt?new Date(monitor.checkedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'待首次运行';
      $('freshness').textContent=`证据版本 ${data.edition} · 网页巡检 ${date}${monitor.checkedAt?' 北京时间':''}${monitor.checkedAt&&age(monitor.checkedAt)>3?'（超过3天未更新）':''} · 自动检查不等于招聘复核`;
      // Update status without replacing cards: an open evidence panel and focus must remain stable.
      document.querySelectorAll('.lab-card').forEach(el=>{const l=data.labs.find(l=>'lab-'+l.id===el.id);const r=review(l);const status=el.querySelector('.status');status.className='status '+r.status;status.textContent=data.statuses[r.status];const old=el.querySelector('.review-note');if(old)old.remove();if(r.reason){const p=document.createElement('p');p.className='review-note';p.textContent='待复核：'+r.reason;el.querySelector('.date').before(p);}el.querySelector('.date').textContent=`${level(l)==='reviewed'?'内容核验':'名录核验'} ${l.verifiedAt} · ${evidenceMonitor(l)}`;});
      if($('status').value)render({preserveHash:true});else renderComparison();
    } catch(e) { $('freshness').textContent='证据库读取失败，请稍后刷新。'+(data?'当前保留已加载内容。':'可使用页尾结构化数据入口。');if(!data)$('cards').innerHTML='<p class="empty">暂时无法载入数据。请刷新或稍后重试。</p>'; }
    finally { loading=false;$('refresh').disabled=false; }
  }
  function preset(kind,value) { resetFilters();$(kind).value=value;page=1;render();$('catalog').scrollIntoView({block:'start'}); }
  $('filters').addEventListener('submit',e=>e.preventDefault());
  $('filters').addEventListener('input',()=>render({resetPage:true}));
  $('filters').addEventListener('reset',()=>setTimeout(()=>render({resetPage:true}),0));
  $('cards').addEventListener('change',e=>{const id=e.target.dataset.compare;if(!id)return;if(e.target.checked&&selected.size>=4){e.target.checked=false;notify('最多比较4组，请先取消一组。');return;}e.target.checked?selected.add(id):selected.delete(id);renderComparison();});
  document.addEventListener('click',e=>{const d=e.target.closest('[data-direction]');if(d){preset('direction',d.dataset.direction);return;}const c=e.target.closest('[data-country]');if(c){preset('country',c.dataset.country);return;}const f=e.target.closest('[data-clear-filter]');if(f){$(f.dataset.clearFilter).value='';render({resetPage:true});return;}const a=e.target.closest('[data-open]');if(a)document.getElementById('lab-'+a.dataset.open)?.querySelector('details').setAttribute('open','');});
  $('pagination').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(!b||b.disabled)return;page=Number(b.dataset.page);render();$('result-count').scrollIntoView({block:'start'});});
  document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>preset('direction',b.dataset.preset)));
  $('compare-open').addEventListener('click',()=>{$('comparison').hidden=false;$('comparison').scrollIntoView();$('comparison').querySelector('h2').focus({preventScroll:true});});
  $('compare-clear').addEventListener('click',()=>{selected.clear();render();});
  $('share-view').addEventListener('click',async()=>{syncUrl({preserveHash:true});try{await navigator.clipboard.writeText(location.href);notify('已复制当前筛选链接。');}catch{notify('当前地址栏已保存筛选条件，可直接复制网址。');}});
  $('export-results').addEventListener('click',()=>{
    const cell=v=>'"'+String(v??'').replace(/^([=+@-])/,"'$1").replace(/"/g,'""')+'"';
    const rows=[['姓名 / 团队','机构','国家 / 地区','研究方向','证据深度','研究问题','官方资料','目录来源','核验日期','博士后状态'],...filtered.map(l=>[l.name,institutions(l).join('；'),countries(l).join('；'),l.directions.join('；'),evidenceLabel(l),l.question,profile(l),(l.sources||[]).filter(s=>s.kind==='directory').map(s=>s.url).join('；'),l.verifiedAt,data.statuses[review(l).status]])];
    const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='research-teams-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);notify(`已导出全部 ${filtered.length} 条筛选结果。`);
  });
  $('refresh').addEventListener('click',load);window.addEventListener('hashchange',openHash);window.addEventListener('popstate',()=>{restoreUrl();render({preserveHash:true});openHash();});load();
})();
