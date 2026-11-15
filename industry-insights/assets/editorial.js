(() => {
  'use strict';
  function revealReference(hash=location.hash){
    if(!hash.startsWith('#'))return;
    const section=document.getElementById(hash.slice(1));
    const fold=section?.querySelector('.reference-fold');
    if(fold)fold.open=true;
  }
  window.addEventListener('hashchange',()=>revealReference());
  document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',()=>revealReference(a.getAttribute('href'))));
  revealReference();
  const query=document.getElementById('research-query');
  const sector=document.getElementById('research-sector');
  function filterArticles(){
    if(!query||!sector)return;
    const q=query.value.trim().toLocaleLowerCase(),s=sector.value;
    let count=0;
    document.querySelectorAll('[data-research-card]').forEach(card=>{
      const show=(!q||card.textContent.toLocaleLowerCase().includes(q))&&(s==='all'||card.dataset.sectors.split(' ').includes(s));
      card.hidden=!show;if(show)count++;
    });
    document.getElementById('research-result-count').textContent=count+'篇匹配专题';
    document.getElementById('research-empty').hidden=count>0;
  }
  query?.addEventListener('input',filterArticles);
  sector?.addEventListener('change',filterArticles);
  document.querySelectorAll('[data-source-filter]').forEach(button=>button.addEventListener('click',()=>{
    const group=button.dataset.sourceFilter;let count=0;
    document.querySelectorAll('[data-reading-group]').forEach(card=>{const show=group==='all'||card.dataset.readingGroup===group;card.hidden=!show;if(show)count++;});
    document.querySelectorAll('[data-source-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    document.getElementById('reading-count').textContent=count+'项外部阅读';
  }));
})();
