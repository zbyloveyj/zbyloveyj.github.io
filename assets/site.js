(() => {
  'use strict';
  const root = document.documentElement;
  const qs = (x, scope = document) => scope.querySelector(x);
  const qsa = (x, scope = document) => [...scope.querySelectorAll(x)];
  const safeGet = (key) => { try { return localStorage.getItem(key); } catch (_) { return null; } };
  const safeSet = (key, value) => { try { localStorage.setItem(key, value); } catch (_) {} };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const bi = (en, zh) => `<span class="en-only">${esc(en)}</span><span class="zh-only">${esc(zh)}</span>`;
  let lang = safeGet('academic-site:lang') === 'en' ? 'en' : 'zh';
  let filter = 'all';
  let publicationQuery = '';

  function applyLang(value) {
    lang = value;
    root.dataset.lang = lang;
    root.lang = lang === 'zh' ? 'zh-CN' : 'en';
    safeSet('academic-site:lang', lang);
    const b = qs('#lang-toggle');
    if (b) {
      b.querySelector('.language-current').textContent = lang === 'en' ? 'EN' : '中文';
      b.querySelector('.language-other').textContent = lang === 'en' ? '中文' : 'EN';
      b.setAttribute('aria-label', lang === 'en' ? '切换到中文' : 'Switch to English');
    }
    if(!document.body.classList.contains('inner-page'))document.title = lang === 'zh' ? '朱宝圆 | 微生物组 · 脑科学 · 人工智能' : 'Baoyuan Zhu · Microbiome, Brain & AI';
    updatePubCount();
  }
  function applyTheme(value) {
    root.dataset.theme = value;
    safeSet('academic-site:theme', value);
    const b = qs('#theme-toggle');
    if(b) b.setAttribute('aria-label', value === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    const meta = qs('meta[name="theme-color"]');
    if (meta) meta.content = value === 'dark' ? '#19241f' : '#f7f6f1';
  }
  qsa('#main-nav a').forEach(a => { if(['index.html#beyond','index.html#books'].includes(a.getAttribute('href'))){ a.setAttribute('href','books.html'); a.innerHTML=bi('Books','著作'); } });
  const data = window.ACADEMIC_DATA || {publications: [], repositories: []};
  const pubRoot = qs('#publication-list');
  function renderPubs() {
    if (!pubRoot) return;
    const entries = data.publications || [];
    pubRoot.innerHTML = entries.map((p, i) => {
      const parts = esc(p.publishedOnline ? p.fullAuthors.join(', ') : p.authors).split(/(Baoyuan Zhu)/g).map(s => s === 'Baoyuan Zhu' ? '<b>Baoyuan Zhu</b>' : s).join('');
      return `<article class="pub-item" data-index="${i}" data-year="${Number(p.year)}" data-lead="${p.role === 'lead'}" aria-label="${esc(p.title)}">
        <span class="pub-year">${Number(p.year)}</span>
        <div class="pub-details"><h3 class="pub-title"><a href="https://doi.org/${esc(p.doi)}" target="_blank" rel="noopener noreferrer" aria-label="Open journal article: ${esc(p.title)}">${esc(p.title)}</a></h3><p class="pub-authors">${parts}</p>
        <p class="pub-meta"><span class="pub-journal">${esc(p.journal)}</span>${p.publishedOnline ? `<span class="pub-status">${bi(p.status,p.statusZh)} · <time datetime="${esc(p.publishedOnline)}">${esc(p.publishedOnline)}</time></span>` : ''}<span>DOI: ${esc(p.doi)}</span><span class="pub-role ${p.role === 'coauthor' ? 'coauthor' : ''}">${bi(p.leadLabel, p.leadLabelZh)}</span></p></div>
        <div class="pub-links"><a href="https://doi.org/${esc(p.doi)}" target="_blank" rel="noopener noreferrer" aria-label="Open DOI for ${esc(p.title)}">PAPER ↗</a><button class="cite-copy" type="button" data-index="${i}" aria-label="Copy citation for ${esc(p.title)}">${bi('COPY CITE','复制引文')}</button></div>
      </article>`;
    }).join('');
    qsa('.cite-copy',pubRoot).forEach(b=>b.addEventListener('click',()=>copyCitation(data.publications[Number(b.dataset.index)]?.citation)));
    setFilter(filter);
  }
  function updatePubCount() {
    const total = qsa('.pub-item:not([hidden])').length;
    const text = qs('#pub-count');
    if(text) text.textContent = lang === 'zh' ? `显示 ${total} 篇` : `${total} papers shown`;
  }
  function setFilter(value) {
    filter=value;
    let visible=0;
    qsa('.pub-item').forEach(el => {
      const indexed = data.publications[Number(el.dataset.index)];
      const text = indexed ? [indexed.title,indexed.authors,indexed.journal,indexed.doi,indexed.topic,indexed.focus,indexed.focusZh,String(indexed.year)].join(' ').toLocaleLowerCase() : el.textContent.toLocaleLowerCase();
      const matchesYear = value==='all' || (value==='lead' ? el.dataset.lead === 'true' : el.dataset.year===value);
      el.hidden = !(matchesYear && (!publicationQuery || text.includes(publicationQuery)));
      if(!el.hidden)visible++;
    });
    qsa('[data-filter]').forEach(b=> {let active = b.dataset.filter === value;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    const empty=qs('#pub-empty');if(empty)empty.hidden=visible!==0;
    updatePubCount();
  }
  function exportSelectedPublications(){
    const rows=[['Year','Title','Authors','Journal','DOI','Contribution','Published online','Publication status']];
    qsa('.pub-item:not([hidden])').forEach(el=>{
      const p=data.publications[Number(el.dataset.index)];
      if(p)rows.push([p.year,p.title,p.fullAuthors.join('; '),p.journal,'https://doi.org/'+p.doi,p.leadLabel,p.publishedOnline||'',p.status||'']);
    });
    if(rows.length<2){toast('No papers to export','没有可导出的论文');return;}
    const csv='\uFEFF'+rows.map(row=>row.map(value=>{
      let str=String(value);
      if(/^[=+@-]/.test(str))str="'"+str;
      return '"'+str.replace(/"/g,'""')+'"';
    }).join(',')).join('\r\n');
    const file=new Blob([csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(file);
    const a=document.createElement('a');a.href=url;a.download='Baoyuan_Zhu_Selected_Publications.csv';document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
    toast('Publication CSV exported','已导出当前论文 CSV');
  }
  let toastTimer;
  function toast(en,zh) {
    let el=qs('.toast');
    if(!el){el=document.createElement('div');el.className='toast';el.setAttribute('role','status');document.body.append(el);}
    el.textContent=lang==='zh'?zh:en;
    el.hidden=false;
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>{el.hidden=true;},2400);
  }
  async function copyCitation(citation) {
    if(!citation)return;
    try {
      if(navigator.clipboard && window.isSecureContext){await navigator.clipboard.writeText(citation);}
      else { const t=document.createElement('textarea');t.value=citation;t.style.position='fixed';t.style.opacity='0';document.body.append(t);t.select();if(!document.execCommand('copy'))throw Error('Copy denied');t.remove();}
      toast('Citation copied to clipboard','引文已复制');
    } catch(e){toast('Copy unavailable; use paper link','复制失败，请使用论文链接');}
  }
  function renderRepos() {
    const target=qs('#repo-grid');if(!target)return;
    target.innerHTML = (data.repositories || []).map(r=>`<a class="code-card" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">
      <div class="code-card__top"><svg class="code-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 7L3 12l5 5M16 7l5 5-5 5M14 4l-4 16"/></svg><span class="code-card__tag">${esc(r.type)}</span></div>
      <h3>${esc(r.name)}</h3><p>${bi(r.en,r.zh)}</p><div class="code-card__bottom"><strong>${esc(r.tag)}</strong><span>GITHUB ↗</span></div>
    </a>`).join('');
  }
  renderPubs();renderRepos();
  applyLang(lang);applyTheme(safeGet('academic-site:theme') === 'dark'?'dark':'light');
  qs('#lang-toggle')?.addEventListener('click', () => applyLang(lang === 'en' ? 'zh' : 'en'));
  qs('#theme-toggle')?.addEventListener('click', () => applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));
  qsa('[data-filter]').forEach(b=>b.addEventListener('click',()=>setFilter(b.dataset.filter)));
  qs('#pub-search')?.addEventListener('input',e=>{
    publicationQuery=e.target.value.trim().toLocaleLowerCase();
    const clear=qs('#pub-clear');if(clear)clear.hidden=!publicationQuery;
    setFilter(filter);
  });
  function resetPubFilters(){
    publicationQuery='';const search=qs('#pub-search');if(search)search.value='';
    const clear=qs('#pub-clear');if(clear)clear.hidden=true;
    setFilter('all');search?.focus();
  }
  qs('#pub-clear')?.addEventListener('click',resetPubFilters);
  qs('#pub-reset')?.addEventListener('click',resetPubFilters);
  qs('#pub-search')?.addEventListener('keydown',e=>{if(e.key==='Escape'&&publicationQuery){e.preventDefault();e.stopPropagation();resetPubFilters()}});
  qs('#pub-export')?.addEventListener('click',exportSelectedPublications);

  qs('#current-year') && (qs('#current-year').textContent = String(new Date().getFullYear()));
  const menuBtn=qs('#menu-toggle');
  function closeMenu(){
    const hadFocus=qs('#main-nav')?.contains(document.activeElement);
    document.body.classList.remove('nav-open');
    menuBtn?.setAttribute('aria-expanded','false');
    menuBtn?.setAttribute('aria-label','Open navigation');
    if(hadFocus)menuBtn?.focus();
  }
  menuBtn?.addEventListener('click',()=>{
    const open=document.body.classList.toggle('nav-open');
    menuBtn.setAttribute('aria-expanded',String(open));
    menuBtn.setAttribute('aria-label',open?'Close navigation':'Open navigation');
    if(open)qs('#main-nav a')?.focus();
  });
  qsa('#main-nav a').forEach(a=>a.addEventListener('click',closeMenu));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
  document.addEventListener('click',e=>{if(document.body.classList.contains('nav-open')&&!e.target.closest('.site-header'))closeMenu()});
  const progress=qs('.reading-progress'); let scheduled=false;
  function updateScroll(){scheduled=false;const max=Math.max(1,document.documentElement.scrollHeight-innerHeight);if(progress)progress.style.width=(Math.max(0,Math.min(100,scrollY/max*100))).toFixed(1)+'%';}
  window.addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(updateScroll)}},{passive:true});updateScroll();
  if('IntersectionObserver' in window && !document.body.classList.contains('inner-page')){
    const nav=qsa('#main-nav a');
    const observer=new IntersectionObserver(entries=>{
      const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
      if(!visible)return;
      nav.forEach(a=>a.classList.toggle('active',(a.hash==='#'+visible.target.id || (a.getAttribute('href')==='about.html' && visible.target.id==='about'))));
    },{rootMargin:'-25% 0px -62% 0px',threshold:[0,.01,.05,.1]});
    qsa('section[id]').forEach(el=>observer.observe(el));
  }
})();
