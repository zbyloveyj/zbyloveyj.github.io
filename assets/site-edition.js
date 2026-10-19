/* Four-book catalog: progressive enhancement; the full catalog remains readable without JavaScript. */
(() => {
 'use strict';
 const root = document.documentElement;
 const isBooks = document.body.classList.contains('page-books');
 const all = (s) => [...document.querySelectorAll(s)];
 let selection = 'all';
 function updateLabels() {
  const zh = root.dataset.lang === 'zh';
  if (isBooks) document.title = zh ? '著作与写作 · 一心问道 | 朱宝圆' : 'Books & Writing · 一心问道 | Baoyuan Zhu';
  const count = document.querySelector('.edition-filter-count');
  if (count) {
   const n = all('.edition-book').filter(e => !e.hidden).length;
   count.textContent = zh ? `共${n}本` : `${n} books`;
  }
  const group = document.querySelector('.edition-book-filters');
  if (group) group.setAttribute('aria-label', zh ? '按作品类型筛选' : 'Filter books by category');
 }
 function applyFilter(value) {
  selection = value;
  all('.edition-book').forEach(e => { e.hidden = selection !== 'all' && e.dataset.bookKind !== selection; });
  all('[data-book-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.bookFilter === selection)));
  updateLabels();
 }
 const filters = document.querySelector('.edition-book-filters');
 if (filters) {
  filters.hidden = false;
  all('[data-book-filter]').forEach(b => b.addEventListener('click', () => applyFilter(b.dataset.bookFilter)));
 }
 if (isBooks) {
  all('#main-nav a').forEach(a => {
   const active = a.getAttribute('href') === 'books.html';
   a.classList.toggle('active', active);
   if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
 }
 all('.edition-cover img').forEach(img => {
  const failure = () => { img.hidden = true; };
  const success = () => { img.style.opacity = '1'; };
  if (!img.complete || !img.naturalWidth) img.style.opacity = '0';
  img.addEventListener('load', success, {once:true});
  img.addEventListener('error', failure, {once:true});
  if (img.complete && !img.naturalWidth) failure();
 });
 function revealLinkedBook() {
  if (!isBooks || !/^#book-(microbes|brain|agent|handbook)$/.test(location.hash)) return;
  applyFilter('all');
  document.querySelector(location.hash)?.scrollIntoView({block:'start', behavior:'auto'});
 }
 document.querySelector('#lang-toggle')?.addEventListener('click', () => queueMicrotask(updateLabels));
 window.addEventListener('hashchange', revealLinkedBook);
 updateLabels();
 if (location.hash.startsWith('#book-')) requestAnimationFrame(revealLinkedBook);
})();
