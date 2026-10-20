'use strict';
(()=>{
const A=window.ACADEMY,main=document.getElementById('main');if(!A||!main)return;
const E=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const byId=Object.fromEntries(A.courses.map(c=>[c.id,c])),KEY='yixindao.growth-academy.v1';
function current(){const p=location.hash.replace(/^#\/?/,'').split('/').filter(Boolean),c=byId[p[0]];return{c,l:c?.lessons.find(x=>x.id===Number(p[1]))};}
const paragraphs=s=>String(s).split(/\n+/).filter(Boolean).map(p=>'<p>'+E(p)+'</p>').join('');
const cleanTitle=s=>s.replace(/^\d+\s*\/\s*/,'');
function rec(c,l){try{return JSON.parse(localStorage.getItem(KEY)||'{}').records?.[c.id+':'+l.id]||{};}catch(_){return{};}}
function toast(t){const el=document.getElementById('toast');if(!el)return;el.textContent=t;el.hidden=false;setTimeout(()=>{if(el.textContent===t)el.hidden=true;},4000);}
function download(name,text,mime='text/plain;charset=utf-8'){const u=URL.createObjectURL(new Blob([text],{type:mime})),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),15000);}
function markdown(c,l,notes=false){
 const r=rec(c,l),fence='```';
 let text=`# ${c.name} · 第${l.id}${c.unit}\n\n## ${l.title}\n\n版本：${A.version}\n阶段：${l.stage}\n建议主动学习时间：${l.minutes}分钟，可分次完成\n\n${l.concept}\n`;
 if(l.material)text+='\n## 原创基础材料\n\n'+l.material+'\n';
 if(l.example)text+='\n## 基础场景提示\n\n'+l.example+'\n';
 for(const s of l.detail||[]){text+='\n## '+cleanTitle(s.title)+'\n\n'+s.body+'\n';if(s.code)text+='\n'+fence+'python\n'+s.code.trimEnd()+'\n'+fence+'\n';}
 text+='\n## 本课任务\n\n'+l.tasks.map((t,i)=>`- [${notes&&r.tasks?.[i]?'x':' '}] ${t}`).join('\n')+'\n\n## 交付物\n\n'+l.output+'\n\n## 验收\n\n'+l.criteria.map(t=>'- '+t).join('\n');
 const refs=[...(l.refs||[]).map(k=>A.resources[k]).filter(Boolean),...(l.links||[])];if(refs.length)text+='\n\n## 来源与进一步学习\n\n'+refs.map(x=>'- '+x.name+'：'+x.url).join('\n');
 if(notes){const cur=current(),active=cur.c?.id===c.id&&cur.l?.id===l.id,note=active?(document.getElementById('note')?.value??r.note??''):(r.note??''),artifact=active?(document.getElementById('artifact')?.value??r.artifact??''):(r.artifact??'');text+='\n\n## 我的笔记\n\n'+note+'\n\n作品位置：'+artifact+'\n';}
 return text+'\n';
}
function badge(){return '<div class="depth-edition no-print"><span>实操教材版 V3</span><p>完整范例 · 逐步讲解 · 专属练习 · 参考解答</p><small>2026.10.20.3</small></div>';}
function codeSection(s,i,c,l){if(!s.code)return '';return `<div class="depth-code-label"><span>Python · ${E(c.id==='coding'?(l.codeRequires||'教学示例'):'合成数据绘图参考')}</span><button type="button" class="no-print" data-workbook-code="${i}">下载这一段 .py</button></div><pre class="depth-code"><code>${E(s.code.trimEnd())}</code></pre>`;}
function enhance(){
 const {c,l}=current(),sheet=main.querySelector('.lesson-sheet');
 if(sheet&&l?.detail){
  if(sheet.querySelector('#depth-handbook'))return;
  const block=document.createElement('section');block.id='depth-handbook';block.className='depth-handbook workbook';block.setAttribute('aria-label','完整实操教材');
  block.innerHTML=`<div class="depth-intro"><p class="depth-kicker">THE PRACTICAL WORKBOOK</p><h2>完整讲义与实操材料</h2><p>先看示范是怎样完成的，再独立做练习。答案可稍后展开，代码按段分别下载。</p><div class="depth-tools no-print"><button type="button" data-workbook="answers">展开全部参考解析</button><button type="button" data-workbook="outline">复制笔记提纲</button>${l.code?'<button type="button" data-workbook="base-code">下载基线代码</button>':''}${l.solutionCode?'<button type="button" data-workbook="solution-code">下载扩展解答</button>':''}</div><p class="depth-small">可分次完成。原笔记与进度保留；旧版完成不等于已练过新增材料。</p></div><nav class="depth-toc no-print" aria-label="本课讲义目录">${l.detail.map((s,i)=>`<button type="button" data-workbook-jump="workbook-part-${i}"><span>${String(i+1).padStart(2,'0')}</span>${E(cleanTitle(s.title))}</button>`).join('')}</nav><div class="depth-sections">${l.detail.map((s,i)=>s.kind==='answer'?`<details class="depth-section depth-answer" id="workbook-part-${i}"><summary><span class="depth-section-number">${String(i+1).padStart(2,'0')}</span><span>${E(cleanTitle(s.title))}</span><small>作答后展开</small></summary><div class="depth-section-body">${paragraphs(s.body)}${codeSection(s,i,c,l)}</div></details>`:`<section class="depth-section depth-${E(s.kind||'lesson')}" id="workbook-part-${i}"><h3><span class="depth-section-number">${String(i+1).padStart(2,'0')}</span>${E(cleanTitle(s.title))}</h3><div class="depth-section-body">${paragraphs(s.body)}${codeSection(s,i,c,l)}</div></section>`).join('')}</div>`;
  const concept=sheet.querySelector('.concept');if(concept)concept.after(block);else sheet.prepend(block);
  const meta=sheet.querySelector('.lesson-meta');if(meta)meta.insertAdjacentHTML('afterend',badge());
  const firstLegacy=block.nextElementSibling;if(firstLegacy?.tagName==='H2'&&/材料|示例/.test(firstLegacy.textContent)){const caption=document.createElement('p');caption.className='workbook-legacy-note';caption.textContent='基础材料与练习工具：可结合上方讲义使用。';block.after(caption);}
  return;
 }
 if(!sheet&&!main.querySelector('.depth-edition')){const target=main.querySelector('.course-summary')||main.querySelector('.hero')||main.querySelector('.library-top')||main.querySelector('.help-section');if(target)target.insertAdjacentHTML('beforebegin',badge());}
}
function setAnswers(open){main.querySelectorAll('.depth-answer').forEach(d=>d.open=open);const b=main.querySelector('[data-workbook="answers"]');if(b)b.textContent=open?'收起全部参考解析':'展开全部参考解析';}
function filename(c,l,label){return `${c.id}-${String(l.id).padStart(3,'0')}-${label}.py`;}
async function copyOutline(text){try{await navigator.clipboard.writeText(text);toast('笔记提纲已复制；粘贴后填写自己的答案。');}catch(_){download('本课笔记提纲.txt',text);toast('复制未获允许，已改为下载。');}}
document.addEventListener('click',e=>{
 const jump=e.target.closest('[data-workbook-jump]');if(jump){e.preventDefault();e.stopImmediatePropagation();document.getElementById(jump.dataset.workbookJump)?.scrollIntoView({behavior:'smooth',block:'start'});return;}
 const button=e.target.closest('[data-workbook],[data-workbook-code],[data-act]');if(!button)return;
 const {c,l}=current(),action=button.dataset.workbook,act=button.dataset.act;
 if(button.hasAttribute('data-workbook-code')){e.preventDefault();e.stopImmediatePropagation();const i=Number(button.dataset.workbookCode),s=l?.detail[i];if(s?.code)download(filename(c,l,'section-'+(i+1)),s.code,'text/x-python;charset=utf-8');return;}
 if(action){e.preventDefault();e.stopImmediatePropagation();
  if(action==='answers'){setAnswers([...main.querySelectorAll('.depth-answer')].some(d=>!d.open));return;}
  if(action==='base-code'&&l?.code){download(filename(c,l,'baseline'),l.code,'text/x-python;charset=utf-8');return;}
  if(action==='solution-code'&&l?.solutionCode){download(filename(c,l,'solution'),l.solutionCode,'text/x-python;charset=utf-8');return;}
  if(action==='outline'&&l){copyOutline(`${c.name} · ${l.title}\n\n一、这次要解决什么\n\n二、第一次独立答案\n\n三、实操与中间结果\n\n四、对照答案后的具体修订\n\n五、剩余问题与下一步\n\n作品文件名与位置：\n`);return;}
 }
 if(act==='export-lesson'&&c&&l){e.preventDefault();e.stopImmediatePropagation();download(`${c.name}-${String(l.id).padStart(3,'0')}-实操讲义.md`,markdown(c,l,true));toast('已导出完整正文、答案、全部代码及本课笔记。');return;}
 if(act==='export-course'&&c){e.preventDefault();e.stopImmediatePropagation();download(c.name+'-完整实操教材.md',`# ${c.name}\n\n版本：${A.version}\n\n${c.intro}\n\n${c.note}\n\n整套教材不包含私人笔记。\n\n`+c.lessons.map(x=>markdown(c,x,false)).join('\n---\n\n'));toast('已导出整套实操教材；不包含私人笔记。');return;}
},true);
let before=[];window.addEventListener('beforeprint',()=>{before=[...main.querySelectorAll('.depth-answer')].map(d=>[d,d.open]);before.forEach(([d])=>d.open=true);});window.addEventListener('afterprint',()=>{for(const [d,v] of before)if(d.isConnected)d.open=v;before=[];});
new MutationObserver(enhance).observe(main,{childList:true,subtree:true});enhance();
window.ACADEMY_WORKBOOK={version:A.version,markdown:(id,n)=>{const c=byId[id],l=c?.lessons.find(x=>x.id===n);return l?markdown(c,l,false):null;}};
})();