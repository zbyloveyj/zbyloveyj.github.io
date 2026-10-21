'use strict';
(() => {
  const M = window.LabModel, D = window.LabDiscovery, T = window.LabTaxonomy, $ = id => document.getElementById(id);
  const E = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safe = url => { try { const u=new URL(url);return ['https:','http:'].includes(u.protocol)?E(u.href):'#'; } catch{return '#';} };
  const link = (url,label) => `<a href="${safe(url)}" target="_blank" rel="noopener noreferrer">${E(label)} ↗</a>`;
  const age = date => (Date.now()-Date.parse(date))/86400000;
  const level = l => l.evidenceLevel || 'reviewed';
  const institutionContext = l => level(l)==='project_record'?'项目依托单位：':'';
  const institution = l => l.institutionKey || l.institution;
  const institutions = l => [...new Set([institution(l),...(l.affiliations||[]).map(a=>a.institutionKey||a.institution)].filter(Boolean))];
  const otherInstitutions = l => [...new Set((l.affiliations||[]).map(a=>a.institution).filter(value=>value&&value!==l.institution))];
  const institutionDescription = l => institutionContext(l)+(l.institution||'')+(otherInstitutions(l).length?'；其他关联机构：'+otherInstitutions(l).join('；'):'');
  const countries = l => [...new Set([l.country,...(l.affiliations||[]).map(a=>a.country)].filter(Boolean))];
  const profile = l => l.profileUrl || l.sources?.[0]?.url || l.opportunity?.url;
  const evidenceLabel = l => ({reviewed:'代表作 + 适配已整理',research_profile:'个人研究资料已整理',project_record:'科研项目证据',official_directory:'官方团队名录'}[level(l)] || '证据待核验');
  const verificationLabel = l => level(l)==='official_directory'?'名录核验':level(l)==='project_record'?'项目记录核对':'内容核验';
  const facetFilters = {'method-filter':'methods','disease-filter':'diseases','modality-filter':'modalities','scale-filter':'researchScales','design-filter':'studyDesigns'};
  const preferenceAxes = ['domains','methods','diseases','modalities'];
  const filterIds = ['query','country','institution','field','direction','research-info','evidence','update-filter','collection','sort','page-size',...Object.keys(facetFilters),'role-filter','dimension-filter','min-evidence','stage-filter','review-filter','tier','status'];
  const preferenceIds = preferenceAxes.flatMap(a=>['pref-'+a,'weight-'+a]);
  const selected = new Set(), notebook = new Map(), savedViews = new Map(), relatedCache = new Map(), labLookup = new Map();
  let data, monitor={sources:{}}, filtered=[], page=1, loading=false, restored=false, toastTimer, storageAvailable=true, notebookWarning='', directorySources=[], sourceLimit=32, agendaLimit=8, filterTimer, directionOptionsKey='', evidenceOrder=[];

  function notify(message) { $('announce').textContent=message;$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('toast').hidden=true;},4500); }
  function notebookFile() {return {type:M.notebookType,schemaVersion:1,exportedAt:new Date().toISOString(),entries:[...notebook.values()],savedViews:[...savedViews.values()]};}
  try {const raw=localStorage.getItem(M.storageKey);if(raw){const file=M.validateNotebook(JSON.parse(raw));for(const e of file.entries)notebook.set(e.id,e);for(const v of file.savedViews||[])savedViews.set(v.id,v);}}catch{notebookWarning='当前浏览器未能读取名单；请检查浏览器存储或导入已有备份。';}
  function mergeStoredViews() {
    try{const raw=localStorage.getItem(M.viewsStorageKey);if(raw){const merged=M.mergeViews([...savedViews.values()],JSON.parse(raw));savedViews.clear();for(const v of merged)savedViews.set(v.id,v);}}catch{notebookWarning='部分筛选方案未能读取，请保留原备份并检查浏览器存储。';}
  }
  mergeStoredViews();
  function saveNotebook() {
    mergeStoredViews();
    try{localStorage.setItem(M.storageKey,JSON.stringify(notebookFile()));localStorage.setItem(M.viewsStorageKey,JSON.stringify([...savedViews.values()]));storageAvailable=true;}catch{storageAvailable=false;}
    renderNotebook();return storageAvailable;
  }
  function mergeStoredNotebook() {
    // A background tab may not have received its storage event before the next edit.
    try{const raw=localStorage.getItem(M.storageKey);if(raw){const merged=M.mergeNotebooks(notebookFile(),JSON.parse(raw));notebook.clear();for(const row of merged.entries)notebook.set(row.id,row);for(const v of merged.savedViews||[])savedViews.set(v.id,v);}}catch{}
    mergeStoredViews();
  }
  function setEntry(id,patch) {
    const lab=labLookup.get(id);if(!lab)return;
    mergeStoredNotebook();
    notebook.set(id,{id,name:lab.name,saved:false,stage:'watch',note:'',...notebook.get(id),...patch,updatedAt:new Date().toISOString()});
    return saveNotebook();
  }
  function renderNotebook() {
    const entries=[...notebook.values()], saved=entries.filter(e=>e.saved).length, notes=entries.filter(e=>e.note.trim()).length;
    const known=labLookup;const missing=entries.filter(e=>!known.has(e.id)).length;
    $('notebook-status').textContent=`已收藏 ${saved} 位 · ${notes} 条阅读笔记${missing?` · ${missing} 条暂未匹配当前库（仍保留在备份中）`:''}${storageAvailable?'':' · 浏览器存储不可用，请立即导出备份'}${notebookWarning?' · '+notebookWarning:''}`;
    $('export-notebook').disabled=!entries.length&&!savedViews.size;
    renderViews();renderAgenda();
  }
  function localDate(offset=0) {const d=new Date();d.setDate(d.getDate()+offset);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
  function planned(entry,kind) {
    if(!kind)return true;
    if(kind==='tasks')return !!entry?.nextAction?.trim()||!!entry?.reviewDate;
    if(!entry?.reviewDate)return false;
    return kind==='planned'||entry.reviewDate<=localDate(kind==='week'?7:0);
  }
  function renderAgenda() {
    if(!data)return;
    const known=labLookup,kind=$('agenda-filter').value;
    const entries=[...notebook.values()].filter(e=>planned(e,kind)).sort((a,b)=>(a.reviewDate||'9999').localeCompare(b.reviewDate||'9999')||a.name.localeCompare(b.name));
    const due=[...notebook.values()].filter(e=>planned(e,'due')).length;
    $('agenda-status').textContent=`${due} 条计划已到复查日期 · 当前范围 ${entries.length} 条`;
    $('agenda-list').innerHTML=entries.slice(0,agendaLimit).map(e=>`<article class="agenda-item"><div><h4>${known.has(e.id)?`<a href="#lab-${E(e.id)}">${E(e.name)}</a>`:E(e.name)}</h4><p>${E(e.nextAction||'查看研究进展、任职或接收信息')}</p><span class="agenda-date ${e.reviewDate&&e.reviewDate<=localDate()?'due':''}">${E(e.reviewDate||'尚未设置日期')}${e.reviewDate&&e.reviewDate<=localDate()?' · 到期':''}</span>${known.has(e.id)?'':'<p class="small">当前库暂未匹配这条记录；计划仍保留在备份中。</p>'}</div>${known.has(e.id)?`<div class="agenda-actions"><button type="button" data-review-next="${E(e.id)}">7天后复查</button>${e.reviewDate?`<button type="button" data-review-clear="${E(e.id)}">取消日期</button>`:''}</div>`:''}</article>`).join('')||'<p class="agenda-empty">当前范围没有计划。打开任一导师的详情，可添加下一步任务与复查日期。</p>';
    $('agenda-more').hidden=entries.length<=agendaLimit;
  }
  function renderViews() {
    const views=[...savedViews.values()].filter(v=>!v.deleted).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
    $('views-status').textContent=`已保存 ${views.length} 套筛选方案${storageAvailable?'':' · 存储不可用，请导出备份'}`;
    $('saved-views').innerHTML=views.map(v=>{const p=new URLSearchParams(v.query);const desc=[...p].filter(([k])=>!k.startsWith('weight-')).slice(0,4).map(([k,value])=>{const el=$(k);return k==='query'?value:el?.options?[...el.options].find(o=>o.value===value)?.textContent||value:value;}).join(' · ');return `<article><button class="apply-view" type="button" data-apply-view="${E(v.id)}"><b>${E(v.name)}</b><span>${E(desc||'全库浏览')}</span></button><button type="button" class="remove-view" data-remove-view="${E(v.id)}" aria-label="删除筛选方案 ${E(v.name)}">删除</button></article>`;}).join('')||'<p class="small">还没有保存方案。设好国家、方向或匹配权重后，保存当前筛选即可。</p>';
  }
  function refreshNotebookFilters() {
    if(!data||!($('collection').value||$('stage-filter').value||$('review-filter').value))return;
    const next=getFiltered();if(next.length===filtered.length&&next.every((l,i)=>l.id===filtered[i].id))return;
    const open=[...document.querySelectorAll('.lab-card details[open]')].map(el=>el.closest('.lab-card').id),active=document.activeElement;
    const focus=active?.dataset.note?['note',active.dataset.note]:active?.dataset.stage?['stage',active.dataset.stage]:active?.dataset.nextAction?['next-action',active.dataset.nextAction]:active?.dataset.reviewDate?['review-date',active.dataset.reviewDate]:null;
    const selection=['note','next-action'].includes(focus?.[0])?[active.selectionStart,active.selectionEnd,active.selectionDirection]:null;
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
    for(const [attribute,key] of [['next-action','nextAction'],['review-date','reviewDate']])document.querySelectorAll(`[data-${attribute}]`).forEach(input=>{
      const value=notebook.get(input.getAttribute('data-'+attribute))?.[key]||'';if(input.value===value)return;
      const active=input===document.activeElement,selection=active&&key==='nextAction'?[input.selectionStart,input.selectionEnd]:null;
      input.value=value;if(selection)input.setSelectionRange(Math.min(selection[0],value.length),Math.min(selection[1],value.length));changedActive||=active;
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
    return `<p class="navigation-context"><b>主领域</b> ${E(l._nav.fields.map(id=>T.fieldMap.get(id).name).join(" · "))}<br><b>合并方向</b> ${E(l._nav.topics.join(" · "))}</p><p class="small">下面保留来源中的原始标签。主领域和合并方向用于导航，不能替代个人研究证据。</p><dl class="facet-details">${Object.entries(M.axes).map(([axis,title])=>`<div><dt>${E(title)}</dt><dd>${E(M.values(l,axis).join(' · ')||'待补充')}</dd></div>`).join('')}</dl><p class="small">${E(l.facetBasis||'结构化标签依据该条官方研究资料；未记录不代表不存在。')}</p>${l.taxonomyNote?`<p class="small">${E(l.taxonomyNote)}</p>`:''}${l.sharedGroup?`<p class="review-note">共同团队：${E(l.sharedGroup)}。本条为该团队的一位PI人物记录，不代表独立增加一个实验室。</p>`:''}${l.linkedProfileUrl?`<p class="review-note">目录原个人链接本次未能读取，当前使用可查证的官方目录。${link(l.linkedProfileUrl,'原个人链接（可稍后重试）')}</p>`:''}${l.roleNote?`<p class="review-note">任职说明：${E(l.roleNote)}</p>`:''}${l.scopeNote?`<p class="small">${E(l.scopeNote)}</p>`:''}${l.formerAffiliations?.length?`<h4>任职变更记录</h4>${l.formerAffiliations.map(a=>`<p>${E(a.institution)}（原任职）· ${E(a.note)} ${link(a.url,'变更依据')}</p>`).join('')}`:''}`;
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
    return `<h4>${level(l)==='project_record'?'官方科研项目收录依据':level(l)==='research_profile'?'个人研究资料核验范围':'官方名录收录依据'}</h4><p>${E(l.evidenceScope||l.directoryNote||'官方研究组或导师目录列有该条目，并提供课题组或个人资料链接。')}</p>${l.role?`<p>${E(l.role)}</p>`:''}${l.groupName?`<p>研究组：${E(l.groupName)}</p>`:''}<p class="small">${E(l.fieldBasis||'方向依据官方条目或所属专题目录；宽泛标签不能代替个人研究方向复核。')}</p>${affiliations.length?`<h4>其他官方关联记录</h4>${affiliations.map(a=>`<p>${E(a.institution)} · ${E(a.country)}${a.url?' · '+link(a.url,'官方记录'):''}${a.note?`<br><span class="small">${E(a.note)}</span>`:''}</p>`).join('')}`:''}${l.affiliationNote?`<p class="small">${E(l.affiliationNote)}</p>`:''}${opportunityDetails(l,r)}`;
  }
  function researchDetails(l) {
    const r=l._nav.research;
    const projects=(l.projectEvidence||[]).filter(p=>p&&p.title);
    return `${r.specific?`<section class="research-summary-detail"><h4>${E(r.origin)}</h4><p>${E(r.text)}</p>${r.url?`<p class="small">${link(r.url,'研究依据')}</p>`:''}</section>`:''}${projects.length?`<section class="project-records"><h4>已记录的科研项目</h4><p class="small">以下支持研究方向与项目负责人身份；项目资助不等于当前招生或独立博士指导资格。</p>${projects.slice(0,6).map(p=>`<article><h5>${p.url?link(p.url,p.title):E(p.title)}</h5><p class="small">${E(p.fiscalYear||p.year||'年份见来源')}${p.projectId?' · '+E(p.projectId):''}${typeof p.isContactPi==='boolean'?' · '+(p.isContactPi?'联系PI':'共同PI'):''}</p>${p.organization?`<p class="small">项目依托单位：${E(p.organization)}</p>`:''}${p.abstractExcerpt?`<p>${E(p.abstractExcerpt)}</p>`:''}${p.terms?.length?`<p class="small">项目关键词：${E((Array.isArray(p.terms)?p.terms:[p.terms]).join(' · '))}</p>`:''}</article>`).join('')}${projects.length>6?`<p class="small">本条共记录 ${projects.length} 项，卡片展示前6项；完整记录见公开数据。</p>`:''}</section>`:''}`;
  }
  function identityDetails(l) {
    const matches=Array.isArray(l.possibleIdentityMatches)?l.possibleIdentityMatches.filter(row=>row&&row.id!==l.id):[];
    if(!l.identityReviewNote&&!matches.length)return '';
    return `<section class="identity-review"><h4>同名身份待核</h4><p>${E(l.identityReviewNote||'以下记录可能涉及同一人，核实前分别保留。请结合官方任职和项目资料核对。')}</p>${matches.length?`<ul>${matches.map(row=>`<li>${labLookup.has(row.id)?`<a href="#lab-${E(row.id)}" data-open="${E(row.id)}">${E(row.name||labLookup.get(row.id).name)} · 定位记录 ↗</a>`:E(row.name||row.id)}${row.institution?`<br><span class="small">${E(row.institution)}</span>`:''}</li>`).join('')}</ul>`:''}</section>`;
  }
  function personalPanel(l) {
    const entry=notebook.get(l.id)||{stage:'watch',note:''};
    return `<section class="personal-panel"><h4>我的阅读与准备笔记</h4><label>准备阶段<select data-stage="${E(l.id)}" aria-label="${E(l.name)}的准备阶段">${Object.entries(M.stages).map(([k,v])=>`<option value="${k}" ${entry.stage===k?'selected':''}>${E(v)}</option>`).join('')}</select></label><label>下一步任务<input type="text" data-next-action="${E(l.id)}" maxlength="400" value="${E(entry.nextAction||'')}" placeholder="例如：读一篇代表作，核对联合培养资格" aria-label="${E(l.name)}的下一步任务"></label><label>计划复查日期<input type="date" data-review-date="${E(l.id)}" value="${E(entry.reviewDate||'')}" aria-label="${E(l.name)}的复查日期"></label><label>私人笔记<textarea data-note="${E(l.id)}" maxlength="3000" rows="4" placeholder="想读哪篇论文？与我的问题有什么联系？还需要确认哪些资格？" aria-label="${E(l.name)}的阅读笔记">${E(entry.note)}</textarea></label><small data-note-state="${E(l.id)}">当前浏览器保存 · 笔记最多3000字 · 任务和日期可在“我的名单”导出</small></section>`;
  }
  function relatedPanel(l) {
    return `<section class="related-panel"><h4>继续发现相近团队</h4><p class="small">从全库按共同的具体方向、方法或疾病标签寻找线索，并显示相近原因。标签不全会影响结果，这不代表实际合作关系或导师水平。</p><button type="button" data-related="${E(l.id)}" aria-expanded="false" aria-controls="related-${E(l.id)}">寻找相近团队</button><div id="related-${E(l.id)}" class="related-results" hidden></div></section>`;
  }
  function showRelated(id,button) {
    const lab=labLookup.get(id),target=$('related-'+id);if(!lab||!target)return;
    if(button.getAttribute('aria-expanded')==='true'){button.setAttribute('aria-expanded','false');target.hidden=true;return;}
    if(!relatedCache.has(id))relatedCache.set(id,D.similar(lab,data.labs));
    const rows=relatedCache.get(id),lookup=labLookup;
    target.innerHTML=rows.map(row=>{const other=lookup.get(row.id);return `<article><h5><a href="#lab-${E(other.id)}">${E(other.name)} ↗</a></h5><p>${E(other.country)} · ${institutionContext(other)}${E(other.institution)}</p><p class="related-reason">${row.shared.map(s=>`${E(M.axes[s.axis]||s.axis)}：${E(s.values.join('、'))}`).join('；')}</p><span class="small">${E(evidenceLabel(other))}</span></article>`;}).join('')||'<p class="small">目前没有足够具体的共同标签。可以点击上方研究方向继续探索，或先核对官方研究页；资料不足不表示没有相近团队。</p>';
    target.hidden=false;button.setAttribute('aria-expanded','true');
  }
  function preferences() {return Object.fromEntries(preferenceAxes.map(a=>[a,{value:$('pref-'+a).value,weight:Number($('weight-'+a).value)}]));}
  function matchDetails(l,compact=false) {
    const m=M.match(l._matchRecord||l,preferences());if(m.score===null)return '';
    const title=`已记录标签匹配 ${m.score}% · ${m.matched.length}/${m.criteriaCount}项`;
    return `<div class="match-result"><strong>${E(title)}</strong>${compact?'':`<p>${m.matched.length?'已匹配：'+E(m.matched.map(x=>x.value).join('、')):'尚无匹配标签。'}</p>${m.missing.length?`<p class="small">待进一步确认：${E(m.missing.map(x=>x.value+(x.recorded?'（已有标签未覆盖）':'（该维度资料缺失）')).join('、'))}</p>`:''}`}</div>`;
  }
  function card(l) {
    const r=review(l),detailed=level(l)==='reviewed',saved=!!notebook.get(l.id)?.saved,nav=l._nav;
    const methods=M.values(l,'methods').slice(0,3), diseases=M.values(l,'diseases').slice(0,2);
    const aliases=(l.aliases||[]).filter(n=>M.norm(n)!==M.norm(l.name)).slice(0,3);
    const role=M.roles[l.roleStatus]||M.roles.unknown;
    return `<article class="lab-card ${detailed?'reviewed':level(l)==='research_profile'?'profile':level(l)==='project_record'?'project':'directory'}" id="lab-${E(l.id)}"><div class="card-top"><div class="card-meta"><span>${E(countries(l).join(' / '))}</span><span>${E(detailed?data.tiers[l.tier]:role)}</span></div><span class="evidence-badge ${E(level(l))}">${E(evidenceLabel(l))}</span><h3>${E(l.name)}</h3>${aliases.length?`<p class="name-aliases">${E(aliases.join(" · "))}</p>`:""}<p class="institution">${institutionContext(l)}${E(l.institution)}${l.affiliations?.length?` <span class="affiliation-note">+${l.affiliations.length}条关联记录</span>`:''}</p><div class="tags">${nav.topics.slice(0,4).map(t=>`<button type="button" data-direction="${E(t)}">${E(t)}</button>`).join('')}${nav.topics.length>4?`<span class="more-topics">+${nav.topics.length-4}个方向</span>`:''}</div><p class="research-origin ${nav.research.specific?'documented':'pending'}">${nav.research.specific?E(nav.research.origin):'具体研究信息待补充'}</p><p class="question ${nav.research.specific?'':'research-pending'}">${E(nav.research.text)}</p>${methods.length?`<p class="facet-line"><span>方法</span>${E(methods.join(' · '))}</p>`:''}${diseases.length?`<p class="facet-line"><span>健康问题</span>${E(diseases.join(' · '))}</p>`:''}<div class="evidence-meter" aria-label="7项评价维度中${M.evidenceCount(l)}项有证据">${Object.keys(M.dimensions).map(d=>`<span class="${M.evidence(l,d).length?'filled':''}" title="${E(M.dimensions[d][0])}：${M.evidence(l,d).length?'已有资料':'待补充'}"></span>`).join('')}<small>${M.evidenceCount(l)} / 7项证据</small></div>${matchDetails(l,true)}<div class="card-links">${link(profile(l),level(l)==='project_record'?'官方科研项目':'官方研究资料')}<span class="status ${r.status}">${E(data.statuses[r.status])}</span></div>${r.reason?`<p class="review-note opportunity-review-note">待复核：${E(r.reason)}</p>`:''}<div class="date">${verificationLabel(l)} ${E(l.verifiedAt)} · ${E(evidenceMonitor(l))}</div></div><div class="card-actions"><label><input type="checkbox" data-compare="${E(l.id)}" ${selected.has(l.id)?'checked':''} aria-label="比较 ${E(l.name)}">比较</label><button class="save-button ${saved?'saved':''}" type="button" data-save="${E(l.id)}" aria-pressed="${saved}" aria-label="收藏 ${E(l.name)}">${saved?'★ 已收藏':'☆ 收藏'}</button><a href="#lab-${E(l.id)}" data-open="${E(l.id)}">定位 ↗</a></div><details><summary>${detailed?`完整证据 · ${l.papers.length}篇代表作`:'研究详情与多维证据'}</summary><div class="details-body">${researchDetails(l)}${identityDetails(l)}${facetDetails(l)}${matchDetails(l)}${assessmentDetails(l)}${detailed?reviewedDetails(l,r):directoryDetails(l,r)}${personalPanel(l)}${relatedPanel(l)}<h4>官方证据与核验范围</h4>${sourceDetails(l)}</div></details></article>`;
  }
  function counts(values) {const m=new Map();for(const v of values)m.set(v,(m.get(v)||0)+1);return [...m].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'zh'));}
  function opts(id,entries) {const v=$(id).value;$(id).innerHTML=$(id).options[0].outerHTML+entries.map(([k,t])=>`<option value="${E(k)}">${E(t)}</option>`).join('');$(id).value=[...$(id).options].some(o=>o.value===v)?v:'';}
  function prepareDirectory() {
    T.reset();labLookup.clear();directionOptionsKey='';
    for(const l of data.labs){
      l._nav=T.classify(l);l._countries=countries(l);l._institutions=institutions(l);
      l._facets=Object.fromEntries(Object.keys(M.axes).map(a=>[a,M.values(l,a)]));
      l._dimensions=new Set(Object.keys(M.dimensions).filter(d=>M.evidence(l,d).length));l._evidenceCount=l._dimensions.size;
      l._researchFlags={summary:l._nav.research.specific,basic:!l._nav.research.specific,methods:l._facets.methods.length>0,outputs:T.matchesResearch(l,'outputs')};
      l._matchRecord={directions:[...l._facets.domains,...l._nav.topics],facets:l.facets};
      l._search=M.searchText(l)+' '+M.norm(l._nav.topics.join(' '));
      labLookup.set(l.id,l);
    }
    const ranks={reviewed:4,research_profile:3,project_record:2,official_directory:1};
    evidenceOrder=[...data.labs].sort((a,b)=>(ranks[level(b)]||0)-(ranks[level(a)]||0)||(a.tier||'D').localeCompare(b.tier||'D')||a.name.localeCompare(b.name));
  }
  function ensureDirection(value) {
    if(!value||[...$('direction').options].some(o=>o.value===value))return;
    if(!data.labs.some(l=>l._nav.raw.includes(value)))return;
    const option=new Option('原始标签：'+value,value);option.dataset.legacy='true';$('direction').add(option);
  }
  function populateDirections({preserve=true}={}) {
    const field=$('field').value,selected=preserve?$('direction').value:'',key=field+'|'+selected;
    if(directionOptionsKey===key)return;
    const pool=field?data.labs.filter(l=>l._nav.fields.includes(field)):data.labs;
    const topicCounts=new Map(counts(pool.flatMap(l=>l._nav.topics)));
    const topics=T.topics.filter(t=>topicCounts.has(t.id)&&(!field||t.fields.includes(field)));
    $('direction').innerHTML='<option value="">全部具体方向</option>'+topics.map(t=>`<option value="${E(t.id)}">${E(t.name)} (${topicCounts.get(t.id).toLocaleString('zh-CN')})</option>`).join('');
    if(selected&&!topics.some(t=>t.id===selected)){
      if(T.topicMap.has(selected))$('direction').add(new Option(T.topicMap.get(selected).name+'（其他领域）',selected));
      else ensureDirection(selected);
    }
    $('direction').value=selected;directionOptionsKey=field+'|'+$('direction').value;
    const preferred=['微生物组','肠脑轴','生物信息与计算生物学','计算与精准精神病学','医学人工智能','脑机接口与神经假体'];
    const shown=field?topics:preferred.map(id=>T.topicMap.get(id)).filter(t=>topicCounts.has(t.id));
    $('quick-filters').innerHTML=shown.map(t=>`<button type="button" data-direction="${E(t.id)}" aria-pressed="false">${E(t.name)} <span>${topicCounts.get(t.id).toLocaleString('zh-CN')}</span></button>`).join('');
    $('topic-context').textContent=field?T.fieldMap.get(field).name+' · 合并后的具体方向':'从常用方向开始';
  }
  function renderFieldNavigation() {
    const chosen=$('field').value,all=data.labs.length,fieldCounts=new Map(counts(data.labs.flatMap(l=>l._nav.fields)));
    $('field-navigation').innerHTML=T.fields.map((f,i)=>`<button type="button" class="field-card" data-field="${f.id}" aria-pressed="${chosen===f.id}"><span class="field-index">0${i+1}</span><span class="field-title">${E(f.short)}</span><span class="field-count">${(fieldCounts.get(f.id)||0).toLocaleString('zh-CN')} <small>条</small></span><span class="field-note">${E(f.note)}</span><span class="field-track" aria-hidden="true"><i style="width:${all?Math.max(2,100*(fieldCounts.get(f.id)||0)/all):0}%"></i></span></button>`).join('');
    $('taxonomy-status').textContent=`6 个主领域 · ${T.topics.length} 个方向组 · 跨领域数量不相加`;
  }
  function populate() {
    opts('country',counts(data.labs.flatMap(countries)).map(([c,n])=>[c,`${c} (${n})`]));
    opts('institution',counts(data.labs.flatMap(institutions)).map(([c,n])=>[c,`${c} (${n})`]));
    opts('field',T.fields.map(f=>[f.id,`${f.name} (${data.labs.filter(l=>l._nav.fields.includes(f.id)).length.toLocaleString('zh-CN')})`]));
    populateDirections();renderFieldNavigation();
    for(const [id,axis] of Object.entries(facetFilters))opts(id,counts(data.labs.flatMap(l=>M.values(l,axis))).map(([c,n])=>[c,`${c} (${n})`]));
    opts('tier',Object.entries(data.tiers));opts('status',Object.entries(data.statuses));opts('stage-filter',Object.entries(M.stages));
    opts('role-filter',counts(data.labs.map(l=>l.roleStatus||'unknown')).map(([c,n])=>[c,`${M.roles[c]||c} (${n})`]));
    opts('dimension-filter',Object.entries(M.dimensions).map(([k,[v]])=>[k,v]));
    if(!$('preference-controls').children.length)$('preference-controls').innerHTML=preferenceAxes.map(a=>`<div><label>${E(M.axes[a])}<select id="pref-${a}"><option value="">不设置目标</option></select></label><label class="weight-label">权重<select id="weight-${a}"><option value="0">0 · 忽略</option><option value="1" selected>1 · 参考</option><option value="2">2 · 较重要</option><option value="3">3 · 很重要</option></select></label></div>`).join('');
    for(const axis of preferenceAxes)opts('pref-'+axis,counts(data.labs.flatMap(l=>axis==='domains'?l._nav.topics:l._facets[axis])).map(([v,n])=>[v,`${v} (${n})`]));
    $('dimension-guide').innerHTML=Object.entries(M.dimensions).map(([k,[title,description]],i)=>`<article><span>0${i+1}</span><h3>${E(title)}</h3><p>${E(description)}</p><button type="button" data-evidence-dimension="${k}">查看有此项资料的团队 ↗</button></article>`).join('')+'<article><span>08</span><h3>来源与时效</h3><p>分开显示内容核验日期与网页机器巡检。网页可访问或内容未变，不等于当前任职和接收资格再次得到确认。</p><a href="#method">查看核验规则 ↗</a></article>';
  }
  function resetFilters() {for(const id of filterIds)$(id).value=id==='sort'?'evidence':id==='page-size'?'24':'';}
  function clearPreferences() {for(const axis of preferenceAxes){$('pref-'+axis).value='';$('weight-'+axis).value='1';}}
  function restoreUrl() {
    const p=new URLSearchParams(location.search);resetFilters();clearPreferences();
    if(T.fieldMap.has(p.get('field')))$('field').value=p.get('field');populateDirections({preserve:false});ensureDirection(p.get('direction'));
    const oldPreference=p.get('pref-domains');if(oldPreference&&![...$('pref-domains').options].some(o=>o.value===oldPreference)&&data.labs.some(l=>l._nav.raw.includes(oldPreference)))$('pref-domains').add(new Option('原始标签：'+oldPreference,oldPreference));
    for(const id of [...filterIds,...preferenceIds]){const v=p.get(id);if(v!==null&&(id==='query'||[...$(id).options].some(o=>o.value===v)))$(id).value=v;}
    if(Object.keys(facetFilters).some(id=>$(id).value)||['role-filter','dimension-filter','min-evidence','stage-filter','review-filter','tier','status'].some(id=>$(id).value))$('advanced-filters').open=true;
    if(preferenceAxes.some(a=>$('pref-'+a).value))$('match-panel').open=true;
    page=Math.max(1,Math.floor(Number(p.get('page')))||1);
  }
  function viewUrl({preserveHash=false,publicOnly=false}={}) {
    const p=new URLSearchParams();
    for(const id of [...filterIds,...preferenceIds]){if(publicOnly&&['collection','stage-filter','review-filter'].includes(id))continue;const v=$(id).value;if(v&&!(id==='sort'&&v==='evidence')&&!(id==='page-size'&&v==='24')&&!(id.startsWith('weight-')&&v==='1'))p.set(id,v);}
    if(page>1&&!publicOnly)p.set('page',page);
    return location.pathname+(p.size?'?'+p.toString():'')+(preserveHash?location.hash:'');
  }
  function syncUrl(options) {history.replaceState(null,'',viewUrl(options));}
  function getFiltered(overrides={}, {sorted=true}={}) {
    const value=Object.fromEntries(filterIds.map(id=>[id,Object.hasOwn(overrides,id)?overrides[id]:$(id).value]));
    const q=M.norm(value.query.trim()).split(/\s+/).filter(Boolean),pref=preferences();
    const criteria=Object.entries(facetFilters).map(([id,axis])=>[axis,value[id]]).filter(([,v])=>v);
    const pool=sorted&&value.sort==='evidence'?evidenceOrder:data.labs;
    const list=pool.filter(l=>{
      const n=notebook.get(l.id),v=value;
      if(v['update-filter']==='new'&&l.firstIncludedEdition!==data.edition)return false;
      if(v['update-filter']==='enriched'&&l.lastEnrichedEdition!==data.edition)return false;
      return q.every(t=>l._search.includes(t))&&(!v.country||l._countries.includes(v.country))&&(!v.institution||l._institutions.includes(v.institution))&&(!v.field||l._nav.fields.includes(v.field))&&T.matchesDirection(l,v.direction)&&(!v['research-info']||l._researchFlags[v['research-info']])&&(!v.evidence||level(l)===v.evidence)&&(!v.tier||l.tier===v.tier)&&(!v.status||review(l).status===v.status)&&criteria.every(([a,c])=>l._facets[a].includes(c))&&(!v['role-filter']||(l.roleStatus||'unknown')===v['role-filter'])&&(!v['dimension-filter']||l._dimensions.has(v['dimension-filter']))&&(!v['min-evidence']||l._evidenceCount>=Number(v['min-evidence']))&&(!v.collection||(v.collection==='saved'?n?.saved:n?.note.trim()))&&(!v['stage-filter']||n?.stage===v['stage-filter'])&&planned(n,v['review-filter']);
    });
    if(!sorted||value.sort==='evidence')return list;
    const ranks={reviewed:4,research_profile:3,project_record:2,official_directory:1},sort=value.sort;
    const scores=sort==='match'?new Map(list.map(l=>[l.id,M.match(l._matchRecord,pref).score||0])):null;
    const byEvidence=(a,b)=>(ranks[level(b)]||0)-(ranks[level(a)]||0)||(a.tier||'D').localeCompare(b.tier||'D')||a.name.localeCompare(b.name);
    list.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):sort==='country'?a.country.localeCompare(b.country,'zh')||a.name.localeCompare(b.name):sort==='institution'?institution(a).localeCompare(institution(b))||a.name.localeCompare(b.name):sort==='date'?(b.verifiedAt||'').localeCompare(a.verifiedAt||'')||a.name.localeCompare(b.name):sort==='dimensions'?b._evidenceCount-a._evidenceCount||byEvidence(a,b):sort==='match'?scores.get(b.id)-scores.get(a.id)||byEvidence(a,b):byEvidence(a,b));
    return list;
  }
  function emptyResults() {
    const suggestions=filterIds.filter(id=>!['sort','page-size'].includes(id)&&$(id).value).map(id=>({id,count:getFiltered({[id]:''},{sorted:false}).length})).filter(row=>row.count>0).sort((a,b)=>a.count-b.count).slice(0,5);
    return `<div class="empty"><h3>暂时没有同时满足全部条件的团队</h3><p>部分团队的细分资料尚未整理。可以只放宽一个条件，其他筛选保持不变。</p><div class="relax-suggestions">${suggestions.map(row=>`<button type="button" data-clear-filter="${row.id}">取消${row.id==='query'?'关键词':`“${E($(row.id).selectedOptions[0].textContent)}”`} <span>可见 ${row.count.toLocaleString('zh-CN')} 条</span></button>`).join('')||'<p class="small">单独放宽一个条件仍无结果，请逐步移除上方筛选条件；个人名单筛选也可能尚无记录。</p>'}</div></div>`;
  }
  function renderResultCoverage() {
    const n=filtered.length,profiles=filtered.filter(l=>['reviewed','research_profile'].includes(level(l))).length,summary=filtered.filter(l=>l._researchFlags.summary).length,methods=filtered.filter(l=>l._researchFlags.methods).length,projects=filtered.filter(l=>level(l)==='project_record').length;
    $('filtered-coverage').innerHTML=`<span>当前结果</span><span>具体研究说明 / 题目 <b>${summary.toLocaleString('zh-CN')} / ${n.toLocaleString('zh-CN')}</b></span><span>个人研究资料 <b>${profiles.toLocaleString('zh-CN')} / ${n.toLocaleString('zh-CN')}</b></span><span>方法标签 <b>${methods.toLocaleString('zh-CN')} / ${n.toLocaleString('zh-CN')}</b></span>${projects?`<span>科研项目证据 <b>${projects.toLocaleString('zh-CN')}</b></span>`:''}`;
  }
  function renderTopicCoverage() {
    const pool=$('coverage-scope').value==='filtered'?filtered:data.labs,rows=new Map();
    const profiles=pool.filter(l=>['reviewed','research_profile'].includes(level(l))).length,withMethods=pool.filter(l=>l._researchFlags.methods).length;
    for(const l of pool)for(const topic of l._nav.topics){if(!rows.has(topic))rows.set(topic,{total:0,institutions:new Set(),research:0,methods:0,profiles:0,projects:0});const row=rows.get(topic);row.total++;for(const i of l._institutions)row.institutions.add(i);if(l._researchFlags.summary)row.research++;if(l._researchFlags.methods)row.methods++;if(['reviewed','research_profile'].includes(level(l)))row.profiles++;if(level(l)==='project_record')row.projects++;}
    $('coverage-context').textContent=`${$('coverage-scope').value==='filtered'?'当前筛选结果':'整个导师库'}：${pool.length.toLocaleString('zh-CN')} 条，${profiles.toLocaleString('zh-CN')} 条已整理个人研究资料。${(pool.length-withMethods).toLocaleString('zh-CN')} 条尚未整理方法标签。主领域和具体方向已经归并；不同方向可交叉，人数不能直接相加。`;
    $('topic-coverage').innerHTML=`<table><caption>合并后的具体方向；点击可转到相应候选。收录数量不代表全球占比或科研水平。</caption><thead><tr><th scope="col">合并研究方向</th><th scope="col">候选条目</th><th scope="col">机构 / 单元</th><th scope="col">具体研究说明</th><th scope="col">有方法标签</th><th scope="col">个人资料 / 项目证据</th></tr></thead><tbody>${[...rows].sort((a,b)=>b[1].total-a[1].total||a[0].localeCompare(b[0],'zh')).map(([topic,r])=>`<tr><th scope="row"><button type="button" data-direction="${E(topic)}">${E(topic)} ↗</button></th><td>${r.total}</td><td>${r.institutions.size}</td><td>${r.research}</td><td>${r.methods}</td><td>${r.profiles} / ${r.projects}</td></tr>`).join('')||'<tr><td colspan="6">当前范围没有条目，请放宽筛选条件。</td></tr>'}</tbody></table>`;
  }
  function render({resetPage=false,preserveHash=false}={}) {
    if(!data)return;if(resetPage)page=1;populateDirections();
    filtered=getFiltered();const size=Number($('page-size').value)||24,pages=Math.max(1,Math.ceil(filtered.length/size));page=Math.min(page,pages);
    const start=(page-1)*size,visible=filtered.slice(start,start+size);
    $('result-count').textContent=`共 ${data.labs.length.toLocaleString('zh-CN')} 个研究者 / 团队 · 筛选 ${filtered.length.toLocaleString('zh-CN')} 个${filtered.length?` · 显示 ${start+1}–${Math.min(start+size,filtered.length)}`:''}`;
    $('cards').innerHTML=visible.length?visible.map(card).join(''):emptyResults();
    $('pagination').hidden=pages<=1;
    const numbers=[...new Set([1,page-1,page,page+1,pages].filter(n=>n>=1&&n<=pages))].sort((a,b)=>a-b);let previous=0;
    const buttons=numbers.map(n=>{const gap=previous&&n-previous>1?'<span aria-hidden="true">…</span>':'';previous=n;return `${gap}<button type="button" data-page="${n}" ${n===page?'aria-current="page"':''}>${n}</button>`;}).join('');
    $('pagination').innerHTML=`<button type="button" data-page="${page-1}" ${page===1?'disabled':''}>← 上一页</button><div class="page-numbers">${buttons}</div><button type="button" data-page="${page+1}" ${page===pages?'disabled':''}>下一页 →</button><span class="page-info">第 ${page} / ${pages} 页</span>`;
    $('export-results').disabled=!filtered.length;
    const active=filterIds.filter(id=>!['sort','page-size'].includes(id)&&$(id).value);
    $('active-filters').innerHTML=active.map(id=>`<button type="button" data-clear-filter="${id}">${E(id==='query'?$('query').value:$(id).selectedOptions[0].text)} ×</button>`).join('');
    document.querySelectorAll('[data-field]').forEach(b=>b.setAttribute('aria-pressed',String($('field').value===b.dataset.field)));
    document.querySelectorAll('#quick-filters [data-direction]').forEach(b=>b.setAttribute('aria-pressed',String($('direction').value===b.dataset.direction)));
    const pref=preferences(),configured=Object.values(pref).filter(p=>p.value&&p.weight>0).length;
    $('match-summary').textContent=configured?`${configured}项有效标准 · 匹配率 = 已匹配权重 / 全部所选权重；缺少标签只表示待确认，不代表能力不足。`:'选择目标并设置正权重后，可按已记录标签匹配率排序。';
    syncUrl({preserveHash});renderComparison();renderNotebook();renderResultCoverage();if($('coverage-panel').open)renderTopicCoverage();
  }
  function renderComparison() {
    const labs=data.labs.filter(l=>selected.has(l.id));$('compare-bar').hidden=!labs.length;$('selected-count').textContent=`已选 ${labs.length} / 4 组`;
    if(!labs.length){$('comparison').hidden=true;return;}
    const unknown='尚未逐条核验';
    const rows=[['国家 / 机构',l=>E(countries(l).join(' / ')+' · '+institutionDescription(l))],['任职身份',l=>E((M.roles[l.roleStatus]||M.roles.unknown)+(l.role?' · '+l.role:''))],['证据深度',l=>E(evidenceLabel(l))],...Object.entries(M.axes).map(([axis,title])=>[title,l=>E(M.values(l,axis).join('；')||unknown)]),['我的标签匹配',l=>matchDetails(l)||'尚未设置匹配标准'],...Object.entries(M.dimensions).map(([key,[title]])=>[title,l=>evidenceRows(l,key)]),['代表论文阅读入口',l=>(l.papers||[]).length?l.papers.map(p=>link(p.url,p.title)).join('<br>'):unknown],['衔接层级',l=>E(data.tiers[l.tier]||'待评估')],['能力契合',l=>E(l.fit||unknown)],['技能缺口 / 起步项目',l=>`<p>${E((l.gaps||[]).join('；')||unknown)}</p><p>${E(l.bridge||unknown)}</p>`],['接收机会',l=>`<b>${E(data.statuses[review(l).status])}</b><p>${E(review(l).reason)}</p><p>${E(l.opportunity?.summary||unknown)}</p>${link(l.opportunity?.url||profile(l),'官方来源')}`],['联合培养 / 访问',l=>E(l.opportunity?.visit||unknown)],['核验日期与巡检',l=>E(l.verifiedAt+' · '+evidenceMonitor(l))],['官方资料',l=>link(profile(l),'团队 / PI资料')]];
    $('compare-table').innerHTML=`<table><caption>${labs.length}组公开证据比较；空白表示本库尚未整理，不代表团队缺乏该能力。</caption><thead><tr><th scope="col">比较维度</th>${labs.map(l=>`<th scope="col">${E(l.name)}</th>`).join('')}</tr></thead><tbody>${rows.map(([t,f])=>`<tr><th scope="row">${E(t)}</th>${labs.map(l=>`<td>${f(l)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  function renderCoverage() {
    const detailed=data.labs.filter(l=>level(l)==='reviewed').length,research=data.labs.filter(l=>level(l)==='research_profile').length,projects=data.labs.filter(l=>level(l)==='project_record').length,directory=data.labs.filter(l=>level(l)==='official_directory').length;
    const cs=counts(data.labs.flatMap(countries)),is=counts(data.labs.flatMap(institutions));
    $('stats').innerHTML=`<div><b>${data.labs.length.toLocaleString('zh-CN')}</b><span>研究者 / 团队条目</span></div><div><b>${cs.length}</b><span>国家 / 地区</span></div><div><b>${is.length}</b><span>机构 / 研究单元</span></div><div><b>${(research+detailed).toLocaleString('zh-CN')}</b><span>个人研究资料已整理</span></div>`;
    $('coverage-note').textContent=`${directory.toLocaleString('zh-CN')}条名录 · ${projects.toLocaleString('zh-CN')}条项目证据 · ${research}份个人资料 · ${detailed}张适配卡`;
    $('evidence-summary').innerHTML=`<div><b>名录发现 <span>${directory}</span></b><p>核对官方目录中的身份与机构关联；个人研究细节继续补充。</p></div><div><b>科研项目 <span>${projects.toLocaleString('zh-CN')}</span></b><p>官方项目中的具名负责人及研究题目；导师任职、接收资格另行核验。</p></div><div><b>研究资料 <span>${research}</span></b><p>逐人整理研究介绍；读取限制和核验范围逐条说明。</p></div><div><b>代表作与适配 <span>${detailed}</span></b><p>另含至少两篇代表论文、技能缺口与起步项目，支持深入比较。</p></div>`;
    $('country-overview').innerHTML=cs.map(([c,n])=>`<button type="button" data-country="${E(c)}">${E(c)}<b>${n}</b></button>`).join('');
    const expansion=data.latestExpansion;
    $('expansion-summary').textContent=expansion?`本轮 ${expansion.date}：新增 ${expansion.newCount.toLocaleString('zh-CN')} 条候选，补充 ${expansion.enrichedCount.toLocaleString('zh-CN')} 条已有资料。可用“本轮更新”筛选查看。`:'';
    if($('coverage-panel').open)renderTopicCoverage();
    const sources=new Map();for(const l of data.labs)for(const s of l.sources||[]){if(s.kind!=='directory')continue;const row=sources.get(s.url)||{url:s.url,label:s.label,country:s.country||l.country,ids:new Set(),date:s.verifiedAt};row.ids.add(l.id);sources.set(s.url,row);}
    directorySources=[...sources.values()].sort((a,b)=>b.ids.size-a.ids.size);sourceLimit=32;renderSources();
  }
  function renderSources() {
    const query=M.norm($('source-search').value).trim(),list=directorySources.filter(s=>M.norm(s.label+' '+s.country+' '+s.url).includes(query));
    $('source-count').textContent=`共 ${directorySources.length} 个官方目录 · 符合条件 ${list.length} 个 · 已显示 ${Math.min(sourceLimit,list.length)} 个`;
    $('source-list').innerHTML=list.slice(0,sourceLimit).map(s=>`<article><h3>${link(s.url,s.label)}</h3><p>${E(s.country)} · 本库收录 ${s.ids.size} 条候选记录</p><p class="small">名录核验 ${E(s.date)}</p></article>`).join('')||'<p>没有匹配的官方目录。个人研究来源也可在导师卡片中查看。</p>';
    $('source-more').hidden=sourceLimit>=list.length;
  }
  function openHash() {
    const id=location.hash.slice(1);if(!id.startsWith('lab-')||!data)return;const target=data.labs.find(l=>'lab-'+l.id===id);if(!target)return;
    let index=filtered.findIndex(l=>l.id===target.id);if(index<0){resetFilters();filtered=getFiltered();index=filtered.findIndex(l=>l.id===target.id);}
    page=Math.floor(index/(Number($('page-size').value)||24))+1;render({preserveHash:true});const el=$(id);if(el){el.querySelector('details').open=true;el.scrollIntoView({block:'start'});}
  }
  async function json(url,timeout=12000) {const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(timeout)});if(!r.ok)throw Error('HTTP '+r.status);return r.json();}
  async function directoryFile(path,compressedPath) {
    if(compressedPath&&'DecompressionStream' in window){
      try{
        const r=await fetch(compressedPath,{cache:'no-store',signal:AbortSignal.timeout(30000)});
        if(!r.ok)throw Error('HTTP '+r.status);
        const bytes=new Uint8Array(await r.arrayBuffer());
        // Some hosts decode Content-Encoding before exposing the response body.
        const text=bytes[0]===31&&bytes[1]===139?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text():new TextDecoder().decode(bytes);
        const parsed=JSON.parse(text);if(!Array.isArray(parsed.labs)||path==='data/labs.json'&&parsed.schemaVersion!==1)throw Error('记录分片格式无效');return parsed;
      }catch{/* A compressed transport failure falls back to this file's JSON only. */}
    }
    const parsed=await json(path,45000);if(!Array.isArray(parsed.labs)||path==='data/labs.json'&&parsed.schemaVersion!==1)throw Error('记录分片格式无效');return parsed;
  }
  async function loadDirectory() {
    $('freshness').textContent='正在读取导师库与来源信息…';
    const main=await directoryFile('data/labs.json','data/labs.json.gz');
    if(main.schemaVersion!==1)throw Error('数据格式不兼容');
    const parts=main.dataParts||[];
    if(!Array.isArray(parts)||parts.length>200)throw Error('数据分片清单无效');
    if(parts.length&&(typeof main.edition!=='string'||!main.edition))throw Error('数据分片版本无效');
    const safePath=path=>typeof path==='string'&&/^data\/[a-zA-Z0-9_./-]+\.json(?:\.gz)?$/.test(path)&&!path.split('/').includes('..');
    const knownPaths=new Set();
    for(const part of parts){if(!part||!safePath(part.path)||part.compressedPath&&!safePath(part.compressedPath)||!Number.isInteger(part.count)||part.count<0||knownPaths.has(part.path))throw Error('数据分片清单无效');knownPaths.add(part.path);}
    const records=[...main.labs];let completed=0;
    for(let offset=0;offset<parts.length;offset+=4){
      const batch=parts.slice(offset,offset+4);
      const results=await Promise.allSettled(batch.map(async part=>{
        const result=await directoryFile(part.path,part.compressedPath);
        if(result.edition!==main.edition)throw Error('记录版本校验未通过');
        if(result.labs.length!==part.count)throw Error('记录数量校验未通过');
        completed++;$('freshness').textContent=`正在读取研究资料 ${completed} / ${parts.length} 批，完成后显示完整人数…`;
        return result.labs;
      }));
      const failure=results.findIndex(r=>r.status==='rejected');
      if(failure>=0)throw Error(`第 ${offset+failure+1} / ${parts.length} 批资料未完整载入，请点击“刷新数据”重试`);
      for(const result of results)records.push(...result.value);
    }
    const ids=new Set();for(const record of records){if(!record||typeof record.id!=='string'||ids.has(record.id))throw Error('数据记录标识重复或缺失，请刷新后重试');ids.add(record.id);}
    if(main.totalRecords!==undefined&&main.totalRecords!==records.length)throw Error('全库记录数量校验未通过，请刷新后重试');
    main.labs=records;return main;
  }
  async function load() {
    if(loading)return;loading=true;$('refresh').disabled=true;
    try{
      const next=await loadDirectory();if(next.schemaVersion!==1||!Array.isArray(next.labs))throw Error('数据格式不兼容');
      data=next;relatedCache.clear();prepareDirectory();for(const id of selected)if(!labLookup.has(id))selected.delete(id);
      populate();if(!restored){restoreUrl();restored=true;}renderCoverage();
      $('methodology').innerHTML='<ol>'+data.methodology.map(t=>`<li>${E(t)}</li>`).join('')+'</ol>';
      $('history').innerHTML=data.history.slice().reverse().slice(0,20).map(h=>`<p><b>${E(h.date)}</b> ${E(h.summary)}</p>`).join('');
      render({preserveHash:true});openHash();$('freshness').textContent=`证据版本 ${data.edition} · 正在读取自动巡检批次…`;
      const raw='https://raw.githubusercontent.com/zbyloveyj/zbyloveyj.github.io/main/personal-growth-lab/academy/data/lab-monitor.json';
      const results=await Promise.allSettled([json(raw),json('data/lab-monitor.json')]);
      monitor=results.filter(x=>x.status==='fulfilled'&&x.value.schemaVersion===1).map(x=>x.value).sort((a,b)=>(b.checkedAt||'').localeCompare(a.checkedAt||''))[0]||{sources:{}};
      const date=monitor.checkedAt?new Date(monitor.checkedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'待首次运行';
      $('freshness').textContent=`证据版本 ${data.edition} · 网页巡检 ${date}${monitor.checkedAt?' 北京时间':''}${monitor.checkedAt&&age(monitor.checkedAt)>3?'（超过3天未更新）':''} · 自动检查不等于内容复核`;
      document.querySelectorAll('.lab-card').forEach(el=>{const l=data.labs.find(l=>'lab-'+l.id===el.id),r=review(l),status=el.querySelector('.status');status.className='status '+r.status;status.textContent=data.statuses[r.status];el.querySelector('.opportunity-review-note')?.remove();if(r.reason){const p=document.createElement('p');p.className='review-note opportunity-review-note';p.textContent='待复核：'+r.reason;el.querySelector('.date').before(p);}el.querySelector('.date').textContent=`${verificationLabel(l)} ${l.verifiedAt} · ${evidenceMonitor(l)}`;});
      if($('status').value)render({preserveHash:true});else renderComparison();
    }catch(e){$('freshness').textContent='证据库读取失败。'+String(e.message||'请稍后刷新。').slice(0,180)+(data?' 当前保留上次完整载入的内容。':' 未完整载入前不显示部分人数。');if(!data)$('cards').innerHTML='<div class="empty"><h3>研究资料尚未完整载入</h3><p>请点击上方“刷新数据”重试。已收藏的名单和私人笔记仍保存在当前浏览器。</p></div>';}
    finally{loading=false;$('refresh').disabled=false;}
  }
  function preset(kind,value) {resetFilters();if(kind==='direction'){populateDirections({preserve:false});ensureDirection(value);}$(kind).value=value;page=1;render();$('catalog').scrollIntoView({block:'start'});}
  function download(content,name,type) {const u=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  $('filters').addEventListener('submit',e=>e.preventDefault());
  $('filters').addEventListener('input',e=>{clearTimeout(filterTimer);if(e.target.id==='field'){$('direction').value='';directionOptionsKey='';}if(e.target.id==='query')filterTimer=setTimeout(()=>render({resetPage:true}),150);else render({resetPage:true});});
  $('filters').addEventListener('reset',e=>{e.preventDefault();resetFilters();render({resetPage:true});});
  $('preference-controls').addEventListener('change',()=>render({resetPage:true}));
  $('apply-match').addEventListener('click',()=>{$('sort').value='match';render({resetPage:true});});
  $('clear-match').addEventListener('click',()=>{clearPreferences();if($('sort').value==='match')$('sort').value='evidence';render({resetPage:true});});
  $('save-view').addEventListener('click',()=>{
    if(!data)return;mergeStoredNotebook();
    const name=$('view-name').value.trim()||[$('country').value,$('direction').value].filter(Boolean).join(' · ')||$('query').value.trim().slice(0,60)||'全库浏览';
    const query=new URL(viewUrl(),location.href).searchParams;query.delete('page');
    const old=[...savedViews.values()].find(v=>!v.deleted&&M.norm(v.name)===M.norm(name));
    if(!old&&[...savedViews.values()].filter(v=>!v.deleted).length>=30){notify('最多保留30套在用方案，请先删除不再使用的方案。');return;}
    const record={id:old?.id||'view-'+(crypto.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)),name,query:query.toString(),updatedAt:new Date().toISOString(),deleted:false};
    try{const merged=M.mergeViews([...savedViews.values()],[record]);savedViews.clear();for(const v of merged)savedViews.set(v.id,v);const ok=saveNotebook();$('view-name').value='';notify(ok?`已${old?'更新':'保存'}筛选方案“${name}”，包含当前匹配标准。`:'方案已保留在本页；浏览器存储不可用，请导出备份。');}catch(err){notify(err.message);}
  });
  $('saved-views').addEventListener('click',e=>{
    const apply=e.target.closest('[data-apply-view]'),remove=e.target.closest('[data-remove-view]');if(!apply&&!remove)return;mergeStoredNotebook();const view=savedViews.get(apply?.dataset.applyView||remove?.dataset.removeView);if(!view||view.deleted){renderViews();notify('该方案已被另一个标签页删除。');return;}
    if(remove){savedViews.set(view.id,{...view,deleted:true,updatedAt:new Date().toISOString()});const ok=saveNotebook();notify(ok?'已删除该筛选方案。':'已在本页删除，请导出备份保存变更。');return;}
    history.replaceState(null,'',location.pathname+(view.query?'?'+view.query:''));restoreUrl();render({resetPage:true});
    const dropped=[...new URLSearchParams(view.query)].some(([id,value])=>$(id)?.value!==value);
    $('catalog').scrollIntoView({block:'start'});notify(`已应用“${view.name}”，按当前导师库重新筛选。${dropped?'部分旧条件已不在当前库，已清空，请检查。':''}`);
  });
  $('agenda-filter').addEventListener('change',()=>{agendaLimit=8;renderAgenda();});
  $('agenda-more').addEventListener('click',()=>{agendaLimit+=8;renderAgenda();});
  $('coverage-scope').addEventListener('change',renderTopicCoverage);
  $('coverage-panel').addEventListener('toggle',()=>{if(data&&$('coverage-panel').open)renderTopicCoverage();});
  $('cards').addEventListener('change',e=>{
    const id=e.target.dataset.compare;if(id){if(e.target.checked&&selected.size>=4){e.target.checked=false;notify('最多比较4组，请先取消一组。');return;}e.target.checked?selected.add(id):selected.delete(id);renderComparison();return;}
    const stageId=e.target.dataset.stage;if(stageId){setEntry(stageId,{stage:e.target.value});refreshNotebookFilters();}
    const dateId=e.target.dataset.reviewDate;if(dateId){if(!M.validReviewDate(e.target.value)){notify('请输入有效的复查日期。');return;}const ok=setEntry(dateId,{reviewDate:e.target.value});refreshNotebookFilters();if(!ok)notify('日期已保留在本页，请导出备份。');}
  });
  $('cards').addEventListener('input',e=>{const id=e.target.dataset.note||e.target.dataset.nextAction;if(!id)return;const key=e.target.dataset.note?'note':'nextAction';const ok=setEntry(id,{[key]:e.target.value});const state=document.querySelector(`[data-note-state="${id}"]`);if(state)state.textContent=ok?'已保存在当前浏览器 · 可导出备份':'浏览器存储不可用 · 本页保留，请立即导出备份';refreshNotebookFilters();});
  document.addEventListener('click',e=>{
    const related=e.target.closest('[data-related]');if(related){showRelated(related.dataset.related,related);return;}
    const reviewNext=e.target.closest('[data-review-next]'),reviewClear=e.target.closest('[data-review-clear]');if(reviewNext||reviewClear){const id=reviewNext?.dataset.reviewNext||reviewClear.dataset.reviewClear;const ok=setEntry(id,{reviewDate:reviewNext?localDate(7):''});syncNotebookControls();if(!ok)notify('计划已保留在本页，请导出备份。');return;}
    const save=e.target.closest('[data-save]');if(save){const id=save.dataset.save,saved=!notebook.get(id)?.saved,ok=setEntry(id,{saved});save.setAttribute('aria-pressed',String(saved));save.classList.toggle('saved',saved);save.textContent=saved?'★ 已收藏':'☆ 收藏';refreshNotebookFilters();if(!ok)notify('浏览器存储不可用；请在“我的名单”导出本次记录。');return;}
    const field=e.target.closest('[data-field]');if(field){const next=$('field').value===field.dataset.field?'':field.dataset.field;$('field').value=next;$('direction').value='';directionOptionsKey='';render({resetPage:true});return;}
    const d=e.target.closest('[data-direction]');if(d){preset('direction',d.dataset.direction);return;}
    const c=e.target.closest('[data-country]');if(c){preset('country',c.dataset.country);return;}
    const ev=e.target.closest('[data-evidence-dimension]');if(ev){preset('dimension-filter',ev.dataset.evidenceDimension);$('advanced-filters').open=true;return;}
    const f=e.target.closest('[data-clear-filter]');if(f){$(f.dataset.clearFilter).value='';render({resetPage:true});return;}
    const a=e.target.closest('[data-open]');if(a)document.getElementById('lab-'+a.dataset.open)?.querySelector('details').setAttribute('open','');
  });
  $('pagination').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(!b||b.disabled)return;page=Number(b.dataset.page);render();$('result-count').scrollIntoView({block:'start'});});
  $('source-search').addEventListener('input',()=>{sourceLimit=32;renderSources();});
  $('source-more').addEventListener('click',()=>{sourceLimit+=32;renderSources();});
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
    const pref=preferences();
    const rows=[['稳定记录ID','姓名 / 团队','姓名别名 / 中文名','机构 / 项目依托单位','机构信息类型','其他关联机构（含另核对现任）','国家 / 地区','任职类型','主领域','合并研究方向','研究信息类型',...Object.values(M.axes),'证据类型代码','证据深度','已整理维度数','研究摘要 / 题目','研究摘要来源','NIH Profile ID','代表项目题目','代表项目年份','代表项目标识','代表项目URL','官方资料','记录核对日期','接收机会','标签匹配率','已匹配标准','待确认标准',...Object.values(M.dimensions).map(d=>d[0]+' · 公开证据与来源')],...filtered.map(l=>{
      const m=M.match(l._matchRecord||l,pref),projects=(l.projectEvidence||[]).filter(p=>p&&p.title);
      return [l.id,l.name,(l.aliases||[]).join('；'),l.institution,level(l)==='project_record'?'项目依托单位':'机构信息',otherInstitutions(l).join('；'),l._countries.join('；'),M.roles[l.roleStatus]||M.roles.unknown,l._nav.fields.map(id=>T.fieldMap.get(id).name).join('；'),l._nav.topics.join('；'),l._nav.research.specific?l._nav.research.origin:'仅宽泛方向',...Object.keys(M.axes).map(a=>M.values(l,a).join('；')),level(l),evidenceLabel(l),l._evidenceCount,l._nav.research.text,l._nav.research.url||'',l.nihProfileId??'',projects.map(p=>p.title).join(' | '),projects.map(p=>p.fiscalYear??p.year??'').join(' | '),projects.map(p=>p.projectId??'').join(' | '),projects.map(p=>p.url||'').join(' | '),profile(l),l.verifiedAt,data.statuses[review(l).status],m.score===null?'':m.score+'%',m.matched.map(x=>x.value).join('；'),m.missing.map(x=>x.value).join('；'),...Object.keys(M.dimensions).map(d=>M.evidence(l,d).map(e=>e.summary+' ['+e.url+']').join('；'))];
    })];
    download('\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n'),'research-teams-'+new Date().toISOString().slice(0,10)+'.csv','text/csv;charset=utf-8');notify(`已导出全部 ${filtered.length} 条公开筛选结果，含多维证据；私人笔记未包含。`);
  });
  $('show-saved').addEventListener('click',()=>preset('collection','saved'));
  $('export-notebook').addEventListener('click',()=>{mergeStoredNotebook();download(JSON.stringify(notebookFile(),null,2),'research-notebook-'+new Date().toISOString().slice(0,10)+'.json','application/json;charset=utf-8');});
  $('import-notebook').addEventListener('change',async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{if(file.size>64*1024*1024)throw Error('备份文件不能超过64MB。');const incoming=JSON.parse(await file.text());mergeStoredNotebook();const merged=M.mergeNotebooks(notebookFile(),incoming);notebook.clear();for(const row of merged.entries)notebook.set(row.id,row);savedViews.clear();for(const v of merged.savedViews||[])savedViews.set(v.id,v);notebookWarning='';const ok=saveNotebook();render();notify(ok?`已合并 ${merged.entries.length} 条记录及筛选方案，保留较新的版本；任务与复查日期一并保存。`:'已读入备份，但浏览器存储不可用；请导出本页记录。');}catch(err){notify('未导入：'+err.message);}finally{e.target.value='';}
  });
  $('refresh').addEventListener('click',load);window.addEventListener('hashchange',openHash);window.addEventListener('popstate',()=>{restoreUrl();render({preserveHash:true});openHash();});
  window.addEventListener('storage',e=>{if(e.key!==M.storageKey&&e.key!==M.viewsStorageKey&&e.key!==null)return;try{if(e.key===M.viewsStorageKey){const raw=localStorage.getItem(M.viewsStorageKey);if(raw)mergeStoredViews();else savedViews.clear();renderNotebook();return;}const raw=localStorage.getItem(M.storageKey),next=raw?M.mergeNotebooks(notebookFile(),JSON.parse(raw)):{entries:[],savedViews:[]};notebook.clear();for(const row of next.entries)notebook.set(row.id,row);savedViews.clear();for(const v of next.savedViews||[])savedViews.set(v.id,v);if(e.key!==null)mergeStoredViews();syncNotebookControls();}catch{notify('另一个标签页的名单格式无法读取，当前页面已保留原记录。');}});
  load();
})();
