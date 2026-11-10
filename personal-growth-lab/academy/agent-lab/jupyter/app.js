const courseUrl='lessons.json';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let lessons=[];
let active=0;
function render(){
 const l=lessons[active];if(!l)return;
 document.querySelector('#nav').innerHTML=lessons.map((x,i)=>'<button class="chapter'+(i===active?' selected':'')+'" data-i="'+i+'"><small>'+String(i+1).padStart(2,'0')+' / '+esc(x.stage)+'</small><span>'+esc(x.title)+'</span></button>').join('');
 document.querySelector('#detail').innerHTML='<p class="eyebrow">CHAPTER '+String(active+1).padStart(2,'0')+' / '+lessons.length+'</p><h2>'+esc(l.title)+'</h2><p class="question">'+esc(l.question)+'</p><h3>原理与应用</h3><p>'+esc(l.concept)+'</p><h3>逐步操作</h3><ol>'+l.steps.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ol><h3>预期结果</h3><p>'+esc(l.output)+'</p><div class="note"><strong>常见误区</strong><p>'+esc(l.pitfall)+'</p></div><div class="foot"><button id="prev" '+(active===0?'disabled':'')+'>上一讲</button><span>第 '+(active+1)+' / '+lessons.length+' 讲</span><button id="next" '+(active===lessons.length-1?'disabled':'')+'>下一讲</button></div>';
 document.querySelector('#prev').onclick=()=>change(active-1);document.querySelector('#next').onclick=()=>change(active+1);
 document.querySelectorAll('[data-i]').forEach(btn=>btn.onclick=()=>change(Number(btn.dataset.i)));
 location.hash='lesson-'+(active+1);
}
function change(n){if(n<0||n>=lessons.length)return;active=n;render();if(innerWidth<850)document.querySelector('#detail').scrollIntoView({behavior:'smooth',block:'start'});}
fetch(courseUrl).then(r=>{if(!r.ok)throw Error('加载失败');return r.json()}).then(d=>{lessons=d.lessons;let m=location.hash.match(/lesson-(\d+)/);active=m?Math.min(lessons.length-1,Math.max(0,Number(m[1])-1)):0;render()}).catch(e=>document.querySelector('#detail').innerHTML='<p>课程数据未能载入。可直接从下方GitHub下载Notebook阅读。</p>');
