/* Filter the static directory; every destination remains available without scripts. */
(() => {
  'use strict';
  const input = document.getElementById('directory-search');
  if (!input) return;
  const form = input.closest('form');
  const filters = document.querySelector('.directory-filters');
  const buttons = [...filters.querySelectorAll('[data-directory-filter]')];
  const groups = [...document.querySelectorAll('[data-directory-group]')];
  const entries = [...document.querySelectorAll('[data-directory-entry]')];
  const count = document.getElementById('directory-count');
  const empty = document.querySelector('.directory-empty');
  const normalize = text => text.normalize('NFKC').toLocaleLowerCase().replace(/[–—-]/g, ' ');
  const validCategories = new Set(['all', ...groups.map(group => group.dataset.directoryGroup)]);
  const initialParams = new URLSearchParams(location.search);
  let category = validCategories.has(initialParams.get('category')) ? initialParams.get('category') : 'all';
  input.value = initialParams.get('q') || '';
  filters.hidden = false;

  function update({syncUrl = true} = {}) {
    const words = normalize(input.value.trim()).split(/\s+/).filter(Boolean);
    let total = 0;
    groups.forEach(group => {
      const matchesCategory = category === 'all' || category === group.dataset.directoryGroup;
      let shown = 0;
      group.querySelectorAll('[data-directory-entry]').forEach(entry => {
        const matches = matchesCategory && words.every(word => normalize(entry.dataset.directorySearch || entry.textContent).includes(word));
        entry.hidden = !matches;
        if (matches) shown++;
      });
      group.hidden = shown === 0;
      const groupCount = group.querySelector('.directory-group-count');
      if (groupCount) groupCount.textContent = String(shown);
      total += shown;
    });
    const en = document.documentElement.dataset.lang === 'en';
    count.textContent = en ? `${total} of ${entries.length} destinations` : `显示 ${total} / ${entries.length} 个内容入口`;
    if (empty) empty.hidden = total !== 0;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.directoryFilter === category)));
    if (syncUrl) {
      const url = new URL(location.href);
      if (input.value.trim()) url.searchParams.set('q', input.value.trim());
      else url.searchParams.delete('q');
      if (category !== 'all') url.searchParams.set('category', category);
      else url.searchParams.delete('category');
      try { history.replaceState(null, '', url); } catch (_) {}
    }
  }
  input.addEventListener('input', () => update());
  form.addEventListener('submit', event => { event.preventDefault(); update(); });
  form.addEventListener('reset', event => {
    event.preventDefault();
    category = 'all';
    input.value = '';
    update();
    input.focus();
  });
  buttons.forEach(button => button.addEventListener('click', () => {
    category = button.dataset.directoryFilter;
    update();
  }));
  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(location.search);
    category = validCategories.has(params.get('category')) ? params.get('category') : 'all';
    input.value = params.get('q') || '';
    update({syncUrl: false});
  });
  document.getElementById('lang-toggle')?.addEventListener('click', () => queueMicrotask(() => update({syncUrl: false})));
  update({syncUrl: false});
})();
