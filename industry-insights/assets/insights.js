(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const url = (v) => {try { const u = new URL(v, location.href); return u.protocol === 'https:' ? u.href : '#'; } catch {return '#';}};
  const external = (s) => `<a href="${esc(url(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ↗</a>`;
  const kinds = {research:'研发进展',product:'产品 / 平台',deployment:'部署进展',equity:'股权融资',mixed:'股权 + 资助',grant:'公共资助',program:'产业项目预算',fundraise:'基金募资',acquisition:'并购',capex:'资本开支',contract:'订单 / 合同',earnings:'财报信号',partnership:'产业合作'};
  let report, watch, archive, view = 'all', requestId = 0;
  async function read(path) { const r = await fetch(path, {cache:'no-cache'}); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }
  function card(e) {
    const fin = e.finance ? `<div class="finance"><strong>${esc(e.finance.display)}</strong><dl><dt>口径</dt><dd>${esc(e.finance.basis)}</dd><dt>轮次 / 状态</dt><dd>${esc(e.finance.stage)}</dd><dt>资金参与方</dt><dd>${esc(e.finance.investors)}</dd><dt>主要用途</dt><dd>${esc(e.finance.use)}</dd></dl></div>` : '';
    return `<article class="signal-card" id="event-${esc(e.id)}"><div class="card-top"><span class="badge ${e.tracks.includes('capital')?'capital':''}">${esc(kinds[e.kind] || e.kind)}</span><span class="${e.window==='context'?'context':'muted'}">${e.window==='week'?'本期新消息':'延伸背景 · 非本周新增'}</span></div><p class="card-org">${esc(e.organizations.join(' · '))} / ${esc(e.region)}</p><h3><a href="${esc(url(e.sources[0].url))}" target="_blank" rel="noopener noreferrer">${esc(e.title)} ↗</a></h3><p class="fact">${esc(e.fact)}</p>${fin}<p class="reading"><strong>观察判断：</strong>${esc(e.insight)}</p><p class="boundary"><strong>下一步核查：</strong>${esc(e.nextCheck)}</p><div class="tags">${e.sectors.map(s=>`<span class="tag">${esc(watch.sectors.find(x=>x.id===s)?.name || s)}</span>`).join('')}<span class="tag">${esc(e.evidence)}</span></div><div class="card-footer"><div class="source-links">${e.sources.map(external).join('')}</div><div class="dates">原文 ${esc(e.publishedDate)}<br>事件 ${esc(e.eventDate || '未单独披露')}<br>核验 ${esc(e.verifiedDate)}</div></div></article>`;
  }
  function renderCards() {
    const q = $('#search').value.trim().toLocaleLowerCase();
    const sector = $('#sector').value, win = $('#window').value;
    const rows = report.entries.filter(e => (view === 'all' || e.tracks.includes(view)) && (sector === 'all' || e.sectors.includes(sector)) && (win === 'all' || e.window === win) && (!q || JSON.stringify(e).toLocaleLowerCase().includes(q) || e.sectors.some(s=>{const t=watch.sectors.find(x=>x.id===s);return t && `${t.name} ${t.aliases.join(' ')}`.toLocaleLowerCase().includes(q);})));
    $('#signal-list').innerHTML = rows.map(card).join('');
    $('#result-count').textContent = `${rows.length} 条匹配 · ${rows.filter(e=>e.window==='week').length} 条本期新消息 · ${rows.filter(e=>e.window==='context').length} 条背景`;
    $('#empty').hidden = rows.length > 0;
    $('#capital-note').hidden = view !== 'capital';
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed', String(b.dataset.view===view)));
  }
  function renderReport() {
    $('#edition-label').textContent = report.issue;
    $('#period').textContent = `${report.period.start} — ${report.period.end}`;
    $('#updated').textContent = `最近发布 ${report.generatedAt.slice(0,10)} · UTC+8`;
    $('#theses').innerHTML = report.theses.map((t,i)=>`<article class="thesis"><span class="number">0${i+1} / 观察</span><h3>${esc(t.title)}</h3><p>${esc(t.text)}</p><div class="evidence-links">${t.evidenceIds.map(id=>{const e=report.entries.find(x=>x.id===id);return e?`<a href="#event-${esc(id)}" data-evidence="${esc(id)}">${esc(e.organizations[0])} ↓</a>`:'';}).join('')}</div></article>`).join('');
    $('#coverage').textContent = report.coverageNote;
    const expired = Date.now() - new Date(`${report.period.end}T23:59:59+08:00`).getTime() > 10*86400000;
    const historical = $('#issue-select').value !== 'latest';
    $('#freshness').hidden = !expired || historical;
    $('#freshness').textContent = '当前最新报告已超过10天，数据可能尚未完成本周更新。请结合原文日期阅读，并查看更新状态。';
    $('#json-download').href = historical ? archive.issues.find(x=>x.id===$('#issue-select').value).path : 'data/latest.json';
    $('#full-report').href = historical ? archive.issues.find(x=>x.id===$('#issue-select').value).html : 'latest.html';
    renderCards();
  }
  async function init() {
    try {
      [report,watch,archive] = await Promise.all([read('data/latest.json'),read('data/watchlist.json'),read('data/archive.json')]);
      $('#sector').innerHTML += watch.sectors.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
      $('#issue-select').innerHTML += archive.issues.map(i=>`<option value="${esc(i.id)}">${esc(i.label)}</option>`).join('');
      $('#sector-map').innerHTML = watch.sectors.map((s,i)=>`<article class="sector-item"><span class="code">${String(i+1).padStart(2,'0')} / WATCHLIST</span><h3>${esc(s.name)}</h3><p>${esc(s.watch)}</p><p class="samples">观察指标：${esc(s.indicators)}</p></article>`).join('');
      $('#source-list').innerHTML = watch.sources.map(s=>`<div class="source-item">${external(s)}<p>${esc(s.focus)}</p></div>`).join('');
      renderReport();
      document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;renderCards();}));
      for (const id of ['search','sector','window']) $(`#${id}`).addEventListener(id==='search'?'input':'change',renderCards);
      $('#reset').addEventListener('click',()=>{view='all';$('#search').value='';$('#sector').value='all';$('#window').value='all';renderCards();});
      $('#theses').addEventListener('click',ev=>{const a=ev.target.closest('[data-evidence]');if(!a)return;ev.preventDefault();view='all';$('#search').value='';$('#sector').value='all';$('#window').value='all';renderCards();document.getElementById(`event-${a.dataset.evidence}`)?.scrollIntoView({block:'start'});});
      $('#issue-select').addEventListener('change',async()=>{const n=++requestId;const value=$('#issue-select').value;const path=value==='latest'?'data/latest.json':archive.issues.find(i=>i.id===value)?.path;if(!path)return;try{const next=await read(path);if(n!==requestId)return;report=next;renderReport();}catch{$('#result-count').textContent='本期周报载入失败，请选择最新一期重试。';}});
      try {const status=await read('data/update-status.json');$('#update-state').textContent=status.enabled?`● ${status.scheduleLabel}`:'自动更新尚未启用';}catch{$('#update-state').textContent='更新状态暂时无法读取';}
    } catch {
      $('#result-count').textContent='报告数据暂时无法读取。';
      $('#signal-list').innerHTML='<p class="note">可先阅读<a href="latest.html">完整周报</a>，其中保留全部内容和原文链接。</p>';
      $('#update-state').textContent='数据载入失败，可阅读完整周报';
    }
  }
  init();
})();
