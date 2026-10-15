/* Independent academic pages: citation metadata, page identity and keyboard usability. */
(() => {
'use strict';
const pageClass = document.body.className.match(/\bpage-(research|publications|projects)\b/);
const path = pageClass ? pageClass[1]+'.html' : (location.pathname.split('/').pop()||'index.html');
const pageName=path.replace('.html','');
const labels={
 'research':{en:'Research | Baoyuan Zhu',zh:'研究方向 | 朱宝圆',href:'research.html'},
 'publications':{en:'Publications | Baoyuan Zhu',zh:'学术论文 | 朱宝圆',href:'publications.html'},
 'projects':{en:'Open Science | Baoyuan Zhu',zh:'开源项目 | 朱宝圆',href:'projects.html'}
};
if(labels[pageName]){
 const link=[...document.querySelectorAll('#main-nav a')].find(x=>x.getAttribute('href')===labels[pageName].href);
 if(link){link.classList.add('active');link.setAttribute('aria-current','page')}
}
const data=window.ACADEMIC_DATA?.publications||[];
const lang=()=>document.documentElement.dataset.lang==='zh'?'zh':'en';
const htmlEscape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function setPageTitle(){if(labels[pageName])document.title=labels[pageName][lang()];}
const switcher=document.getElementById('lang-toggle');
switcher?.addEventListener('click',()=>queueMicrotask(setPageTitle));
setPageTitle();
// Full-author BibTeX is generated only from publisher/PubMed confirmed authors in data.js.
function bib(p){
 if(!p||!p.fullAuthors?.length)return '';
 const fields={title:p.title,author:p.fullAuthors.join(' and '),journal:p.journal,year:String(p.year),doi:p.doi,url:'https://doi.org/'+p.doi};
 for(const key of ['volume','number','pages'])if(p[key])fields[key]=p[key];
 const escapeBib=v=>String(v).replace(/[{}]/g,c=>'\\'+c).replace(/&/g,'\\&');
 return '@article{'+p.key+',\n'+Object.entries(fields).map(([k,v])=>'  '+k+' = {'+escapeBib(v)+'}').join(',\n')+'\n}';
}
async function copy(text){
 try{
  if(navigator.clipboard && window.isSecureContext)await navigator.clipboard.writeText(text);
  else{const e=document.createElement('textarea');e.value=text;e.style.position='fixed';e.style.opacity='0';document.body.append(e);e.select();if(!document.execCommand('copy'))throw Error('denied');e.remove()}
  showToast(lang()==='zh'?'BibTeX 已复制':'BibTeX copied');
 }catch(e){showToast(lang()==='zh'?'复制失败，请下载 BibTeX 文件':'Copy unavailable; download BibTeX file')}
}
let toastTimer;
function showToast(message){
 let el=document.querySelector('.toast');if(!el){el=document.createElement('div');el.className='toast';el.setAttribute('role','status');document.body.append(el)}
 el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,2200);
}
if(pageName==='publications'){
 for(const item of document.querySelectorAll('.pub-item')){
  const n=Number(item.dataset.index),p=data[n],detail=item.querySelector('.pub-details'),actions=item.querySelector('.pub-links');
  if(!p||!detail||!actions)continue;
  const topic=document.createElement('span');topic.className='pub-topic';topic.textContent=p.topic||'Research';detail.append(topic);
  const notes=document.createElement('details');notes.className='pub-details-summary';
  notes.innerHTML='<summary><span class="en-only">Research note</span><span class="zh-only">论文研究概览</span></summary><p class="en-only">'+htmlEscape(p.focus||'')+'</p><p class="zh-only">'+htmlEscape(p.focusZh||'')+'</p>';
  detail.append(notes);
  const cite=document.createElement('button');cite.className='bib-copy';cite.type='button';cite.textContent='BibTeX ↗';cite.setAttribute('aria-label','Copy full-author BibTeX for '+p.title);
  cite.addEventListener('click',()=>copy(bib(p)));actions.append(cite);
 }
 // Slash focuses publication search unless the user is already typing.
 document.addEventListener('keydown',event=>{
  const t=event.target?.tagName||'';
  if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!/^(INPUT|TEXTAREA|SELECT)$/.test(t)&&!event.target?.isContentEditable){event.preventDefault();document.getElementById('pub-search')?.focus()}
 });
}
})();
