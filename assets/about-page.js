/* The biography and contact links work without JavaScript; clipboard copying is optional. */
(() => {
 'use strict';
 const button = document.querySelector('[data-copy-contact]');
 const status = document.querySelector('.personal-copy-status');
 if (!button || !status) return;
 let copied = false;
 function setStatus(success) {
  const zh = document.documentElement.dataset.lang === 'zh';
  status.textContent = success
   ? (zh ? '邮箱已复制。' : 'Email address copied.')
   : (zh ? '复制未获允许，请使用上方邮件链接。' : 'Copying is unavailable. Please use the email link above.');
 }
 button.addEventListener('click', async () => {
  try {
   if (!navigator.clipboard || !window.isSecureContext) throw new Error('Clipboard unavailable');
   await navigator.clipboard.writeText(button.dataset.copyContact);
   copied = true; setStatus(true);
  } catch (_) { copied = false; setStatus(false); }
 });
 document.querySelector('#lang-toggle')?.addEventListener('click', () => {
  if (status.textContent) queueMicrotask(() => setStatus(copied));
 });
})();
