/* Keyboard-accessible research-method previews and legacy section routing. */
(() => {
  'use strict';
  if (location.hash === '#journals') {
    const target = new URL('publications.html', location.href);
    target.search = location.search;
    target.hash = 'journals';
    location.replace(target.href);
    return;
  }
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
})();
