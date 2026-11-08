(() => {
  'use strict';
  const data = window.TRAVEL_CATALOG || [];
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const base = document.body.dataset.base || '';
  const key = 'future-travel-plan-v1';
  const lookup = new Map();
  data.forEach(p => p.places.forEach((c, i) => lookup.set(`${p.id}:${i}`, {p, c, i})));
  let plan = {}, storageOK = true, toastTimer;
  function clean(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Invalid plan');
    const result = {};
    Object.entries(raw).forEach(([id, value]) => {
      if (!lookup.has(id) || !value || typeof value !== 'object' || !['want', 'visited'].includes(value.state)) return;
      const validDays = ['string', 'number'].includes(typeof value.days) && String(value.days).trim() !== '' && Number.isFinite(+value.days) && +value.days >= 0 && +value.days <= 365;
      result[id] = {
        state: value.state,
        month: typeof value.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value.month) ? value.month : '',
        days: validDays ? String(value.days) : '',
        note: typeof value.note === 'string' ? value.note.slice(0, 3000) : ''
      };
    });
    return result;
  }
  try { plan = clean(JSON.parse(localStorage.getItem(key) || '{}')); }
  catch (_) { storageOK = false; }
  function el(tag, text, cls) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  }
  function toast(text) {
    const host = $('#status');
    if (!host) return;
    host.textContent = text;
    host.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => host.hidden = true, 4200);
  }
  function update() {
    const values = Object.values(plan);
    $$('[data-plan-count]').forEach(node => node.textContent = values.length);
    if ($('#want-count')) $('#want-count').textContent = values.filter(v => v.state === 'want').length;
    if ($('#visited-count')) $('#visited-count').textContent = values.filter(v => v.state === 'visited').length;
    if ($('#storage-warning')) $('#storage-warning').hidden = storageOK;
    $$('[data-save]').forEach(button => {
      const value = plan[button.dataset.save];
      button.setAttribute('aria-pressed', String(!!value));
      button.textContent = value ? (value.state === 'visited' ? '已去过 ✓' : '已加入想去 ✓') : '＋ 加入想去';
    });
  }
  function persist() {
    try { localStorage.setItem(key, JSON.stringify(plan)); storageOK = true; }
    catch (_) { storageOK = false; toast('浏览器未能保存。请导出备份后再离开页面。'); }
    update();
  }
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], {type}));
    const link = el('a'); link.href = url; link.download = name;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function cityUrl(p, i) { return `${base}regions/${p.id}.html#city-${i}`; }
  function renderPlan() {
    const host = $('#plan-list');
    if (!host) return;
    host.replaceChildren();
    const filter = $('#plan-filter').value;
    const entries = Object.entries(plan).filter(([, value]) => filter === 'all' || value.state === filter);
    if (!entries.length) { host.append(el('p', '这里还没有目的地。打开一个地区，在城市详解中点击“加入想去”。', 'empty')); return; }
    entries.forEach(([id, value]) => {
      const {p, c, i} = lookup.get(id);
      const article = el('article', undefined, 'plan-item'); article.dataset.plan = id;
      const header = el('header'), title = el('h3'), link = el('a', `${p.name} / ${c.name}`);
      link.href = cityUrl(p, i); title.append(link);
      const controls = el('div'), select = el('select');
      select.setAttribute('aria-label', `${c.name}的旅行状态`);
      [['want', '想去'], ['visited', '已去过']].forEach(([val, text]) => { const option = el('option', text); option.value = val; select.append(option); });
      select.value = value.state;
      select.addEventListener('change', () => { value.state = select.value; persist(); renderPlan(); });
      const remove = el('button', '移除'); remove.type = 'button'; remove.setAttribute('aria-label', `移除${c.name}`);
      remove.addEventListener('click', () => { delete plan[id]; persist(); renderPlan(); toast('已移除，可随时在城市攻略中重新加入。'); });
      controls.append(select, document.createTextNode(' '), remove); header.append(title, controls);
      article.append(header, el('p', c.sights));
      const fields = el('div', undefined, 'plan-inputs');
      [['month', '计划月份', 'month'], ['days', '停留天数', 'number'], ['note', '我的想法 / 想吃什么 / 待查信息', 'textarea']].forEach(([field, label, type]) => {
        const lab = el('label', label), input = el(type === 'textarea' ? 'textarea' : 'input');
        if (type !== 'textarea') input.type = type;
        input.value = value[field] || '';
        input.setAttribute('aria-label', `${c.name}：${label}`);
        if (type === 'number') { input.min = 0; input.max = 365; input.step = '0.5'; }
        if (type === 'textarea') input.maxLength = 3000;
        input.addEventListener('input', () => { value[field] = input.value; persist(); });
        lab.append(input); fields.append(lab);
      });
      article.append(fields); host.append(article);
    });
  }
  document.addEventListener('click', event => {
    const save = event.target.closest('[data-save]');
    if (save && lookup.has(save.dataset.save)) {
      if (!plan[save.dataset.save]) {
        plan[save.dataset.save] = {state: 'want', month: '', days: '', note: ''};
        persist(); renderPlan(); toast('已加入想去。可在“我的清单”填写月份、天数和笔记。');
      } else toast('已经在清单中，可到“我的清单”修改状态或移除。');
    }
    if (event.target.closest('[data-print]')) window.print();
  });
  if ($('#plan-filter')) {
    $('#plan-filter').addEventListener('change', renderPlan);
    $('#export-plan').addEventListener('click', () => download('未来旅游规划-备份.json', JSON.stringify({version: 1, exportedAt: new Date().toISOString(), plan}, null, 2), 'application/json'));
    $('#import-plan').addEventListener('click', () => $('#import-file').click());
    $('#import-file').addEventListener('change', async event => {
      const file = event.target.files[0]; if (!file) return;
      try {
        if (file.size > 2e6) throw Error('File too large');
        const raw = JSON.parse(await file.text());
        if (raw.version !== 1) throw Error('Unsupported version');
        const next = clean(raw.plan);
        if (!Object.keys(next).length) throw Error('No valid entries');
        plan = {...plan, ...next}; persist(); renderPlan(); toast('已合并备份；重复目的地采用备份内容。');
      } catch (_) { toast('导入失败。请使用本页面导出的有效JSON备份。'); }
      event.target.value = '';
    });
    $('#export-text').addEventListener('click', () => {
      let text = '# 我的未来旅游规划\n\n';
      Object.entries(plan).forEach(([id, value]) => {
        const {p, c, i} = lookup.get(id);
        text += `## ${p.name} / ${c.name}\n\n状态：${value.state === 'want' ? '想去' : '已去'}；月份：${value.month || '未定'}；天数：${value.days || '未定'}\n\n景点：${c.sights}\n\n历史人文：${c.history}\n\n美食：${c.food}\n\n我的想法：${value.note || '暂无'}\n\n详细攻略：https://zbyloveyj.github.io/personal-growth-lab/academy/travel-plans/regions/${p.id}.html#city-${i}\n\n`;
      });
      download('我的旅行清单.md', text, 'text/markdown;charset=utf-8');
    });
  }
  if (document.body.dataset.page === 'home') {
    let area = '全部';
    function filter() {
      const query = $('#search').value.trim().toLowerCase();
      let regionCount = 0, placeCount = 0;
      $$('.destination').forEach(card => {
        const p = data.find(p => p.id === card.dataset.id);
        const ownMatch = [p.name, p.region].join(' ').toLowerCase().includes(query);
        const guideMatch = [p.memory, p.intro].join(' ').toLowerCase().includes(query);
        const matches = p.places.map((c, i) => ({c, i})).filter(({c}) => [c.name, c.sights, c.food, c.history, c.theme, c.search].join(' ').toLowerCase().includes(query));
        card.hidden = !((area === '全部' || p.region === area) && (!query || ownMatch || guideMatch || matches.length));
        const host = card.querySelector('.match-links'); host.replaceChildren();
        if (!card.hidden) {
          regionCount++; placeCount += query && !ownMatch ? matches.length : p.places.length;
          if (query && !ownMatch) matches.slice(0, 5).forEach(({c, i}) => { const a = el('a', `${c.name} ↗`); a.href = cityUrl(p, i); host.append(a); });
          if (query && !ownMatch && !matches.length && guideMatch) host.append(el('span', '地区导读包含此线索，可进入查看。', 'small-note'));
        }
      });
      $('#result-count').textContent = `找到 ${regionCount} 个地区 · ${placeCount} 个相关城市与旅行片区`;
      $('#no-results').hidden = regionCount > 0;
      $$('[data-area]').forEach(button => { if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', String(button.dataset.area === area)); });
    }
    $('#search').addEventListener('input', filter);
    $('#area-filters').addEventListener('click', event => { const button = event.target.closest('button[data-area]'); if (button) { area = button.dataset.area; filter(); } });
    $('#clear-search').addEventListener('click', () => { area = '全部'; $('#search').value = ''; filter(); $('#search').focus(); });
    $('#random-region').addEventListener('click', () => { const shown = $$('.destination').filter(n => !n.hidden); if (shown.length) location.href = shown[Math.floor(Math.random() * shown.length)].querySelector('a').href; });
    function legacyLink() {
      const match = location.hash.match(/^#region-([a-z]+)$/);
      if (match && data.some(p => p.id === match[1])) location.replace(`regions/${match[1]}.html`);
      const place = location.hash.match(/^#place-([a-z]+)-(\d+)$/);
      if (place && lookup.has(`${place[1]}:${place[2]}`)) location.replace(`regions/${place[1]}.html#city-${place[2]}`);
    }
    window.addEventListener('hashchange', legacyLink); legacyLink(); filter();
  }
  if (document.body.dataset.page === 'region') {
    const guides = $$('.city-guide');
    function openHash() {
      const match = location.hash.match(/^#city-(\d+)$/);
      if (!match) return;
      const target = guides.find(node => node.id === `city-${match[1]}`);
      if (target) {
        if (target.hidden) { $('#city-search').value = ''; filterCities(); }
        target.open = true; target.scrollIntoView({behavior: 'instant', block: 'start'});
      }
    }
    let previousOpen = null;
    function filterCities() {
      const query = $('#city-search').value.trim().toLowerCase();
      if (query && !previousOpen) previousOpen = new Set(guides.filter(n => n.open).map(n => n.id));
      let count = 0;
      guides.forEach(guide => {
        guide.hidden = !!query && !guide.dataset.search.toLowerCase().includes(query);
        if (!guide.hidden) count++;
        if (query && !guide.hidden) guide.open = true;
        if (!query && previousOpen) guide.open = previousOpen.has(guide.id);
        const nav = $(`[data-city-link="${guide.dataset.city}"]`); if (nav) nav.hidden = guide.hidden;
      });
      if (!query) previousOpen = null;
      $('#city-count').textContent = `显示 ${count} / ${guides.length} 个城市与片区`;
      $('#no-cities').hidden = count > 0; updateExpand();
    }
    function updateExpand() {
      const visible = guides.filter(n => !n.hidden);
      $('#expand-cities').textContent = visible.length && visible.every(n => n.open) ? '收起全部城市' : '展开全部城市';
    }
    $('#city-search').addEventListener('input', filterCities);
    $('#expand-cities').addEventListener('click', () => {
      const visible = guides.filter(n => !n.hidden), open = !visible.every(n => n.open);
      visible.forEach(n => n.open = open); updateExpand();
    });
    guides.forEach(guide => guide.addEventListener('toggle', updateExpand));
    $$('[data-city-link]').forEach(a => a.addEventListener('click', () => { const node = $(`#city-${a.dataset.cityLink}`); if (node) node.open = true; }));
    window.addEventListener('hashchange', openHash);
    let beforePrint;
    window.addEventListener('beforeprint', () => { beforePrint = guides.map(n => n.open); guides.forEach(n => n.open = true); });
    window.addEventListener('afterprint', () => { if (beforePrint) guides.forEach((n, i) => n.open = beforePrint[i]); });
    openHash(); updateExpand();
  }
  window.addEventListener('storage', event => {
    if (event.key === key) { try { plan = clean(JSON.parse(event.newValue || '{}')); update(); renderPlan(); } catch (_) {} }
  });
  update(); renderPlan();
})();
