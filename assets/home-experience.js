/* Progressive method tabs and a scroll-aware homepage index. */
(() => {
  'use strict';
  const explorer = document.querySelector('.method-explorer');
  if (explorer) {
    const list = explorer.querySelector('.method-tabs');
    const tabs = [...list.querySelectorAll('button')];
    const panels = [...explorer.querySelectorAll('.method-panel')];
    list.hidden = false;
    list.setAttribute('role', 'tablist');
    list.setAttribute('aria-labelledby', 'method-heading');
    tabs.forEach(tab => tab.setAttribute('role', 'tab'));
    panels.forEach(panel => {
      panel.setAttribute('role', 'tabpanel');
      panel.tabIndex = 0;
    });
    function select(index, focus = false) {
      tabs.forEach((tab, i) => {
        tab.setAttribute('aria-selected', String(i === index));
        tab.tabIndex = i === index ? 0 : -1;
        panels[i].hidden = i !== index;
      });
      if (focus) tabs[index].focus();
    }
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => select(index));
      tab.addEventListener('keydown', event => {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next === undefined) return;
        event.preventDefault();
        select(next, true);
      });
    });
    select(0);
  }
  const index = document.querySelector('.home-toc');
  if (!index) return;
  const links = [...index.querySelectorAll('a')];
  const sections = links.map(link => document.getElementById(link.hash.slice(1)));
  let pending = false;
  function updateIndex() {
    pending = false;
    const boundary = index.getBoundingClientRect().bottom + 40;
    let active = -1;
    sections.forEach((section, i) => {
      if (section && section.getBoundingClientRect().top <= boundary) active = i;
    });
    links.forEach((link, i) => {
      if (i === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  function schedule() {
    if (!pending) {
      pending = true;
      requestAnimationFrame(updateIndex);
    }
  }
  addEventListener('scroll', schedule, {passive: true});
  addEventListener('resize', schedule);
  document.getElementById('lang-toggle')?.addEventListener('click', schedule);
  updateIndex();
})();
