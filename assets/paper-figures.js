(() => {
 const dialog = document.querySelector('.paper-lightbox');
 if (!dialog) return;
 let trigger;
 document.querySelectorAll('[data-paper-figure]').forEach(button => button.addEventListener('click', () => {
  trigger = button;
  const image = button.querySelector('img');
  const enlarged = dialog.querySelector('img');
  enlarged.src = image.currentSrc || image.src;
  enlarged.alt = image.alt;
  dialog.querySelector('.lightbox-source').innerHTML = button.closest('figure').querySelector('figcaption').innerHTML;
  dialog.showModal();
 }));
 dialog.querySelector('.figure-close').addEventListener('click', () => dialog.close());
 dialog.addEventListener('click', event => { if(event.target === dialog) dialog.close(); });
 dialog.addEventListener('close', () => trigger?.focus());
})();
