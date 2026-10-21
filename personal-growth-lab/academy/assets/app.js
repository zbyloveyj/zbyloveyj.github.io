'use strict';
(()=>{
const A=window.ACADEMY;if(!A||!Array.isArray(A.courses))return;
const courses=[...A.courses,...(A.externalCourses||[])].sort((a,b)=>Number(a.number)-Number(b.number));
const byId=Object.fromEntries(courses.map(c=>[c.id,c]));
const KEY='yixindao.growth-academy.v1';
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validUrl=u=>/^https:\/\//.test(u)?E(u):'#';
const key=(c,l)=>`${c.id}:${l.id}`;
const allowed=new Map(courses.flatMap(c=>c.lessons.map(l=>[key(c,l),l])));
const fresh=()=>({schema:1,records:{},last:{}});
let state=fresh(),persistent=true,curCourse=null,curLesson=null,toastTimer;
function normalize(raw){
 if(!raw||raw.schema!==1||!raw.records||typeof raw.records!=='object'||Array.isArray(raw.records))throw Error('这不是本学院的有效备份文件。');
 const result=fresh();
 for(const [k,v] of Object.entries(raw.records)){
  const l=allowed.get(k);if(!l||!v||typeof v!=='object')continue;
  const tasks=l.tasks.map((_,i)=>Array.isArray(v.tasks)&&v.tasks[i]===true);
  const date=typeof v.updatedAt==='string'&&Number.isFinite(Date.parse(v.updatedAt))?v.updatedAt:'1970-01-01T00:00:00.000Z';
  result.records[k]={tasks,done:v.done===true&&tasks.every(Boolean),note:typeof v.note==='string'?v.note.slice(0,100000):'',artifact:typeof v.artifact==='string'?v.artifact.slice(0,4000):'',score:Number.isInteger(v.score)&&v.score>=0&&v.score<=6?v.score:null,updatedAt:date};
 }
 if(raw.last&&typeof raw.last==='object')for(const c of courses){const id=Number(raw.last[c.id]);if(Number.isInteger(id)&&id>0&&id<=c.lessons.length)result.last[c.id]=id;}
 return result;
}
try{const s=localStorage.getItem(KEY);if(s)state=normalize(JSON.parse(s));localStorage.setItem(KEY,JSON.stringify(state));}catch(e){persistent=false;}
function toast(t){const box=document.getElementById('toast');box.textContent=t;box.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.hidden=true,4200);}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));persistent=true;}catch(e){persistent=false;toast('浏览器未能保存。当前记录仅在本页内存中，请立即导出备份。');}updateSaveStatus();}
function updateSaveStatus(){const el=document.getElementById('save-status');if(el)el.textContent=persistent?'已保存至当前浏览器 · 请定期导出备份':'未持久保存 · 离开前请导出备份';}
function rec(c,l){return state.records[key(c,l)]||{tasks:l.tasks.map(()=>false),done:false,note:'',artifact:'',score:null,updatedAt:''};}
function change(c,l,patch){const r={...rec(c,l),...patch,updatedAt:new Date().toISOString()};if(!r.tasks.every(Boolean))r.done=false;state.records[key(c,l)]=r;persist();return r;}
const done=c=>c.lessons.filter(l=>rec(c,l).done).length;
const next=c=>c.lessons.find(l=>!rec(c,l).done)?.id||c.lessons.length;
function bar(c){const n=done(c),p=Math.round(n/c.lessons.length*100);return `<div class="progress-label"><span>${n} / ${c.lessons.length} ${c.unit}已完成</span><span>${p}%</span></div><div class="progress" role="progressbar" aria-label="${E(c.name)}完成进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}"><i style="width:${p}%"></i></div>`;}
function card(c,priority=false){
 const samples={english:'“My current goal is to build analyses that are transparent and reproducible.”',coding:'data → baseline → evaluation → tests\n六个起步样例 · 合成数据 · CPU可运行',writing:'桌上的饭盒已经没有热气。\n从一个看得见的细节，写出自己的文章。'};
 if(priority)return `<article class="priority-card"><div class="card-top"><span class="code-symbol">${{english:'Aa',coding:'&lt;/&gt;',writing:'文'}[c.id]}</span><span class="pill">重点主线 ${c.number}</span></div><p class="eyebrow">${c.en}</p><h3><a class="card-title" href="#/${c.id}">${E(c.name)}</a></h3><p>${E(c.intro)}</p><div class="preview ${c.id==='english'?'en':c.id==='coding'?'code':''}">${E(samples[c.id]).replace(/\n/g,'<br>')}</div><div class="card-footer">${bar(c)}<div class="card-actions"><a class="button primary small" href="#/${c.id}/${next(c)}">${done(c)?'继续练习':'开始第一课'} ↗</a><a class="quiet-link" href="#/${c.id}">${c.lessons.length}${c.unit}课程</a></div></div></article>`;
 return `<article class="project-card"><div class="card-top"><span class="num">${c.number}</span><span class="en-label">${c.en}</span></div><h3><a class="card-title" href="#/${c.id}">${E(c.name)}</a></h3><p>${E(c.intro)}</p><div class="card-footer">${bar(c)}<div class="card-actions"><a href="#/${c.id}">打开项目 →</a><span>${c.lessons.length} ${c.unit} · 可自主推进</span></div></div></article>`;
}
function home(){
 const p=['english','coding','writing'].map(x=>byId[x]);
 const complete=courses.reduce((n,c)=>n+done(c),0),artifacts=Object.values(state.records).filter(r=>r.artifact.trim()).length;
 return `<div class="wrap"><section class="hero"><div><p class="eyebrow">A PERSONAL PRACTICE FOR A LARGER LIFE</p><h1>把成长，<br><span>写进作品里。</span></h1><p class="lead">用英语打开交流，用代码实现想法，用写作形成自己的声音。${courses.length}个项目，一套可积累的学习空间；今天，只需认真推进一小步。</p><div class="hero-links"><a class="button primary" href="#/english/${next(byId.english)}">从学术英语开始 ↗</a><a class="button" href="#/projects">浏览全部项目</a></div></div><aside class="path-panel"><p class="eyebrow">YOUR THREE CORE PATHS</p><h2>把时间，留给真正重要的事。</h2><p class="path-intro">三条重点主线，其余项目按需选修，不必同时打卡。</p>${p.map(c=>`<a class="path-row" href="#/${c.id}"><span class="num">${c.number}</span><span><strong>${c.name}</strong><small>${E(c.pace)}</small></span><span class="arrow">↗</span></a>`).join('')}</aside></section><div class="stats"><div class="stat"><strong>${courses.length}</strong><span>学习与探索项目</span></div><div class="stat"><strong>03</strong><span>优先投入的主线</span></div><div class="stat"><strong>${complete}</strong><span>你已完成的学习单元</span></div><div class="stat"><strong>${artifacts}</strong><span>你已记录的作品条目</span></div></div><section class="cm-launch"><div><p class="eyebrow">NEW / CURATEMICROBIOTA</p><h2>从零写 GPT，到微生物表征模型。</h2><p>14个学习单元 · 深度讲义与论文导读 · 可运行CPU工程 · 交互实验</p></div><a class="button primary" href="llm-lab/">进入大模型实战营 ↗</a></section><section class="section"><div class="section-head"><div><p class="eyebrow">FOCUS FIRST</p><h2>三件值得长期做的事</h2><p>每次练习都有材料、任务和可检查的交付物。</p></div><a href="#/journal">查看我的记录 ↗</a></div><div class="grid">${p.map(c=>card(c,true)).join('')}</div></section><section class="section"><div class="section-head"><div><p class="eyebrow">EXPLORE AT YOUR OWN PACE</p><h2>扩展你的能力与生活</h2><p>研究、思考、表达与探索，按自己的需要进入。</p></div></div><div class="grid">${courses.filter(c=>!c.priority).map(c=>card(c)).join('')}</div></section><div class="section-head"><div><p class="eyebrow">KEEP WHAT YOU HAVE BUILT</p><h2>原有计划，继续保留</h2></div></div><div class="bridge"><a href="../"><span><strong>21天口才与表达训练</strong><small>原课程、PDF与训练记录入口不变</small></span><span>↗</span></a><a href="../100-days/"><span><strong>100天生活成长计划</strong><small>作息、饮食、运动与日常实践</small></span><span>↗</span></a></div><div class="notice">使用建议：先完成一次英语练习；每周选择编程的三次练习，并安排一次写作工作坊。其他项目不必同时开启。中断后从下一次学习继续，不清零、不补罚。</div></div>`;
}
function projects(){return `<div class="wrap page-top"><div class="library-top"><p class="eyebrow">THE COMPLETE COLLECTION</p><h1>${courses.length}个项目，各自通向作品。</h1><p>全部内容按学习单元组织，不强制绑定自然日期。课程时长是练习建议，不是结果保证。</p></div><div class="filters"><button data-filter="all" aria-pressed="true">全部 ${courses.length}</button><button data-filter="priority" aria-pressed="false">重点主线 3</button><div class="search-wide"><input type="search" id="project-search" aria-label="搜索项目" placeholder="搜索英语、编程、写作、脑科学…"></div></div><div class="grid" id="project-grid">${courses.map(c=>card(c)).join('')}</div><p class="all-summary" id="project-count">${courses.length}个项目 · ${courses.reduce((n,c)=>n+c.lessons.length,0)}个有明确任务的学习单元</p></div>`;}
function institutionBlock(){return `<div class="help-section"><h2>真实导师与实验室 · 动态证据库</h2><p>按国家、脑科学与计算生物学方向筛选，查看导师现职、代表论文、技能衔接和机会证据。支持最多4组比较与来源变化巡检。</p><a class="button primary" href="labs.html">打开科研环境观察站 →</a></div><div class="help-section"><h2>机构发现入口</h2><p class="muted">以下为2026年10月20日核验的官方入口，不代表正在招收博后。进入后再核查具体课题组、职位和联系方式。</p><div class="institution-grid">${A.institutes.map(([country,name,desc,url])=>`<a href="${validUrl(url)}" target="_blank" rel="noopener noreferrer"><small>${E(country)}</small><strong>${E(name)} ↗</strong><small>${E(desc)}</small></a>`).join('')}</div></div>`;}
function stageGroups(c,query=''){const groups=new Map();for(const l of c.lessons){if(query&&!`${l.title} ${l.stage} ${l.concept}`.toLowerCase().includes(query.toLowerCase()))continue;if(!groups.has(l.stage))groups.set(l.stage,[]);groups.get(l.stage).push(l);}return groups;}
function syllabus(c,q=''){let first=true;return [...stageGroups(c,q)].map(([s,ls])=>{const open=first||q;first=false;return `<details ${open?'open':''}><summary>${E(s)} <span class="muted"> · ${ls.length}${c.unit}</span></summary><div>${ls.map(l=>`<a class="lesson-row" href="#/${c.id}/${l.id}"><span class="idx">${String(l.id).padStart(2,'0')}</span><span>${E(l.title)}</span><small class="${rec(c,l).done?'checked':''}">${rec(c,l).done?'已完成 ✓':l.minutes+'分钟'}</small></a>`).join('')}</div></details>`;}).join('')||'<p class="empty">没有找到匹配课程，请换一个关键词。</p>';}
function side(c,l,q=''){return `<h2>课程导航 · ${c.lessons.length}${c.unit}</h2><input type="search" id="toc-search" aria-label="搜索本项目课程" placeholder="搜索本项目课程" value="${E(q)}"><div id="toc-list">${sideList(c,l,q)}</div>`;}
function sideList(c,l,q=''){return [...stageGroups(c,q)].map(([s,ls])=>`<details ${q||ls.some(x=>x.id===l.id)?'open':''}><summary>${E(s)}</summary><ul>${ls.map(x=>`<li><a href="#/${c.id}/${x.id}" ${x.id===l.id?'aria-current="page"':''}>${rec(c,x).done?'<span class="done-mark">✓</span>':''}${String(x.id).padStart(2,'0')} · ${E(x.title)}</a></li>`).join('')}</ul></details>`).join('')||'<p class="muted">无匹配结果</p>';}
function courseHeader(c,lesson=false){return `<div class="course-hero"><div class="wrap"><div class="breadcrumb"><a href="#/">成长学院</a><span>/</span><a href="#/projects">全部项目</a>${lesson?`<span>/</span><a href="#/${c.id}">${E(c.name)}</a>`:''}</div><p class="eyebrow">PATH ${c.number} / ${c.en}</p><h1>${E(c.name)}</h1><p class="intro">${E(c.intro)}</p><div class="course-meta"><span>${E(c.pace)}</span><span>已完成 ${done(c)}/${c.lessons.length}${c.unit}</span>${c.priority?'<span class="pill">重点主线</span>':''}</div>${!lesson?`<div class="actions"><a class="button primary" href="#/${c.id}/${next(c)}">${done(c)?'继续下一课':'开始第一课'} ↗</a><button data-act="export-course">下载完整课程 Markdown</button>${c.id==='coding'?'<a class="button" href="downloads/starter_projects.py" download>下载六项目起步代码</a>':''}</div>`:''}</div></div>`;}
function overview(c){return `${courseHeader(c)}<div class="wrap page-top"><div class="course-summary"><h2>完成后，留下什么？</h2><p>${E(c.outcome)}</p><div class="notice">${E(c.note)}</div>${bar(c)}</div>${c.id==='career'?institutionBlock():''}<div class="section-head"><div><h2>完整课程目录</h2><p>可以顺序推进，也可以直接进入需要的单元。</p></div></div><div class="filters"><input class="search-wide" type="search" id="lesson-search" aria-label="搜索课程标题" placeholder="搜索标题、阶段或概念…"></div><div class="syllabus" id="syllabus">${syllabus(c)}</div></div>`;}
function referenceLinks(l){const refs=(l.refs||[]).map(k=>A.resources[k]).filter(Boolean);return [...refs,...(l.links||[])].map(r=>`<a target="_blank" rel="noopener noreferrer" href="${validUrl(r.url)}">${E(r.name)} ↗</a>`).join('');}
function lesson(c,l){const r=rec(c,l);return `${courseHeader(c,true)}<div class="wrap course-body"><button class="mobile-contents" type="button" data-act="toggle-toc" aria-expanded="false" aria-controls="sidebar">展开课程导航</button><aside class="sidebar collapsed" id="sidebar">${side(c,l)}</aside><article class="lesson-sheet"><p class="eyebrow">${E(l.stage)} / ${String(l.id).padStart(2,'0')}</p><h1>${E(l.title)}</h1><div class="lesson-meta">第${l.id}${c.unit} / 共${c.lessons.length}${c.unit} · 建议${l.minutes}分钟 · <span id="lesson-state">${r.done?'已完成':'自主推进'}</span></div><div class="actions no-print"><button class="small" data-act="print">打印本课 / 另存PDF</button><button class="small" data-act="export-lesson">下载本课 Markdown</button>${l.download?`<a class="button small" href="${E(l.download)}" download>下载起步代码</a>`:''}</div><p class="concept">${E(l.concept)}</p>${l.material?`<h2>本次练习材料</h2><div class="material english" lang="en">${E(l.material)}</div><div class="actions no-print" style="margin-top:13px"><button class="small" data-act="speak">听系统朗读</button><button class="small" data-act="stop-speech">停止朗读</button><button class="small" data-act="record">录一段练习</button></div><p class="muted no-print" style="font-size:11px;margin-top:7px">系统语音可用性取决于浏览器；并非人工示范。不支持录音时可使用自己的录音工具。</p>`:''}${l.example?`<h2>示例与练习提示</h2><div class="example">${E(l.example)}</div>`:''}<h2>本次具体任务</h2><div id="task-list">${l.tasks.map((t,i)=>`<label class="task"><input type="checkbox" data-task="${i}" ${r.tasks[i]?'checked':''}><span>${E(t)}</span></label>`).join('')}</div><h2>应留下的交付物</h2><div class="deliverable">${E(l.output)}</div><ul class="rubric">${l.criteria.map(t=>`<li>${E(t)}</li>`).join('')}</ul>${referenceLinks(l)?`<h2>材料与原始来源</h2><div class="resources-list">${referenceLinks(l)}</div>`:''}<div class="editor-fields"><label class="field" for="note">学习笔记 / 草稿 <small>（自动保存在本浏览器）</small></label><textarea id="note" maxlength="100000" placeholder="今天完成了什么？保留草稿、依据和一个需要改进的具体问题。请勿填写个人敏感数据或账号密钥。">${E(r.note)}</textarea><div class="write-count" id="write-count">${r.note.length} 字符</div><label class="field" for="artifact">作品记录 <small>（文件名、个人保存位置或公开作品说明）</small></label><input id="artifact" type="text" maxlength="4000" value="${E(r.artifact)}" placeholder="例如：第01天自我介绍-第二版.webm；这里不上传文件。">${c.id==='english'?`<label class="field" for="score">表达自评 <small>（信息、结构、可理解度各0—2分；非语言考试评分）</small></label><select id="score"><option value="">暂未评价</option>${Array.from({length:7},(_,i)=>`<option value="${i}" ${r.score===i?'selected':''}>${i} / 6</option>`).join('')}</select>`:''}</div><div class="print-only"><h2>我的学习记录</h2><div id="print-note">${E(r.note||'尚未记录')}</div><p id="print-artifact">${E(r.artifact)}</p></div><p class="save-line" id="save-status">${persistent?'已保存至当前浏览器 · 请定期导出备份':'当前无法持久保存，请导出备份'}</p><div class="actions no-print"><button class="primary" data-act="complete" id="complete-btn">${r.done?'撤销本课完成':'确认完成本课'}</button><button data-act="export-data">导出全部学习记录</button></div><div class="lesson-nav">${l.id>1?`<a href="#/${c.id}/${l.id-1}">← 上一${c.unit}</a>`:`<a href="#/${c.id}">← 课程目录</a>`}${l.id<c.lessons.length?`<a href="#/${c.id}/${l.id+1}">下一${c.unit} →</a>`:`<a href="#/journal">查看我的成果 →</a>`}</div></article></div>`;}
function journal(){const entries=[];for(const c of courses)for(const l of c.lessons){const r=rec(c,l);if(r.updatedAt&&(r.note||r.artifact||r.done||r.tasks.some(Boolean)))entries.push({c,l,r});}entries.sort((a,b)=>b.r.updatedAt.localeCompare(a.r.updatedAt));return `<div class="wrap page-top"><p class="eyebrow">YOUR PRIVATE PRACTICE LOG</p><h1>留下过程，也看见变化。</h1><p class="muted" style="margin:13px 0 22px">这里只显示当前浏览器中你实际保存的记录，不预填完成数据。</p><div class="actions"><button class="primary" data-act="export-data">导出JSON备份</button><button data-act="import-data">导入备份并合并</button><button data-act="export-journal">下载笔记 Markdown</button></div><div class="notice" style="margin:23px 0">记录不自动上传GitHub，不提供账号或跨设备实时同步。更换设备时先导出、再导入；清理浏览器数据可能删除记录。该空间未加密，不要放置临床个体数据、密钥或私人证件。原口才和100天计划的记录仍由各自页面管理，本页不读取或覆盖它们。</div>${entries.length?`<p class="all-summary">${entries.length}条有内容的记录，按最后修改时间排序。</p><div class="journal-grid">${entries.map(({c,l,r})=>`<article class="journal-entry"><small>${E(c.name)} · 第${l.id}${c.unit} · ${E(new Date(r.updatedAt).toLocaleDateString('zh-CN'))} ${r.done?'· 已完成':''}</small><h3><a href="#/${c.id}/${l.id}">${E(l.title)}</a></h3><p>${E(r.note||'已保存任务进度，暂无文字笔记。')}</p>${r.artifact?`<div class="example">作品：${E(r.artifact)}</div>`:''}<a href="#/${c.id}/${l.id}">继续编辑 →</a></article>`).join('')}</div>`:'<div class="empty"><h2>第一份记录，从一次练习开始。</h2><p class="muted">进入课程后写下笔记，或记录你的第一个作品。</p><a class="button primary" style="margin-top:20px" href="#/english/1">打开第一天英语训练</a></div>'}</div>`;}
function resources(){return `<div class="wrap page-top"><p class="eyebrow">RESOURCES & WORKING PRINCIPLES</p><h1>材料有出处，记录有边界。</h1><div class="help-section"><h2>怎样使用这些项目</h2><p>优先推进学术英语、AI编程和深度写作。课程编号是学习顺序，不是必须连续完成的自然日；其他项目随时选修，暂停不会清空记录。</p><p>每节课都包含具体任务和交付物。勾选全部任务后，再手动确认完成；完成数量来自自己的记录，不是自动推断的能力评分。</p><p>课程材料和练习为本站整理与原创设计，外部网页用于学习和核验。本站与这些机构没有官方课程或招生合作关系。</p></div><h2>公开学习资源</h2><p class="muted" style="margin:10px 0 20px">资源入口于2026年10月20日核验。外部网页可能更新，具体版本、授权与访问条件以原网站为准。</p><div class="resources-grid">${Object.values(A.resources).map(r=>`<a class="resource-card" href="${validUrl(r.url)}" target="_blank" rel="noopener noreferrer"><strong>${E(r.name)} ↗</strong><span>打开官方文档或原始论文入口</span></a>`).join('')}</div>${institutionBlock()}<div class="help-section"><h2>下载、打印与代码</h2><p>课程总览提供整套课程Markdown；课内支持单课Markdown及“打印本课 / 另存PDF”。PDF通过浏览器打印窗口生成，并非预先制作的独立PDF教材。</p><p>编程项目提供一个含六个子命令的Python文件。网页不执行Python、不调用付费模型API；先在本地虚拟环境安装所需依赖，再按课程扩展。神经网络示例额外需要PyTorch。</p><a class="button" href="downloads/starter_projects.py" download>下载六项目起步代码</a></div><div class="help-section"><h2>隐私与备份</h2><p>学习记录使用本浏览器的localStorage，不自动写入公开仓库。它不等于加密云空间，也不会自动同步到手机或其他电脑。请定期导出JSON备份，并保存在自己可信的位置。</p><p>导入时按学习单元合并，较新的记录优先；未知课程或不合法字段会被忽略。公开的只是课程内容，不是你的学习笔记。</p><p>录音只在你按下按钮并允许麦克风后开始；本站不上传音频。录音只保留在当前页面内存，请及时下载。系统朗读由浏览器提供，部分系统语音服务可能需要网络。</p><div class="actions"><button data-act="export-data">导出当前记录</button><button data-act="import-data">导入JSON备份</button></div></div><div class="help-section"><h2>内容边界</h2><p>论文项目提供书目与精读任务，不声称已完成每篇论文的全文评审。申请项目提供准备流程和官方机构入口，不声称这些机构目前有岗位，也不自动联系导师。</p><p>研究和神经科学训练不代替统计咨询、伦理审批、医疗建议或专业资质。训练样例不包含真实临床结果，不能用于诊断或申报虚构科研成绩。</p></div></div>`;}
function render(){
 const parts=location.hash.replace(/^#\/?/,'').split('/').filter(Boolean);const id=parts[0]||'';
 curCourse=byId[id]||null;curLesson=null;
 if(curCourse?.external){const day=Number(parts[1]);location.replace(curCourse.external+(Number.isInteger(day)&&day>=1&&day<=curCourse.lessons.length?'#/day/'+day:'#/'));return;}
 if(window.speechSynthesis)window.speechSynthesis.cancel();
 let html,nav='projects';
 if(!id){html=home();nav='home';}
 else if(id==='projects')html=projects();
 else if(id==='journal'){html=journal();nav='journal';}
 else if(id==='resources'){html=resources();nav='resources';}
 else if(curCourse){const n=parts.length>1?Number(parts[1]):null;if(n!==null&&Number.isInteger(n)&&n>0&&n<=curCourse.lessons.length){curLesson=curCourse.lessons[n-1];state.last[id]=n;persist();html=lesson(curCourse,curLesson);}else html=overview(curCourse);}
 else{html=`<div class="wrap page-top empty"><h1>没有找到这个项目。</h1><p>可以从全部项目重新进入。</p><a class="button primary" href="#/projects">浏览项目</a></div>`;}
 document.getElementById('main').innerHTML=html;
 document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===nav)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 document.title=curLesson?`${curLesson.title}｜${curCourse.name} · 成长学院`:curCourse?`${curCourse.name}｜成长学院`:'成长学院 · 一心问道｜英语、编程、写作';
 window.scrollTo(0,0);document.getElementById('main').focus({preventScroll:true});
}
function download(name,text,mime='text/plain;charset=utf-8'){const url=URL.createObjectURL(new Blob([text],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function md(c,l,includeNotes=true){const r=rec(c,l);let text=`# ${c.name} · 第${l.id}${c.unit}\n\n## ${l.title}\n\n阶段：${l.stage}\n建议用时：${l.minutes}分钟\n\n${l.concept}\n`;
 if(l.material)text+=`\n## 练习材料（原创）\n\n${l.material}\n`;
 if(l.example)text+=`\n## 示例与提示\n\n${l.example}\n`;
 text+='\n## 具体任务\n\n'+l.tasks.map((t,i)=>`- [${includeNotes&&r.tasks[i]?'x':' '}] ${t}`).join('\n')+`\n\n## 交付物\n\n${l.output}\n\n## 验收\n\n`+l.criteria.map(t=>'- '+t).join('\n');
 const refs=[...(l.refs||[]).map(k=>A.resources[k]).filter(Boolean),...(l.links||[])];if(refs.length)text+='\n\n## 原始来源\n\n'+refs.map(x=>`- ${x.name}：${x.url}`).join('\n');
 if(includeNotes)text+=`\n\n## 我的笔记\n\n${r.note}\n\n作品记录：${r.artifact}\n${r.score!==null?'表达自评：'+r.score+'/6\n':''}`;
 return text+'\n';}
function exportData(){download('成长学院-学习备份-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({...state,exportedAt:new Date().toISOString(),edition:A.version},null,2),'application/json');toast('已导出JSON备份。请保存在自己可信的位置。');}
let projectFilter='all';
function filterProjects(){const q=(document.getElementById('project-search')?.value||'').toLowerCase();const matched=courses.filter(c=>(projectFilter!=='priority'||c.priority)&&`${c.name} ${c.en} ${c.intro}`.toLowerCase().includes(q));document.getElementById('project-grid').innerHTML=matched.length?matched.map(c=>card(c)).join(''):'<p class="empty">没有找到匹配的项目。</p>';document.getElementById('project-count').textContent=`显示 ${matched.length} 个项目`;}
let recorder=null,stream=null,audioUrl=null,recordTimeout=null,recordPending=false;
async function startRecord(){
 if(recordPending||recorder?.state==='recording')return toast('录音正在进行或正在申请麦克风权限。');
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)return toast('当前浏览器不支持网页录音，请使用设备自带录音工具。');
 if(audioUrl&&!confirm('开始新录音将替换当前录音。请先确认已经下载。'))return;
 recordPending=true;
 try{
  stream=await navigator.mediaDevices.getUserMedia({audio:true});
  const chunks=[];recorder=new MediaRecorder(stream);const r=recorder;
  r.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  r.onstop=()=>{
   clearTimeout(recordTimeout);stream?.getTracks().forEach(t=>t.stop());stream=null;
   if(audioUrl)URL.revokeObjectURL(audioUrl);
   const mime=r.mimeType||'audio/webm';audioUrl=URL.createObjectURL(new Blob(chunks,{type:mime}));
   const player=document.getElementById('play-record');player.src=audioUrl;player.hidden=false;
   const link=document.getElementById('save-record');link.href=audioUrl;link.download=`英语练习-${new Date().toISOString().replace(/[:.]/g,'-')}.${mime.includes('mp4')?'mp4':mime.includes('ogg')?'ogg':'webm'}`;link.hidden=false;
   document.getElementById('audio-status').textContent='录音已完成 · 请下载保存';document.getElementById('stop-record').hidden=true;document.getElementById('close-record').hidden=false;
  };
  document.getElementById('play-record').hidden=true;document.getElementById('save-record').hidden=true;document.getElementById('close-record').hidden=true;document.getElementById('stop-record').hidden=false;
  document.getElementById('audio-panel').hidden=false;document.getElementById('audio-status').textContent='正在录音…（最长15分钟，结束后请下载）';
  r.start(1000);recordTimeout=setTimeout(()=>{if(r.state==='recording')r.stop();},900000);
 }catch(e){stream?.getTracks().forEach(t=>t.stop());stream=null;toast('未能开始录音。请检查麦克风权限，或使用设备录音工具。');}finally{recordPending=false;}
}
document.getElementById('stop-record').addEventListener('click',()=>{if(recorder?.state==='recording')recorder.stop();});
document.getElementById('close-record').addEventListener('click',()=>{if(confirm('确认已下载需要保留的录音后关闭？')){document.getElementById('audio-panel').hidden=true;document.getElementById('play-record').pause();document.getElementById('play-record').removeAttribute('src');if(audioUrl)URL.revokeObjectURL(audioUrl);audioUrl=null;}});
window.addEventListener('beforeunload',e=>{if(recorder?.state==='recording'){e.preventDefault();e.returnValue='';}});
document.addEventListener('click',e=>{
 const filter=e.target.closest('[data-filter]');if(filter){projectFilter=filter.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===filter)));filterProjects();return;}
 const b=e.target.closest('[data-act]');if(!b)return;const act=b.dataset.act,c=curCourse,l=curLesson;
 if(act==='export-data')return exportData();
 if(act==='import-data'){document.getElementById('import-file').click();return;}
 if(act==='export-journal'){let text='# 我的成长学院学习记录\n\n';for(const co of courses)for(const le of co.lessons){const r=rec(co,le);if(r.note||r.artifact||r.done)text+=md(co,le)+'\n---\n\n';}download('成长学院-我的笔记.md',text);return;}
 if(act==='export-course'&&c){download(c.name+'-完整课程.md',`# ${c.name}\n\n${c.intro}\n\n${c.note}\n\n`+c.lessons.map(le=>md(c,le,false)).join('\n---\n\n'));return;}
 if(act==='toggle-toc'){const el=document.getElementById('sidebar');el.classList.toggle('collapsed');const expanded=!el.classList.contains('collapsed');b.setAttribute('aria-expanded',String(expanded));b.textContent=expanded?'收起课程导航':'展开课程导航';return;}
 if(!c||!l)return;
 if(act==='export-lesson')return download(`${c.name}-${String(l.id).padStart(3,'0')}.md`,md(c,l));
 if(act==='print')return window.print();
 if(act==='complete'){
  const r=rec(c,l);if(!r.done&&!r.tasks.every(Boolean))return toast('请先完成并勾选本课各项任务，再确认完成。');
  const updated=change(c,l,{done:!r.done});b.textContent=updated.done?'撤销本课完成':'确认完成本课';document.getElementById('lesson-state').textContent=updated.done?'已完成':'自主推进';document.getElementById('toc-list').innerHTML=sideList(c,l,document.getElementById('toc-search').value);toast(updated.done?'本课已记录完成。下次可以从这里继续。':'已撤销完成标记，笔记仍保留。');return;
 }
 if(act==='speak'){
  if(!window.speechSynthesis||!window.SpeechSynthesisUtterance)return toast('当前浏览器不支持系统朗读，请按材料自行朗读。');
  speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(l.material||'');u.lang='en-US';u.rate=.85;const voice=speechSynthesis.getVoices().find(v=>v.lang.startsWith('en')&&v.localService)||speechSynthesis.getVoices().find(v=>v.lang.startsWith('en'));if(voice)u.voice=voice;u.onerror=()=>toast('系统语音暂不可用，可以继续文字练习。');speechSynthesis.speak(u);return;
 }
 if(act==='stop-speech'&&window.speechSynthesis)return speechSynthesis.cancel();
 if(act==='record')return startRecord();
});
document.addEventListener('input',e=>{
 const el=e.target;
 if(el.id==='project-search')return filterProjects();
 if(el.id==='lesson-search'&&curCourse){document.getElementById('syllabus').innerHTML=syllabus(curCourse,el.value);return;}
 if(el.id==='toc-search'&&curCourse&&curLesson){document.getElementById('toc-list').innerHTML=sideList(curCourse,curLesson,el.value);return;}
 if(!curCourse||!curLesson)return;
 if(el.id==='note'){change(curCourse,curLesson,{note:el.value});document.getElementById('write-count').textContent=el.value.length+' 字符';document.getElementById('print-note').textContent=el.value||'尚未记录';}
 if(el.id==='artifact'){change(curCourse,curLesson,{artifact:el.value});document.getElementById('print-artifact').textContent=el.value;}
});
document.addEventListener('change',e=>{
 const el=e.target;if(!curCourse||!curLesson)return;
 if(el.matches('[data-task]')){const tasks=[...rec(curCourse,curLesson).tasks];tasks[Number(el.dataset.task)]=el.checked;const r=change(curCourse,curLesson,{tasks});document.getElementById('complete-btn').textContent=r.done?'撤销本课完成':'确认完成本课';document.getElementById('lesson-state').textContent=r.done?'已完成':'自主推进';}
 if(el.id==='score')change(curCourse,curLesson,{score:el.value===''?null:Number(el.value)});
});
document.getElementById('import-file').addEventListener('change',async e=>{
 const file=e.target.files[0];if(!file)return;
 try{
  if(file.size>10*1024*1024)throw Error('备份超过10MB，未导入。');
  const incoming=normalize(JSON.parse(await file.text()));let n=0;
  for(const [k,r] of Object.entries(incoming.records)){const old=state.records[k];if(!old||Date.parse(r.updatedAt)>Date.parse(old.updatedAt)){state.records[k]=r;n++;}}
  persist();render();toast(`已合并${n}条较新记录；原有较新记录与其他计划均未覆盖。`);
 }catch(err){toast('导入失败：'+(err.message||'文件无效'));}finally{e.target.value='';}
});
window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue){try{state=normalize(JSON.parse(e.newValue));if(!['note','artifact'].includes(document.activeElement?.id)){render();toast('已读取另一标签页更新的记录。');}}catch(_){toast('另一标签页的记录无效，未导入。');}}});
window.addEventListener('hashchange',()=>{projectFilter='all';render();});
render();
if(!persistent){const alert=document.createElement('div');alert.className='storage-alert';alert.textContent='本浏览器无法持久保存记录。学习后请导出JSON备份，避免刷新丢失。';document.querySelector('.masthead').after(alert);}
})();

