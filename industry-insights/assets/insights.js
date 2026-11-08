(() => {
  'use strict';
  const $ = (s) => document.querySelector(s), model = window.IndustryInsightModel;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeURL = (v) => {try {const u=new URL(v,location.href);return u.protocol==='https:'?u.href:'#';}catch{return '#';}};
  const external = (s) => '<a href="'+esc(safeURL(s.url))+'" target="_blank" rel="noopener noreferrer">'+esc(s.label)+' ↗</a>';
  const kinds = {research:'研发进展',product:'产品与平台',deployment:'部署进展',equity:'股权融资',mixed:'股权与资助',grant:'公共资助',program:'产业项目预算',fundraise:'基金募资',acquisition:'并购',capex:'资本开支',contract:'订单与合同',earnings:'财报信号',partnership:'产业合作'};
  let report,watch,archive,state={sector:'all',view:'all',q:'',window:'all'},requestId=0,loadedIssue='latest';
  async function read(path) {const r=await fetch(path,{cache:'no-cache'});if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}
  function sectorHref(id) {return '?sector='+encodeURIComponent(id)+'#sector-detail';}
  function controlState() {return model.normalizeState({sector:$('#sector').value,view:state.view,q:$('#search').value,window:$('#window').value},watch);}
  function syncControls() {$('#sector').value=state.sector;$('#search').value=state.q;$('#window').value=state.window;}
  function stateFromURL() {const p=new URL(location.href).searchParams;return model.normalizeState({sector:p.get('sector'),view:p.get('view'),q:'',window:'all'},watch);}
  function saveURL(hash,push=true) {
    const u=new URL(location.href);
    state.sector==='all'?u.searchParams.delete('sector'):u.searchParams.set('sector',state.sector);
    state.view==='all'?u.searchParams.delete('view'):u.searchParams.set('view',state.view);
    if(hash)u.hash=hash;
    if(u.href!==location.href)history[push?'pushState':'replaceState']({},'',u);
  }
  function card(e) {
    const finance=e.finance?'<div class="finance"><strong>'+esc(e.finance.display)+'</strong><dl><dt>资金口径</dt><dd>'+esc(e.finance.basis)+'</dd><dt>轮次与状态</dt><dd>'+esc(e.finance.stage)+'</dd><dt>参与方</dt><dd>'+esc(e.finance.investors)+'</dd><dt>主要用途</dt><dd>'+esc(e.finance.use)+'</dd></dl></div>':'';
    const tags=e.sectors.map(id=>'<a class="tag" data-sector-link="'+esc(id)+'" href="'+sectorHref(id)+'">'+esc(watch.sectors.find(s=>s.id===id)?.name||id)+'</a>').join('');
    return '<article class="signal-card" id="event-'+esc(e.id)+'"><div class="signal-rail"><p class="card-date">'+esc(e.publishedDate)+'</p><span class="badge '+(e.tracks.includes('capital')?'capital':'')+'">'+esc(kinds[e.kind]||e.kind)+'</span><span class="signal-window '+(e.window==='context'?'context':'')+'">'+(e.window==='week'?'本期新消息':'延伸背景')+'</span></div><div class="signal-body"><p class="card-org">'+esc(e.organizations.join(' · '))+' / '+esc(e.region)+'</p><h3><a href="'+esc(safeURL(e.sources[0].url))+'" target="_blank" rel="noopener noreferrer">'+esc(e.title)+' ↗</a></h3><p class="fact">'+esc(e.fact)+'</p>'+(e.finance?'<div class="finance-summary">'+esc(e.finance.display)+'</div>':'')+'<div class="tags">'+tags+'</div><details class="analysis"><summary>'+(e.finance?'研究判断与资本明细':'研究判断与后续核查')+'<span aria-hidden="true">+</span></summary><div class="analysis-content">'+finance+'<p class="reading"><strong>观察判断：</strong>'+esc(e.insight)+'</p><p class="boundary"><strong>下一步核查：</strong>'+esc(e.nextCheck)+'</p><p class="boundary">证据类型：'+esc(e.evidence)+'</p><p class="boundary">事件日期：'+esc(e.eventDate||'未单独披露')+'；原文日期：'+esc(e.publishedDate)+'；核验日期：'+esc(e.verifiedDate)+'</p></div></details><div class="card-footer"><div class="source-links">'+e.sources.map(external).join('')+'</div><span class="dates">核验 '+esc(e.verifiedDate)+'</span></div></div></article>';
  }
  function renderDirectory() {
    $('#sector-map').innerHTML=watch.sectors.map((s,i)=>{
      const count=model.matches(report,watch,{sector:s.id}).length;
      return '<a class="sector-item" href="'+sectorHref(s.id)+'" data-sector-link="'+esc(s.id)+'" aria-label="查看'+esc(s.name)+'"'+(state.sector===s.id?' aria-current="page"':'')+'><span class="code">'+String(i+1).padStart(2,'0')+'</span><span class="sector-name">'+esc(s.name)+'</span><span class="sector-count">'+(count?count+' 条动态':'研究跟踪')+'</span><span class="sector-arrow" aria-hidden="true">↗</span></a>';
    }).join('');
  }
  function renderSector() {
    const s=watch.sectors.find(x=>x.id===state.sector), panel=$('#sector-detail');
    panel.hidden=!s;if(!s){panel.innerHTML='';return;}
    const all=model.matches(report,watch,{sector:s.id}), fresh=all.filter(e=>e.window==='week').length;
    const scope=all.length?(fresh+' 条本期新消息 · '+(all.length-fresh)+' 条延伸背景'):'本期暂未收录已核验动态，继续跟踪';
    panel.innerHTML='<div class="sector-detail-top"><div><p class="eyebrow">SECTOR RESEARCH</p><h3 id="selected-sector-title">'+esc(s.name)+'</h3></div><a class="sector-detail-close" href="?sector=all#signals" data-sector-link="all">全部领域 ↗</a></div><p>'+esc(s.watch)+'</p><p>重点指标：'+esc(s.indicators)+'</p><p class="scope">'+esc(scope)+'</p><p class="sector-brief-link"><a href="research/sector-'+esc(s.id)+'.html">阅读全文：客户、产业链、商业模式与风险 ↗</a></p><div class="sector-sources"><span>继续查阅</span>'+model.sources(watch,s.id).map(external).join('')+'</div>';
  }
  function renderCards() {
    const rows=model.matches(report,watch,state);
    $('#signal-list').innerHTML=rows.map(card).join('');
    $('#result-count').textContent=rows.length+' 条动态 · '+rows.filter(e=>e.window==='week').length+' 条本期新消息 · '+rows.filter(e=>e.window==='context').length+' 条背景';
    $('#capital-note').hidden=state.view!=='capital';
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===state.view)));
    $('#empty').hidden=rows.length>0;
    if(!rows.length){
      const s=watch.sectors.find(x=>x.id===state.sector), sectorRows=model.matches(report,watch,{sector:state.sector});
      if(s&&!sectorRows.length)$('#empty').innerHTML='<h3>'+esc(s.name)+' · 本期暂无已核验动态</h3><p>本领域的观察重点与信息源已在上方列出。有新的可靠消息时，会纳入后续周报。</p><a href="?sector=all#signals" data-sector-link="all">浏览其他领域 ↗</a>';
      else $('#empty').innerHTML='<h3>当前筛选暂无匹配结果</h3><p>可清空关键词或调整观察主线与日期范围。</p><a href="'+sectorHref(state.sector)+'" data-sector-link="'+esc(state.sector)+'">清除筛选，保留当前领域 ↗</a>';
    }
  }
  function renderSelection() {syncControls();renderDirectory();renderSector();renderCards();}
  function jumpToSelection() {const el=state.sector==='all'?$('#signals'):$('#sector-detail');el.scrollIntoView({block:'start'});if(state.sector!=='all')el.focus({preventScroll:true});}
  function selectSector(id,{push=true,jump=true}={}) {state=model.selectSector(state,id,watch);renderSelection();saveURL(state.sector==='all'?'signals':'sector-detail',push);if(jump)jumpToSelection();}
  function renderReport() {
    $('#edition-label').textContent=report.issue;
    $('#period').textContent=report.period.start+' — '+report.period.end;
    $('#updated').textContent='最近发布 '+report.generatedAt.slice(0,10)+' · UTC+8';
    $('#capital-count').textContent=String(report.entries.filter(e=>e.tracks.includes('capital')&&e.window==='week').length);
    $('#theses').innerHTML=report.theses.map((t,i)=>'<article class="thesis"><span class="number">0'+(i+1)+' / PERSPECTIVE</span><h3>'+esc(t.title)+'</h3><p>'+esc(t.text)+'</p><div class="evidence-links">'+t.evidenceIds.map(id=>{const e=report.entries.find(x=>x.id===id);return e?'<a href="#event-'+esc(id)+'" data-evidence="'+esc(id)+'">'+esc(e.organizations[0])+' ↗</a>':'';}).join('')+'</div></article>').join('');
    $('#coverage').textContent=report.coverageNote;
    const expired=Date.now()-new Date(report.period.end+'T23:59:59+08:00').getTime()>10*86400000;
    $('#freshness').hidden=!expired||loadedIssue!=='latest';
    $('#freshness').textContent='最新报告已超过10天，请结合原文日期阅读并核查本周更新状态。';
    const issue=archive.issues.find(x=>x.id===loadedIssue);
    $('#json-download').href=issue?issue.path:'data/latest.json';
    $('#full-report').href=issue?issue.html:'latest.html';
    renderSelection();
  }
  async function init() {
    try {
      if(!model)throw new Error('Model unavailable');
      [report,watch,archive]=await Promise.all([read('data/latest.json'),read('data/watchlist.json'),read('data/archive.json')]);
      $('#sector').innerHTML+=watch.sectors.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>').join('');
      $('#issue-select').innerHTML+=archive.issues.map(i=>'<option value="'+esc(i.id)+'">'+esc(i.label)+'</option>').join('');
      $('#source-list').innerHTML=watch.sources.map(s=>'<div class="source-item">'+external(s)+'<p>'+esc(s.focus)+'</p></div>').join('');
      state=stateFromURL();renderReport();
      document.addEventListener('click',ev=>{
        const a=ev.target.closest('a[data-sector-link],a[data-view-link]');
        if(!a||ev.ctrlKey||ev.metaKey||ev.shiftKey||ev.altKey||ev.button!==0)return;
        ev.preventDefault();
        if(a.dataset.sectorLink!==undefined)selectSector(a.dataset.sectorLink);
        else {state=model.normalizeState({view:a.dataset.viewLink},watch);renderSelection();saveURL('signals');jumpToSelection();}
      });
      document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{state=controlState();state.view=b.dataset.view;renderCards();saveURL(null,false);}));
      $('#search').addEventListener('input',()=>{state=controlState();renderCards();});
      $('#window').addEventListener('change',()=>{state=controlState();renderCards();});
      $('#sector').addEventListener('change',()=>selectSector($('#sector').value,{jump:false}));
      $('#reset').addEventListener('click',()=>selectSector('all',{jump:false}));
      $('#theses').addEventListener('click',ev=>{
        const a=ev.target.closest('[data-evidence]');if(!a)return;
        ev.preventDefault();state=model.normalizeState({},watch);renderSelection();saveURL('event-'+a.dataset.evidence);
        document.getElementById('event-'+a.dataset.evidence)?.scrollIntoView({block:'start'});
      });
      window.addEventListener('popstate',()=>{state=stateFromURL();renderSelection();});
      $('#issue-select').addEventListener('change',async()=>{
        const n=++requestId,value=$('#issue-select').value,path=value==='latest'?'data/latest.json':archive.issues.find(i=>i.id===value)?.path;
        if(!path)return;
        try{const next=await read(path);if(n!==requestId)return;report=next;loadedIssue=value;renderReport();}
        catch{if(n!==requestId)return;$('#issue-select').value=loadedIssue;$('#result-count').textContent='周报载入失败，仍显示上一期。请重试。';}
      });
      if(state.sector!=='all'&&location.hash==='#sector-detail')requestAnimationFrame(jumpToSelection);
      try{const status=await read('data/update-status.json');$('#update-state').textContent=status.enabled?status.scheduleLabel:'自动更新尚未启用';}catch{$('#update-state').textContent='更新状态暂时无法读取';}
    }catch{
      $('#result-count').textContent='交互数据暂时无法读取。';
      $('#signal-list').innerHTML='<p class="note">可先阅读<a href="latest.html">完整周报</a>，其中保留内容与来源。</p>';
      $('#update-state').textContent='数据载入失败，可阅读完整周报';
    }
  }
  init();
})();
