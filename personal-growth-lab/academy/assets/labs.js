'use strict';
(() => {
  const M = window.LabModel, $ = id => document.getElementById(id);
  const E = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safe = url => { try { const u=new URL(url);return ['https:','http:'].includes(u.protocol)?E(u.href):'#'; } catch{return '#';} };
  const link = (url,label) => `<a href="${safe(url)}" target="_blank" rel="noopener noreferrer">${E(label)} ↗</a>`;
  const age = date => (Date.now()-Date.parse(date))/86400000;
  const level = l => l.evidenceLevel || 'reviewed';
  const institution = l => l.institutionKey || l.institution;
  const institutions = l => [...new Set([institution(l),...(l.affiliations||[]).map(a=>a.institutionKey||a.institution)].filter(Boolean))];
  const countries = l => [...new Set([l.country,...(l.affiliations||[]).map(a=>a.country)].filter(Boolean))];
  const profile = l => l.profileUrl || l.sources?.[0]?.url || l.opportunity?.url;
  const evidenceLabel = l => ({reviewed:'代表作 + 适配已整理',research_profile:'个人研究资料已整理',official_directory:'官方团队名录'}[level(l)] || '证据待核验');
  const facetFilters = {'method-filter':'methods','disease-filter':'diseases','modality-filter':'modalities','scale-filter':'researchScales','design-filter':'studyDesigns'};
  const preferenceAxes = ['domains','methods','diseases','modalities'];
  const filterIds = ['query','country','institution','direction','evidence','collection','sort','page-size',...Object.keys(facetFilters),'role-filter','dimension-filter','min-evidence','stage-filter','tier','status'];
  const preferenceIds = preferenceAxes.flatMap(a=>['pref-'+a,'weight-'+a]);
  const selected = new Set(), notebook = new Map();
  let data, monitor={sources:{}}, filtered=[], page=1, loading=false, restored=false, toastTimer, storageAvailable=true, notebookWarning='';

  function notify(message) { $('announce').textContent=message;$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('toast').hidden=true;},4500); }
  function notebookFile() {return {type:M.notebookType,schemaVersion:1,exportedAt:new Date().toISOString(),entries:[...notebook.values()]};}
  try {const raw=localStorage.getItem(M.storageKey);if(raw)for(const e of M.validateNotebook(JSON.parse(raw)).entries)notebook.set(e.id,e);}catch{notebookWarning='当前浏览器未能读取名单；请检查浏览器存储或导入已有备份。';}
  function saveNotebook() {
    try{localStorage.setItem(M.storageKey,JSON.stringify(notebookFile()));storageAvailable=true;}catch{storageAvailable=false;}
    renderNotebook();return storageAvailable;
  }
  function mergeStoredNotebook() {
    // A background tab may not have received its storage event before the next edit.
    try{const raw=localStorage.getItem(M.storageKey);if(raw){const merged=M.mergeNotebooks(notebookFile(),JSON.parse(raw));notebook.clear();for(const row of merged.entries)notebook.set(row.id,row);}}catch{}
  }
  function setEntry(id,patch) {
    const lab=data.labs.find(l=>l.id===id);if(!lab)return;
    mergeStoredNotebook();
    notebook.set(id,{id,name:lab.name,saved:false,stage:'watch',note:'',...notebook.get(id),...patch,updatedAt:new Date().toISOString()});
    return saveNotebook();
  }
  function renderNotebook() {
    const entries=[...notebook.values()], saved=entries.filter(e=>e.saved).length, notes=entries.filter(e=>e.note.trim()).length;
    const known=data?new Set(data.labs.map(l=>l.id)):new Set();const missing=entries.filter(e=>!known.has(e.id)).length;
    $('notebook-status').textContent=`已收藏 ${saved} 位 · ${notes} 条阅读笔记${missing?` · ${missing} 条暂未匹配当前库（仍保留在备份中）`:''}${storageAvailable?'':' · 浏览器存储不可用，请立即导出备份'}${notebookWarning?' · '+notebookWarning:''}`;
    $('export-notebook').disabled=!entries.length;
  }
  function refreshNotebookFilters() {
    if(!data||!($('collection').value||$('stage-filter').value))return;
    const next=getFiltered();if(next.length===filtered.length&&next.every((l,i)=>l.id===filtered[i].id))return;
    const open=[...document.querySelectorAll('.lab-card details[open]')].map(el=>el.closest('.lab-card').id),active=document.activeElement;
    const focus=active?.dataset.note?['note',active.dataset.note]:active?.dataset.stage?['stage',active.dataset.stage]:null;
    const selection=focus?.[0]==='note'?[active.selectionStart,active.selectionEnd,active.selectionDirection]:null;
    render({preserveHash:next.some(l=>'#lab-'+l.id===location.hash)});
    for(const id of open)$(id)?.querySelector('details').setAttribute('open','');
    if(focus){const control=document.querySelector(`[data-${focus[0]}="${focus[1]}"]`);if(control){control.focus({preventScroll:true});if(selection)control.setSelectionRange(Math.min(selection[0],control.value.length),Math.min(selection[1],control.value.length),selection[2]);}}
  }
  function syncNotebookControls() {
    let changedActive=false;
    document.querySelectorAll('[data-save]').forEach(b=>{const saved=!!notebook.get(b.dataset.save)?.saved;b.setAttribute('aria-pressed',String(saved));b.classList.toggle('saved',saved);b.textContent=saved?'★ 已收藏':'☆ 收藏';});
    document.querySelectorAll('[data-stage]').forEach(select=>{const value=notebook.get(select.dataset.stage)?.stage||'watch';if(select.value!==value){changedActive||=select===document.activeElement;select.value=value;}});
    document.querySelectorAll('[data-note]').forEach(input=>{
      const value=notebook.get(input.dataset.note)?.note||'';if(input.value===value)return;
      const active=input===document.activeElement,start=input.selectionStart,end=input.selectionEnd,direction=input.selectionDirection;
      input.value=value;if(active){input.setSelectionRange(Math.min(start,value.length),Math.min(end,value.length),direction);changedActive=true;}
      const state=document.querySelector(`[data-note-state="${input.dataset.note}"]`);if(state)state.textContent='已同步另一个标签页的最新记录 · 当前浏览器保存';
    });
    renderNotebook();refreshNotebookFilters();
    if(changedActive)notify('已同步另一个标签页的最新笔记或准备阶段，请基于当前显示内容继续编辑。');
  }
  function review(l) {
    const o=l.opportunity||{status:'unknown'};
    if(!o.verifiedAt)return {status:'unknown',reason:''};
    const m=monitor.sources?.[o.url], stale=!Number.isFinite(age(o.verifiedAt))||age(o.verifiedAt)>data.reviewWindowDays;
    const expired=o.deadline&&Date.parse(o.deadline+'T23:59:59Z')<Date.now();
    const changed=m?.reviewStamp===o.verifiedAt&&m?.changed, failed=m?.reviewStamp===o.verifiedAt&&m.state!=='ok';
    const reason=expired?'公告截止日期已过':stale?`内容核验已超过${data.reviewWindowDays}天`:changed?'机会来源文本有变化':failed?'机会来源本次未能读取':'';
    return {status:reason?'unknown':o.status,reason};
  }
  function evidenceMonitor(l) {
    const rows=(l.sources||[]).map(s=>monitor.sources?.[s.url.split('#')[0]]).filter(Boolean);
    const changed=rows.filter(m=>m.changed).length,failed=rows.filter(m=>m.state!=='ok').length;
    return rows.length?`${changed}条变化 · ${failed}条读取异常`:'自动巡检待建立';
  }
  function sourceDetails(l) {
    return (l.sources||[]).map(s=>{const m=monitor.sources?.[s.url.split('#')[0]];return `<div class="source">${link(s.url,s.label)}<p>${E(s.claim)}</p><small>内容核验 ${E(s.verifiedAt)} · ${E(s.access||'官方公开来源')}${m?`<br>网页检查 ${E(m.checkedAt?.slice(0,10))} · ${m.state==='ok'?(m.changed?'有变化，待内容复核':'未检测到文本变化'):'读取异常'}`:''}</small></div>`;}).join('');
  }
  function evidenceRows(l,dimension) {
    const rows=M.evidence(l,dimension);
    return rows.length?rows.map(e=>`<div class="evidence-item"><p>${E(e.summary)}</p><small>${link(e.url,'来源')} · ${E(e.verifiedAt)}${e.basis?` · ${E(e.basis)}`:''}${l.sources?.some(s=>s.url===e.url&&s.kind==='historical')?' · 历史研究来源':''}</small></div>`).join(''):'<p class="unknown">待补充 · 尚未整理这项公开证据</p>';
  }
  function facetDetails(l) {
    return `<dl class="facet-details">${Object.entries(M.axes).map(([axis,title])=>`<div><dt>${E(title)}</dt><dd>${E(M.values(l,axis).join(' · ')||'待补充')}</dd></div>`).join('')}</dl><p class="small">${E(l.facetBasis||'结构化标签依据该条官方研究资料；未记录不代表不存在。')}</p>${l.taxonomyNote?`<p class="small">${E(l.taxonomyNote)}</p>`:''}${l.sharedGroup?`<p class="review-note">共同团队：${E(l.sharedGroup)}。本条为该团队的一位PI人物记录，不代表独立增加一个实验室。</p>`:''}${l.linkedProfileUrl?`<p class="review-note">目录原个人链接本次未能读取，当前使用可查证的官方目录。${link(l.linkedProfileUrl,'原个人链接（可稍后重试）')}</p>`:''}${l.roleNote?`<p class="review-note">任职说明：${E(l.roleNote)}</p>`:''}${l.scopeNote?`<p class="small">${E(l.scopeNote)}</p>`:''}${l.formerAffiliations?.length?`<h4>任职变更记录</h4>${l.formerAffiliations.map(a=>`<p>${E(a.institution)}（原任职）· ${E(a.note)} ${link(a.url,'变更依据')}</p>`).join('')}`:''}`;
  }
  function assessmentDetails(l) {
    return `<h4>多维证据 · ${M.evidenceCount(l)} / 7项已整理</h4><p class="small">资料完整度用于安排下一步核验，不作为导师水平排名。</p><div class="assessment-grid">${Object.entries(M.dimensions).map(([key,[title]])=>`<section class="assessment-item ${M.evidence(l,key).length?'documented':'pending'}"><h5>${E(title)}</h5>${evidenceRows(l,key)}</section>`).join('')}</div>`;
  }
  function reviewedDetails(l,r) {
    return `<h4>当前任职 · 公开事实</h4><p>${E(l.role)}</p><h4>持续产出与技术优势</h4><p>${E(l.strength)}</p><ul>${(l.platforms||[]).map(x=>`<li>${E(x)}</li>`).join('')}</ul><h4>能力衔接 · 编辑分析</h4><p>${E(l.fit)}</p><h4>需要补足</h4><ul>${(l.gaps||[]).map(x=>`<li>${E(x)}</li>`).join('')}</ul><h4>可实施的第一个项目</h4><p>${E(l.bridge)}</p><h4>适配边界</h4><p>${E(l.risk)}</p><h4>代表性论文 · 阅读入口</h4>${(l.papers||[]).map(p=>`<div class="paper">${link(p.url,p.title)}<small>${E(p.venue)} · ${E(p.year)} · ${E(p.kind)} · ${E(p.review)}<br>书目信息核验 ${E(p.verifiedAt)}</small><p>${E(p.why)}</p></div>`).join('')}${opportunityDetails(l,r)}`;
  }
  function opportunityDetails(l,r) {
    return `<h4>接收机会 · 附加参考</h4><p>${E(l.opportunity?.summary||'当前接收名额待核验。')}</p><p>${link(l.opportunity?.url||profile(l),'核对官方机会 / 资料来源')}</p><p class="small">${l.opportunity?.verifiedAt?`机会内容核验 ${E(l.opportunity.verifiedAt)}；截止日 ${E(l.opportunity.deadline||'未确认')}。`:'本条未核验当前接收名额。'}${r.reason?E(r.reason)+'，请重新核验。':''}</p><h4>博士联合培养 / 访问</h4><p>${E(l.opportunity?.visit||'博士、博士后与联合培养资格需分别核实；当前无名额不影响长期收录。')}</p>`;
  }
  function directoryDetails(l,r) {
    const affiliations=(l.affiliations||[]).filter(a=>a.institution!==l.institution);
    return `<h4>${level(l)==='research_profile'?'个人研究资料核验范围':'官方名录收录依据'}</h4><p>${E(l.evidenceScope||l.directoryNote||'官方研究组或导师目录列有该条目，并提供课题组或个人资料链接。')}</p>${l.role?`<p>${E(l.role)}</p>`:''}${l.groupName?`<p>研究组：${E(l.groupName)}</p>`:''}<p class="small">${E(l.fieldBasis||'方向依据官方条目或所属专题目录；宽泛标签不能代替个人研究方向复核。')}</p>${affiliations.length?`<h4>其他官方关联记录</h4>${affiliations.map(a=>`<p>${E(a.institution)} · ${E(a.country)}${a.url?' · '+link(a.url,'官方记录'):''}</p>`).join('')}`:''}${l.affiliationNote?`<p class="small">${E(l.affiliationNote)}</p>`:''}${opportunityDetails(l,r)}`;
  }
  function personalPanel(l) {
    const entry=notebook.get(l.id)||{stage:'watch',note:''};
    return `<section class="personal-panel"><h4>我的阅读与准备笔记</h4><label>准备阶段<select data-stage="${E(l.id)}" aria-label="${E(l.name)}的准备阶段">${Object.entries(M.stages).map(([k,v])=>`<option value="${k}" ${entry.stage===k?'selected':''}>${E(v)}</option>`).join('')}</select></label><label>私人笔记<textarea data-note="${E(l.id)}" maxlength="3000" rows="4" placeholder="想读哪篇论文？与我的问题有什么联系？还需要确认哪些资格？" aria-label="${E(l.name)}的阅读笔记">${E(entry.note)}</textarea></label><small data-note-state="${E(l.id)}">当前浏览器保存 · 最多3000字 · 可在“我的名单”导出</small></section>`;
  }
  function preferences() {return Object.fromEntries(preferenceAxes.map(a=>[a,{value:$('pref-'+a).value,weight:Number($('weight-'+a).value)}]));}
  function matchDetails(l,compact=false) {
    const m=M.match(l,preferences());if(m.score===null)return '';
    const title=`已记录标签匹配 ${m.score}% · ${m.matched.length}/${m.criteriaCount}项`;
    return `<div class="match-result"><strong>${E(title)}</strong>${compact?'':`<p>${m.matched.length?'已匹配：'+E(m.matched.map(x=>x.value).join('、')):'尚无匹配标签。'}</p>${m.missing.length?`<p class="small">待进一步确认：${E(m.missing.map(x=>x.value+(x.recorded?'（已有标签未覆盖）':'（该维度资料缺失）')).join('、'))}</p>`:''}`}</div>`;
  }
  function card(l) {
    const r=review(l),detailed=level(l)==='reviewed',saved=!!notebook.get(l.id)?.saved;
    const methods=M.values(l,'methods').slice(0,3), diseases=M.values(l,'diseases').slice(0,2);
    const role=M.roles[l.roleStatus]||M.roles.unknown;
    return `<article class="lab-card ${detailed?'reviewed':level(l)==='research_profile'?'profile':'directory'}" id="lab-${E(l.id)}"><div class="card-top"><div class="card-meta"><span>${E(countries(l).join(' / '))}</span><span>${E(detailed?data.tiers[l.tier]:role)}</span></div><span class="evidence-badge ${E(level(l))}">${E(evidenceLabel(l))}</span><h3>${E(l.name)}</h3><p class="institution">${E(l.institution)}${l.affiliations?.length?` <span class="affiliation-note">+${l.affiliations.length}条关联记录</span>`:''}</p><div class="tags">${l.directions.map(t=>`<button type="button" data-direction="${E(t)}">${E(t)}</button>`).join('')}</div><p class="question">${E(l.question||'官方目录已收录；具体研究问题请查阅团队资料。')}</p>${methods.length?`<p class="facet-line"><span>方法</span>${E(methods.join(' · '))}</p>`:''}${diseases.length?`<p class="facet-line"><span>健康问题</span>${E(diseases.join(' · '))}</p>`:''}<div class="evidence-meter" aria-label="7项评价维度中${M.evidenceCount(l)}项有证据">${Object.keys(M.dimensions).map(d=>`<span class="${M.evidence(l,d).length?'filled':''}" title="${E(M.dimensions[d][0])}：${M.evidence(l,d).length?'已有资料':'待补充'}"></span>`).join('')}<small>${M.evidenceCount(l)} / 7项证据</small></div>${matchDetails(l,true)}<div class="card-links">${link(profile(l),'官方团队 / PI资料')}<span class="status ${r.status}">${E(data.statuses[r.status])}</span></div>${r.reason?`<p class="review-note opportunity-review-note">待复核：${E(r.reason)}</p>`:''}<div class="date">${level(l)==='official_directory'?'名录核验':'内容核验'} ${E(l.verifiedAt)} · ${E(evidenceMonitor(l))}</div></div><div class="card-actions"><label><input type="checkbox" data-compare="${E(l.id)}" ${selected.has(l.id)?'checked':''} aria-label="比较 ${E(l.name)}">比较</label><button class="save-button ${saved?'saved':''}" type="button" data-save="${E(l.id)}" aria-pressed="${saved}" aria-label="收藏 ${E(l.name)}">${saved?'★ 已收藏':'☆ 收藏'}</button><a href="#lab-${E(l.id)}" data-open="${E(l.id)}">定位 ↗</a></div><details><summary>${detailed?`完整证据 · ${l.papers.length}篇代表作`:'研究详情与多维证据'}</summary><div class="details-body">${facetDetails(l)}${matchDetails(l)}${assessmentDetails(l)}${detailed?reviewedDetails(l,r):directoryDetails(l,r)}${personalPanel(l)}<h4>官方证据与核验范围</h4>${sourceDetails(l)}</div></details></article>`;
  }
  function counts(values) {const m=new Map();for(const v of values)m.set(v,(m.get(v)||0)+1);return [...m].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'zh'));}
  function opts(id,entries) {const v=$(id).value;$(id).innerHTML=$(id).options[0].outerHTML+entries.map(([k,t])=>`<option value="${E(k)}">${E(t)}</option>`).join('');$(id).value=[...$(id).options].some(o=>o.value===v)?v:'';}
  function populate() {
    opts('country',counts(data.labs.flatMap(countries)).map(([c,n])=>[c,`${c} (${n})`]));
    opts('institution',counts(data.labs.flatMap(institutions)).map(([c,n])=>[c,`${c} (${n})`]));
    opts('direction',counts(data.labs.flatMap(l=>l.directions)).map(([c,n])=>[c,`${c} (${n})`]));
    for(const [id,axis] of Object.entries(facetFilters))opts(id,counts(data.labs.flatMap(l=>M.values(l,axis))).map(([c,n])=>[c,`${c} (${n})`]));
    opts('tier',Object.entries(data.tiers));opts('status',Object.entries(data.statuses));opts('stage-filter',Object.entries(M.stages));
    opts('role-filter',counts(data.labs.map(l=>l.roleStatus||'unknown')).map(([c,n])=>[c,`${M.roles[c]||c} (${n})`]));
    opts('dimension-filter',Object.entries(M.dimensions).map(([k,[v]])=>[k,v]));
    if(!$('preference-controls').children.length)$('preference-controls').innerHTML=preferenceAxes.map(a=>`<div><label>${E(M.axes[a])}<select id="pref-${a}"><option value="">不设置目标</option></select></label><label class="weight-label">权重<select id="weight-${a}"><option value="0">0 · 忽略</option><option value="1" selected>1 · 参考</option><option value="2">2 · 较重要</option><option value="3">3 · 很重要</option></select></label></div>`).join('');
    for(const axis of preferenceAxes)opts('pref-'+axis,counts(data.labs.flatMap(l=>M.values(l,axis))).map(([v,n])=>[v,`${v} (${n})`]));
    const topics=['微生物组','肠脑轴','计算精神病学','医学人工智能','计算生物学','神经免疫','AI虚拟细胞（AIVC）','单细胞与空间组学','神经影像','脑机接口'];
    $('quick-filters').innerHTML=topics.map(t=>{const n=data.labs.filter(l=>l.directions.includes(t)).length;return n?`<button type="button" data-direction="${E(t)}" aria-pressed="false">${E(t)} <span>${n}</span></button>`:'';}).join('');
    $('dimension-guide').innerHTML=Object.entries(M.dimensions).map(([k,[title,description]],i)=>`<article><span>0${i+1}</span><h3>${E(title)}</h3><p>${E(description)}</p><button type="button" data-evidence-dimension="${k}">查看有此项资料的团队 ↗</button></article>`).join('')+'<article><span>08</span><h3>来源与时效</h3><p>分开显示内容核验日期与网页机器巡检。网页可访问或内容未变，不等于当前任职和接收资格再次得到确认。</p><a href="#method">查看核验规则 ↗</a></article>';
  }
  function resetFilters() {for(const id of filterIds)$(id).value=id==='sort'?'evidence':id==='page-size'?'24':'';}
  function clearPreferences() {for(const axis of preferenceAxes){$('pref-'+axis).value='';$('weight-'+axis).value='1';}}
  function restoreUrl() {
    const p=new URLSearchParams(location.search);resetFilters();clearPreferences();
    for(const id of [...filterIds,...preferenceIds]){const v=p.get(id);if(v!==null&&(id==='query'||[...$(id).options].some(o=>o.value===v)))$(id).value=v;}
    if(Object.keys(facetFilters).some(id=>$(id).value)||['role-filter','dimension-filter','min-evidence','stage-filter','tier','status'].some(id=>$(id).value))$('advanced-filters').open=true;
    if(preferenceAxes.some(a=>$('pref-'+a).value))$('match-panel').open=true;
    page=Math.max(1,Math.floor(Number(p.get('page')))||1);
  }
  function viewUrl({preserveHash=false,publicOnly=false}={}) {
    const p=new URLSearchParams();
    for(const id of [...filterIds,...preferenceIds]){if(publicOnly&&['collection','stage-filter'].includes(id))continue;const v=$(id).value;if(v&&!(id==='sort'&&v==='evidence')&&!(id==='page-size'&&v==='24')&&!(id.startsWith('weight-')&&v==='1'))p.set(id,v);}
    if(page>1&&!publicOnly)p.set('page',page);
    return location.pathname+(p.size?'?'+p.toString():'')+(preserveHash?location.hash:'');
  }
  function syncUrl(options) {history.replaceState(null,'',viewUrl(options));}
  function getFiltered() {
    const q=M.norm($('query').value.trim()).split(/\s+/).filter(Boolean), pref=preferences();
    const criteria=Object.fromEntries(Object.entries(facetFilters).map(([id,a])=>[a,$(id).value]));
    const list=data.labs.filter(l=>{
      const n=notebook.get(l.id),collect=$('collection').value;
      return q.every(t=>l._search.includes(t))&&(!$('country').value||countries(l).includes($('country').value))&&(!$('institution').value||institutions(l).includes($('institution').value))&&(!$('direction').value||l.directions.includes($('direction').value))&&(!$('evidence').value||level(l)===$('evidence').value)&&(!$('tier').value||l.tier===$('tier').value)&&(!$('status').value||review(l).status===$('status').value)&&M.matchesFacets(l,criteria)&&(!$('role-filter').value||(l.roleStatus||'unknown')===$('role-filter').value)&&(!$('dimension-filter').value||M.evidence(l,$('dimension-filter').value).length)&&(!$('min-evidence').value||M.evidenceCount(l)>=Number($('min-evidence').value))&&(!collect||(collect==='saved'?n?.saved:n?.note.trim()))&&(!$('stage-filter').value||n?.stage===$('stage-filter').value);
    });
    const ranks={reviewed:3,research_profile:2,official_directory:1},sort=$('sort').value;
    const scores=sort==='match'?new Map(list.map(l=>[l.id,M.match(l,pref).score||0])):null;
    const byEvidence=(a,b)=>(ranks[level(b)]||0)-(ranks[level(a)]||0)||(a.tier||'D').localeCompare(b.tier||'D')||a.name.localeCompare(b.name);
    list.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):sort==='country'?a.country.localeCompare(b.country,'zh')||a.name.localeCompare(b.name):sort==='institution'?institution(a).localeCompare(institution(b))||a.name.localeCompare(b.name):sort==='date'?b.verifiedAt.localeCompare(a.verifiedAt)||a.name.localeCompare(b.name):sort==='dimensions'?M.evidenceCount(b)-M.evidenceCount(a)||byEvidence(a,b):sort==='match'?scores.get(b.id)-scores.get(a.id)||byEvidence(a,b):byEvidence(a,b));
    return list;
  }
  function render({resetPage=false,preserveHash=false}={}) {
    if(!data)return;if(resetPage)page=1;
    filtered=getFiltered();const size=Number($('page-size').value)||24,pages=Math.max(1,Math.ceil(filtered.length/size));page=Math.min(page,pages);
    const start=(page-1)*size,visible=filtered.slice(start,start+size);
    $('result-count').textContent=`共 ${data.labs.length.toLocaleString('zh-CN')} 个团队 / PI · 筛选 ${filtered.length.toLocaleString('zh-CN')} 个${filtered.length?` · 显示 ${start+1}–${Math.min(start+size,filtered.length)}`:''}`;
    $('cards').innerHTML=visible.length?visible.map(card).join(''):'<p class="empty">没有符合全部条件的团队。请清空一个条件，或先收藏感兴趣的导师。资料尚未整理的团队可能不会出现在细分筛选中。</p>';
    $('pagination').hidden=pages<=1;
    const numbers=[...new Set([1,page-1,page,page+1,pages].filter(n=>n>=1&&n<=pages))].sort((a,b)=>a-b);let previous=0;
    const buttons=numbers.map(n=>{const gap=previous&&n-previous>1?'<span aria-hidden="true">…</span>':'';previous=n;return `${gap}<button type="button" data-page="${n}" ${n===page?'aria-current="page"':''}>${n}</button>`;}).join('');
    $('pagination').innerHTML=`<button type="button" data-page="${page-1}" ${page===1?'disabled':''}>← 上一页</button><div class="page-numbers">${buttons}</div><button type="button" data-page="${page+1}" ${page===pages?'disabled':''}>下一页 →</button><span class="page-info">第 ${page} / ${pages} 页</span>`;
    $('export-results').disabled=!filtered.length;
    const active=filterIds.filter(id=>!['sort','page-size'].includes(id)&&$(id).value);
    $('active-filters').innerHTML=active.map(id=>`<button type="button" data-clear-filter="${id}">${E(id==='query'?$('query').value:$(id).selectedOptions[0].text)} ×</button>`).join('');
    document.querySelectorAll('#quick-filters [data-direction]').forEach(b=>b.setAttribute('aria-pressed',String($('direction').value===b.dataset.direction)));
    const pref=preferences(),configured=Object.values(pref).filter(p=>p.value&&p.weight>0).length;
    $('match-summary').textContent=configured?`${configured}项有效标准 · 匹配率 = 已匹配权重 / 全部所选权重；缺少标签只表示待确认，不代表能力不足。`:'选择目标并设置正权重后，可按已记录标签匹配率排序。';
    syncUrl({preserveHash});renderComparison();renderNotebook();
  }
  function renderComparison() {
    const labs=data.labs.filter(l=>selected.has(l.id));$('compare-bar').hidden=!labs.length;$('selected-count').textContent=`已选 ${labs.length} / 4 组`;
    if(!labs.length){$('comparison').hidden=true;return;}
    const unknown='尚未逐条核验';
    const rows=[['国家 / 机构',l=>E(countries(l).join(' / ')+' · '+institutions(l).join('；'))],['任职身份',l=>E((M.roles[l.roleStatus]||M.roles.unknown)+(l.role?' · '+l.role:''))],['证据深度',l=>E(evidenceLabel(l))],...Object.entries(M.axes).map(([axis,title])=>[title,l=>E(M.values(l,axis).join('；')||unknown)]),['我的标签匹配',l=>matchDetails(l)||'尚未设置匹配标准'],...Object.entries(M.dimensions).map(([key,[title]])=>[title,l=>evidenceRows(l,key)]),['代表论文阅读入口',l=>(l.papers||[]).length?l.papers.map(p=>link(p.url,p.title)).join('<br>'):unknown],['衔接层级',l=>E(data.tiers[l.tier]||'待评估')],['能力契合',l=>E(l.fit||unknown)],['技能缺口 / 起步项目',l=>`<p>${E((l.gaps||[]).join('；')||unknown)}</p><p>${E(l.bridge||unknown)}</p>`],['接收机会',l=>`<b>${E(data.statuses[review(l).status])}</b><p>${E(review(l).reason)}</p><p>${E(l.opportunity?.summary||unknown)}</p>${link(l.opportunity?.url||profile(l),'官方来源')}`],['联合培养 / 访问',l=>E(l.opportunity?.visit||unknown)],['核验日期与巡检',l=>E(l.verifiedAt+' · '+evidenceMonitor(l))],['官方资料',l=>link(profile(l),'团队 / PI资料')]];
    $('compare-table').innerHTML=`<table><caption>${labs.length}组公开证据比较；空白表示本库尚未整理，不代表团队缺乏该能力。</caption><thead><tr><th scope="col">比较维度</th>${labs.map(l=>`<th scope="col">${E(l.name)}</th>`).join('')}</tr></thead><tbody>${rows.map(([t,f])=>`<tr><th scope="row">${E(t)}</th>${labs.map(l=>`<td>${f(l)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  function renderCoverage() {
    const detailed=data.labs.filter(l=>level(l)==='reviewed').length,research=data.labs.filter(l=>level(l)==='research_profile').length,directory=data.labs.length-detailed-research;
    const cs=counts(data.labs.flatMap(countries)),is=counts(data.labs.flatMap(institutions));
    $('stats').innerHTML=`<div><b>${data.labs.length.toLocaleString('zh-CN')}</b><span>团队 / PI条目</span></div><div><b>${cs.length}</b><span>国家 / 地区</span></div><div><b>${is.length}</b><span>机构 / 研究单元</span></div><div><b>${(research+detailed).toLocaleString('zh-CN')}</b><span>个人研究资料已整理</span></div>`;
    $('coverage-note').textContent=`${directory}条名录 · ${research}份研究资料 · ${detailed}张代表作与适配卡`;
    $('evidence-summary').innerHTML=`<div><b>名录发现 <span>${directory}</span></b><p>核对官方目录中的身份与机构关联；个人研究细节继续补充。</p></div><div><b>研究资料 <span>${research}</span></b><p>逐人整理研究介绍；读取限制和核验范围逐条说明。</p></div><div><b>代表作与适配 <span>${detailed}</span></b><p>另含至少两篇代表论文、技能缺口与起步项目，支持深入比较。</p></div>`;
    $('country-overview').innerHTML=cs.map(([c,n])=>`<button type="button" data-country="${E(c)}">${E(c)}<b>${n}</b></button>`).join('');
    const sources=new Map();for(const l of data.labs)for(const s of l.sources||[]){if(s.kind!=='directory')continue;const row=sources.get(s.url)||{url:s.url,label:s.label,country:s.country||l.country,ids:new Set(),date:s.verifiedAt};row.ids.add(l.id);sources.set(s.url,row);}
    $('source-list').innerHTML=[...sources.values()].sort((a,b)=>b.ids.size-a.ids.size).map(s=>`<article><h3>${link(s.url,s.label)}</h3><p>${E(s.country)} · 本库收录 ${s.ids.size} 条候选记录</p><p class="small">名录核验 ${E(s.date)}</p></article>`).join('')||'<p>个人证据卡提供各自官方来源。</p>';
  }
  function openHash() {
    const id=location.hash.slice(1);if(!id.startsWith('lab-')||!data)return;const target=data.labs.find(l=>'lab-'+l.id===id);if(!target)return;
    let index=filtered.findIndex(l=>l.id===target.id);if(index<0){resetFilters();filtered=getFiltered();index=filtered.findIndex(l=>l.id===target.id);}
    page=Math.floor(index/(Number($('page-size').value)||24))+1;render({preserveHash:true});const el=$(id);if(el){el.querySelector('details').open=true;el.scrollIntoView({block:'start'});}
  }
  async function json(url) {const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json();}
  async function load() {
    if(loading)return;loading=true;$('refresh').disabled=true;
    try{
      const next=await json('data/labs.json');if(next.schemaVersion!==1||!Array.isArray(next.labs))throw Error('数据格式不兼容');
      data=next;for(const l of data.labs)l._search=M.searchText(l);for(const id of selected)if(!data.labs.some(l=>l.id===id))selected.delete(id);
      populate();if(!restored){restoreUrl();restored=true;}renderCoverage();
      $('methodology').innerHTML='<ol>'+data.methodology.map(t=>`<li>${E(t)}</li>`).join('')+'</ol>';
      $('history').innerHTML=data.history.slice().reverse().slice(0,20).map(h=>`<p><b>${E(h.date)}</b> ${E(h.summary)}</p>`).join('');
      render({preserveHash:true});openHash();$('freshness').textContent=`证据版本 ${data.edition} · 正在读取自动巡检批次…`;
      const raw='https://raw.githubusercontent.com/zbyloveyj/zbyloveyj.github.io/main/personal-growth-lab/academy/data/lab-monitor.json';
      const results=await Promise.allSettled([json(raw),json('data/lab-monitor.json')]);
      monitor=results.filter(x=>x.status==='fulfilled'&&x.value.schemaVersion===1).map(x=>x.value).sort((a,b)=>(b.checkedAt||'').localeCompare(a.checkedAt||''))[0]||{sources:{}};
      const date=monitor.checkedAt?new Date(monitor.checkedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'待首次运行';
      $('freshness').textContent=`证据版本 ${data.edition} · 网页巡检 ${date}${monitor.checkedAt?' 北京时间':''}${monitor.checkedAt&&age(monitor.checkedAt)>3?'（超过3天未更新）':''} · 自动检查不等于内容复核`;
      document.querySelectorAll('.lab-card').forEach(el=>{const l=data.labs.find(l=>'lab-'+l.id===el.id),r=review(l),status=el.querySelector('.status');status.className='status '+r.status;status.textContent=data.statuses[r.status];el.querySelector('.opportunity-review-note')?.remove();if(r.reason){const p=document.createElement('p');p.className='review-note opportunity-review-note';p.textContent='待复核：'+r.reason;el.querySelector('.date').before(p);}el.querySelector('.date').textContent=`${level(l)==='official_directory'?'名录核验':'内容核验'} ${l.verifiedAt} · ${evidenceMonitor(l)}`;});
      if($('status').value)render({preserveHash:true});else renderComparison();
    }catch(e){$('freshness').textContent='证据库读取失败，请稍后刷新。'+(data?'当前保留已加载内容。':'可使用页尾结构化数据入口。');if(!data)$('cards').innerHTML='<p class="empty">暂时无法载入数据。请刷新或稍后重试。</p>';}
    finally{loading=false;$('refresh').disabled=false;}
  }
  function preset(kind,value) {resetFilters();$(kind).value=value;page=1;render();$('catalog').scrollIntoView({block:'start'});}
  function download(content,name,type) {const u=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  $('filters').addEventListener('submit',e=>e.preventDefault());
  $('filters').addEventListener('input',()=>render({resetPage:true}));
  $('filters').addEventListener('reset',e=>{e.preventDefault();resetFilters();render({resetPage:true});});
  $('preference-controls').addEventListener('change',()=>render({resetPage:true}));
  $('apply-match').addEventListener('click',()=>{$('sort').value='match';render({resetPage:true});});
  $('clear-match').addEventListener('click',()=>{clearPreferences();if($('sort').value==='match')$('sort').value='evidence';render({resetPage:true});});
  $('cards').addEventListener('change',e=>{
    const id=e.target.dataset.compare;if(id){if(e.target.checked&&selected.size>=4){e.target.checked=false;notify('最多比较4组，请先取消一组。');return;}e.target.checked?selected.add(id):selected.delete(id);renderComparison();return;}
    const stageId=e.target.dataset.stage;if(stageId){setEntry(stageId,{stage:e.target.value});refreshNotebookFilters();}
  });
  $('cards').addEventListener('input',e=>{const id=e.target.dataset.note;if(!id)return;const ok=setEntry(id,{note:e.target.value});const state=document.querySelector(`[data-note-state="${id}"]`);if(state)state.textContent=ok?'已保存在当前浏览器 · 可导出备份':'浏览器存储不可用 · 本页保留，请立即导出备份';refreshNotebookFilters();});
  document.addEventListener('click',e=>{
    const save=e.target.closest('[data-save]');if(save){const id=save.dataset.save,saved=!notebook.get(id)?.saved,ok=setEntry(id,{saved});save.setAttribute('aria-pressed',String(saved));save.classList.toggle('saved',saved);save.textContent=saved?'★ 已收藏':'☆ 收藏';refreshNotebookFilters();if(!ok)notify('浏览器存储不可用；请在“我的名单”导出本次记录。');return;}
    const d=e.target.closest('[data-direction]');if(d){preset('direction',d.dataset.direction);return;}
    const c=e.target.closest('[data-country]');if(c){preset('country',c.dataset.country);return;}
    const ev=e.target.closest('[data-evidence-dimension]');if(ev){preset('dimension-filter',ev.dataset.evidenceDimension);$('advanced-filters').open=true;return;}
    const f=e.target.closest('[data-clear-filter]');if(f){$(f.dataset.clearFilter).value='';render({resetPage:true});return;}
    const a=e.target.closest('[data-open]');if(a)document.getElementById('lab-'+a.dataset.open)?.querySelector('details').setAttribute('open','');
  });
  $('pagination').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(!b||b.disabled)return;page=Number(b.dataset.page);render();$('result-count').scrollIntoView({block:'start'});});
  document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>preset('direction',b.dataset.preset)));
  $('compare-open').addEventListener('click',()=>{$('comparison').hidden=false;$('comparison').scrollIntoView();$('comparison').querySelector('h2').focus({preventScroll:true});});
  $('compare-clear').addEventListener('click',()=>{selected.clear();render();});
  $('share-view').addEventListener('click',async()=>{
    const url=new URL(viewUrl({preserveHash:true,publicOnly:true}),location.href).href;
    try{await navigator.clipboard.writeText(url);notify('已复制公开筛选条件与匹配标准；不包含收藏和私人笔记。');}
    catch{syncUrl({preserveHash:true,publicOnly:true});notify('公开筛选链接已放入地址栏，可直接复制；笔记未包含。');}
  });
  $('export-results').addEventListener('click',()=>{
    const cell=v=>'"'+String(v??'').replace(/^(\s*[=+@-])/u,"'$1").replace(/"/g,'""')+'"';
    const rows=[['姓名 / 团队','机构','国家 / 地区','任职类型',...Object.values(M.axes),'证据深度','已整理维度数','研究问题','官方资料','内容核验日期','接收机会','标签匹配率','已匹配标准','待确认标准',...Object.values(M.dimensions).map(d=>d[0]+' · 公开证据与来源')],...filtered.map(l=>{const m=M.match(l,preferences());return [l.name,institutions(l).join('；'),countries(l).join('；'),M.roles[l.roleStatus]||M.roles.unknown,...Object.keys(M.axes).map(a=>M.values(l,a).join('；')),evidenceLabel(l),M.evidenceCount(l),l.question,profile(l),l.verifiedAt,data.statuses[review(l).status],m.score===null?'':m.score+'%',m.matched.map(x=>x.value).join('；'),m.missing.map(x=>x.value).join('；'),...Object.keys(M.dimensions).map(d=>M.evidence(l,d).map(e=>e.summary+' ['+e.url+']').join('；'))];})];
    download('\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n'),'research-teams-'+new Date().toISOString().slice(0,10)+'.csv','text/csv;charset=utf-8');notify(`已导出全部 ${filtered.length} 条公开筛选结果，含多维证据；私人笔记未包含。`);
  });
  $('show-saved').addEventListener('click',()=>preset('collection','saved'));
  $('export-notebook').addEventListener('click',()=>download(JSON.stringify(notebookFile(),null,2),'research-notebook-'+new Date().toISOString().slice(0,10)+'.json','application/json;charset=utf-8'));
  $('import-notebook').addEventListener('change',async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{if(file.size>5*1024*1024)throw Error('备份文件不能超过5MB。');const incoming=JSON.parse(await file.text());mergeStoredNotebook();const merged=M.mergeNotebooks(notebookFile(),incoming);notebook.clear();for(const row of merged.entries)notebook.set(row.id,row);notebookWarning='';const ok=saveNotebook();render();notify(ok?`已合并 ${merged.entries.length} 条记录，保留每条较新的版本。`:'已读入备份，但浏览器存储不可用；请导出本页记录。');}catch(err){notify('未导入：'+err.message);}finally{e.target.value='';}
  });
  $('refresh').addEventListener('click',load);window.addEventListener('hashchange',openHash);window.addEventListener('popstate',()=>{restoreUrl();render({preserveHash:true});openHash();});
  window.addEventListener('storage',e=>{if(e.key!==M.storageKey&&e.key!==null)return;try{const raw=localStorage.getItem(M.storageKey),next=raw?M.mergeNotebooks(notebookFile(),JSON.parse(raw)):{entries:[]};notebook.clear();for(const row of next.entries)notebook.set(row.id,row);syncNotebookControls();}catch{notify('另一个标签页的名单格式无法读取，当前页面已保留原记录。');}});
  load();
})();
