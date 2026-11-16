/* Apply only local appearance preferences before the first paint. */
(() => {
  const root = document.documentElement;
  let language = new URLSearchParams(location.search).get('lang');
  let theme = 'light';
  try {
    language = ['zh', 'en'].includes(language) ? language : localStorage.getItem('academic-site:lang');
    theme = localStorage.getItem('academic-site:theme') === 'dark' ? 'dark' : 'light';
  } catch (_) {}
  root.dataset.lang = language === 'en' ? 'en' : 'zh';
  root.lang = language === 'en' ? 'en' : 'zh-CN';
  root.dataset.theme = theme;
})();
