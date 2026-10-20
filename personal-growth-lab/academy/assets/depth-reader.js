'use strict';
(()=>{
const A=window.ACADEMY,main=document.getElementById('main');
if(!A||!main)return;
const E=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const KEY='yixindao.growth-academy.v1';
const byId=Object.fromEntries(A.courses.map(c=>[c.id,c]));
function current(){const p=location.hash.replace(/^#\/?/,'').split('/').filter(Boolean),c=byId[p[0]];return{c,l:c?.lessons.find(x=>x.id===Number(p[1]))};}
function paragraph(body){return String(body).split(/\n+/).filter(Boolean).map(p=>`<p>${E(p)}</p>`).join('');}
function record(c,l){try{return JSON.parse(localStorage.getItem(KEY)||'{}').records?.[c.id+':'+l.id]||{};}catch(_){return{};}}
function notify(text){const box=document.getElementById('toast');if(!box)return;box.textContent=text;box.hidden=false;setTimeout(()=>{if(box.textContent===text)box.hidden=true;},4500);}
function save(name,content,mime='text/plain;charset=utf-8'){const url=URL.createObjectURL(new Blob([content],{type:mime})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);}
function markdown(c,l,notes=true){
 const r=record(c,l),fence='```';
 let text=`# ${c.name} · 第${l.id}${c.unit}\n\n## ${l.title}\n\n版本：${A.version}\n建议主动学习时间：${l.minutes}分钟，可分次完成\n阶段：${l.stage}\n\n${l.concept}\n`;
 if(l.material)text+='\n## 原创基础练习材料\n\n'+l.material+'\n';
 if(l.example)text+='\n## 原有场景提示\n\n'+l.example+'\n';
 for(const s of l.detail||[]){text+='\n## '+s.title+'\n\n'+s.body+'\n';if(s.code)text+='\n'+fence+'python\n'+s.code.trimEnd()+'\n'+fence+'\n';}
 text+='\n## 本课任务与交付\n\n'+l.tasks.map((t,i)=>`- [${notes&&r.tasks?.[i]?'x':' '}] ${t}`).join('\n')+'\n\n'+l.output+'\n\n### 验收标准\n\n'+l.criteria.map(t=>'- '+t).join('\n');
 const refs=[...(l.refs||[]).map(k=>A.resources[k]).filter(Boolean),...(l.links||[])];
 if(refs.length)text+='\n\n## 材料与原始来源\n\n'+refs.map(x=>'- '+x.name+'：'+x.url).join('\n');
 if(notes){const note=document.getElementById('note')?.value??r.note??'',artifact=document.getElementById('artifact')?.value??r.artifact??'';text+='\n\n## 我的记录\n\n'+note+'\n\n作品位置：'+artifact+'\n';}
 return text+'\n';
}
function badge(){return '<div class="depth-edition no-print"><span>详细教学版</span><p>先学习，再动手，最后对照解析。课程与记录编号保持不变。</p><small>2026.10.20.2</small></div>';}
function enhance(){
 const {c,l}=current(),sheet=main.querySelector('.lesson-sheet');
 if(sheet&&l?.detail){
  if(sheet.querySelector('#depth-handbook'))return;
  const block=document.createElement('section');block.id='depth-handbook';block.className='depth-handbook';
  block.setAttribute('aria-label','本课详细教学正文');
  const chars=l.detail.reduce((n,s)=>n+s.body.length,0);
  block.innerHTML=`<div class="depth-intro"><p class="depth-kicker">LEARN · PRACTISE · REVIEW</p><h2>本课详细讲义</h2><p>共${l.detail.length}个教学环节。先独立练习，再展开参考解析；这不是只有任务标题的打卡页。</p><div class="depth-tools no-print"><button type="button" data-depth="answers">展开全部参考解析</button><button type="button" data-depth="copy-outline">复制本课笔记提纲</button>${l.code?'<button type="button" class="primary" data-depth="code">下载本课Python示例</button>':''}</div><p class="depth-small">学习可以分次进行。原记录保留；旧版完成状态不代表已练过本次新增内容。</p></div><nav class="depth-toc no-print" aria-label="本课教学环节">${l.detail.map((s,i)=>`<button type="button" data-depth-jump="depth-section-${i}"><span>${String(i+1).padStart(2,'0')}</span>${E(s.title.replace(/^\d+\s*\/\s*/,''))}</button>`).join('')}</nav><div class="depth-sections">${l.detail.map((s,i)=>s.kind==='answer'?`<details class="depth-section depth-answer" id="depth-section-${i}"><summary><span class="depth-section-number">${String(i+1).padStart(2,'0')}</span><span>${E(s.title.replace(/^\d+\s*\/\s*/,''))}</span><small>先作答，再展开</small></summary><div class="depth-section-body">${paragraph(s.body)}</div></details>`:`<section class="depth-section depth-${E(s.kind||'lesson')}" id="depth-section-${i}"><h3><span class="depth-section-number">${String(i+1).padStart(2,'0')}</span>${E(s.title.replace(/^\d+\s*\/\s*/,''))}</h3><div class="depth-section-body">${paragraph(s.body)}${s.code?`<div class="depth-code-label"><span>Python · ${E(l.codeRequires||'本课示例')}</span><button class="no-print" type="button" data-depth="code">保存 .py</button></div><pre class="depth-code"><code>${E(s.code.trimEnd())}</code></pre>`:''}</div></section>`).join('')}</div>`;
  block.dataset.contentCharacters=String(chars);
  const tasks=sheet.querySelector('#task-list'),before=tasks?.previousElementSibling;
  if(before?.tagName==='H2')before.before(block);else sheet.querySelector('.concept')?.after(block);
  const meta=sheet.querySelector('.lesson-meta');if(meta)meta.insertAdjacentHTML('afterend',badge());
  return;
 }
 if(!sheet&&!main.querySelector('.depth-edition')){
  const heading=main.querySelector('.course-summary')||main.querySelector('.hero')||main.querySelector('.library-top')||main.querySelector('.help-section');
  if(heading)heading.insertAdjacentHTML('beforebegin',badge());
 }
}
function answers(open){document.querySelectorAll('.depth-answer').forEach(d=>d.open=open);const b=document.querySelector('[data-depth="answers"]');if(b)b.textContent=open?'收起全部参考解析':'展开全部参考解析';}
async function copy(text){try{await navigator.clipboard.writeText(text);notify('笔记提纲已复制。粘贴到下方草稿后填写自己的内容。');}catch(_){save('本课笔记提纲.txt',text);notify('浏览器未允许复制，已改为下载提纲。');}}
document.addEventListener('click',e=>{
 const jump=e.target.closest('[data-depth-jump]');if(jump){e.preventDefault();e.stopImmediatePropagation();document.getElementById(jump.dataset.depthJump)?.scrollIntoView({behavior:'smooth',block:'start'});return;}
 const button=e.target.closest('[data-depth],[data-act]');if(!button)return;
 const {c,l}=current(),act=button.dataset.act,action=button.dataset.depth;
 if(action){e.preventDefault();e.stopImmediatePropagation();
  if(action==='answers'){answers([...document.querySelectorAll('.depth-answer')].some(d=>!d.open));return;}
  if(action==='code'&&l?.code){save(`coding-${String(l.id).padStart(2,'0')}.py`,'# Growth Academy detailed edition\n# '+l.title+'\n# Dependencies: '+l.codeRequires+'\n# Synthetic / teaching data only.\n\n'+l.code,'text/x-python;charset=utf-8');return;}
  if(action==='copy-outline'&&l){copy(`${c.name} · ${l.title}\n\n一、今天的问题与已有基础\n\n二、我的第一次答案\n\n三、实操过程与输出\n\n四、对照解析后的修订\n\n五、仍不确定的点与下一步\n\n作品文件名/保存位置：\n`);return;}
 }
 if(act==='export-lesson'&&c&&l?.detail){e.preventDefault();e.stopImmediatePropagation();save(`${c.name}-${String(l.id).padStart(3,'0')}-详细讲义.md`,markdown(c,l,true));notify('已导出本课完整讲义，包含参考解析、代码（如有）和当前笔记。');return;}
 if(act==='export-course'&&c){e.preventDefault();e.stopImmediatePropagation();save(c.name+'-完整详细课程.md',`# ${c.name}\n\n${c.intro}\n\n${c.note}\n\n版本：${A.version}\n整套教材不含私人笔记。\n\n`+c.lessons.map(x=>markdown(c,x,false)).join('\n---\n\n'));notify('已导出整套详细教材，包含全部教学正文与参考解析，不含私人笔记。');return;}
},true);
let printState=[];
window.addEventListener('beforeprint',()=>{printState=[...document.querySelectorAll('.depth-answer')].map(d=>[d,d.open]);printState.forEach(([d])=>d.open=true);});
window.addEventListener('afterprint',()=>{for(const [d,open] of printState)if(d.isConnected)d.open=open;printState=[];});
const observer=new MutationObserver(()=>enhance());observer.observe(main,{childList:true,subtree:true});
enhance();
// Exposed read-only helpers for reproducible tests and curriculum audits, not learner records.
window.ACADEMY_DEPTH={version:A.version,markdown:(courseId,lessonId)=>{const c=byId[courseId],l=c?.lessons.find(x=>x.id===lessonId);return l?markdown(c,l,false):null;},enhance};
})();