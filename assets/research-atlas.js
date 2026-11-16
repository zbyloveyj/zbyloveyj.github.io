(() => {
 const visual = document.querySelector('.research-visual');
 if (!visual) return;
 visual.querySelectorAll('[data-scale-button]').forEach(button => button.addEventListener('click', () => {
   const selected = button.dataset.scaleButton;
   visual.querySelectorAll('[data-scale-button]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
   visual.querySelectorAll('[data-scale-copy]').forEach(copy => { copy.hidden = copy.dataset.scaleCopy !== selected; });
   visual.querySelectorAll('[data-scale]').forEach(layer => { layer.classList.toggle('scale-highlight', layer.dataset.scale === selected); });
 }));
})();
