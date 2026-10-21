(() => {
  'use strict';
  const STORE = 'growth-academy-journal-atlas-v1';
  const PAGE_SIZE = 24;
  const TODAY_YEAR = 2026;
  const $ = (id) => document.getElementById(id);
  const number = new Intl.NumberFormat('zh-CN');
  const journalNameCollator = new Intl.Collator('en', { sensitivity:'base' });
  let countryNames;
  try { countryNames = new Intl.DisplayNames(['zh-CN'], { type: 'region' }); } catch (_) { countryNames = null; }
  const FIELD_NAMES = {
    'Agricultural and Biological Sciences': '农业与生物科学', 'Arts and Humanities': '艺术与人文学科',
    'Biochemistry, Genetics and Molecular Biology': '生物化学、遗传与分子生物学', 'Business, Management and Accounting': '商业、管理与会计',
    'Chemical Engineering': '化学工程', 'Chemistry': '化学', 'Computer Science': '计算机科学',
    'Decision Sciences': '决策科学', 'Earth and Planetary Sciences': '地球与行星科学',
    'Economics, Econometrics and Finance': '经济、计量经济与金融', 'Energy': '能源', 'Engineering': '工程',
    'Environmental Science': '环境科学', 'Health Professions': '卫生专业', 'Immunology and Microbiology': '免疫学与微生物学',
    'Materials Science': '材料科学', 'Mathematics': '数学', 'Medicine': '医学', 'Multidisciplinary': '多学科',
    'Neuroscience': '神经科学', 'Nursing': '护理学', 'Pharmacology, Toxicology and Pharmaceutics': '药理、毒理与药剂学',
    'Physics and Astronomy': '物理学与天文学', 'Psychology': '心理学', 'Social Sciences': '社会科学',
    'Veterinary': '兽医学', 'Dentistry': '口腔医学', 'Unclassified': '未分类', 'Unknown': '未分类'
  };
  const ALIASES = {
    '微生物': ['microbi', 'microb', '微生物'], '菌群': ['microbiom', 'microbiot', '菌群'],
    '肠道': ['gut', 'intestinal', 'gastroenter', '肠道'], '生态': ['ecolog', 'ecosy', '生态'],
    '生物信息': ['bioinform', 'computational biology', '生物信息'], '生物信息学': ['bioinform', 'computational biology', '生物信息'],
    '计算生物': ['computational biology', 'bioinform', '计算生物'], '人工智能': ['artificial intelligence', 'machine learning', 'intelligent', '人工智能'],
    'ai': ['artificial intelligence', 'machine learning', 'intelligent', ' ai '],
    '机器学习': ['machine learning', 'deep learning', 'neural network', '机器学习'],
    '医学': ['medicine', 'medical', 'clinical', 'health', '医学'],
    '精神病': ['psychiatr', 'mental health', 'psycho', '精神'], '精神病学': ['psychiatr', 'mental health', '精神'],
    '心理': ['psycholog', 'psycho', '心理'], '抑郁': ['depress', 'affective', 'mood', '抑郁'],
    '脑科学': ['neuro', 'brain', 'cognit', '脑'], '神经': ['neuro', 'neural', '神经'],
    '脑机接口': ['brain computer', 'neural engineering', 'neuroengineering', '脑机'],
    '影像': ['imag', 'radiolog', '影像'], '基因': ['genom', 'genet', '基因'], '组学': ['omics', 'genom', 'proteom', 'metabolom', '组学'],
    '免疫': ['immun', '免疫'], '肿瘤': ['oncolog', 'cancer', 'tumor', '肿瘤'], '癌症': ['oncolog', 'cancer', 'tumor'],
    '口腔': ['oral', 'dental', 'dentist', '口腔'], '药物': ['pharmac', 'drug', 'pharmaceut', '药物'],
    '材料': ['material', 'biomaterial', '材料'], '工程': ['engineer', '工程'], '环境': ['environment', 'ecolog', '环境'],
    '农业': ['agricultur', 'crop', 'agronom', '农业'], '食品': ['food', 'nutrition', '食品'],
    '化学': ['chemistr', 'chemical', '化学'], '物理': ['physics', 'physical', '物理'], '数学': ['mathematic', '数学'],
    '统计': ['statistic', 'biostat', '统计'], '计算机': ['computer', 'computing', 'software', '计算机'],
    '社会科学': ['social science', 'sociolog', 'social studies', '社会'], '经济': ['economic', 'finance', '经济'],
    '管理': ['management', 'business', '管理'], '教育': ['education', 'teaching', 'learning', '教育'],
    '人文': ['humanities', 'history', 'philosoph', 'literature', '人文'], '公共卫生': ['public health', 'epidemiol', '公共卫生'],
    '生命科学': ['biolog', 'bioscien', 'life science', '生命科学']
  };
  const STAGES = { considering:'待评估', primary:'优先目标', backup:'备选目标', preparing:'准备投稿', submitted:'已投稿', revision:'修回中', accepted:'已接收', closed:'已结束' };
  const REVIEW_STAGES = {
    submission_to_first_decision:'投稿至首次决定（可能含编辑初筛）', first_decision:'投稿至首次决定（可能含编辑初筛）',
    submission_to_first_editorial_decision:'投稿至首次编辑决定', first_decision_without_review:'未送外审稿件的首次决定', first_decision_with_review:'外审后首次决定', reviewer_turnaround:'审稿人完成评审耗时', submission_to_first_post_review_decision:'投稿至首次外审后决定',
    submission_to_first_peer_review_decision:'投稿至首次外审后决定', first_review_decision:'首次外审后决定',
    peer_review:'同行评审阶段', submission_to_acceptance:'投稿至接收', acceptance_to_publication:'接收至发表',
    submission_to_publication:'投稿至发表', submission_to_final_decision:'投稿至最终决定', review_time:'来源标注的审稿时间', decision_after_review:'外审后决定'
  };
  const DEFAULT_FILTERS = { q:'', field:'', database:'', system:'JCR', quartile:'', category:'', year:'', min:'', max:'', oa:'', country:'', publisher:'', review:'', reviewStage:'first', curated:false, saved:false, sort:'recommended' };
  const state = { journals:[], byId:new Map(), meta:{}, filtered:[], filters:{...DEFAULT_FILTERS}, page:1, mode:'cards', view:'catalog', ready:false, compare:[], compareToken:0, detailId:null, detailToken:0, local:null, importMap:new Map(), sourceLists:[], issnSet:new Set(), candidateScope:null, editorialEvidence:new Map(), editorialEvidenceStatus:'loading' };
  // Manuscript matching is deliberately session-only: text and inferred terms never
  // enter URL filters, localStorage, shared links, or journal-result exports.
  const matchState = { index:null, indexPromise:null, indexRows:null, analysis:null, excluded:new Set(), required:new Set(), ranked:[], screened:[], eligible:[], filtered:[], screening:null, shown:5, token:0, renderToken:0, busy:false, hasRun:false, pending:false, inputKey:'', preferences:null, identityRejected:0, preferenceRejected:0 };
  const submissionReadiness = { promise:null, missing:null, status:'idle' };
  const detailCache = new Map();
  const shardPromises = new Map();
  let toastTimer;
  let storageFailed = false;
  let importEpoch = 0;
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = (value) => Number.isFinite(Number(value)) && value !== null && value !== '' && value !== undefined ? number.format(Number(value)) : '—';
  const validNumber = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  const numValue = (value) => validNumber(value) ? Number(value) : null;
  const asArray = (value) => Array.isArray(value) ? value : [];
  const asText = (value) => typeof value === 'string' ? value : value && typeof value === 'object' ? String(value.display_name || value.name || value.label || value.title || '') : value == null ? '' : String(value);
  const unique = (values) => [...new Set(values.filter((v) => v !== null && v !== undefined && v !== ''))];
  const normalize = (value) => String(value || '').toLowerCase().normalize('NFKC').replace(/[‐‑–—]/g,'-').replace(/\s+/g,' ').trim();
  const countryName = (code) => { if (!code) return '未标明'; try { return countryNames && /^[A-Z]{2}$/.test(code) ? countryNames.of(code) : code; } catch (_) { return code; } };
  const fieldName = (field) => FIELD_NAMES[field] || field;
  const dateOnly = (value) => typeof value === 'string' ? value.slice(0,10) : '';
  function safeURL(value) { try { const url = new URL(String(value)); return ['https:','http:'].includes(url.protocol) ? url.href : ''; } catch (_) { return ''; } }
  function sourceURL(value) { if (typeof value === 'string') return safeURL(value); return value && typeof value === 'object' ? safeURL(value.url || value.source || value.href) : ''; }
  function link(value, label='来源 ↗', className='source-link') { const url = sourceURL(value); return url ? `<a class="${esc(className)}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : '<span class="detail-small">未附公开链接</span>'; }
  function tag(text, color='') { return `<span class="tag ${esc(color)}">${esc(text)}</span>`; }
  function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3900); }
  function emptyPersonal() { return { version:1, records:Object.create(null), searches:[], metrics:[], manuscript:{ title:'', keywords:'' } }; }
  function readLocal() {
    const blank = emptyPersonal();
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return blank;
      if (parsed.records && typeof parsed.records === 'object' && !Array.isArray(parsed.records)) {
        Object.entries(parsed.records).forEach(([id, record]) => { if (/^[A-Za-z0-9][A-Za-z0-9._:-]{0,100}$/.test(id) && record && typeof record === 'object') blank.records[id] = { saved:record.saved === true, stage:STAGES[record.stage] ? record.stage : 'considering', notes:String(record.notes || '').slice(0,12000), updatedAt:String(record.updatedAt || '').slice(0,30) }; });
      }
      blank.searches = asArray(parsed.searches).slice(0,12).filter((x) => x && typeof x === 'object').map((x) => ({ name:String(x.name || '').slice(0,100), filters:sanitizeFilters(x.filters) }));
      blank.metrics = asArray(parsed.metrics).slice(0,60000).filter(validImportedMetric).map(normalizeImportedMetric);
      blank.manuscript = { title:String(parsed.manuscript?.title || '').slice(0,300), keywords:String(parsed.manuscript?.keywords || '').slice(0,500) };
      return blank;
    } catch (_) { return blank; }
  }
  function persist() { try { localStorage.setItem(STORE, JSON.stringify(state.local)); storageFailed = false; } catch (_) { if (!storageFailed) toast('浏览器本地存储不可用或空间不足。请立即导出个人数据备份。'); storageFailed = true; } }
  function recordFor(id) { if (!Object.prototype.hasOwnProperty.call(state.local.records,id)) state.local.records[id] = {saved:false,stage:'considering',notes:'',updatedAt:''}; return state.local.records[id]; }
  const isSaved = (id) => state.local.records[id]?.saved === true;
  function sanitizeFilters(input) { const f = {...DEFAULT_FILTERS}; if (input && typeof input === 'object') Object.keys(f).forEach((key) => { if (typeof f[key] === 'boolean') f[key] = input[key] === true || input[key] === '1'; else if (input[key] != null) f[key] = String(input[key]).slice(0,key==='q'?500:200); }); if (!['JCR','CAS','SJR'].includes(f.system)) f.system='JCR'; if (!['first','peer','publication'].includes(f.reviewStage)) f.reviewStage='first'; if (!['recommended','jif-desc','jif-asc','volume-desc','review-asc','name'].includes(f.sort)) f.sort='recommended'; return f; }
  function readURLFilters() { const params = new URLSearchParams(location.search), raw={}; Object.keys(DEFAULT_FILTERS).forEach((key) => { if (params.has(key)) raw[key]=params.get(key); }); state.filters=sanitizeFilters(raw); }
  function syncURL() { const url=new URL(location.href); url.search=''; Object.entries(state.filters).forEach(([key,value]) => { if (value!==DEFAULT_FILTERS[key] && value!=='' && value!==false) url.searchParams.set(key, value===true?'1':value); }); history.replaceState(null,'',url); }
  function buildImportMap() { importEpoch++; state.importMap = new Map(); state.local.metrics.forEach((metric) => { const key=metric.issn; if (!state.importMap.has(key)) state.importMap.set(key,[]); state.importMap.get(key).push(metric); }); }
  function importsFor(journal) { const entries=[]; unique([journal.issnL,...asArray(journal.issns)]).forEach((issn) => entries.push(...(state.importMap.get(String(issn).toUpperCase()) || []))); const seen=new Set(); return entries.filter((m) => { const k=metricKey(m); if(seen.has(k))return false; seen.add(k);return true; }); }
  function jifInfo(journal, year=state.filters.year) {
    const cacheKey=String(year||'latest')+'|'+importEpoch;
    if(journal._jifCache?.key===cacheKey)return journal._jifCache.result;
    const candidates=[],recordedYears=[];
    const rememberYear=(value)=>{const y=Number(value);if(Number.isInteger(y)&&y>0)recordedYears.push(y);};
    const byYear=journal.jifByYear;
    if (byYear && typeof byYear==='object') Object.entries(byYear).forEach(([y, v]) => { rememberYear(y);const value=numValue(typeof v==='object' && v ? v.value:v); if(value!==null)candidates.push({year:Number(y),value,personal:false}); });
    asArray(journal.jif).forEach((m) => { rememberYear(m.year);const value=numValue(m.value); if(value!==null && Number(m.year)) candidates.push({...m,year:Number(m.year),value,personal:false}); });
    if(validNumber(journal.jifValue)||journal.jifText)rememberYear(journal.jifYear);
    if(validNumber(journal.jifValue)&&Number(journal.jifYear)) candidates.push({year:Number(journal.jifYear),value:Number(journal.jifValue),personal:false});
    importsFor(journal).forEach((m) => { if(m.system==='JCR' && m.impact_factor!==null){rememberYear(m.year);candidates.push({year:m.year,value:m.impact_factor,personal:true,source:m.source});} });
    // A newer censored value is still a reported year. Never silently use an
    // older exact value for a filter labelled "latest recorded JIF".
    const selectedYear=year?Number(year):recordedYears.length?Math.max(...recordedYears):null;
    const filtered=candidates.filter((p)=>p.year===selectedYear);
    filtered.sort((a,b)=>b.year-a.year || Number(a.personal)-Number(b.personal));
    const result=filtered[0] || null;journal._jifCache={key:cacheKey,result,year:selectedYear,hasRecord:recordedYears.includes(selectedYear)};return result;
  }
  function jifDisplayInfo(journal,year=state.filters.year) {
    const numeric=jifInfo(journal,year);
    if(numeric)return {...numeric,text:fmt(numeric.value),exportValue:numeric.value};
    const selectedYear=journal._jifCache?.year;
    const point=asArray(journal.jif).find((m)=>Number(m.year)===selectedYear&&m.display);
    const byYear=journal.jifByYear?.[selectedYear];
    const text=point?.display||(byYear&&typeof byYear==='object'?byYear.display:'')||(Number(journal.jifYear)===selectedYear?journal.jifText:'')||(journal._jifCache?.hasRecord?'无精确值，见详情':'');
    return text?{year:selectedYear,value:null,text:String(text),exportValue:String(text),personal:false}:null;
  }
  function qNormalize(value) { const match=String(value||'').toUpperCase().match(/(?:Q\s*)?([1-4])(?:\s*区)?/); return match?'Q'+match[1]:''; }
  function quartileEntries(journal, system='JCR') {
    const entries=[];
    if(system==='JCR') {
      if(journal.jcrByCategory && typeof journal.jcrByCategory==='object') Object.entries(journal.jcrByCategory).forEach(([category,q])=> { const value=typeof q==='object'&&q?q.quartile:q; if(qNormalize(value))entries.push({system,category,quartile:qNormalize(value),year:journal.jcrYear || journal.jifYear,personal:false}); });
      else asArray(journal.jcrQuartiles).forEach((q)=>{if(qNormalize(q))entries.push({system,category:'',quartile:qNormalize(q),year:journal.jcrYear || journal.jifYear,personal:false});});
    }
    if(system==='CAS') {
      if(journal.casByCategory && typeof journal.casByCategory==='object') Object.entries(journal.casByCategory).forEach(([category,q])=>{const value=typeof q==='object'&&q?q.quartile:q;if(qNormalize(value))entries.push({system,category,quartile:qNormalize(value),year:journal.casYear||2025,level:typeof q==='object'?q.level:'major',personal:false});});
      else if(qNormalize(journal.casZone))entries.push({system,category:journal.casMajorCategory || journal.casCategory || '源表未注明学科层级',quartile:qNormalize(journal.casZone),year:journal.casYear||2025,level:journal.casLevel||'unspecified',personal:false});
    }
    asArray(journal.quartiles).forEach((q)=>{if(String(q.system).toUpperCase()===system&&qNormalize(q.quartile))entries.push({...q,quartile:qNormalize(q.quartile),personal:false});});
    importsFor(journal).forEach((m)=>{if(m.system===system&&m.quartile)entries.push({...m,personal:true});});
    return entries;
  }
  function cardQuartiles(journal) { const system=state.filters.system, category=state.filters.category; return unique(quartileEntries(journal,system).filter((q)=>!category||q.category===category).map((q)=>q.quartile)).sort(); }
  function positiveIndex(journal, index) {
    const wanted=String(index).toLowerCase();
    if([...asArray(journal.wosIndexes),...asArray(journal.indexingNames)].some((v)=>String(v).toLowerCase()===wanted))return true;
    if(wanted==='doaj'&&journal.isDOAJ===true)return true;
    if(wanted==='scopus'&&journal.isScopus===true)return true;
    const lists=asArray(journal.listedIn).map((v)=>normalize(asText(v)));
    if(lists.some((v)=>v===wanted || v===wanted.replace(/-/g,'_') || (wanted==='medline'&&/^medline[ _-]?\d*$/.test(v)) || (wanted==='scielo'&&v==='scielo')))return true;
    return asArray(journal.indexing).some((entry)=>normalize(entry.name)===wanted && !['unknown','not_indexed','removed','no','false'].includes(normalize(entry.status)));
  }
  function volumeInfo(journal) { const value=journal.latestAnnual; if(value&&typeof value==='object'&&validNumber(value.count))return {year:Number(value.year),count:Number(value.count)}; const annual=asArray(journal.annual).filter((a)=>validNumber(a.count)&&Number(a.year)<TODAY_YEAR).sort((a,b)=>Number(b.year)-Number(a.year)); return annual[0] || null; }
  function reviewLabel(stage=state.filters.reviewStage) { return stage==='publication'?'投稿至发表':stage==='peer'?'外审后首次决定':'首次决定'; }
  function reviewInfo(journal, stage=state.filters.reviewStage) {
    const field=stage==='publication'?'publicationDays':stage==='peer'?'peerReviewDays':'reviewDays';
    const stages=stage==='publication'?['submission_to_publication']:stage==='peer'?['first_decision_with_review','submission_to_first_post_review_decision','submission_to_first_peer_review_decision','first_review_decision']:['submission_to_first_decision','first_decision'];
    const record=asArray(journal.review).find((r)=>stages.includes(r.stage)&&validNumber(r.days??r.value));
    if(record)return {...record,days:Number(record.days??record.value),label:reviewLabel(stage),field};
    return validNumber(journal[field])?{days:Number(journal[field]),label:reviewLabel(stage),field}:null;
  }
  function reviewStatistic(record) {
    return ({median:'中位数',mean:'平均值',average:'平均值',publisher_reported_average:'DOAJ 申报平均值'})[record?.statistic]||record?.statistic||'统计口径见来源';
  }
  function reviewAvailability(journal, stage='first') {
    const selected=reviewInfo(journal,stage);
    if(selected)return reviewLabel(stage)+' '+fmt(selected.days)+' 天';
    const peer=reviewInfo(journal,'peer');
    return stage==='first'&&peer?'整体首次决定未收录；外审后 '+fmt(peer.days)+' 天':reviewLabel(stage)+'：本站未收录';
  }
  function mergeEditorialEvidence(journal) {
    const supplement=state.editorialEvidence.get(journal.id);if(!supplement)return journal;
    const incoming=asArray(supplement.review);
    journal.review=[...incoming,...asArray(journal.review).filter((r)=>!incoming.some((n)=>n.stage===r.stage&&n.statistic===r.statistic&&n.period===r.period))];
    const first=incoming.find((r)=>['submission_to_first_decision','first_decision'].includes(r.stage)&&validNumber(r.days));
    if(first)journal.reviewDays=Number(first.days);
    const peer=incoming.find((r)=>['first_decision_with_review','submission_to_first_post_review_decision','submission_to_first_peer_review_decision','first_review_decision'].includes(r.stage)&&validNumber(r.days));
    if(peer)journal.peerReviewDays=Number(peer.days);
    if(supplement.publisher&&sourceURL(supplement.publisherSource)){journal.publisher=String(supplement.publisher);journal.publisherSource=supplement.publisherSource;}
    if(safeURL(supplement.authorGuidelines))journal.authorGuidelines=safeURL(supplement.authorGuidelines);
    if(safeURL(supplement.submissionURL))journal.submissionURL=safeURL(supplement.submissionURL);
    if(safeURL(supplement.homepage))journal.homepage=safeURL(supplement.homepage);
    journal.editorialCheckedAt=supplement.checkedAt||incoming[0]?.checkedAt;
    if(supplement.publisherNotes||supplement.publisherMetricNotes)journal.publisherMetricNotes=asArray(supplement.publisherNotes||supplement.publisherMetricNotes);
    return journal;
  }
  async function loadEditorialEvidence(signal) {
    try {
      const response=await fetch('data/editorial-evidence.json',{signal});if(!response.ok)throw new Error('补充审稿资料未载入');
      const data=await response.json();if(!Array.isArray(data.records))throw new Error('补充审稿资料格式错误');
      state.editorialEvidenceStatus='ready';return data.records;
    }catch(error){state.editorialEvidenceStatus='unavailable';return [];}
  }
  async function ensureSubmissionReadiness() {
    if(submissionReadiness.status==='ready')return;
    if(submissionReadiness.promise)return submissionReadiness.promise;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
    submissionReadiness.status='loading';
    submissionReadiness.promise=(async()=>{
      try {
        const [response,manifestResponse]=await Promise.all([fetch('data/submission-readiness.json',{signal:controller.signal}),fetch('data/index-manifest.json',{signal:controller.signal})]);
        if(!response.ok||!manifestResponse.ok)throw new Error('入口资料索引暂未载入，请重试');
        const [data,manifest]=await Promise.all([response.json(),manifestResponse.json()]);
        const expectedHash=asArray(manifest.files).find((file)=>file.gzipPath==='catalog.json.gz')?.gzipSHA256;
        if(data.version!==1||!expectedHash||data.catalogSha256!==expectedHash||data.catalogCount!==state.journals.length||!Array.isArray(data.missingHomepageIds)||new Set(data.missingHomepageIds).size!==data.missingHomepageIds.length||data.missingHomepageIds.some((id)=>!state.byId.has(id)))throw new Error('入口资料与目录版本不一致，请刷新后重试');
        submissionReadiness.missing=new Set(data.missingHomepageIds);submissionReadiness.status='ready';
      }catch(error){submissionReadiness.status='unavailable';submissionReadiness.promise=null;throw error;}
      finally{clearTimeout(timeout);}
    })();return submissionReadiness.promise;
  }
  function hasSubmissionIdentity(journal) {
    const hasISSN=unique([journal.issnL,...asArray(journal.issns)]).some((issn)=>/^\d{4}-\d{3}[\dX]$/i.test(String(issn)));
    const hasHomepage=safeURL(journal.homepage)||submissionReadiness.status==='ready'&&!submissionReadiness.missing.has(journal.id);
    return hasISSN&&Boolean(String(journal.publisher||'').trim())&&Boolean(hasHomepage);
  }
  function keywordGroups(query) { return normalize(query).split(/[\s,，;；]+/).filter(Boolean).map((word)=>ALIASES[word] || [word]); }
  function filterMatches(journal, f, groups) {
    if(groups.length && !groups.every((group)=>group.some((word)=>journal._search.includes(word))))return false;
    if(f.field&&!journal.fields.includes(f.field))return false;
    if(f.database&&!positiveIndex(journal,f.database))return false;
    if(f.quartile||f.category){const q=quartileEntries(journal,f.system);if(!q.some((e)=>(!f.quartile||e.quartile===f.quartile)&&(!f.category||e.category===f.category)))return false;}
    if(f.min!==''||f.max!==''){const metric=jifInfo(journal,f.year);if(!metric)return false;if(f.min!==''&&metric.value<Number(f.min))return false;if(f.max!==''&&metric.value>Number(f.max))return false;}
    else if(f.year&&!jifDisplayInfo(journal,f.year))return false;
    if(f.oa==='yes'&&journal.isOA!==true)return false;
    if(f.oa==='no'&&journal.isOA!==false)return false;
    if(f.country&&journal.country!==f.country)return false;
    if(f.publisher&&!normalize(journal.publisher).includes(normalize(f.publisher)))return false;
    if(f.review){const r=reviewInfo(journal,f.reviewStage);if(!r||r.days>Number(f.review))return false;}
    if(f.curated&&!journal.curated)return false;
    if(f.saved&&!isSaved(journal.id))return false;
    return true;
  }
  function sortResults(list) {
    const mode=state.filters.sort;
    const byName=(a,b)=>journalNameCollator.compare(a.name,b.name);
    if(mode==='name')return list.sort(byName);
    if(mode==='jif-desc'||mode==='jif-asc') {
      list.forEach((j)=>{j._sortNumber=jifInfo(j)?.value??null;});
      return list.sort((a,b)=>{const av=a._sortNumber,bv=b._sortNumber;if(av===null)return bv===null?byName(a,b):1;if(bv===null)return -1;return (mode==='jif-desc'?bv-av:av-bv)||byName(a,b);});
    }
    if(mode==='volume-desc'){list.forEach((j)=>{j._sortNumber=volumeInfo(j)?.count??-1;});return list.sort((a,b)=>b._sortNumber-a._sortNumber||byName(a,b));}
    if(mode==='review-asc'){list.forEach((j)=>{j._sortNumber=reviewInfo(j)?.days??Infinity;});return list.sort((a,b)=>a._sortNumber-b._sortNumber||byName(a,b));}
    list.forEach((j)=>{j._sortCurated=Number(Boolean(j.curated));j._sortSaved=Number(isSaved(j.id));j._sortNumber=jifInfo(j)?.value??-1;});
    return list.sort((a,b)=>b._sortCurated-a._sortCurated||b._sortSaved-a._sortSaved||b._sortNumber-a._sortNumber||byName(a,b));
  }
  function computeResults() {
    if(!state.ready)return;
    const f=state.filters, groups=keywordGroups(state.filters.q);
    if(f.min!==''&&f.max!==''&&Number(f.min)>Number(f.max)){state.filtered=[];$('result-subtitle').textContent='最低 JIF 大于最高 JIF，请调整范围。';}
    else {state.filtered=sortResults(state.journals.filter((j)=>(!state.candidateScope||state.candidateScope.ids.has(j.id))&&filterMatches(j,f,groups)));$('result-subtitle').textContent=state.candidateScope?`在生成时选定的 ${fmt(state.candidateScope.ids.size)} 本稿件候选中继续筛选；范围仅限本次会话。`:f.q?'关键词匹配刊名、学科与主题；不是稿件录用预测':'每项指标保留年份；未披露信息不推算';}
    state.page=Math.max(1,Math.min(state.page,Math.ceil(state.filtered.length/PAGE_SIZE)||1));
    renderResults();renderActiveFilters();syncURL();
  }
  function metricHTML(label,value,year,missing=false,small=false) { return `<div><span class="metric-label">${esc(label)}</span><span class="metric-value${missing?' missing':small?' small':''}">${esc(value)}${year?`<small class="metric-year">${esc(year)}</small>`:''}</span></div>`; }
  function favoriteButton(journal) { const saved=isSaved(journal.id);return `<button type="button" class="favorite-button" aria-label="${saved?'移出收藏':'收藏'}：${esc(journal.name)}" aria-pressed="${saved}" data-action="favorite" data-id="${esc(journal.id)}">${saved?'★':'☆'}</button>`; }
  function compareCheck(journal) { return `<label class="compare-check"><input type="checkbox" data-compare="${esc(journal.id)}" ${state.compare.includes(journal.id)?'checked':''} aria-label="比较 ${esc(journal.name)}">加入比较</label>`; }
  function shortIndexTags(journal) {const labels=unique([...asArray(journal.wosIndexes),journal.isDOAJ?'DOAJ':null,positiveIndex(journal,'MEDLINE')?'MEDLINE':null]);return labels.slice(0,4).map((s)=>tag(s,s==='DOAJ'?'teal':'')).join('');}
  function cardHTML(journal) {
    const jif=jifDisplayInfo(journal),volume=volumeInfo(journal),qs=cardQuartiles(journal),review=reviewInfo(journal);
    const qLabel=state.filters.system==='CAS'?'中科院 2025 参考':state.filters.system==='SJR'?'SJR / 个人导入':'JCR 分区';
    const qDisplay=state.filters.system==='CAS'?qs.map((x)=>x.slice(1)+'区').join(' / '):qs.join(' / ');
    return `<article class="journal-card"><div class="card-topline"><span class="publisher" title="${esc(journal.publisher)}">${esc(journal.publisher || '出版方未标明')}</span>${favoriteButton(journal)}</div><h3><button class="journal-title-button" type="button" data-action="detail" data-id="${esc(journal.id)}">${esc(journal.name)}</button></h3><p class="issn-line">ISSN ${esc(journal.issnL || asArray(journal.issns)[0] || '未标明')} <span> · ${esc(countryName(journal.country))}</span></p><div class="field-tags">${journal.fields.slice(0,2).map((f)=>tag(fieldName(f))).join('')}${journal.curated?tag('出版方详情','teal'):''}</div><div class="metric-row">${metricHTML('影响因子 JIF',jif?jif.text:'未收录',jif?jif.year:'',!jif,Boolean(jif&&jif.value===null&&jif.text.length>8))}${metricHTML(qLabel,qDisplay||'未收录','',!qDisplay,true)}${metricHTML(volume?`${volume.year} 收录文献量${volume.year>=TODAY_YEAR?' *':''}`:'年度收录文献量',volume?fmt(volume.count):'未收录','',!volume)}</div><div class="card-meta">${shortIndexTags(journal)}${journal.isOA?tag('全 OA','blue'):''}${jif?.personal?tag('JIF 个人导入','purple'):''}<span>${esc(reviewAvailability(journal,state.filters.reviewStage))}</span></div>${asArray(journal.warnings).length?'<p class="warning-line">来源元数据有待核对项，详情中保留说明。</p>':''}<div class="card-bottom">${compareCheck(journal)}<button type="button" class="text-button" data-action="review" data-id="${esc(journal.id)}">审稿周期与来源</button><button type="button" class="text-button" data-action="detail" data-id="${esc(journal.id)}">查看完整档案 ↗</button></div></article>`;
  }
  function tableHTML(journals) { return `<div class="result-table-wrap"><table class="result-table"><thead><tr><th>收藏</th><th>期刊 / ISSN</th><th>JIF / 年份</th><th>${state.filters.system==='CAS'?'中科院历史分区':esc(state.filters.system)+' 分区'}</th><th>年度文献量</th><th>${esc(reviewLabel())}</th><th>比较</th></tr></thead><tbody>${journals.map((j)=>{const ifv=jifDisplayInfo(j),v=volumeInfo(j);return `<tr><td>${favoriteButton(j)}</td><td><button class="journal-title-button" type="button" data-action="detail" data-id="${esc(j.id)}">${esc(j.name)}</button><p class="table-secondary">${esc(j.issnL || '')} · ${esc(j.publisher || '出版方未标明')}</p></td><td class="table-number">${ifv?esc(ifv.text):'—'}<div class="table-secondary">${ifv?esc(ifv.year)+(ifv.personal?' · 个人导入':''):'未收录'}</div></td><td>${cardQuartiles(j).map((q)=>tag(state.filters.system==='CAS'?q.slice(1)+'区':q)).join('') || '—'}</td><td class="table-number">${v?fmt(v.count):'—'}<div class="table-secondary">${v?v.year+' · OpenAlex':''}</div></td><td>${reviewInfo(j)?fmt(reviewInfo(j).days)+' 天':'本站未收录'}<br><button type="button" class="text-button" data-action="review" data-id="${esc(j.id)}">阶段与来源 ↗</button></td><td>${compareCheck(j)}</td></tr>`;}).join('')}</tbody></table></div>`; }
  function renderResults() {
    if(!state.ready)return;
    $('catalog-message').hidden=true;
    $('result-count').innerHTML=`找到 <b>${fmt(state.filtered.length)}</b> 本期刊`;
    const start=(state.page-1)*PAGE_SIZE, page=state.filtered.slice(start,start+PAGE_SIZE);
    if(!page.length){$('results').innerHTML='<div class="empty-panel"><h3>这组条件下暂未找到期刊</h3><p>试试减少一个条件，或用期刊英文名称、ISSN 检索。设置数值筛选会排除未披露该指标的记录。</p><button type="button" class="secondary-button" data-action="reset">清除筛选条件</button></div>';$('pagination').innerHTML='';return;}
    $('results').innerHTML=state.mode==='table'?tableHTML(page):`<div class="journal-grid">${page.map(cardHTML).join('')}</div>`;
    const pages=Math.ceil(state.filtered.length/PAGE_SIZE), visible=unique([1,state.page-1,state.page,state.page+1,pages]).filter((p)=>p>0&&p<=pages).sort((a,b)=>a-b);
    let last=0,html=`<button type="button" data-page="${state.page-1}" ${state.page===1?'disabled':''} aria-label="上一页">←</button>`;
    visible.forEach((p)=>{if(last&&p-last>1)html+='<span>…</span>';html+=`<button type="button" data-page="${p}" ${p===state.page?'aria-current="page"':''}>${p}</button>`;last=p;});
    html+=`<button type="button" data-page="${state.page+1}" ${state.page===pages?'disabled':''} aria-label="下一页">→</button><span>${start+1}–${Math.min(start+PAGE_SIZE,state.filtered.length)} / ${fmt(state.filtered.length)}</span>`;
    $('pagination').innerHTML=html;
  }
  function renderActiveFilters() {
    const f=state.filters, labels={q:`关键词：${f.q}`,field:fieldName(f.field),database:f.database,quartile:`${f.system} ${f.quartile}`,category:f.category,year:`JIF ${f.year}`,min:`JIF ≥ ${f.min}`,max:`JIF ≤ ${f.max}`,oa:f.oa==='yes'?'全开放获取':'未标记全 OA',country:countryName(f.country),publisher:`出版方：${f.publisher}`,review:`${reviewLabel(f.reviewStage)} ≤ ${f.review} 天`,curated:'出版方详情核验',saved:'我的收藏'};
    $('active-filters').innerHTML=(state.candidateScope?`<button class="filter-chip candidate-scope-chip" type="button" data-clear-scope title="清除本次稿件候选范围，返回全目录筛选"><span>稿件候选 ${fmt(state.candidateScope.ids.size)} 本 · 本次会话</span><span aria-hidden="true">×</span></button>`:'')+Object.entries(labels).filter(([k])=>f[k]!==''&&f[k]!==false).map(([key,label])=>`<button class="filter-chip" type="button" data-clear-filter="${key}" title="清除${esc(label)}"><span>${esc(label)}</span><span aria-hidden="true">×</span></button>`).join('');
    $('share-search').disabled=Boolean(state.candidateScope);
    $('share-search').textContent=state.candidateScope?'稿件候选仅限本次会话':'复制检索链接';
    $('share-search').title=state.candidateScope?'可导出当前候选；分享链接不包含稿件内容或候选范围。':'';
  }
  function fillSelect(id, entries, current) {const select=$(id),first=select.options[0]?.outerHTML||'<option value="">全部</option>';select.innerHTML=first+entries.map(([value,label])=>`<option value="${esc(value)}">${esc(label)}</option>`).join('');select.value=current||'';}
  function populateFilters() {
    const fields=unique(state.journals.flatMap((j)=>j.fields)).sort((a,b)=>fieldName(a).localeCompare(fieldName(b),'zh-CN'));
    fillSelect('filter-field',fields.map((f)=>[f,fieldName(f)]),state.filters.field);
    const countries=unique(state.journals.map((j)=>j.country)).sort((a,b)=>countryName(a).localeCompare(countryName(b),'zh-CN'));
    fillSelect('filter-country',countries.map((c)=>[c,countryName(c)]),state.filters.country);
    const years=unique([...state.journals.flatMap((j)=>Object.keys(j.jifByYear||{}).concat(j.jifYear?String(j.jifYear):[])),...state.local.metrics.filter((m)=>m.system==='JCR'&&m.impact_factor!==null).map((m)=>String(m.year))]).sort((a,b)=>Number(b)-Number(a));
    fillSelect('filter-year',years.map((y)=>[y,`${y} 指标年份`]),state.filters.year);
    const hasCAS=state.journals.some((j)=>validNumber(j.casZone)||j.casByCategory)||state.local.metrics.some((m)=>m.system==='CAS');
    const hasSJR=state.local.metrics.some((m)=>m.system==='SJR');
    $('filter-system').innerHTML='<option value="JCR">JCR 分区</option>'+(hasCAS?'<option value="CAS">中科院2025参考分区</option>':'')+(hasSJR?'<option value="SJR">SJR（个人导入）</option>':'');
    if(![...$('filter-system').options].some((o)=>o.value===state.filters.system))state.filters.system='JCR';
    $('filter-system').value=state.filters.system;
    populateCategories();syncFilterControls();populateMatchControls();
  }
  function populateCategories() {
    const system=state.filters.system, categories=new Set();
    state.journals.forEach((j)=>{if(system==='JCR'){Object.keys(j.jcrByCategory||{}).forEach((c)=>categories.add(c));asArray(j.jcrCategories).forEach((c)=>categories.add(c));}else if(system==='CAS'){Object.keys(j.casByCategory||{}).forEach((c)=>categories.add(c));if(j.casMajorCategory||j.casCategory)categories.add(j.casMajorCategory||j.casCategory);}});
    state.local.metrics.filter((m)=>m.system===system).forEach((m)=>{if(m.category)categories.add(m.category);});
    fillSelect('filter-category',[...categories].sort((a,b)=>a.localeCompare(b)).map((c)=>[c,c]),state.filters.category);
    $('filter-quartile').innerHTML='<option value="">全部分区</option>'+[1,2,3,4].map((n)=>`<option value="Q${n}">${system==='CAS'?n+'区':'Q'+n}</option>`).join('');
    $('filter-quartile').value=state.filters.quartile;
  }
  const FILTER_IDS={field:'filter-field',database:'filter-database',system:'filter-system',quartile:'filter-quartile',category:'filter-category',year:'filter-year',min:'filter-min',max:'filter-max',oa:'filter-oa',country:'filter-country',publisher:'filter-publisher',review:'filter-review',reviewStage:'filter-review-stage',curated:'filter-curated',saved:'filter-saved',sort:'sort-by'};
  function syncFilterControls() {$('search-input').value=state.filters.q;Object.entries(FILTER_IDS).forEach(([key,id])=>{const element=$(id);if(!element)return;if(element.type==='checkbox')element.checked=state.filters[key];else element.value=state.filters[key];});}
  function resetFilters() {state.candidateScope=null;state.filters={...DEFAULT_FILTERS};state.page=1;populateCategories();syncFilterControls();computeResults();}
  function updateFilter(key,value) {state.filters[key]=value;state.page=1;if(key==='system'){state.filters.category='';state.filters.quartile='';populateCategories();}computeResults();}
  function savedCount() {return Object.entries(state.local.records).filter(([id,r])=>r.saved&&state.byId.has(id)).length;}
  function renderSavedCount() {$('saved-count').textContent=fmt(savedCount());}
  function setView(view, updateHash=true) {
    if(!['catalog','matcher','shortlist','methods'].includes(view))view='catalog';state.view=view;
    ['catalog','matcher','shortlist','methods'].forEach((name)=>{$('view-'+name).hidden=name!==view;$('tab-'+name).setAttribute('aria-selected',String(name===view));$('tab-'+name).tabIndex=name===view?0:-1;});
    if(view==='shortlist')renderShortlist();
    if(updateHash)history.replaceState(null,'',location.pathname+location.search+(view==='catalog'?'#catalog':'#'+view));
  }
  function scrollToElement(element) {
    if(element)element.scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  }
  function navigateToView(view) {
    setView(view);$('view-'+state.view).focus({preventScroll:true});scrollToElement(document.querySelector('.workspace-tabs'));
  }
  const MATCH_FILTER_IDS={field:'match-field',database:'match-database',system:'match-system',quartile:'match-quartile',oa:'match-oa',min:'match-min',max:'match-max',reviewStage:'match-review-stage',review:'match-review'};
  const MATCH_EXAMPLES={
    microbiome:{title:'肠道微生物组与抑郁症脑功能网络的关联',abstract:'结合宏基因组测序与静息态功能磁共振，研究肠道微生物群落及代谢功能与抑郁症、认知表现和脑网络之间的关系，并在独立人群中检验结果。',keywords:'gut microbiome, depression, functional brain networks'},
    ai:{title:'Interpretable machine learning for clinical risk prediction',abstract:'We develop interpretable machine learning methods for early disease risk prediction using longitudinal electronic health records. External validation and uncertainty estimation assess model generalization across hospitals.',keywords:'machine learning, medical informatics, clinical prediction'},
    materials:{title:'可降解导电水凝胶用于神经组织修复',abstract:'设计具有导电性与可降解性的水凝胶生物材料，研究其力学性能、电学性质和细胞相容性，并评价材料在组织工程与神经再生中的应用。',keywords:'hydrogel, biomaterials, tissue engineering, nerve regeneration'},
    social:{title:'Housing affordability and social inequality in urban communities',abstract:'This study examines how housing costs and neighborhood change affect social inequality and residential mobility. Longitudinal survey data and urban policy analysis are used to compare communities.',keywords:'housing, urban sociology, social inequality'}
  };
  function populateMatchControls() {
    if(!$('match-field'))return;
    const field=$('match-field').value;
    const fields=unique(state.journals.flatMap((j)=>j.fields)).sort((a,b)=>fieldName(a).localeCompare(fieldName(b),'zh-CN'));
    fillSelect('match-field',fields.map((f)=>[f,fieldName(f)]),field);
    updateMatchQuartileLabels();
  }
  function updateMatchQuartileLabels() {
    if(!$('match-system'))return;
    const value=$('match-quartile').value,system=$('match-system').value;
    $('match-quartile').innerHTML='<option value="">不限分区</option>'+[1,2,3,4].map((n)=>`<option value="Q${n}">${system==='CAS'?n+'区':'Q'+n}</option>`).join('');
    $('match-quartile').value=value;
  }
  function matchInputs() {return {title:$('match-title').value.trim().slice(0,500),abstract:$('match-abstract').value.trim().slice(0,12000),keywords:$('match-keywords').value.trim().slice(0,500)};}
  function matchInputKey(input) {return JSON.stringify([input.title,input.abstract,input.keywords]);}
  function matchPreferences() {
    const f={...DEFAULT_FILTERS};Object.entries(MATCH_FILTER_IDS).forEach(([key,id])=>{f[key]=$(id)?.value||DEFAULT_FILTERS[key];});
    const requested=Number($('match-limit')?.value||5);
    return {filters:sanitizeFilters(f),fee:$('match-fee')?.value||'',sort:$('match-sort')?.value||'relevance',limit:[3,5,10].includes(requested)?requested:5,identity:$('match-identity')?.checked!==false};
  }
  function matchPreferenceError(p) {
    const f=p.filters;
    if([f.min,f.max].some((v)=>v!==''&&(!validNumber(v)||Number(v)<0)))return '影响因子范围请填写大于或等于 0 的数值。';
    if(f.min!==''&&f.max!==''&&Number(f.min)>Number(f.max))return '最低影响因子大于最高影响因子，请调整范围。';
    return '';
  }
  function matchStatus(message,kind='idle') {$('match-status').textContent=message;$('match-status').dataset.state=kind;}
  function setMatchBusy(busy) {
    matchState.busy=busy;$('match-submit').disabled=busy;$('match-submit').textContent=busy?'正在筛选…':'筛选推荐期刊';
    $('match-results').setAttribute('aria-busy',String(busy));
    $('match-actions').hidden=busy||!matchState.filtered.length;
  }
  function updateMatchCounts() {
    if($('match-title-count'))$('match-title-count').textContent=`${$('match-title').value.length} / 500`;
    if($('match-abstract-count'))$('match-abstract-count').textContent=`${$('match-abstract').value.length} / 12,000`;
  }
  function matchEmpty(title,copy,action='') {return `<div class="match-empty"><span class="match-empty-mark" aria-hidden="true">⌕</span><h3>${esc(title)}</h3><p>${esc(copy)}</p>${action}</div>`;}
  function invalidateMatch(message='稿件内容已更新，点击“筛选推荐期刊”重新计算。') {
    matchState.token++;matchState.renderToken++;matchState.pending=false;matchState.analysis=null;matchState.excluded.clear();matchState.required.clear();matchState.ranked=[];matchState.screened=[];matchState.eligible=[];matchState.filtered=[];matchState.screening=null;matchState.hasRun=false;matchState.inputKey='';setMatchBusy(false);
    $('match-analysis').innerHTML='';$('match-summary').innerHTML='';$('match-actions').hidden=true;
    $('match-results').innerHTML=matchEmpty('筛出少量值得核对的期刊','输入研究对象、核心问题与方法。默认精选 5 本；证据不足时会少给或不给，不为凑数放宽条件。');
    matchStatus(message);updateMatchCounts();
  }
  function renderMatchAnalysis() {
    const analysis=matchState.analysis;if(!analysis){$('match-analysis').innerHTML='';return;}
    const terms=asArray(analysis.terms),active=terms.filter((t)=>!matchState.excluded.has(t.id));
    const core=asArray(matchState.screening?.coreTerms).filter((t)=>!matchState.excluded.has(t.id)),coreIds=new Set(core.map((t)=>t.id)),additional=active.filter((t)=>!coreIds.has(t.id));
    const focused=document.activeElement,focusedTerm=focused?.dataset?.matchTerm,focusedRequired=focused?.dataset?.matchRequired,focusedAll=Boolean(focused?.getAttribute?.('data-match-enable-all')!==null&&focused?.getAttribute?.('data-match-enable-all')!==undefined);
    const requiredOption=(term)=>`<label class="match-required-option"><input type="checkbox" data-match-required="${esc(term.id)}" ${matchState.required.has(term.id)?'checked':''}><span>${esc(term.label)}</span></label>`;
    const additionalHTML=additional.length?`<details class="match-required-extra" ${additional.some((t)=>matchState.required.has(t.id)||t.id===focusedRequired)?'open':''}><summary>其他已识别主题也可设为必含（${additional.length}）</summary><p>未识别或未有直接证据的细节，不会被宽泛学科词替代。</p><div class="match-required-options">${additional.map(requiredOption).join('')}</div></details>`:'';
    $('match-analysis').innerHTML=`<div class="match-analysis-head"><div><h3>确认研究主题</h3><p>点击排除识别不准的词；筛选会优先检查具体研究方向，宽泛学科词不能单独形成推荐。</p></div><button class="text-button" type="button" data-match-enable-all>全部启用</button></div><div class="match-topic-list">${terms.map((term)=>`<button class="match-topic-chip" type="button" data-match-term="${esc(term.id)}" aria-pressed="${!matchState.excluded.has(term.id)}" title="${matchState.excluded.has(term.id)?'启用':'排除'}主题：${esc(term.label)}"><span>${esc(term.label)}</span><span aria-hidden="true">${matchState.excluded.has(term.id)?'+':'✓'}</span></button>`).join('')}</div>${active.length?`<fieldset class="match-required"><legend>必须匹配的主题 <span>可多选</span></legend><p>勾选后，每本候选都必须有这些方向的直接文字证据。交叉方向没有同时命中时，会返回空结果。</p><div class="match-required-options">${core.map(requiredOption).join('')}</div>${additionalHTML}</fieldset>`:''}${asArray(analysis.warnings).length?`<p class="match-analysis-note">${analysis.warnings.map(esc).join(' ')}</p>`:''}`;
    const selector=focusedRequired?'[data-match-required]':focusedTerm?'[data-match-term]':'';
    if(selector){const replacement=[...$('match-analysis').querySelectorAll(selector)].find((button)=>(focusedRequired?button.dataset.matchRequired:button.dataset.matchTerm)===(focusedRequired||focusedTerm));replacement?.focus({preventScroll:true});}
    else if(focusedAll)$('match-analysis').querySelector('[data-match-enable-all]')?.focus({preventScroll:true});
  }
  async function ensureMatchIndex() {
    if(matchState.index&&matchState.indexRows===state.journals)return matchState.index;
    if(matchState.indexPromise&&matchState.indexRows===state.journals)return matchState.indexPromise;
    const engine=globalThis.JournalMatcher;if(!engine)throw new Error('匹配组件未载入，请刷新页面后重试');
    const rows=state.journals;matchState.indexRows=rows;
    matchState.indexPromise=engine.createIndex(rows,{onProgress:({processed,total})=>{if(matchState.busy)matchStatus(`正在准备本地主题索引：${fmt(processed)} / ${fmt(total)}。稿件内容留在当前页面。`,'loading');}}).then((index)=>{if(matchState.indexRows===rows)matchState.index=index;return index;}).catch((error)=>{if(matchState.indexRows===rows){matchState.indexPromise=null;matchState.index=null;}throw error;});
    return matchState.indexPromise;
  }
  async function runMatcher(reanalyze=true) {
    const input=matchInputs();
    if(!input.title&&!input.abstract&&!input.keywords){invalidateMatch('请先填写论文标题、一段摘要或研究关键词。');$('match-title').focus();return;}
    const preference=matchPreferences(),error=matchPreferenceError(preference);
    if(error){matchState.filtered=[];$('match-actions').hidden=true;$('match-summary').innerHTML='';$('match-results').innerHTML=matchEmpty('请调整筛选范围',error);matchStatus(error,'error');return;}
    if(!state.ready){matchState.pending=true;matchStatus('完整期刊目录正在载入，载入后会自动开始筛选。','loading');return;}
    if(!globalThis.JournalMatcher?.screen){matchStatus('筛选组件未载入，请刷新页面后重试。','error');return;}
    const token=++matchState.token;matchState.renderToken++;matchState.pending=false;const key=matchInputKey(input);
    if(reanalyze||!matchState.analysis||key!==matchState.inputKey){matchState.analysis=globalThis.JournalMatcher.analyze(input);matchState.excluded.clear();matchState.required.clear();matchState.screening=null;matchState.inputKey=key;}
    renderMatchAnalysis();
    if(!asArray(matchState.analysis.terms).length){matchState.ranked=[];matchState.screened=[];matchState.eligible=[];matchState.filtered=[];matchState.hasRun=true;setMatchBusy(false);renderMatchResults();matchStatus('暂未识别到具体研究主题，请补充研究对象、领域或方法名称。','empty');return;}
    setMatchBusy(true);matchStatus('正在检查核心主题、排除弱关联，并核对投稿条件…','loading');
    try {
      const [index]=await Promise.all([ensureMatchIndex(),ensureSubmissionReadiness().catch((err)=>{if(matchPreferences().identity)throw err;})]);if(token!==matchState.token)return;
      await new Promise((resolve)=>setTimeout(resolve,0));if(token!==matchState.token)return;
      const ranked=globalThis.JournalMatcher.rank(index,matchState.analysis,{excludedTermIds:[...matchState.excluded],limit:0});
      const screening=globalThis.JournalMatcher.screen(index,matchState.analysis,{excludedTermIds:[...matchState.excluded],requiredTermIds:[...matchState.required],ranked});
      if(token!==matchState.token)return;
      matchState.ranked=ranked;matchState.screening=screening;matchState.screened=screening.candidates;matchState.hasRun=true;renderMatchAnalysis();applyMatchPreferences();
    }catch(error){if(token===matchState.token){matchState.hasRun=false;matchState.ranked=[];matchState.screened=[];matchState.eligible=[];matchState.filtered=[];$('match-actions').hidden=true;$('match-summary').innerHTML='';$('match-results').innerHTML=matchEmpty('筛选暂时未完成','你填写的内容仍在当前页面，可以再次尝试。');matchStatus(error.message||'筛选暂时未完成，请重试。','error');}}
    finally{if(token===matchState.token)setMatchBusy(false);}
  }
  function applyMatchPreferences() {
    if(!matchState.hasRun)return;
    const p=matchPreferences(),error=matchPreferenceError(p);matchState.preferences=p;
    if(error||p.identity&&submissionReadiness.status!=='ready'){
      const message=error||'官网入口资料尚未准备好，请重新点击筛选。';matchState.filtered=[];matchState.eligible=[];matchState.renderToken++;$('match-actions').hidden=true;$('match-summary').innerHTML='';$('match-results').innerHTML=matchEmpty('请调整或重新筛选',message);matchStatus(message,'error');return;
    }
    matchState.identityRejected=0;matchState.preferenceRejected=0;
    matchState.eligible=matchState.screened.filter((row)=>{
      const j=state.byId.get(row.id);if(!j)return false;
      if(p.identity&&!hasSubmissionIdentity(j)){matchState.identityRejected++;return false;}
      const passes=filterMatches(j,p.filters,[])&&!(p.fee==='free'&&!(j.hasDOAJProfile===true&&j.apcCharged===false))&&!(p.fee==='paid'&&!(j.hasDOAJProfile===true&&j.apcCharged===true));
      if(!passes)matchState.preferenceRejected++;return passes;
    });
    // Screen and enforce every hard condition before selecting the shortlist.
    // Sorting changes the order inside that shortlist, not topic eligibility.
    matchState.filtered=matchState.eligible.slice(0,p.limit);matchState.shown=p.limit;
    const rankOrder=new Map(matchState.screened.map((row,i)=>[row.id,i])),tie=(a,b)=>rankOrder.get(a.id)-rankOrder.get(b.id);
    if(p.sort==='jif-desc')matchState.filtered.sort((a,b)=>(jifInfo(state.byId.get(b.id),'')?.value??-1)-(jifInfo(state.byId.get(a.id),'')?.value??-1)||tie(a,b));
    else if(p.sort==='review-asc')matchState.filtered.sort((a,b)=>(reviewInfo(state.byId.get(a.id),p.filters.reviewStage)?.days??Infinity)-(reviewInfo(state.byId.get(b.id),p.filters.reviewStage)?.days??Infinity)||tie(a,b));
    renderMatchResults();
    matchStatus(matchState.filtered.length?`本次精选 ${fmt(matchState.filtered.length)} 本。已执行主题门槛与全部所选条件；不足 ${p.limit} 本时不补入弱关联。`:matchState.screened.length?'没有期刊同时通过入口资料与所选条件。请按需要主动调整；系统没有放宽条件。':'没有期刊通过当前主题证据门槛。请补充研究对象，或检查“必须匹配的主题”是否过严。',matchState.filtered.length?'success':'empty');
  }
  function matchPreferenceLabels(p) {
    const f=p.filters;return [p.identity?'有出版方、ISSN 与官网记录':'',f.field?fieldName(f.field):'',f.database,f.quartile?`${f.system==='CAS'?'中科院2025参考':f.system} ${f.system==='CAS'?f.quartile.slice(1)+'区':f.quartile}`:'',f.min!==''?'JIF ≥ '+f.min:'',f.max!==''?'JIF ≤ '+f.max:'',f.oa==='yes'?'标记全 OA':f.oa==='no'?'未标记全 OA':'',f.review?reviewLabel(f.reviewStage)+' ≤ '+f.review+' 天':'',p.fee==='free'?'DOAJ 标明不收 APC':p.fee==='paid'?'DOAJ 标明收取 APC':''].filter(Boolean);
  }
  function matchingFee(journal) {return journal.hasDOAJProfile&&journal.apcCharged===false?'DOAJ 标明不收 APC':journal.hasDOAJProfile&&journal.apcCharged===true?'DOAJ 标明收取 APC':'APC 状态未收录';}
  function matchReviewHTML(journal,stage) {
    const review=reviewInfo(journal,stage),peer=reviewInfo(journal,'peer');
    const alternate=!review&&stage==='first'&&peer?'另有外审后 '+fmt(peer.days)+' 天':'';
    return `<span class="metric-label">${esc(stage==='first'?'整体首次决定':reviewLabel(stage))}</span><span class="metric-value small${review?'':' missing'}">${review?fmt(review.days)+' 天':'本站未收录'}</span>${review?.source?`<small>${esc(reviewStatistic(review))} · ${esc(review.period||review.year||'统计期未注明')}</small>${link(review.source,review.evidenceMethod==='publisher_page_public_search_excerpt'?'出版方检索摘要 ↗':'时间来源 ↗')}${review.evidenceMethod==='publisher_page_public_search_excerpt'?`<small>来自公开检索摘录${review.sourceIndexedAt?' · 索引标注 '+esc(review.sourceIndexedAt):''}，请在官网复核</small>`:''}`:alternate?`<small>${esc(alternate)}</small>`:''}<button type="button" class="text-button review-detail-link" data-action="review" data-id="${esc(journal.id)}">所有阶段与来源 ↗</button>`;
  }
  function matchLinksHTML(journal,loaded=false,failed=false) {
    const homepage=safeURL(journal.homepage),guidelines=safeURL(journal.authorGuidelines||journal.authorGuidelinesURL||journal.doaj?.authorInstructionsUrl),submission=safeURL(journal.submissionURL||journal.submissionUrl),scope=safeURL(journal.doaj?.aimsScopeUrl||journal.scopeSource);
    return `<div class="match-link-row">${homepage?link(homepage,'期刊官网 ↗','secondary-button'):loaded?'<span class="match-link-missing">本站未收录可打开的官网地址</span>':`<button type="button" class="secondary-button" data-action="detail" data-id="${esc(journal.id)}">${failed?'重试读取官网入口':'查看官网入口'} ↗</button>`}${guidelines?link(guidelines,'作者指南 ↗'):''}${scope?link(scope,'征稿范围 ↗'):''}${submission?link(submission,'投稿入口 ↗'):''}</div><small>${loaded?'请在官网核对刊名、ISSN、征稿范围与当前投稿要求。':failed?'详情暂未读取，已保留当前候选。':'正在读取这本期刊的官网与来源资料…'}</small>${asArray(journal.publisherMetricNotes).map((note)=>`<p class="match-publisher-note">${esc(note.text)} ${link(note.source)}</p>`).join('')}`;
  }
  async function hydrateMatchEvidence(rows,renderToken) {
    await Promise.allSettled(rows.map(async(row)=>{
      try {
        const detail=await getDetail(row.id);if(renderToken!==matchState.renderToken)return;
        const target=$('match-links-'+row.id),reviewTarget=$('match-review-'+row.id);
        if(target)target.innerHTML=matchLinksHTML(detail,true);
        if(reviewTarget)reviewTarget.innerHTML=matchReviewHTML(detail,(matchState.preferences||matchPreferences()).filters.reviewStage);
      }catch(error){if(renderToken!==matchState.renderToken)return;const target=$('match-links-'+row.id);if(target)target.innerHTML=matchLinksHTML(state.byId.get(row.id),false,true);}
    }));
  }
  function matchCardHTML(row,position) {
    const j=state.byId.get(row.id),detail=detailCache.get(row.id),p=matchState.preferences||matchPreferences(),f=p.filters,metric=jifDisplayInfo(j,''),volume=volumeInfo(j),screening=row.screening||{};
    const qs=unique(quartileEntries(j,f.system).map((q)=>q.quartile)).sort(),qTitle=f.system==='CAS'?'中科院2025参考':f.system==='SJR'?'SJR / 个人导入':'JCR 已收录分区';
    const qText=qs.length?qs.map((q)=>f.system==='CAS'?q.slice(1)+'区':q).join(' / '):'未收录';
    const terms=unique(asArray(screening.matchedCoreTerms).map((t)=>t.label)).slice(0,6),missing=asArray(screening.missingCoreTerms),topics=unique(asArray(row.matchedTopics)).slice(0,3);
    const reason=screening.reason||'已通过核心主题与独立证据检查';
    return `<article class="match-card"><div class="match-card-head"><span class="match-rank" aria-label="第 ${position} 项">${String(position).padStart(2,'0')}</span><div class="match-card-title"><p class="match-publisher">${esc(j.publisher||'出版方未标明')} · ${esc(countryName(j.country))}</p><h3><button class="journal-title-button" type="button" data-action="detail" data-id="${esc(j.id)}">${esc(j.name)}</button></h3><p class="issn-line">ISSN ${esc(j.issnL||'未标明')} · ${esc(j.fields.slice(0,2).map(fieldName).join(' / '))}</p></div><span class="match-fit-label">通过主题初筛</span>${favoriteButton(j)}</div><div class="match-selection-reason"><strong>为什么保留</strong><p>${esc(reason)}</p></div><div class="match-reasons"><span class="match-reasons-label">核心证据</span>${terms.map((t)=>tag(t,'teal')).join('')}${shortIndexTags(j)}</div><p class="match-evidence">${topics.length?'命中的期刊主题：'+esc(topics.join('；')):'直接文字证据来自已收录刊名；请继续核对官网征稿范围。'}</p>${missing.length?`<p class="match-missing-evidence"><strong>还需确认：</strong>现有资料未直接覆盖 ${esc(missing.map((t)=>t.label||t).join('、'))}。这些方向若不可缺少，请在上方设为必须匹配。</p>`:''}<div class="match-card-metrics">${metricHTML('影响因子 JIF',metric?metric.text:'未收录',metric?metric.year:'',!metric)}${metricHTML(qTitle,qText,'',!qs.length,true)}<div id="match-review-${esc(j.id)}" class="match-review-metric">${matchReviewHTML(detail||j,f.reviewStage)}</div>${metricHTML('费用资料',matchingFee(j),'',!j.hasDOAJProfile,true)}</div><div id="match-links-${esc(j.id)}" class="match-entry-links">${matchLinksHTML(detail||j,Boolean(detail))}</div><details class="match-explanation"><summary>展开完整文字证据与核对事项</summary><ul>${asArray(row.reasons).slice(0,6).map((reason)=>`<li>${esc(reason)}</li>`).join('')}<li>本次文字检索分 ${Number(row.score||0).toFixed(1)}，仅作内部检索排序参考，不表示适配概率、录用概率或期刊质量。</li><li>当前初筛使用刊名、期刊主题和分区学科；主题标签不等同于完整 Aims &amp; Scope，未据此判断稿件创新性或文章类型是否被接受。</li>${qs.length?`<li>${esc(qTitle)}分学科记录；当前分区条件须满足其中至少一条，详情保留对应年份和学科。</li>`:''}${metric?.personal?'<li>当前 JIF 来自个人导入，保留独立来源标识。</li>':''}${j.hasDOAJProfile?`<li>APC 状态来自 DOAJ${j.doajUpdatedAt?'，记录更新 '+esc(dateOnly(j.doajUpdatedAt)):''}；不收 APC 仍可能存在其他费用。</li>`:''}${volume?`<li>${volume.year} 年 OpenAlex 收录 ${fmt(volume.count)} 条文献，不等于收到的投稿量。</li>`:''}</ul></details><div class="match-card-actions">${compareCheck(j)}<button type="button" class="text-button" data-action="detail" data-id="${esc(j.id)}">完整期刊档案 ↗</button></div></article>`;
  }
  function screeningReportHTML() {
    const d=matchState.screening?.diagnostics;if(!d)return '';
    const labels={broadOnly:'只有宽泛学科词',insufficientEvidence:'缺少独立的直接证据',missingCore:'未覆盖关键研究方向',missingRequired:'未命中你指定的必含主题',scopeMismatch:'研究对象或语境不一致',publicationType:'刊名提示刊物或文章类型需核对',belowThreshold:'证据强度不足'};
    const rejected=Object.entries(d.counts||{}).filter(([,count])=>count>0);
    return `<details class="match-screening-report"><summary>查看筛选过程与淘汰依据</summary><p>文字初检 ${fmt(d.retrieved??matchState.ranked.length)} 条 → 主题门槛保留 ${fmt(matchState.screened.length)} 条 → 入口资料和投稿条件保留 ${fmt(matchState.eligible.length)} 条 → 本次精选 ${fmt(matchState.filtered.length)} 本。</p>${rejected.length?`<ul>${rejected.map(([key,count])=>`<li>${esc(labels[key]||key)}：${fmt(count)} 条</li>`).join('')}${matchState.identityRejected?`<li>缺出版方、有效 ISSN 或官网记录：${fmt(matchState.identityRejected)} 条</li>`:''}${matchState.preferenceRejected?`<li>不满足所选投稿条件或指标未收录：${fmt(matchState.preferenceRejected)} 条</li>`:''}</ul>`:''}${asArray(matchState.screening.warnings).map((warning)=>`<p>${esc(warning)}</p>`).join('')}<p>未进入清单不等于不能投稿；它只表示当前资料不足以通过本次筛选。你可以在全目录按刊名或 ISSN 单独核对。</p></details>`;
  }
  function renderMatchResults() {
    const rows=matchState.filtered,p=matchState.preferences||matchPreferences(),labels=matchPreferenceLabels(p),terms=asArray(matchState.analysis?.terms).filter((t)=>!matchState.excluded.has(t.id)),renderToken=++matchState.renderToken;
    $('match-summary').innerHTML=matchState.hasRun?`<div class="match-summary-card"><div><span class="eyebrow">SCREENED SHORTLIST</span><h3>${rows.length?'已精选 '+fmt(rows.length)+' 本':'本次没有合格候选'}</h3><p>主题证据与投稿条件同时通过 · 最多 ${p.limit} 本 · 不足不凑数</p></div><div class="match-filter-summary">${labels.map((label)=>tag(label)).join('')}</div></div>${screeningReportHTML()}`:'';
    $('match-actions').hidden=!rows.length||matchState.busy;
    if(!rows.length){
      const excludedAll=matchState.analysis?.terms?.length&&!terms.length,missingSJR=p.filters.system==='SJR'&&p.filters.quartile&&!state.local.metrics.some((m)=>m.system==='SJR');
      const warning=asArray(matchState.screening?.warnings).join(' ');
      $('match-results').innerHTML=matchEmpty(excludedAll?'请至少启用一个主题':missingSJR?'尚未导入可用的 SJR 分区':matchState.screened.length?'没有期刊同时满足当前条件':'现有证据不足，暂不推荐',excludedAll?'点击上方主题标签重新启用，或点击“全部启用”。':missingSJR?'SJR 使用当前浏览器中个人导入的记录。可先导入有权使用的指标，或主动选择其他分区条件。':matchState.screened.length?'入口资料、收录、分区、JIF、费用与时间条件同时生效。缺少所选指标的记录不会通过筛选。':warning||'请补充具体研究对象、核心问题与方法。若指定了多个必须匹配的主题，需要同一本期刊同时有直接文字证据；系统不会自动降低要求。',missingSJR?'<button class="secondary-button" type="button" data-view="methods">查看个人指标导入说明</button>':matchState.screened.length?'<button class="secondary-button" type="button" data-match-reset-prefs>重置选刊条件</button>':'');return;
    }
    $('match-results').innerHTML=`<div class="match-result-list">${rows.map((row,i)=>matchCardHTML(row,i+1)).join('')}</div><p class="match-result-footnote">本次清单共 ${fmt(rows.length)} 本，导出与继续筛选均使用这份清单。需要更多候选，可主动将数量调至最多 10 本；筛选门槛保持不变。</p>`;
    hydrateMatchEvidence(rows,renderToken);
  }
  function resetMatchPreferences() {Object.entries(MATCH_FILTER_IDS).forEach(([key,id])=>{if($(id))$(id).value=DEFAULT_FILTERS[key];});$('match-fee').value='';$('match-limit').value='5';$('match-identity').checked=true;if($('match-sort'))$('match-sort').value='relevance';updateMatchQuartileLabels();applyMatchPreferences();}
  function useManuscriptForMatch() {
    const title=$('manuscript-title').value.trim(),keywords=$('manuscript-keywords').value.trim();
    if(!title&&!keywords){setView('matcher');toast('投稿清单尚未填写稿件名称或关键词，可以直接在这里输入。');$('match-title').focus();return;}
    $('match-title').value=title;$('match-keywords').value=keywords;$('match-abstract').value='';invalidateMatch('已带入投稿清单中的稿件名称和关键词，可以补充摘要后匹配。');setView('matcher');$('match-title').focus();
  }
  function matchToCatalog() {
    if(matchState.busy||!matchState.hasRun){toast('请等待当前匹配完成。');return;}
    if(!matchState.filtered.length){toast('当前没有可继续筛选的候选。');return;}
    state.candidateScope={ids:new Set(matchState.filtered.map((row)=>row.id)),createdAt:new Date().toISOString()};state.filters={...DEFAULT_FILTERS,...matchPreferences().filters,q:'',sort:'recommended'};state.page=1;populateCategories();syncFilterControls();computeResults();navigateToView('catalog');
    toast(`已限定为当前 ${fmt(state.candidateScope.ids.size)} 本候选，可继续筛选；候选范围只保留在本次会话。`);
  }
  function exportMatchResults() {
    if(matchState.busy||!matchState.hasRun){toast('请等待当前匹配完成。');return;}
    if(!matchState.filtered.length){toast('暂无匹配结果可以导出。');return;}
    const p=matchState.preferences||matchPreferences(),headers=['候选顺序','期刊编号','期刊名称','ISSN','主题相关分_非录用概率','期刊已收录主题','已收录JCR学科','JIF','JIF年份','WoS收录','所选处理阶段','阶段天数','DOAJ_APC状态','筛选条件','期刊档案链接'];
    // Do not export manuscript text, extracted terms, or free-form explanations,
    // because an English extracted term can reproduce a distinctive title phrase.
    const rows=matchState.filtered.map((row,i)=>{const j=state.byId.get(row.id),metric=jifDisplayInfo(j,''),review=reviewInfo(j,p.filters.reviewStage),url=new URL(location.href);url.search='';url.hash='journal='+encodeURIComponent(j.id);return [i+1,j.id,j.name,j.issnL,row.score,asArray(j.topics).join('; '),asArray(j.jcrCategories).join('; '),metric?.exportValue??'',metric?.year??'',asArray(j.wosIndexes).join('; '),reviewLabel(p.filters.reviewStage),review?.days??'',matchingFee(j),matchPreferenceLabels(p).join('; '),url.href].map(csvCell).join(',');});
    download('\uFEFF'+[headers.map(csvCell).join(','),...rows].join('\r\n'),'journal-manuscript-candidates.csv','text/csv;charset=utf-8');toast(`已导出 ${fmt(rows.length)} 本候选，不含你的标题、摘要或提取词。`);
  }
  function bindMatchEvents() {
    $('matcher-form').addEventListener('submit',(event)=>{event.preventDefault();runMatcher();});
    ['match-title','match-abstract','match-keywords'].forEach((id)=>{$(id).addEventListener('input',()=>invalidateMatch());$(id).addEventListener('keydown',(event)=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();runMatcher();}});});
    Object.values(MATCH_FILTER_IDS).concat('match-fee','match-sort','match-limit','match-identity').forEach((id)=>{const el=$(id);if(el)el.addEventListener(el.tagName==='INPUT'?'input':'change',()=>{if(id==='match-system')updateMatchQuartileLabels();if(matchState.hasRun)applyMatchPreferences();});});
    $('match-clear').addEventListener('click',()=>{['match-title','match-abstract','match-keywords'].forEach((id)=>$(id).value='');invalidateMatch('已清空本次稿件文本，筛选偏好仍保留。');$('match-title').focus();});
    $('match-use-manuscript').addEventListener('click',useManuscriptForMatch);$('match-export').addEventListener('click',exportMatchResults);$('match-to-catalog').addEventListener('click',matchToCatalog);
    document.addEventListener('change',(event)=>{const id=event.target.dataset.matchRequired;if(id&&matchState.analysis){if(event.target.checked)matchState.required.add(id);else matchState.required.delete(id);runMatcher(false);}});
    document.addEventListener('click',(event)=>{
      const example=event.target.closest('[data-match-example]');if(example){const data=MATCH_EXAMPLES[example.dataset.matchExample];if(data){$('match-title').value=data.title;$('match-abstract').value=data.abstract;$('match-keywords').value=data.keywords;invalidateMatch('已填入公开演示用例，可根据你的研究修改。');runMatcher();}return;}
      const term=event.target.closest('[data-match-term]');if(term&&matchState.analysis){const id=term.dataset.matchTerm;if(matchState.excluded.has(id))matchState.excluded.delete(id);else {matchState.excluded.add(id);matchState.required.delete(id);}runMatcher(false);return;}
      if(event.target.closest('[data-match-enable-all]')){matchState.excluded.clear();runMatcher(false);return;}
      if(event.target.closest('[data-match-reset-prefs]')){resetMatchPreferences();return;}
      if(event.target.closest('[data-clear-scope]')){state.candidateScope=null;state.page=1;computeResults();toast('已清除稿件候选范围，当前筛选条件应用于全目录。');}
    });updateMatchCounts();
  }
  function renderStats() {
    const totals={total:state.journals.length,jif:state.journals.filter((j)=>validNumber(j.jifValue)||Object.keys(j.jifByYear||{}).length).length,quartile:state.journals.filter((j)=>asArray(j.jcrQuartiles).length||Object.keys(j.jcrByCategory||{}).length).length,curated:state.journals.filter((j)=>j.curated).length};
    Object.entries(totals).forEach(([key,value])=>{const el=document.querySelector(`[data-stat="${key}"]`);if(el)el.textContent=fmt(value);});
    const checked=dateOnly(state.meta.checkedAt||state.meta.retrievedAt||state.meta.generatedAt||state.meta.snapshotDate||state.meta.updatedAt||'2026-10-21');$('snapshot-date').textContent=checked;
    const isKnownField=(field)=>Boolean(field)&&!['Unclassified','Unknown'].includes(field);
    const fields=unique(state.journals.flatMap((j)=>j.fields).filter(isKnownField)),countries=unique(state.journals.map((j)=>j.country).filter(Boolean));
    const unclassified=state.journals.filter((j)=>!j.fields.some(isKnownField)).length,unknownCountry=state.journals.filter((j)=>!j.country).length;
    const review=state.journals.filter((j)=>validNumber(j.reviewDays)).length,annual=state.journals.filter((j)=>volumeInfo(j)).length;
    $('coverage-detail').innerHTML=`<div class="coverage-numbers"><div><strong>${fmt(totals.total)}</strong><span>期刊候选</span></div><div><strong>${fmt(fields.length)}</strong><span>已分类学科领域</span></div><div><strong>${fmt(countries.length)}</strong><span>已知出版国家 / 地区</span></div><div><strong>${fmt(totals.jif)}</strong><span>具有 JIF 记录</span></div><div><strong>${fmt(review)}</strong><span>首次决定时间记录</span></div><div><strong>${fmt(annual)}</strong><span>年度文献量记录</span></div></div><p>目录核验日期：${esc(checked)}。${esc(asText(state.meta.scope || state.meta.selectionCriteria || state.meta.description) || 'OpenAlex 中有 ISSN、近期有文献活动的期刊来源；详细入库规则保留在目录元数据中。')}</p><p>另有 ${fmt(unclassified)} 本期刊尚未分类，${fmt(unknownCountry)} 本未标明出版国家 / 地区；上述覆盖数不包含这些未知项。</p><p>缺失指标显示“未收录 / 未披露”，不按零处理。当前 ${TODAY_YEAR} 年尚未结束。${totals.quartile?`JCR 分区覆盖 ${fmt(totals.quartile)} 本候选。`:''}</p><p><a class="source-link" href="data/catalog-meta.json" target="_blank" rel="noopener noreferrer">下载目录元数据 ↗</a></p>`;
  }
  function toggleFavorite(id) {if(!state.byId.has(id))return;const record=recordFor(id);record.saved=!record.saved;record.updatedAt=new Date().toISOString();persist();renderSavedCount();document.querySelectorAll(`[data-action="favorite"][data-id="${id}"]`).forEach((button)=>{if(button.classList.contains('favorite-button')){button.textContent=record.saved?'★':'☆';button.setAttribute('aria-pressed',String(record.saved));button.setAttribute('aria-label',`${record.saved?'移出收藏':'收藏'}：${state.byId.get(id).name}`);}else{button.textContent=record.saved?'★ 已收藏':'☆ 收藏期刊';}});if(state.filters.saved||state.view==='shortlist'){if(state.view==='shortlist')renderShortlist();computeResults();}toast(storageFailed?'本次收藏状态已更新，但未能保存到浏览器；请导出个人备份。':record.saved?'已加入我的投稿清单':'已移出收藏；已有笔记仍保留在个人备份中');}
  function toggleCompare(id, checked) {if(!state.byId.has(id))return;const has=state.compare.includes(id);if(checked&&!has){if(state.compare.length>=4){toast('最多同时比较 4 本期刊，请先移除一本。');document.querySelectorAll(`[data-compare="${id}"]`).forEach((input)=>input.checked=false);return;}state.compare.push(id);}else if(!checked&&has)state.compare=state.compare.filter((x)=>x!==id);renderCompareTray();document.querySelectorAll(`[data-compare="${id}"]`).forEach((input)=>input.checked=state.compare.includes(id));}
  function renderCompareTray() {$('compare-tray').hidden=state.compare.length===0;document.body.classList.toggle('has-compare',state.compare.length>0);$('compare-count').textContent=`${state.compare.length} / 4`;$('compare-names').textContent=state.compare.map((id)=>state.byId.get(id)?.name||id).join(' · ');$('open-compare').disabled=state.compare.length<2;}
  function renderSavedSearches() {$('saved-searches').innerHTML=state.local.searches.map((s,i)=>`<div class="saved-search-row"><button type="button" data-load-search="${i}" title="${esc(s.name)}">${esc(s.name)}</button><button type="button" data-delete-search="${i}" aria-label="删除筛选方案 ${esc(s.name)}">×</button></div>`).join('');}
  function saveSearch() {const f=state.filters;const name=[f.q,fieldName(f.field),f.database,f.quartile?f.system+' '+f.quartile:'',f.min?'JIF ≥ '+f.min:'',f.saved?'收藏':''].filter(Boolean).join(' · ')||'全部期刊';if(state.local.searches.some((s)=>JSON.stringify(s.filters)===JSON.stringify(f))){toast('这组筛选已经保存。');return;}state.local.searches.unshift({name:name.slice(0,100),filters:{...f}});state.local.searches=state.local.searches.slice(0,12);persist();renderSavedSearches();toast(storageFailed?'筛选方案仅在本次会话生效，未能保存到浏览器；请导出个人备份。':state.candidateScope?'已保存常规筛选条件；不包含仅本次会话有效的稿件候选范围。':'已保存筛选条件，可在左侧再次打开。');}
  function stageOptions(value) {return Object.entries(STAGES).map(([id,label])=>`<option value="${id}" ${id===value?'selected':''}>${label}</option>`).join('');}
  function renderShortlist() {
    if(!state.ready){$('shortlist-content').innerHTML='<div class="loading-panel"><h3>正在读取期刊目录</h3><p>目录就绪后会自动匹配本地收藏。</p></div>';return;}
    const stage=$('shortlist-stage').value;
    const entries=state.journals.filter((j)=>isSaved(j.id)&&(!stage||recordFor(j.id).stage===stage));
    if(!entries.length){$('shortlist-content').innerHTML=`<div class="empty-panel"><h3>${savedCount()?'这个状态下还没有期刊':'为你的下一篇稿件，留下一份候选清单'}</h3><p>在期刊卡片上点一下 ☆，即可保存期刊。在这里记录研究契合点、稿件要求与下一步操作。</p><button class="primary-button" type="button" data-view="catalog">去探索期刊 ↗</button></div>`;return;}
    $('shortlist-content').innerHTML=entries.map((j)=>{const r=recordFor(j.id),metric=jifDisplayInfo(j,'');return `<article class="shortlist-item"><div class="shortlist-main"><h3><button class="journal-title-button" type="button" data-action="detail" data-id="${esc(j.id)}">${esc(j.name)}</button></h3><p class="issn-line">ISSN ${esc(j.issnL || '')} · ${esc(j.publisher || '')}</p><div class="field-tags">${j.fields.slice(0,3).map((f)=>tag(fieldName(f))).join('')}</div><div class="shortlist-meta"><span>JIF ${metric?esc(metric.text)+' ('+metric.year+')'+(metric.personal?' · 个人导入':''):'未收录'}</span><span>${unique(quartileEntries(j,'JCR').map((x)=>x.quartile)).sort().join(' / ') || 'JCR 分区未收录'}</span><span>${esc(reviewAvailability(j,'first'))}</span></div><div class="inline-actions">${compareCheck(j)}<button class="text-button" type="button" data-action="review" data-id="${esc(j.id)}">审稿周期与来源 ↗</button><button class="text-button" type="button" data-action="detail" data-id="${esc(j.id)}">完整档案 ↗</button><button class="text-button" type="button" data-action="favorite" data-id="${esc(j.id)}">移出收藏</button></div></div><div class="shortlist-notes"><label for="note-${esc(j.id)}">适配理由、稿件要求与下一步</label><textarea id="note-${esc(j.id)}" data-note="${esc(j.id)}" placeholder="例如：近期发表过相近主题；还需核对字数、数据开放要求及版面费用。" maxlength="12000">${esc(r.notes)}</textarea><div class="note-footer"><select data-stage="${esc(j.id)}" aria-label="${esc(j.name)} 投稿状态">${stageOptions(r.stage)}</select><small data-note-status="${esc(j.id)}">${r.updatedAt?'上次修改 '+esc(r.updatedAt.slice(0,10)):'输入后自动保存在本机'}</small></div></div></article>`;}).join('');
  }
  async function fetchJSON(path, options={}, progress=null) {
    const supportsCompressedData=typeof DecompressionStream==='function';
    if(supportsCompressedData) {
      try {
        const response=await fetch(path+'.gz',options);
        if(response.ok && response.body) {
          let stream=response.body;
          if(progress && typeof TransformStream==='function') {
            let bytes=0,last=0;
            stream=stream.pipeThrough(new TransformStream({transform(chunk,controller){bytes+=chunk.byteLength;if(bytes-last>180000){progress(bytes);last=bytes;}controller.enqueue(chunk);}}));
          }
          return await new Response(stream.pipeThrough(new DecompressionStream('gzip'))).json();
        }
      } catch(error) { if(error.name==='AbortError')throw error; }
    }
    // Uncompressed snapshots may exist in a development checkout. Public hosting
    // ships compressed data, so an older browser gets an explicit recovery step.
    const response=await fetch(path,options);
    if(!response.ok) {
      if(!supportsCompressedData)throw new Error('当前浏览器版本不支持本期刊库的数据读取，请更新 Chrome、Edge、Firefox 或 Safari 后重新打开');
      throw new Error('期刊数据暂时未能读取，请刷新页面或稍后重试（'+response.status+'）');
    }
    return response.json();
  }
  async function getDetail(id) {
    if(detailCache.has(id))return detailCache.get(id);
    const summary=state.byId.get(id);if(!summary)throw new Error('期刊不在当前目录中');
    if(!summary.detailShard){detailCache.set(id,{...summary});return {...summary};}
    const path=String(summary.detailShard);if(!/^(?:data\/)?details\/[A-Za-z0-9._-]+\.json$/.test(path))throw new Error('详情路径无效');
    const url=path.startsWith('data/')?path:'data/'+path;
    if(!shardPromises.has(url))shardPromises.set(url,fetchJSON(url).catch((error)=>{shardPromises.delete(url);throw error;}));
    const shard=await shardPromises.get(url), raw=Array.isArray(shard)?shard.find((j)=>j.id===id):shard[id]||shard.journals?.find?.((j)=>j.id===id)||shard.journals?.[id];
    if(!raw)throw new Error('当前详情分片未找到此期刊');
    const detail=mergeEditorialEvidence({...summary,...raw});detail.fields=asArray(detail.fields).map(asText).filter(Boolean);detailCache.set(id,detail);return detail;
  }
  function openDialog(id) {const dialog=$(id);if(!dialog.open)dialog.showModal();}
  function closeDialog(id) {$(id).close();if(id==='compare-dialog')state.compareToken++;if(id==='journal-dialog'){state.detailId=null;state.detailToken++;if(location.hash.startsWith('#journal='))history.replaceState(null,'',location.pathname+location.search+'#'+state.view);}}
  async function openDetail(id,updateHash=true,section='') {
    if(!state.byId.has(id)){toast('当前目录没有找到这个期刊编号。');return;}
    const token=++state.detailToken;state.detailId=id;const summary=state.byId.get(id);
    $('journal-detail').innerHTML=`<div class="detail-head"><h2 id="journal-dialog-title">${esc(summary.name)}</h2><p class="detail-small">正在读取带来源的完整档案…</p></div><div class="loading-panel"><span class="loading-ring"></span></div>`;
    openDialog('journal-dialog');$('journal-dialog').scrollTop=0;
    if(updateHash)history.pushState(null,'',location.pathname+location.search+'#journal='+encodeURIComponent(id));
    try {const detail=await getDetail(id);if(token!==state.detailToken)return;$('journal-detail').innerHTML=detailHTML(detail);if(section){const target=$(section);if(target){target.tabIndex=-1;target.focus({preventScroll:true});scrollToElement(target);}}}
    catch(error){if(token!==state.detailToken)return;$('journal-detail').innerHTML=`<div class="detail-head"><h2 id="journal-dialog-title">${esc(summary.name)}</h2><div class="empty-panel"><h3>详情暂时没有载入</h3><p>${esc(error.message)}。目录与已保存的个人记录仍可使用。</p><button class="secondary-button" data-action="detail" data-id="${esc(id)}">重试</button></div></div>`;}
  }
  function buildChart(points,kind,label) {
    const clean=points.filter((p)=>validNumber(p.value)&&Number(p.year)).map((p)=>({year:Number(p.year),value:Number(p.value)})).sort((a,b)=>a.year-b.year);
    if(!clean.length)return '<div class="empty-metric">暂无可绘制的公开数据。缺失年份不按零计入。</div>';
    const width=520,height=220,left=45,right=16,top=20,bottom=36,plotW=width-left-right,plotH=height-top-bottom;
    const minYear=Math.min(...clean.map((p)=>p.year)),maxYear=Math.max(...clean.map((p)=>p.year)),maxVal=Math.max(...clean.map((p)=>p.value),1)*1.1;
    const x=(year)=>left+(maxYear===minYear?plotW/2:(year-minYear)/(maxYear-minYear)*plotW),y=(value)=>top+plotH-value/maxVal*plotH;
    let svg=`<svg class="metric-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}。下方表格包含精确值。"><title>${esc(label)}</title>`;
    for(let i=0;i<=4;i++){const val=maxVal*i/4,yy=y(val);svg+=`<line class="chart-grid" x1="${left}" x2="${width-right}" y1="${yy}" y2="${yy}"/><text class="chart-axis-label" x="${left-8}" y="${yy+4}" text-anchor="end">${esc(val>=1000?fmt(Math.round(val)):Number(val.toFixed(1)))}</text>`;}
    const labelEvery=Math.max(1,Math.ceil((maxYear-minYear+1)/7));
    for(let year=minYear;year<=maxYear;year++){if((year-minYear)%labelEvery===0||year===maxYear)svg+=`<text class="chart-axis-label" x="${x(year)}" y="${height-11}" text-anchor="middle">${year}${year>=TODAY_YEAR?'*':''}</text>`;}
    if(kind==='bar'){const barWidth=Math.min(33,plotW/Math.max(maxYear-minYear+1,2)*.6);clean.forEach((p)=>{svg+=`<rect class="chart-bar${p.year>=TODAY_YEAR?' partial':''}" x="${x(p.year)-barWidth/2}" y="${y(p.value)}" width="${barWidth}" height="${top+plotH-y(p.value)}" rx="2"><title>${p.year}：${fmt(p.value)}${p.year>=TODAY_YEAR?'（未完整年度）':''}</title></rect>`;});}
    else {let d='',last=null;clean.forEach((p)=>{d+=(last===null||p.year-last>1?'M':'L')+x(p.year)+','+y(p.value)+' ';last=p.year;});svg+=`<path class="chart-line" d="${d}"/>`;clean.forEach((p)=>{svg+=`<circle class="chart-dot" cx="${x(p.year)}" cy="${y(p.value)}" r="3.6"><title>${p.year} JIF：${fmt(p.value)}</title></circle>`;});}
    return svg+'</svg>';
  }
  function jifPoints(detail) {
    const points=new Map();asArray(detail.jif).forEach((m)=>{if(Number(m.year)&&validNumber(m.value))points.set(Number(m.year),{...m,year:Number(m.year),value:Number(m.value),personal:false});});
    Object.entries(detail.jifByYear||{}).forEach(([year,value])=>{if(!points.has(Number(year))&&validNumber(value))points.set(Number(year),{year:Number(year),value:Number(value),source:detail.jifSource,personal:false});});
    if(validNumber(detail.jifValue)&&detail.jifYear&&!points.has(Number(detail.jifYear)))points.set(Number(detail.jifYear),{year:Number(detail.jifYear),value:Number(detail.jifValue),source:detail.jifSource,personal:false});
    return [...points.values()].sort((a,b)=>a.year-b.year);
  }
  function reviewGuideHTML(detail) {
    const hasFirst=Boolean(reviewInfo(detail,'first')),peer=reviewInfo(detail,'peer');
    const editorial=asArray(detail.review).find((r)=>['first_decision_without_review','submission_to_first_editorial_decision'].includes(r.stage)&&validNumber(r.days));
    return `<div class="review-stage-guide"><strong>先分清你要看的时间</strong><p>整体首次决定可能包含编辑初筛；外审后首次决定只统计经过外审的稿件；投稿至发表还包含修回、接收和出版过程。</p>${!hasFirst&&(peer||editorial)?`<p>本站未收录这本期刊的整体首次决定，但已收录${editorial?'编辑阶段 '+fmt(editorial.days)+' 天':''}${editorial&&peer?'、':''}${peer?'外审后首次决定 '+fmt(peer.days)+' 天':''}，分别列在下表，不互相代填。</p>`:''}<div class="source-links">${safeURL(detail.homepage)?link(detail.homepage,'到期刊官网查 Journal metrics / Insights ↗'):link(detail.source,'核对期刊身份资料 ↗')}</div></div>`;
  }
  function reviewTable(detail) {
    const rows=asArray(detail.review).filter((r)=>validNumber(r.days)||validNumber(r.value));
    if(!rows.length)return '<div class="empty-metric">本站尚未收录可核验的审稿周期，这不表示出版方没有披露。可从上方期刊官网进入 Journal metrics / Insights / About 页面查找。</div>';
    return `<div class="table-scroll"><table class="data-table"><thead><tr><th>处理阶段</th><th>时间</th><th>统计口径</th><th>统计期</th><th>来源</th></tr></thead><tbody>${rows.map((r)=>{const days=validNumber(r.days)?Number(r.days):Number(r.value);const stat={median:'中位数',mean:'平均值',average:'平均值',publisher_reported_average:'出版方在 DOAJ 申报的平均值'}[r.statistic]||r.statistic||'未注明';return `<tr><td>${esc(REVIEW_STAGES[r.stage]||r.label||r.stage||'来源所载周期')}</td><td class="table-number">${fmt(days)} 天${validNumber(r.weeks??r.originalWeeks)?`<div class="table-secondary">原值 ${fmt(r.weeks??r.originalWeeks)} 周</div>`:''}</td><td>${esc(stat)}</td><td>${esc(r.period||r.year||'未注明')}${r.recordUpdatedAt?`<div class="table-secondary">目录记录更新 ${esc(dateOnly(r.recordUpdatedAt))}</div>`:''}${r.checkedAt?`<div class="table-secondary">核验日期 ${esc(dateOnly(r.checkedAt))}</div>`:''}</td><td>${link(r.source)}${r.evidenceMethod==='publisher_page_public_search_excerpt'?`<div class="table-secondary">出版方公开检索摘录${r.sourceIndexedAt?' · 索引标注 '+esc(r.sourceIndexedAt):''}；页面全文未读取</div>`:''}</td></tr>`;}).join('')}</tbody></table></div><p class="metric-note">不同处理阶段和统计口径不能直接比较。首次决定可能包含编辑退稿；投稿至接收与发表的指标通常仅反映最终录用的稿件。过往数据不构成时间承诺。</p>`;
  }
  function disclosuresTable(detail) {
    const groups=[['投稿量（稿件）',detail.submissionCounts||detail.submissions],['独立投稿人数',detail.submitterCounts||detail.uniqueSubmittingAuthors||detail.authorCounts],['录用率',detail.acceptance],['出版方年度发文量',detail.publicationCounts]];
    const rows=[];
    groups.forEach(([label,raw])=>{asArray(raw).forEach((r)=>{const value=r.value??r.count??r.rate;if(validNumber(value))rows.push({...r,value:Number(value),label});});});
    if(!rows.length)return '<div class="empty-metric">未找到已核验的公开投稿量、独立投稿人数或录用率。年度文献量不用于反推投稿量或录用率；“没有数据”也不表示没有人投稿。</div>';
    return `<div class="table-scroll"><table class="data-table"><thead><tr><th>指标</th><th>数值</th><th>年份 / 统计期</th><th>对象 / 分母</th><th>来源</th></tr></thead><tbody>${rows.map((r)=>`<tr><td>${esc(r.label)}</td><td class="table-number">${fmt(r.value)}${['percent','%','percentage'].includes(r.unit)?'%':r.label.includes('人数')?' 人':r.label.includes('录用率')&&r.unit?esc(r.unit):' 篇'}</td><td>${esc(r.year||r.period||'未注明')}</td><td>${esc(r.definition||r.denominator||r.note||'来源未说明完整统计口径')}</td><td>${link(r.source)}</td></tr>`).join('')}</tbody></table></div><p class="metric-note">投稿量按稿件计，与独立作者人数不同。未列出的独立投稿人数或其他指标尚未披露 / 核验。期刊总体录用率不是这篇稿件的录用概率。</p>`;
  }
  function publicationInfo(detail) {
    const rows=asArray(detail.apc).filter((a)=>a&&typeof a==='object');
    const content=[];
    asArray(detail.publisherMetricNotes).forEach((note)=>content.push(`<div class="warning-box"><strong>出版方补充说明</strong><p>${esc(note.text)} ${link(note.source)}</p><small>核验日期 ${esc(dateOnly(note.checkedAt)||'未注明')}</small></div>`));
    if(rows.length)content.push(`<div class="table-scroll"><table class="data-table"><thead><tr><th>费用类型</th><th>金额</th><th>适用范围 / 年份</th><th>来源</th></tr></thead><tbody>${rows.map((a)=>`<tr><td>${esc(a.type||a.label||'文章处理费 APC')}</td><td>${validNumber(a.value??a.amount)?fmt(a.value??a.amount)+' '+esc(a.currency||''):'以来源页面为准'}</td><td>${esc([a.note||a.articleType,a.year||a.priceDate,a.taxIncluded===false?'未含税':null].filter(Boolean).join(' · ')||'未注明')}</td><td>${link(a.source)}</td></tr>`).join('')}</tbody></table></div>`);
    else if(validNumber(detail.apcUSD))content.push(`<div class="empty-metric"><strong>OpenAlex 收录的 APC 参考价：${fmt(detail.apcUSD)} USD</strong><br>该数值可能来自目录历史记录，不表示最新实付金额；税费、文章类型、机构协议与减免需在出版方官网核实。 ${link(detail.source)}</div>`);
    else content.push('<div class="empty-metric">APC / 版面费用暂未收录。未收录不表示免费；开放获取状态也不等于作者必须支付费用。</div>');
    if(asArray(detail.articleTypes).length)content.push(`<p class="metric-note"><strong>已核实文章类型：</strong>${esc(detail.articleTypes.map(asText).join('、'))}</p>`);
    const links=[detail.submissionURL||detail.submissionUrl,detail.authorGuidelines||detail.authorGuidelinesURL].filter(Boolean);
    if(links.length)content.push(`<div class="source-links">${links.map((url,i)=>link(url,i===0?'投稿 / 作者入口 ↗':'作者指南 ↗')).join('')}</div>`);
    const d=detail.doaj;
    if(d && typeof d==='object') {
      const policy=[];
      const languages=asArray(d.languages).map(asText).join('、');
      if(languages)policy.push(['出版语言',languages]);
      if(asArray(d.review?.models).length)policy.push(['评审方式（DOAJ 申报）',d.review.models.map(asText).join('、')]);
      if(asArray(d.licenses).length)policy.push(['文章许可',d.licenses.map(asText).join('、')]);
      if(typeof d.apc?.charged==='boolean')policy.push(['APC 收费声明',d.apc.charged?'申报收取 APC':'申报不收取 APC']);
      if(typeof d.otherFees?.charged==='boolean')policy.push(['其他作者费用',d.otherFees.charged?'申报另有其他费用':'申报无其他作者费用']);
      if(typeof d.apc?.waiversDeclared==='boolean')policy.push(['费用减免政策',d.apc.waiversDeclared?'声明有减免政策，资格需核实':'目录未声明减免政策']);
      if(typeof d.plagiarismScreeningDeclared==='boolean')policy.push(['文本相似性检查',d.plagiarismScreeningDeclared?'目录声明开展检查':'目录未声明']);
      if(asArray(d.preservation?.services).length)policy.push(['长期保存服务',d.preservation.services.join('、')]);
      if(d.continuedBy)policy.push(['刊名延续线索',asText(d.continuedBy)]);
      if(!rows.length && asArray(d.apc?.prices).length)content.push(`<div class="table-scroll" style="margin-top:15px"><table class="data-table"><thead><tr><th>DOAJ 申报的 APC</th><th>币种</th><th>来源</th></tr></thead><tbody>${d.apc.prices.map((p)=>`<tr><td>${fmt(p.amount)}</td><td>${esc(p.currency)}</td><td>${link(d.apc.informationUrl||d.source)}</td></tr>`).join('')}</tbody></table></div>`);
      if(policy.length)content.push(`<div class="table-scroll" style="margin-top:15px"><table class="data-table"><thead><tr><th>出版政策</th><th>目录记录</th></tr></thead><tbody>${policy.map(([key,value])=>`<tr><td>${esc(key)}</td><td>${esc(value)}</td></tr>`).join('')}</tbody></table></div>`);
      content.push(`<p class="metric-note">以上 DOAJ 信息来自出版方申报；目录记录更新于 ${esc(dateOnly(d.metadataUpdatedAt)||'未注明')}，不表示所有出版政策均于本站访问日重新核验。费用按币种分别列出，不换算相加；税费、协议折扣与实付金额以出版方为准。 ${link(d.source,'DOAJ 原始记录 ↗')}</p>`);
      const authorLinks=[[d.authorInstructionsUrl,'作者指南 ↗'],[d.editorialBoardUrl,'编委会 ↗'],[d.aimsScopeUrl,'征稿范围 ↗'],[d.apc?.waiverInformationUrl,'减免政策 ↗'],[d.depositPolicy?.informationUrl,'自存档政策 ↗']].filter(([url])=>safeURL(url));
      if(authorLinks.length)content.push(`<div class="source-links">${authorLinks.map(([url,label])=>link(url,label)).join('')}</div>`);
    }
    return content.join('');
  }
  function indexItems(detail) {
    const map=new Map();
    asArray(detail.indexing).forEach((entry)=>{if(entry&&entry.name)map.set(entry.name,{...entry});});
    asArray(detail.wosIndexes).forEach((name)=>{if(!map.has(name))map.set(name,{name,status:'historical',year:detail.jcrYear||detail.jifYear,source:detail.indexingSource||detail.quartiles?.find((q)=>q.system==='JCR')?.source});});
    const lists=asArray(detail.listedIn);lists.forEach((slug)=>{const name=asText(slug);const known=state.sourceLists.find((s)=>s.id===name||s.slug===name||String(s.id||'').endsWith('/'+name));const display=known?.display_name||known?.name||({medline:'MEDLINE',doaj:'DOAJ',scielo:'SciELO','ccf-a':'CCF A','ccf-b':'CCF B','ccf-c':'CCF C','cwts-core':'CWTS 核心来源目录'}[name])||name;if(!map.has(display))map.set(display,{name:display,status:'openalex_list',source:known?.source_url||known?.homepage_url||known?.url||detail.source,year:known?.year||known?.list_version,checkedAt:known?.updated_at||known?.updated_date||detail.checkedAt});});
    if(detail.isDOAJ&&!map.has('DOAJ'))map.set('DOAJ',{name:'DOAJ',status:'openalex_list',source:detail.source});
    return [...map.values()];
  }
  function indexHTML(detail) {
    const items=indexItems(detail);
    if(!items.length)return '<div class="empty-metric">尚未收录可核验的数据库状态。可按 ISSN 到 Master Journal List、NLM Catalog、Scopus 或 DOAJ 查询。</div>';
    return `<div class="index-grid">${items.map((item)=>{const status={publisher_reported:'出版方公开声明',historical:'所载年度历史状态',listed_in_snapshot:'所载年度快照',openalex_list:'OpenAlex 目录映射',verified:'公开来源核验',active:'来源记录收录',listed_in_source:'来源目录记录'}[item.status]||'来源所载状态';return `<div class="index-item"><strong>${esc(item.name)}</strong><small>${esc(status)}${item.year?' · '+esc(item.year):''}</small>${link(item.source)}</div>`;}).join('')}</div><p class="metric-note">收录状态可能变化，以对应数据库最新记录为准。有 JIF 不自动代表 SCIE；PubMed、MEDLINE 与 PMC 分别核实。</p>`;
  }
  function sourceLedger(detail) {
    const links=new Set();function collect(value,depth=0){if(depth>5)return;if(typeof value==='string'){const url=safeURL(value);if(url)links.add(url);}else if(Array.isArray(value))value.forEach((x)=>collect(x,depth+1));else if(value&&typeof value==='object')Object.entries(value).forEach(([key,val])=>{if(['source','url','homepage','sourceURL','scopeSource','authorGuidelines','submissionURL','jifSource','indexingSource'].includes(key))collect(val,depth+1);else if(Array.isArray(val)||(val&&typeof val==='object'))collect(val,depth+1);});}
    collect(detail);const urls=[...links].slice(0,40);
    return `<details class="source-ledger"><summary>查看本页数据来源（${urls.length}）</summary><ol>${urls.map((url)=>`<li>${link(url,url)}</li>`).join('')}</ol></details>`;
  }
  function importedHTML(detail) {
    const metrics=importsFor(detail);
    if(!metrics.length)return '';
    return `<section class="detail-section"><div class="section-title"><h3>个人导入记录</h3><span>LOCAL ONLY</span></div><p class="metric-note">这些记录由你在当前浏览器导入，未经本站公共数据核验。与公开来源并列保留。</p><div class="table-scroll"><table class="data-table"><thead><tr><th>体系</th><th>年份</th><th>学科</th><th>分区</th><th>JIF</th><th>来源</th></tr></thead><tbody>${metrics.sort((a,b)=>b.year-a.year).map((m)=>`<tr><td>${tag(m.system==='CAS'?'中科院':m.system,'purple')}</td><td>${m.year}</td><td>${esc(m.category||'未注明')}</td><td>${m.system==='CAS'?esc(m.quartile.replace('Q','')+'区'):esc(m.quartile||'—')}</td><td>${m.impact_factor!==null?fmt(m.impact_factor):'—'}</td><td>${m.source?link(m.source):'个人文件未附链接'}</td></tr>`).join('')}</tbody></table></div></section>`;
  }
  function detailHTML(detail) {
    const id=detail.id,points=jifPoints(detail),allJif=asArray(detail.jif).length?asArray(detail.jif).filter((p)=>p.year).slice().sort((a,b)=>Number(a.year)-Number(b.year)):points,latest=allJif[allJif.length-1],annual=asArray(detail.annual).filter((a)=>Number(a.year)&&validNumber(a.count)).sort((a,b)=>a.year-b.year),volume=volumeInfo(detail),firstDecision=asArray(detail.review).find((r)=>['submission_to_first_decision','first_decision'].includes(r.stage));
    const quarters=asArray(detail.quartiles).filter((q)=>q&&q.system&&q.quartile);
    if(!quarters.length&&detail.jcrByCategory)Object.entries(detail.jcrByCategory).forEach(([category,q])=>quarters.push({system:'JCR',year:detail.jcrYear,category,quartile:typeof q==='object'?q.quartile:q,source:detail.quartileSource}));
    const extraNotes=asArray(detail.notes).map(asText).filter(Boolean),warnings=asArray(detail.warnings).map(asText).filter(Boolean);
    return `<div class="detail-head"><h2 id="journal-dialog-title">${esc(detail.name)}</h2><div class="detail-identifiers"><span>${esc(detail.publisher || '出版方未标明')}</span><span>${esc(countryName(detail.country))}</span><span>ISSN ${esc(unique([detail.issnL,...asArray(detail.issns)]).join(' / ')||'未标明')}</span></div><div class="field-tags">${detail.fields.map((f)=>tag(fieldName(f))).join('')}${detail.curated?tag('出版方详情核验','teal'):tag('公开目录候选')}</div><div class="inline-actions">${safeURL(detail.homepage)?`<a class="primary-button" href="${esc(safeURL(detail.homepage))}" target="_blank" rel="noopener noreferrer">期刊官网 ↗</a>`:''}<button class="secondary-button" type="button" data-action="favorite" data-id="${esc(id)}">${isSaved(id)?'★ 已收藏':'☆ 收藏期刊'}</button><button class="secondary-button" type="button" data-action="compare-toggle" data-id="${esc(id)}">${state.compare.includes(id)?'移出比较':'加入比较'}</button><button class="text-button" type="button" data-action="copy-detail" data-id="${esc(id)}">复制档案链接</button></div></div><nav class="detail-navigation" aria-label="期刊详情章节"><a href="#detail-scope" data-detail-anchor="detail-scope">范围与定位</a><a href="#detail-metrics" data-detail-anchor="detail-metrics">指标与趋势</a><a href="#detail-index" data-detail-anchor="detail-index">收录</a><a href="#detail-review" data-detail-anchor="detail-review">审稿与投稿</a><a href="#detail-cost" data-detail-anchor="detail-cost">费用与类型</a></nav><div class="detail-body"><section class="detail-section" id="detail-scope"><div class="section-title"><h3>研究范围与定位</h3><span>AIMS & SCOPE</span></div>${detail.scope?`<p class="scope-copy">${esc(detail.scope)}</p><p class="metric-source">${link(detail.scopeSource||detail.homepage,'范围来源 ↗')}</p>`:'<p class="scope-copy">该期刊已纳入候选目录。尚未完成出版方征稿范围的详细核验，请在官网确认你的研究对象、方法、文章类型与读者群是否适合。</p>'}${asArray(detail.topics).length?`<p class="metric-note">OpenAlex 文献主题标签（用于发现方向，不等同于征稿范围）</p><div class="field-tags">${detail.topics.slice(0,8).map((topic)=>tag(asText(topic))).join('')}</div>`:''}${warnings.length?`<div class="warning-box"><strong>来源元数据核对提示</strong>${warnings.map((w)=>`<p>${esc(w)}</p>`).join('')}</div>`:''}<div class="detail-stat-grid"><div class="detail-stat"><span class="metric-label">最新已收录 JIF</span><span class="metric-value${latest?'':' missing'}">${latest?validNumber(latest.value)?fmt(latest.value):esc(latest.display||detail.jifText||'未收录'):'未收录'}</span><small>${latest?latest.year+' 指标年 / '+(latest.releaseYear||latest.year+1)+' 发布年':'不以其他被引指标替代'}</small></div><div class="detail-stat"><span class="metric-label">${volume?volume.year:'年度'} OpenAlex 文献量</span><span class="metric-value${volume?'':' missing'}">${volume?fmt(volume.count):'未收录'}</span><small>数据库收录记录数，非投稿量</small></div><div class="detail-stat"><span class="metric-label">首次决定时间</span><span class="metric-value${validNumber(firstDecision?.days)||validNumber(detail.reviewDays)?'':' missing'}">${validNumber(firstDecision?.days)?fmt(firstDecision.days)+' 天':validNumber(detail.reviewDays)?fmt(detail.reviewDays)+' 天':'未收录'}</span><small>${firstDecision?esc(reviewStatistic(firstDecision))+' · '+esc(firstDecision.period||firstDecision.year||'统计期未注明'):'整体口径未收录；其他阶段见下方'}<br>可能包含编辑初筛 / 退稿</small><button type="button" class="text-button" data-detail-anchor="detail-review">查看各阶段与来源 ↓</button></div><div class="detail-stat"><span class="metric-label">开放获取</span><span class="metric-value small">${detail.isOA===true?'全 OA':detail.isOA===false?'未标记全 OA':'未标明'}</span><small>按 OpenAlex 目录标记；费用另核实</small></div></div></section><section class="detail-section" id="detail-metrics"><div class="section-title"><h3>指标与年度变化</h3><span>METRICS IN CONTEXT</span></div><div class="detail-columns"><div><div class="chart-panel"><h4>影响因子 JIF</h4><p>按指标年份展示。仅连接相邻且有数据的年份；不插补缺失值。</p>${buildChart(points.map((p)=>({year:p.year,value:p.value})),'line','历年期刊影响因子')}</div>${allJif.length?`<div class="table-scroll"><table class="data-table"><thead><tr><th>指标年份</th><th>JIF</th><th>发布年份</th><th>来源</th></tr></thead><tbody>${allJif.slice().reverse().map((p)=>`<tr><td>${p.year}</td><td class="table-number">${validNumber(p.value)?fmt(p.value):esc(p.display||'未收录')}</td><td>${esc(p.releaseYear||p.year+1)}</td><td>${link(p.source)}</td></tr>`).join('')}</tbody></table></div><p class="metric-note">小于某阈值的 JIF 保留原文（如 &lt;0.1），不当作精确数值绘图或排序。</p>`:''}</div><div><div class="chart-panel"><h4>年度收录文献量 · OpenAlex</h4><p>按数据库文献记录计。${TODAY_YEAR}* 为未完整年度，不代表全年发文量。</p>${buildChart(annual.map((a)=>({year:a.year,value:a.count})),'bar','OpenAlex 按年收录文献量')}</div>${annual.length?`<div class="table-scroll"><table class="data-table"><thead><tr><th>年份</th><th>收录记录数</th><th>状态</th></tr></thead><tbody>${annual.slice().reverse().map((a)=>`<tr><td>${a.year}</td><td class="table-number">${fmt(a.count)}</td><td>${a.year>=TODAY_YEAR?'未完整年度':'历史年度'}</td></tr>`).join('')}</tbody></table></div><p class="metric-source">${link(detail.source,'OpenAlex 原始记录 ↗')} · 文献类型及元数据覆盖影响计数。</p>`:''}</div></div><div class="section-title" style="margin-top:27px"><h3>各学科分区</h3><span>CATEGORY-SPECIFIC</span></div>${quarters.length?`<div class="table-scroll"><table class="data-table"><thead><tr><th>体系 / 年份</th><th>学科</th><th>分区</th><th>来源</th></tr></thead><tbody>${quarters.slice().sort((a,b)=>Number(b.year)-Number(a.year)).map((q)=>`<tr><td>${esc(q.system==='CAS'?'中科院（历史）':q.system)} · ${esc(q.year||'未注明')}${q.level?`<div class="table-secondary">${q.level==='major'?'大类':q.level==='minor'?'小类':q.level==='unspecified'?'源表未注明大 / 小类':esc(q.level)}</div>`:''}</td><td>${esc(q.category||'未注明')}</td><td>${tag(q.system==='CAS'?qNormalize(q.quartile).slice(1)+'区':q.quartile,'blue')}</td><td>${link(q.source)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-metric">尚未收录有来源的学科分区。JCR、中科院与 SJR 采用不同体系，不能互相换算。可导入你有权使用的个人数据。</div>'}<p class="metric-note">同一期刊可同时属于多个学科。筛选学科与分区时按同一条记录匹配；不同年份的分区应分别比较。</p>${asArray(detail.jcrRanks).length?`<details class="source-ledger"><summary>查看 JCR 学科排名</summary><div class="table-scroll"><table class="data-table"><thead><tr><th>年份</th><th>学科</th><th>排名</th><th>来源</th></tr></thead><tbody>${detail.jcrRanks.map((r)=>`<tr><td>${esc(r.year||'未注明')}</td><td>${esc(r.category)}</td><td>${esc(r.rank)} / ${esc(r.total)}</td><td>${link(r.source)}</td></tr>`).join('')}</tbody></table></div></details>`:''}</section><section class="detail-section" id="detail-index"><div class="section-title"><h3>数据库与目录收录</h3><span>INDEXING</span></div>${indexHTML(detail)}<div class="source-links">${link('https://mjl.clarivate.com/','Master Journal List 核对 ↗')}${link('https://www.ncbi.nlm.nih.gov/nlmcatalog/?term='+encodeURIComponent(detail.issnL||detail.name),'NLM Catalog 核对 ↗')}</div></section><section class="detail-section" id="detail-review"><div class="section-title"><h3>审稿周期</h3><span>EDITORIAL PROCESS</span></div>${reviewGuideHTML(detail)}${reviewTable(detail)}<div class="section-title" style="margin-top:27px"><h3>投稿量、发文量与录用率</h3><span>PUBLISHED DISCLOSURES</span></div>${disclosuresTable(detail)}</section><section class="detail-section" id="detail-cost"><div class="section-title"><h3>费用与文章类型</h3><span>PUBLISHING CONDITIONS</span></div>${publicationInfo(detail)}</section>${importedHTML(detail)}${extraNotes.length?`<section class="detail-section"><div class="section-title"><h3>补充说明</h3></div>${extraNotes.map((note)=>`<p class="metric-note">${esc(note)}</p>`).join('')}</section>`:''}<section class="detail-section">${sourceLedger(detail)}</section><div class="detail-footer"><span>资料核验：${esc(dateOnly(detail.checkedAt||state.meta.checkedAt||'2026-10-21'))} · 期刊编号 ${esc(id)}</span><span>投稿前再次核对官网要求与最新收录状态</span></div></div>`;
  }
  async function openCompare() {
    if(state.compare.length<2){toast('请至少选择 2 本期刊。');return;}
    const ids=[...state.compare],token=++state.compareToken;openDialog('compare-dialog');$('compare-dialog').scrollTop=0;$('compare-content').innerHTML='<div class="loading-panel"><span class="loading-ring"></span><h3>正在整理所选期刊</h3><p>读取指标年份、分区学科与各项来源。</p></div>';
    const results=await Promise.allSettled(ids.map(getDetail));
    if(token!==state.compareToken||!$('compare-dialog').open)return;
    const journals=results.map((r,i)=>r.status==='fulfilled'?r.value:{...state.byId.get(ids[i]),_detailFailed:true});
    const row=(label,fn)=>`<tr><td>${esc(label)}</td>${journals.map((j)=>`<td>${fn(j)}</td>`).join('')}</tr>`;
    const html=`<p class="comparison-note">相同指标仍需对齐年份、统计对象和处理阶段。缺失值不视为低值，期刊总体指标不能直接预测稿件录用概率。</p><div class="compare-body"><div class="table-scroll"><table class="comparison-table"><thead><tr><th>比较维度</th>${journals.map((j)=>`<th><button type="button" class="journal-title-button comparison-title" data-action="detail" data-id="${esc(j.id)}">${esc(j.name)}</button><small>ISSN ${esc(j.issnL||'未标明')}${j._detailFailed?' · 详情暂未读取':''}</small></th>`).join('')}</tr></thead><tbody>${row('出版方',(j)=>esc(j.publisher||'未标明'))}${row('研究范围',(j)=>esc(j.scope||'尚未核验出版方征稿范围'))}${row('学科',(j)=>j.fields.map((f)=>tag(fieldName(f))).join(''))}${row('JIF（最新已收录）',(j)=>{const v=jifDisplayInfo(j,'');return v?`<strong>${esc(v.text)}</strong><small>${v.year} 指标年${v.personal?' · 个人导入':''}</small>`:'未收录';})}${row('JCR 学科分区',(j)=>{const q=quartileEntries(j,'JCR').filter((e)=>!e.personal);return q.length?q.slice(0,8).map((e)=>`${tag(e.quartile,'blue')} ${esc(e.category||'学科未注明')}<small>${esc(e.year||'')}</small>`).join('<br>'):'未收录';})}${row('中科院历史分区',(j)=>{const q=quartileEntries(j,'CAS');return q.length?q.slice(0,6).map((e)=>`${tag(e.quartile.slice(1)+'区',e.personal?'purple':'')} ${esc(e.category)}<small>${esc(e.year)}${e.personal?' · 个人导入':' · 历史版'}</small>`).join('<br>'):'未收录；可本地导入';})}${row('年度收录文献量',(j)=>{const v=volumeInfo(j);return v?`${fmt(v.count)}<small>${v.year} · OpenAlex 文献记录数</small>`:'未收录';})}${row('数据库 / 目录',(j)=>indexItems(j).slice(0,12).map((entry)=>tag(entry.name)).join('')||'未核验')}${row('首次决定时间',(j)=>{const r=asArray(j.review).find((x)=>['submission_to_first_decision','first_decision'].includes(x.stage));return r&&validNumber(r.days)?`${fmt(r.days)} 天<small>${esc(({median:'中位数',mean:'平均值'})[r.statistic]||r.statistic||'口径未注明')} · ${esc(r.period||'统计期未注明')}<br>可能含编辑初筛</small>${link(r.source)}`:validNumber(j.reviewDays)?`${fmt(j.reviewDays)} 天<small>可能含编辑初筛；见详情来源</small>`:'未收录';})}${row('外审后首次决定',(j)=>{const r=asArray(j.review).find((x)=>['first_decision_with_review','submission_to_first_post_review_decision','submission_to_first_peer_review_decision'].includes(x.stage));return r&&validNumber(r.days)?`${fmt(r.days)} 天<small>${esc(({median:'中位数',mean:'平均值'})[r.statistic]||r.statistic||'口径未注明')} · ${esc(r.period||'统计期未注明')}<br>仅指经过外审的稿件</small>${link(r.source)}`:validNumber(j.peerReviewDays)?`${fmt(j.peerReviewDays)} 天<small>外审后首次决定；来源见详情</small>`:'未披露 / 未收录';})}${row('投稿至接收',(j)=>{const r=asArray(j.review).find((x)=>x.stage==='submission_to_acceptance');return r&&validNumber(r.days)?`${fmt(r.days)} 天<small>${esc(r.statistic||'口径未注明')} · ${esc(r.period||'统计期未注明')}</small>${link(r.source)}`:'未披露 / 未收录';})}${row('公开投稿量（稿件）',(j)=>{const rows=asArray(j.submissionCounts);return rows.length?rows.map((r)=>`${fmt(r.count)} ${r.unit==='manuscripts'?'篇稿件':esc(r.unit||'条记录')}<small>${esc(r.year||r.period||'统计期未注明')} · ${esc(r.definition||r.denominator||'统计对象见来源')}</small>${link(r.source)}`).join('<br>'):'未披露 / 未收录；不由发文量推算';})}${row('公开录用率',(j)=>{const rows=asArray(j.acceptance);return rows.length?rows.map((r)=>`${fmt(r.value??r.rate)}${r.unit==='percent'?'%':''}<small>${esc(r.year||r.period||'统计期未注明')} · ${esc(r.definition||r.denominator||'分母见来源')}</small>${link(r.source)}`).join('<br>'):'未披露 / 未收录；不推算';})}${row('开放获取',(j)=>j.isOA===true?'OpenAlex 标记全 OA':j.isOA===false?'未标记全 OA；是否混合 OA 见官网':'未标明')}${row('APC 参考价',(j)=>validNumber(j.apcUSD)?`${fmt(j.apcUSD)} USD<small>OpenAlex 目录参考，最新价及减免另核实</small>`:'未收录，不表示免费')}${row('官网与核验日期',(j)=>`${link(j.homepage,'期刊官网 ↗')}<small>${esc(dateOnly(j.checkedAt||state.meta.checkedAt||'2026-10-21'))}</small>`)}</tbody></table></div></div>`;
    $('compare-content').innerHTML=html;
  }
  function csvCell(value) {let str=String(value==null?'':value);if(/^[\s]*[=+\-@]/.test(str)||/^[\t\r\n]/.test(str))str="'"+str;return '"'+str.replace(/"/g,'""')+'"';}
  function download(text,filename,type) {const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
  function exportCSV(journals,personal=false) {
    if(!journals.length){toast('没有可导出的记录。');return;}
    const headers=['期刊编号','期刊名称','ISSN-L','其他ISSN','出版方','国家或地区','学科','JIF','JIF指标年份','JIF个人导入','JCR分区','JCR年份','SCIE或其他WoS收录','DOAJ','OpenAlex全OA标记','年度文献量','年度文献量年份','文献量口径','整体首次决定天数','外审后首次决定天数','投稿至发表天数','审稿说明','OpenAlex来源','资料核验日期'];
    if(personal)headers.push('投稿状态','个人笔记','最后修改');
    const rows=journals.map((j)=>{const metric=jifDisplayInfo(j),v=volumeInfo(j),r=personal?recordFor(j.id):null;const values=[j.id,j.name,j.issnL,asArray(j.issns).join('; '),j.publisher,countryName(j.country),j.fields.map(fieldName).join('; '),metric?.exportValue??'',metric?.year??'',metric?.personal?'是':'否',unique(quartileEntries(j,'JCR').filter((q)=>!q.personal).map((q)=>`${q.category||'未注明学科'}: ${q.quartile}`)).join('; '),j.jcrYear||'',asArray(j.wosIndexes).join('; '),j.isDOAJ===true?'是':'未标记',j.isOA===true?'是':j.isOA===false?'否':'未标明',v?.count??'',v?.year??'','OpenAlex收录文献记录数，非出版方研究论文发文量',validNumber(j.reviewDays)?j.reviewDays:'',validNumber(j.peerReviewDays)?j.peerReviewDays:'',validNumber(j.publicationDays)?j.publicationDays:'','整体首次决定可能含编辑初筛；外审后首次决定与投稿至发表分开记录，具体口径见详情',j.source||'https://api.openalex.org/sources/'+j.id,j.checkedAt||state.meta.checkedAt||''];if(personal)values.push(STAGES[r.stage],r.notes,r.updatedAt);return values.map(csvCell).join(',');});
    download('\uFEFF'+[headers.map(csvCell).join(','),...rows].join('\r\n'),personal?'my-journal-shortlist.csv':'journal-search-results.csv','text/csv;charset=utf-8');toast(`已导出 ${fmt(journals.length)} 条记录。`);
  }
  function backupPersonal() {download(JSON.stringify({...state.local,exportedAt:new Date().toISOString(),application:'Journal Atlas'},null,2),'journal-atlas-personal-backup.json','application/json');toast('已生成个人数据备份。请保存到你信任的位置。');}
  function validISSN(value) {const v=String(value||'').toUpperCase().replace(/\s/g,'');if(!/^\d{4}-\d{3}[\dX]$/.test(v))return false;const chars=v.replace('-','');let sum=0;for(let i=0;i<8;i++)sum+=(chars[i]==='X'?10:Number(chars[i]))*(8-i);return sum%11===0;}
  function validImportedMetric(m) {if(!m||typeof m!=='object'||!validISSN(m.issn||m.ISSN))return false;const system=String(m.system||'').toUpperCase(),year=Number(m.year);return ['JCR','CAS','SJR'].includes(system)&&Number.isInteger(year)&&year>=1900&&year<=TODAY_YEAR+1&&(m.impact_factor==null||m.impact_factor===''||(validNumber(m.impact_factor)&&Number(m.impact_factor)>=0&&Number(m.impact_factor)<2000));}
  function normalizeImportedMetric(m) {const system=String(m.system).toUpperCase();return {issn:String(m.issn||m.ISSN).toUpperCase().replace(/\s/g,''),year:Number(m.year),system,category:String(m.category||'').slice(0,250),quartile:qNormalize(m.quartile),impact_factor:system==='JCR'?numValue(m.impact_factor):null,source:safeURL(m.source),importedAt:String(m.importedAt||new Date().toISOString()).slice(0,30)};}
  const metricKey=(m)=>[m.issn,m.year,m.system,m.category].join('|');
  function mergeMetrics(metrics) {const map=new Map(state.local.metrics.map((m)=>[metricKey(m),m]));metrics.forEach((m)=>map.set(metricKey(m),m));state.local.metrics=[...map.values()].slice(-60000);buildImportMap();persist();populateFilters();computeResults();if(matchState.hasRun)applyMatchPreferences();renderImportSummary();if(state.detailId)openDetail(state.detailId,false);}
  function parseCSV(text) {const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else quoted=false;}else cell+=c;}else if(c==='"'){if(cell!=='')throw new Error('CSV 引号格式不正确');quoted=true;}else if(c===','){row.push(cell);cell='';}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some((v)=>v.trim()!==''))rows.push(row);row=[];cell='';}else cell+=c;}if(quoted)throw new Error('CSV 存在未闭合的引号');if(cell||row.length){row.push(cell);if(row.some((v)=>v.trim()!==''))rows.push(row);}return rows;}
  async function importMetrics(file) {
    if(!file)return;if(file.size>8*1024*1024){$('metric-import-result').textContent='文件超过 8 MB，请拆分后导入。';return;}
    try {const rows=parseCSV((await file.text()).replace(/^\uFEFF/,''));if(rows.length<2)throw new Error('CSV 没有数据行。');const header=rows[0].map((s)=>s.trim().toLowerCase());if(!['issn','year','system'].every((key)=>header.includes(key)))throw new Error('CSV 缺少 ISSN、year 或 system 表头。');let invalid=0,unmatched=0;const metrics=[];rows.slice(1).forEach((cells)=>{const raw={};header.forEach((key,i)=>{if(['issn','year','system','category','quartile','impact_factor','source'].includes(key))raw[key]=String(cells[i]||'').trim();});if(!validImportedMetric(raw)||(!qNormalize(raw.quartile)&&!validNumber(raw.impact_factor))){invalid++;return;}const metric=normalizeImportedMetric(raw);if(!state.issnSet.has(metric.issn))unmatched++;metrics.push(metric);});mergeMetrics(metrics);$('metric-import-result').textContent=`已导入 ${fmt(metrics.length)} 条个人记录；${fmt(invalid)} 条格式无效；${fmt(unmatched)} 条 ISSN 暂未匹配目录（保留在备份中）。`;toast(storageFailed?'个人指标已在本次会话生效，但未能保存到浏览器；请导出个人备份。':'个人指标已保存在本浏览器，未上传。');}
    catch(error){$('metric-import-result').textContent='导入失败：'+error.message;}
    finally{$('metric-file').value='';}
  }
  function renderImportSummary() {const count=state.local.metrics.length,systems=unique(state.local.metrics.map((m)=>m.system));$('personal-metrics-summary').innerHTML=count?`<div class="personal-import-card"><span>本机已有 <strong>${fmt(count)}</strong> 条记录 · ${esc(systems.join(' / '))}</span><button type="button" class="text-button" id="clear-personal-metrics">清除个人指标</button></div>`:'<p class="fine-print">本机尚未导入个人指标。公共目录无需导入即可使用。</p>';}
  async function restoreBackup(file) {
    if(!file)return;if(file.size>15*1024*1024){toast('备份文件过大，请使用本站导出的 JSON 备份。');return;}
    try {const incoming=JSON.parse(await file.text());if(!incoming||incoming.version!==1||typeof incoming.records!=='object'||Array.isArray(incoming.records))throw new Error('不是有效的 Journal Atlas 备份');let restored=0;Object.entries(incoming.records).forEach(([id,r])=>{if(!state.byId.has(id)||!r||typeof r!=='object')return;const existing=recordFor(id);if(!existing.updatedAt||String(r.updatedAt||'')>=existing.updatedAt){state.local.records[id]={saved:r.saved===true,stage:STAGES[r.stage]?r.stage:'considering',notes:String(r.notes||'').slice(0,12000),updatedAt:String(r.updatedAt||'').slice(0,30)};restored++;}});if(incoming.manuscript){state.local.manuscript={title:String(incoming.manuscript.title||'').slice(0,300),keywords:String(incoming.manuscript.keywords||'').slice(0,500)};$('manuscript-title').value=state.local.manuscript.title;$('manuscript-keywords').value=state.local.manuscript.keywords;}const searches=asArray(incoming.searches).slice(0,12).map((s)=>({name:String(s.name||'筛选方案').slice(0,100),filters:sanitizeFilters(s.filters)}));state.local.searches=searches.length?searches:state.local.searches;mergeMetrics(asArray(incoming.metrics).filter(validImportedMetric).map(normalizeImportedMetric));persist();renderSavedSearches();renderSavedCount();renderShortlist();computeResults();toast(storageFailed?`已在本次会话合并 ${fmt(restored)} 条记录，但未能保存到浏览器；请导出备份。`:`已合并恢复 ${fmt(restored)} 条期刊记录，已有较新的笔记予以保留。`);}catch(error){toast('恢复失败：'+error.message);}finally{$('backup-file').value='';}
  }
  async function copyText(text) {try{await navigator.clipboard.writeText(text);toast('链接已复制。');}catch(_){toast('浏览器未允许自动复制，可直接复制地址栏中的链接。');}}
  function bindEvents() {
    bindMatchEvents();
    let searchTimer;const triggerSearch=()=>{state.filters.q=$('search-input').value.trim();state.page=1;computeResults();};
    $('search-form').addEventListener('submit',(event)=>{event.preventDefault();clearTimeout(searchTimer);triggerSearch();});
    $('search-input').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(triggerSearch,240);});
    Object.entries(FILTER_IDS).forEach(([key,id])=>{const el=$(id);if(!el)return;el.addEventListener(el.tagName==='INPUT'&&el.type!=='checkbox'?'input':'change',()=>{updateFilter(key,el.type==='checkbox'?el.checked:el.value);});});
    $('reset-filters').addEventListener('click',resetFilters);
    $('mobile-filter-toggle').addEventListener('click',()=>{const open=$('filter-panel').classList.toggle('is-open');$('mobile-filter-toggle').setAttribute('aria-expanded',String(open));if(open)scrollToElement($('filter-panel'));});
    $('view-cards').addEventListener('click',()=>{state.mode='cards';$('view-cards').setAttribute('aria-pressed','true');$('view-table').setAttribute('aria-pressed','false');renderResults();});
    $('view-table').addEventListener('click',()=>{state.mode='table';$('view-cards').setAttribute('aria-pressed','false');$('view-table').setAttribute('aria-pressed','true');renderResults();});
    $('save-search').addEventListener('click',saveSearch);
    $('share-search').addEventListener('click',()=>{if(state.candidateScope){toast('稿件候选范围仅限本次会话，可以导出当前结果。');return;}syncURL();const url=new URL(location.href);url.hash='catalog';copyText(url.href);});
    $('export-results').addEventListener('click',()=>exportCSV(state.filtered));
    $('export-shortlist').addEventListener('click',()=>exportCSV(state.journals.filter((j)=>isSaved(j.id)),true));
    $('backup-personal').addEventListener('click',backupPersonal);$('backup-methods').addEventListener('click',backupPersonal);
    $('restore-personal').addEventListener('click',()=>$('backup-file').click());$('backup-file').addEventListener('change',()=>restoreBackup($('backup-file').files[0]));
    ['open-import','open-import-methods'].forEach((id)=>$(id).addEventListener('click',()=>{renderImportSummary();openDialog('import-dialog');}));
    $('choose-metrics').addEventListener('click',()=>$('metric-file').click());$('metric-file').addEventListener('change',()=>importMetrics($('metric-file').files[0]));
    $('download-template').addEventListener('click',()=>download('\uFEFFISSN,year,system,category,quartile,impact_factor,source\r\n','journal-personal-metrics-template.csv','text/csv;charset=utf-8'));
    $('shortlist-stage').addEventListener('change',renderShortlist);
    ['manuscript-title','manuscript-keywords'].forEach((id)=>$(id).addEventListener('input',()=>{state.local.manuscript={title:$('manuscript-title').value,keywords:$('manuscript-keywords').value};persist();}));
    $('manuscript-search').addEventListener('click',useManuscriptForMatch);
    $('clear-compare').addEventListener('click',()=>{state.compare=[];renderCompareTray();document.querySelectorAll('[data-compare]').forEach((input)=>input.checked=false);});$('open-compare').addEventListener('click',openCompare);
    document.addEventListener('click',(event)=>{
      const view=event.target.closest('[data-view]');if(view){event.preventDefault();if(view.closest('.workspace-tabs'))setView(view.dataset.view);else navigateToView(view.dataset.view);return;}
      const close=event.target.closest('[data-close]');if(close){closeDialog(close.dataset.close);return;}
      const query=event.target.closest('[data-query]');if(query){state.filters.q=query.dataset.query;state.page=1;$('search-input').value=state.filters.q;computeResults();return;}
      const page=event.target.closest('[data-page]');if(page){state.page=Number(page.dataset.page);renderResults();scrollToElement(document.querySelector('.results-toolbar'));return;}
      const clear=event.target.closest('[data-clear-filter]');if(clear){state.filters[clear.dataset.clearFilter]=DEFAULT_FILTERS[clear.dataset.clearFilter];state.page=1;syncFilterControls();computeResults();return;}
      const search=event.target.closest('[data-load-search]');if(search){state.candidateScope=null;state.filters=sanitizeFilters(state.local.searches[Number(search.dataset.loadSearch)].filters);state.page=1;populateCategories();syncFilterControls();computeResults();toast('已恢复保存的筛选条件。');return;}
      const del=event.target.closest('[data-delete-search]');if(del){state.local.searches.splice(Number(del.dataset.deleteSearch),1);persist();renderSavedSearches();return;}
      const anchor=event.target.closest('[data-detail-anchor]');if(anchor){event.preventDefault();scrollToElement($(anchor.dataset.detailAnchor));return;}
      const action=event.target.closest('[data-action]');if(action){const id=action.dataset.id;switch(action.dataset.action){case'detail':openDetail(id);break;case'review':openDetail(id,true,'detail-review');break;case'favorite':toggleFavorite(id);break;case'compare-toggle':toggleCompare(id,!state.compare.includes(id));action.textContent=state.compare.includes(id)?'移出比较':'加入比较';break;case'reset':resetFilters();break;case'copy-detail':{const url=new URL(location.href);url.hash='journal='+encodeURIComponent(id);copyText(url.href);break;}case'retry-load':loadCatalog();break;}return;}
      if(event.target.closest('#clear-personal-metrics')){if(confirm('清除当前浏览器里的个人指标？收藏和笔记会保留。建议先导出个人备份。')){state.local.metrics=[];buildImportMap();persist();populateFilters();computeResults();if(matchState.hasRun)applyMatchPreferences();renderImportSummary();toast(storageFailed?'个人指标已在本次会话清除，但未能保存该操作；刷新后可能恢复。':'个人指标已清除，公共来源未改变。');}}
    });
    document.addEventListener('change',(event)=>{if(event.target.dataset.compare)toggleCompare(event.target.dataset.compare,event.target.checked);if(event.target.dataset.stage){const id=event.target.dataset.stage,r=recordFor(id);r.stage=event.target.value;r.updatedAt=new Date().toISOString();persist();if($('shortlist-stage').value)renderShortlist();}});
    document.addEventListener('input',(event)=>{if(event.target.dataset.note){const id=event.target.dataset.note,r=recordFor(id);r.notes=event.target.value.slice(0,12000);r.updatedAt=new Date().toISOString();persist();const status=document.querySelector(`[data-note-status="${id}"]`);if(status)status.textContent=storageFailed?'未能保存，请导出备份':'已保存在本浏览器';}});
    ['journal-dialog','compare-dialog','import-dialog'].forEach((id)=>{$(id).addEventListener('click',(event)=>{if(event.target===$(id)){const rect=$(id).getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeDialog(id);}});$(id).addEventListener('cancel',(event)=>{event.preventDefault();closeDialog(id);});});
    document.querySelector('.workspace-tabs').addEventListener('keydown',(event)=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;const tabs=['catalog','matcher','shortlist','methods'],current=tabs.indexOf(state.view);let next=event.key==='Home'?0:event.key==='End'?tabs.length-1:event.key==='ArrowRight'?(current+1)%tabs.length:(current+tabs.length-1)%tabs.length;event.preventDefault();setView(tabs[next]);$('tab-'+tabs[next]).focus();});
    document.addEventListener('keydown',(event)=>{if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target.closest('input,textarea,select,[contenteditable="true"]')&&!document.querySelector('dialog[open]')){event.preventDefault();setView('catalog');$('search-input').focus();}});
    window.addEventListener('hashchange',()=>route(true));window.addEventListener('popstate',()=>route(true));
  }
  function route(scroll=false) {
    const hash=location.hash;if(hash==='#main')return;
    if(hash.startsWith('#journal=')){
      let id;try{id=decodeURIComponent(hash.slice(9));}catch(_){setView('catalog');toast('期刊链接格式无效，已返回期刊检索。');return;}
      if(state.ready)openDetail(id,false);
    }else{
      if($('journal-dialog').open)closeDialog('journal-dialog');
      setView(hash==='#shortlist'?'shortlist':hash==='#matcher'?'matcher':hash==='#methods'?'methods':'catalog',false);
      if(scroll&&['#catalog','#matcher','#shortlist','#methods'].includes(hash)){$('view-'+state.view).focus({preventScroll:true});scrollToElement(document.querySelector('.workspace-tabs'));}
    }
  }
  async function loadCatalog() {
    $('catalog-message').hidden=false;$('catalog-message').innerHTML='<span class="loading-ring" aria-hidden="true"></span><h3>正在准备期刊目录</h3><p>首次读取全学科目录需要一点时间；详细数据按需加载。</p>';
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),120000);
    try {
      const [data,editorial]=await Promise.all([fetchJSON('data/catalog.json',{signal:controller.signal},(bytes)=>{const p=$('catalog-message').querySelector('p');if(p)p.textContent='已读取 '+(bytes/1048576).toFixed(1)+' MB 压缩目录，正在准备全学科检索…';}),loadEditorialEvidence(controller.signal)]);
      const raw=Array.isArray(data)?data:asArray(data.journals);if(!raw.length)throw new Error('目录文件为空，数据尚未准备完成');
      state.editorialEvidence.clear();const rawById=new Map(raw.map((j)=>[j.id,j]));editorial.forEach((record)=>{const j=rawById.get(record.id);if(j&&asArray(record.issns).some((issn)=>unique([j.issnL,...asArray(j.issns)]).includes(issn)))state.editorialEvidence.set(record.id,record);});
      state.meta=data.meta||{};state.sourceLists=asArray(data.sourceLists||state.meta.sourceLists);
      state.journals=raw.filter((j)=>j&&typeof j.id==='string'&&typeof j.name==='string').map((j)=>{mergeEditorialEvidence(j);j.fields=asArray(j.fields).map(asText).filter(Boolean);j.issns=asArray(j.issns).map((x)=>String(x).toUpperCase());j.issnL=String(j.issnL||'').toUpperCase();j.country=j.country||'';j._search=normalize([j.name,j.issnL,...j.issns,j.publisher,...j.fields,...j.fields.map(fieldName),...asArray(j.subfields).map(asText),...asArray(j.topics).map(asText),...asArray(j.aliases).map(asText)].join(' '));return j;});
      state.byId=new Map(state.journals.map((j)=>[j.id,j]));state.issnSet=new Set(state.journals.flatMap((j)=>[j.issnL,...j.issns]).filter(Boolean));state.ready=true;populateFilters();renderStats();renderSavedCount();renderSavedSearches();computeResults();renderShortlist();route();if(matchState.pending)runMatcher();
      if(!state.sourceLists.length)fetchJSON('data/catalog-meta.json').then((data)=>{if(!data)return;state.sourceLists=asArray(data.sourceLists||data.source_lists||data.meta?.sourceLists);}).catch(()=>{});
    }catch(error){state.ready=false;$('catalog-message').innerHTML=`<h3>期刊目录暂时无法载入</h3><p>${esc(error.name==='AbortError'?'读取超过两分钟，请检查网络后重试':error.message)}。你的本地收藏和笔记不会因此删除。</p><button type="button" class="primary-button" data-action="retry-load">重新载入</button>`;$('result-count').textContent='目录读取未完成';if(matchState.pending){matchState.pending=false;matchStatus('目录读取未完成，请回到期刊检索点击“重新载入”，再运行匹配。','error');}}
    finally{clearTimeout(timeout);}
  }
  state.local=readLocal();buildImportMap();readURLFilters();$('manuscript-title').value=state.local.manuscript.title;$('manuscript-keywords').value=state.local.manuscript.keywords;bindEvents();syncFilterControls();renderSavedSearches();route(true);loadCatalog();
})();
