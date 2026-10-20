(function growthApp(){
  "use strict";
  const ALL=Array.isArray(window.GROWTH_LESSONS)?window.GROWTH_LESSONS.slice().sort((a,b)=>a.d-b.d):[];
  const KEY="yixw_practice_lab_2026_v1";
  const START="2026-10-20";
  const MAIN=document.getElementById("app-main");
  const fmt=n=>String(n).padStart(2,"0");
  const esc=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const arr=x=>Array.isArray(x)?x:[];
  const rawState=(()=>{try{return JSON.parse(localStorage.getItem(KEY)||"null")}catch{return null}})();
  let STATE=rawState&&typeof rawState==="object"&&rawState.lessons&&typeof rawState.lessons==="object"?rawState:{version:1,started:START,lessons:{}};
  const phases=[
    {name:"基础与声音",period:"Day 01—07",detail:"呼吸与吐字、易混音、语速停顿、重音以及第一阶段复测。"},
    {name:"思考与组织",period:"Day 08—14",detail:"先说结论、观点论证、证据边界、讲故事、通俗解释与即兴表达。"},
    {name:"沟通与实战",period:"Day 15—21",detail:"倾听、说服、现场问答、进度汇报、不同听众、限时表达与结业演讲。"}
  ];
  const normalRubric=[["专项练习",20],["完整句子",15],["文章朗读",20],["脱稿复述",15],["情境实战",20],["录音与复盘",10]];
  const stageRubric=[["核心能力专项",20],["观点与结构",20],["文章朗读",15],["脱稿复述",15],["独立实战",20],["自我复盘",10]];
  const finalRubric=[["五分钟演讲",40],["同题自我介绍",15],["原文朗读",10],["文章复述",10],["结构与证据",15],["对比复盘",10]];
  function getRubric(d){return d===21?finalRubric:[7,14].includes(d)?stageRubric:normalRubric}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(STATE));return true}catch{return false}}
  function byDay(d){return STATE.lessons[String(d)]||{}}
  function update(d,field,value){STATE.lessons[String(d)]={...byDay(d),[field]:value,updated:new Date().toISOString()};save()}
  function isDone(d){return byDay(d).completed===true}
  function doneCount(){return ALL.filter(x=>isDone(x.d)).length}
  function nextDay(){const first=ALL.find(x=>!isDone(x.d));return first?first.d:21}
  function dayLink(d){return "./?day="+fmt(d)}
  function toast(message){const el=document.getElementById("toast");if(!el)return;el.textContent=message;el.hidden=false;clearTimeout(el._hide);el._hide=setTimeout(()=>el.hidden=true,3600)}
  function download(name,text,type="application/json"){const b=new Blob([text],{type});const url=URL.createObjectURL(b);const a=document.createElement("a");a.href=url;a.download=name;a.style.display="none";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)}
  function exportData(){download("personal-growth-lab-progress-"+new Date().toISOString().slice(0,10)+".json",JSON.stringify(STATE,null,2))}
  function phaseFor(d){return d<=7?0:d<=14?1:2}
  function decorate(s){return esc(s).replace(/\n/g,"<br>")}
  function getTasks(day){return day===21?
    ["完成热身与关键词提纲","阅读结业文章并朗读","完成脱稿复述","完成五分钟演讲第一版","完成修改后的演讲","与Day01同题录制60秒自我介绍","评分并写结业复盘"]:
    [7,14].includes(day)?["完成发音与声音热身","完成专项抽测","完成六句朗读","完整朗读文章","完成脱稿复述","完成独立表达测评","保存录音、评分和复盘"]:
    ["完成开口热身","完成今日专项材料","练完六句完整表达","朗读整篇训练文章","完成脱稿复述","完成至少一个实战场景","录音、评分并记录问题"]}
  function scheduleFor(d){
    if(d===1)return [
      ["00—05","呼吸与开口","先做三句热身，让声音自然稳定"],
      ["05—12","自我介绍基线","不看稿，录第一次60秒自我介绍，保留原始音频"],
      ["12—24","易混音初测","逐组练12对发音并遮住拼音抽测"],
      ["24—34","完整句子","慢读、正常读、最后试着不看文字说"],
      ["34—45","文章朗读","默读圈难字，再录整篇原创短文"],
      ["45—52","90秒脱稿复述","只看关键词，按事件顺序重新讲述"],
      ["52—57","情境实战","生活通知或科研科普，选择其一录音"],
      ["57—60","评分与复盘","保存录音和原始问题，不以高分为目标"]];
    if(d===21)return [
      ["00—05","声音与节奏热身","正常音量朗读三句，整理呼吸"],
      ["05—14","结业提纲","列开场问题、三项观点、个人例子和收尾"],
      ["14—23","文章朗读","完成原创文章朗读并注意自然停顿"],
      ["23—31","脱稿复述","根据五个关键词讲出文章主线"],
      ["31—47","五分钟演讲","正式讲一遍，回听纠错，再录修正版"],
      ["47—55","一分钟同题复测","重新录Day01自我介绍并比较两版"],
      ["55—60","结业评分","填写总分、改进证据、后续训练目标"]];
    if([7,14].includes(d))return [
      ["00—05","热身","练三句语音与结构热身"],
      ["05—17","专项抽测","完成当天全部随机或结构化题目"],
      ["17—27","六句朗读","清晰读完整句并记录错误"],
      ["27—39","完整朗读","朗读指定原文并留存录音"],
      ["39—48","脱稿复述","不看正文，连贯讲90秒"],
      ["48—56","阶段独立表达","任选生活或专业场景录制"],
      ["56—60","复测记录","比较基线与当前，选一个下一步目标"]];
    return [
      ["00—05","发声热身","完成三句热身素材，放松肩颈"],
      ["05—16","今日专项训练","练习本课的发音、逻辑或交流技巧"],
      ["16—27","完整句子","逐句练习，从看稿过渡到不看稿"],
      ["27—39","文章朗读","默读、慢读、自然读并回听"],
      ["39—48","脱稿复述","只看五个关键词，完整讲出文章主线"],
      ["48—56","场景实战","生活或科研场景二选一，尝试脱稿"],
      ["56—60","评分打卡","记录六项评分、错音与改进动作"]];
  }
  function cardHtml(x){
    return `<a class="course-card ${isDone(x.d)?"is-done":""}" href="${dayLink(x.d)}" aria-label="开始第${x.d}课：${esc(x.t)}">
      <div><div class="card-top"><span class="card-day">DAY ${fmt(x.d)}</span><span class="card-state">${isDone(x.d)?"✓ 已完成":"○ 可随时学习"}</span></div>
      <h4>${esc(x.t)}</h4><p>${esc(x.sub)}</p></div>
      <div class="card-bottom"><span>60 MIN / 自主安排</span><span>阅读本课 ↗</span></div></a>`;
  }
  function renderHome(){
    document.title="个人成长实验室｜21天口才与表达训练";
    const count=doneCount(),pct=Math.round(count/21*100),next=nextDay();
    const phaseHtml=phases.map((p,i)=>`<article class="phase"><div><span class="phase-number">0${i+1}</span><span class="phase-period">${p.period}</span></div><h3>${p.name}</h3><p>${p.detail}</p></article>`).join("");
    const courseHtml=phases.map((p,i)=>`<section class="phase-block" aria-label="${p.name}"><div class="phase-label"><strong>0${i+1} / ${p.name}</strong><span>${p.period}</span></div>
      <div class="lesson-cards">${ALL.filter(x=>phaseFor(x.d)===i).map(cardHtml).join("")}</div></section>`).join("");
    const done=ALL.filter(x=>isDone(x.d));
    const avg=done.length?Math.round(done.reduce((s,l)=>s+(Number(byDay(l.d).total)||0),0)/done.length):null;
    MAIN.innerHTML=`<section class="intro"><div class="container intro-layout">
      <div><p class="eyebrow">PERSONAL DEVELOPMENT / SERIES 01</p>
        <h1 class="hero-title">把表达，<br><em>练成一种可靠的能力。</em></h1>
        <p class="hero-description">21节完整课程，从准确发音到逻辑表达、即兴发言与公众演讲。每次只练60分钟，有具体材料、有练习、有录音、有反馈。按自己的节奏学习，不被日期催着往前走。</p>
        <div class="hero-meta"><span class="meta-pill">21 节课程</span><span class="meta-pill">每天约 60 分钟</span><span class="meta-pill">全部教材已开放</span></div>
        <div class="hero-actions"><a class="button primary" href="${dayLink(next)}">${count===21?"回看结业课程":"继续学习 · DAY "+fmt(next)} <span aria-hidden="true">↗</span></a><a class="button" href="#course-map">查看完整课程 ↓</a></div>
        <p class="hero-footnote">本轮学习起点：2026年10月20日。完成进度仅由你自己标记，不与自然日期绑定。</p>
      </div>
      <div class="hero-plate" aria-label="21天表达练习示意">
        <div class="plate-grid"></div><div class="plate-top"><span>FIG. 01 / PRACTICE & PROGRESS</span><span>YIXIN WENDAO</span></div>
        <div class="plate-illustration"><div class="plate-circle"><strong>21</strong><small>DAYS OF PRACTICE</small></div><div class="plate-accent"></div></div>
        <div class="plate-caption"><div><b>Speak clearly.</b><br>THINK PRECISELY. PRACTISE DAILY.</div><div>VOL. 01<br>2026</div></div>
      </div></div>
      <div class="container stats-strip"><div class="stats-item"><strong>21</strong><span>完整逐日课程</span></div><div class="stats-item"><strong>60'</strong><span>每课建议时长</span></div><div class="stats-item"><strong>03</strong><span>能力进阶阶段</span></div><div class="stats-item"><strong>100</strong><span>每课量化自评</span></div></div>
      </section>
      <section class="section" id="approach"><div class="container"><div class="section-header"><div><p class="overline">01 / LEARNING DESIGN</p><h2 class="section-heading">不是课程清单，<br>而是一套可以真正练起来的教材。</h2></div><p class="section-lead">每节课含时间安排、逐字练习、完整朗读短文、脱稿复述、生活与科研情境、错误修正和100分评分。</p></div><div class="phases">${phaseHtml}</div></div></section>
      <section class="section curriculum" id="course-map"><div class="container"><div class="section-header"><div><p class="overline">02 / COMPLETE SYLLABUS</p><h2 class="section-heading">21天，完整开放。</h2></div><p class="section-lead">所有课程均可随时打开；建议按顺序练习，但不会锁住下一节课。</p></div>${courseHtml}</div></section>
      <section class="section" id="journal"><div class="container"><div class="section-header"><div><p class="overline">03 / LEARNING JOURNAL</p><h2 class="section-heading">训练的价值，<br>在于看见自己的变化。</h2></div><p class="section-lead">通过勾选、评分、文字复盘记录进度；所有记录只保存在当前浏览器中。</p></div>
        <div class="record-panel">
          <div class="progress-wheel" style="--progress:${pct}%"><div class="wheel-inner"><b>${count}<span style="font-size:22px">/ 21</span></b><span>完成课程 · ${pct}%</span></div></div>
          <div class="record-main"><p class="overline">YOUR PROGRESS</p><h3>${count===0?"新的练习，从今天开始。":count===21?"21节课程已经全部打卡。":"已经完成 "+count+" 节练习。"}</h3><p>${count?("完成课程自评均分："+(avg===null?"尚未评分":avg+" / 100")+"。"):"先保留第一天的原始录音，后面用同一主题做对照。"}</p>
          <div class="record-actions"><a href="${dayLink(next)}" class="button primary">${count===21?"回看 Day 21":"进入 Day "+fmt(next)+" →"}</a><button class="button subtle" type="button" id="export-progress">导出学习记录 ↓</button><button class="button subtle" type="button" id="import-progress">导入记录 ↑</button></div>
          <input type="file" id="import-file" accept=".json,application/json" hidden><p class="record-small"><strong>隐私说明：</strong>打卡、评分和文字笔记保存在此设备的浏览器里，不发送到GitHub或其他服务器。录音功能会在你的设备上生成下载文件，不自动上传。跨设备学习请使用导出/导入。</p></div>
        </div>
        <div class="site-note"><strong>给自己留一点真实进步的空间。</strong> 不用为了连续打卡而仓促完成。可以重复某一课，错过几天也不会清空成果；今天做完Day 01，下一次再打开Day 02即可。</div>
      </div></section>`;
    const exp=document.getElementById("export-progress");if(exp)exp.addEventListener("click",exportData);
    const imp=document.getElementById("import-progress");
    const file=document.getElementById("import-file");
    if(imp&&file){imp.addEventListener("click",()=>file.click());file.addEventListener("change",async()=>{
      const f=file.files&&file.files[0];if(!f)return;
      if(f.size>2*1024*1024){toast("文件过大，请确认是本网站导出的记录。");return}
      try{
        const obj=JSON.parse(await f.text());
        if(!obj||typeof obj!=="object"||obj.version!==1||typeof obj.lessons!=="object"||Array.isArray(obj.lessons)){throw Error("格式不正确")}
        if(confirm("导入的记录会覆盖此浏览器当前的打卡和笔记，确定继续吗？")){STATE=obj;save();renderHome();toast("学习记录已导入。")}
      }catch{toast("无法识别此记录文件，请使用本站导出的 JSON 文件。")}
    })}
  }
  let timer=null,remaining=3600,startedAt=null,stream=null,media=null,chunks=[];
  function timeStr(seconds){return `${fmt(Math.floor(seconds/60))}:${fmt(seconds%60)}`}
  function showTimer(){const el=document.getElementById("timer-display");if(el)el.textContent=timeStr(remaining)}
  function pauseTimer(){if(startedAt!==null){remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));startedAt=null}clearInterval(timer);timer=null;showTimer()}
  let deadline=0;
  function startTimer(){if(timer)return;deadline=Date.now()+remaining*1000;startedAt=Date.now();timer=setInterval(()=>{remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));showTimer();if(remaining===0){pauseTimer();toast("本课计时结束，可以完成今日复盘。")}},300);showTimer()}
  function resetTimer(){clearInterval(timer);timer=null;startedAt=null;remaining=3600;showTimer()}
  function stopMedia(){if(media&&media.state==="recording")media.stop()}
  function destroy(){clearInterval(timer);timer=null;startedAt=null;if(stream){stream.getTracks().forEach(x=>x.stop());stream=null}media=null;chunks=[]}
  function section(num,title,body,extra=""){return `<section class="lesson-section"><span class="section-num">${num} / TRAINING</span><h2>${title}</h2>${extra}${body}</section>`}
  function renderLesson(x){
    destroy();resetTimer();
    const d=x.d;document.title=`Day ${fmt(d)} · ${x.t}｜个人成长实验室`;
    const s=scheduleFor(d),tasks=getTasks(d),entry=byDay(d),checks=Array.isArray(entry.checks)?entry.checks:[],rubric=getRubric(d),savedScores=Array.isArray(entry.scores)?entry.scores:rubric.map(()=>0);
    const list=items=>`<ul class="exercise-list">${arr(items).map(v=>`<li>${esc(v)}</li>`).join("")}</ul>`;
    const reading=esc(x.reading||"").split(/\n\s*\n/).map(p=>`<p>${p.replace(/\n/g,"<br>")}</p>`).join("");
    const sample=`<div class="sample">${decorate(x.sample)}</div>`;
    const scheduleHtml=s.map(item=>`<div class="schedule-row"><span class="schedule-time">${esc(item[0])}</span><div class="schedule-body"><strong>${esc(item[1])}</strong><small>${esc(item[2])}</small></div></div>`).join("");
    const rubricHtml=rubric.map((c,i)=>`<div class="rubric-line"><label for="score-${i}">${esc(c[0])} <small style="color:var(--muted)">/ ${c[1]}</small></label><input type="number" id="score-${i}" data-score="${i}" min="0" max="${c[1]}" step="1" value="${Math.max(0,Math.min(c[1],Number(savedScores[i])||0))}" aria-label="${esc(c[0])}，最高${c[1]}分"></div>`).join("");
    const rec=list(x.rec);
    MAIN.innerHTML=`<div class="container"><section class="lesson-header">
      <div class="breadcrumbs"><a href="./">所有课程</a><span>／</span><span>阶段 0${phaseFor(d)+1}</span><span>／</span><span>第 ${fmt(d)} 课</span></div>
      <p class="lesson-kicker">LESSON ${fmt(d)} / 21　 ·　 60 MINUTES</p><h1 class="lesson-title">${esc(x.t)}</h1><p class="lesson-deck">${esc(x.sub)}</p>
      <div class="outcome-pills">${arr(x.goal).map(g=>`<span>${esc(g)}</span>`).join("")}</div></section>
      <div class="lesson-layout">
        <div class="lesson-content">
          ${section("01","今天的60分钟",`<div class="schedule">${scheduleHtml}</div>`,`<p class="section-explain">时间从0分钟开始连续计入，可分段暂停，但不要跳过录音复盘。</p>`)}
          ${section("02","开口热身",list(x.warm),`<p class="section-explain">自然音量、不挤压喉咙；每句先慢读后自然说。</p>`)}
          ${section("03","本日核心专项",list(x.drill),`<p class="section-explain">不要只浏览；把下面每项真正读出来、讲出来或完成角色模拟。</p>`)}
          ${section("04","完整句子练习",`<div class="speech-lines">${arr(x.lines).map((line,i)=>`<div class="speech-line"><span class="num">${fmt(i+1)}</span>${esc(line)}</div>`).join("")}</div>`,`<p class="section-explain">每句三轮：慢速准确、自然表达、最后尽量不看文字复述。“／”短停顿，“∥”较长停顿。</p>`)}
          ${section("05",`朗读原文：《${esc(x.readingName)}》`,`<div class="reading-caption"><span>ORIGINAL READING MATERIAL</span><span>／短停顿　∥较长停顿</span></div><div class="reading">${reading}</div>`,`<p class="section-explain">先默读并圈出难点，再慢读、自然读，最后保存不剪辑的完整录音。停顿秒数仅供参考，不能机械化。</p>`)}
          ${section("06","脱稿复述练习",`<div class="retell-chain">${arr(x.retell).map(v=>`<span>${esc(v)}</span>`).join("")}</div><p class="section-explain">先合上原文，只看上面五个关键词准备1分钟，然后连续讲60—90秒。请先独立完成，再看示范。</p><h3 style="font-size:14px;margin:19px 0 9px">参考复述</h3>${sample}`)}
          ${section("07","真实情境表达",`<div class="scene-card"><h3>生活情境｜${esc(x.dailyTitle)}</h3><p>${decorate(x.daily)}</p><small>先照读，再只看要点脱稿讲一遍。</small></div><div class="scene-card"><h3>科研交流｜${esc(x.labTitle)}</h3><p>${decorate(x.lab)}</p><small>用于表达练习的情境示范，不代表实际项目进展；只需任选一套。</small></div>`,`<p class="section-explain">每次选择至少一套实战稿练习，先录原始版，再修正一处具体问题。</p>`)}
          ${section("08","常见错误与修正",`<div class="fix-list">${arr(x.fix).map(pair=>`<div class="fix-item"><strong>常见问题：${esc(pair[0])}</strong><p>修正方法：${esc(pair[1])}</p></div>`).join("")}</div>`)}
          ${section("09","100分评分与复盘",`<p style="font-size:13px;color:var(--muted)">评分请在练习完成后填写。初期的自评只用于追踪变化；发音准确性可以借助词典规范录音或他人听辨。</p>
          <div class="note-box"><h4>今日必须保留的录音</h4>${rec}</div>
          <div class="note-box"><h4>写下真正能改进的一件事</h4><p>例如：“语速变快时，我要先停半秒，再讲下一层意思。”尽量写可执行的动作，而不是空泛的评价。</p></div>`)}
        </div>
        <aside class="lesson-aside" aria-label="学习操作台">
          <div class="aside-card"><h3>60分钟专注计时</h3><div id="timer-display" class="timer-display" aria-live="off">60:00</div><div class="timer-controls"><button class="button small primary" id="timer-start">开始</button><button class="button small" id="timer-pause">暂停</button><button class="button small" id="timer-reset">归零</button></div><p class="audio-note" style="margin:10px 0 0">计时器仅作参考，可以根据体力和实际情况暂停。</p></div>
          <div class="aside-card"><h3>完成今日7项任务</h3><p class="aside-caption" id="tasks-count">${checks.filter(Boolean).length} / ${tasks.length} 已完成</p>${tasks.map((v,i)=>`<label class="checkbox-row ${checks[i]?"checked":""}"><input type="checkbox" data-check="${i}" ${checks[i]?"checked":""}><span>${esc(v)}</span></label>`).join("")}</div>
          <div class="aside-card"><h3>分项打分 · 满分100</h3>${rubricHtml}<div class="score-total"><span>本课评分</span><strong id="score-total">0 / 100</strong></div></div>
          <div class="aside-card"><h3>我的问题与改进</h3><p class="aside-caption">保存于当前浏览器，可随时修改。</p><textarea class="memo" id="day-notes" placeholder="今天哪句话卡住了？哪种音仍不稳定？下次准备怎么调整？">${esc(entry.notes||"")}</textarea><p class="memo-status" id="memo-status">输入后自动保存</p></div>
          <div class="aside-card"><h3>本地录音</h3><p class="audio-note">点击开始后浏览器会请求麦克风权限。点击停止后音频会下载到你的设备，不传到服务器；若不支持，可用手机录音。</p><div class="audio-controls"><button class="button small primary" id="record-start">开始录音</button><button class="button small" id="record-stop" disabled>停止并下载</button></div><p class="aside-feedback" id="record-status" aria-live="polite"></p></div>
          <div class="aside-card"><button class="button primary" id="mark-complete" style="width:100%">${entry.completed?"✓ 已完成（点击取消）":"标记完成本课 ✓"}</button><p class="audio-note" style="margin:10px 0 0">不自动跳到下一课，也不强制连续打卡。</p><button class="button small subtle" id="print-lesson" style="width:100%;margin-top:8px">打印 / 保存PDF</button></div>
        </aside>
      </div>
      <nav class="lesson-steps-footer" aria-label="课程切换"><a href="${dayLink(Math.max(1,d-1))}" ${d===1?'style="visibility:hidden"':''}><span>←</span><span>Day ${fmt(Math.max(1,d-1))}</span></a><a href="${d===21?"./":dayLink(d+1)}"><span>${d===21?"返回总览":"Day "+fmt(d+1)}</span><span>→</span></a></nav>
    </div>`;
    const total=document.getElementById("score-total");
    const scores=[...document.querySelectorAll("[data-score]")];
    function setTotal(){let val=0;scores.forEach((e,i)=>{const upper=rubric[i][1];const v=Math.round(Math.max(0,Math.min(upper,Number(e.value)||0)));val+=v});total.textContent=`${val} / 100`;update(d,"total",val)}
    scores.forEach((e,i)=>e.addEventListener("change",()=>{const upper=rubric[i][1];e.value=String(Math.round(Math.max(0,Math.min(upper,Number(e.value)||0))));update(d,"scores",scores.map(v=>Number(v.value)||0));setTotal()}));
    setTotal();
    document.querySelectorAll("[data-check]").forEach(e=>e.addEventListener("change",()=>{
      const selected=[...document.querySelectorAll("[data-check]")].map(v=>v.checked);update(d,"checks",selected);
      document.getElementById("tasks-count").textContent=`${selected.filter(Boolean).length} / ${tasks.length} 已完成`;
      e.closest(".checkbox-row").classList.toggle("checked",e.checked);
    }));
    const memo=document.getElementById("day-notes");
    memo.addEventListener("input",()=>{update(d,"notes",memo.value);document.getElementById("memo-status").textContent="已保存到本机浏览器"});
    document.getElementById("timer-start").addEventListener("click",startTimer);
    document.getElementById("timer-pause").addEventListener("click",pauseTimer);
    document.getElementById("timer-reset").addEventListener("click",resetTimer);
    document.getElementById("mark-complete").addEventListener("click",()=>{
      const value=!isDone(d);update(d,"completed",value);const b=document.getElementById("mark-complete");b.textContent=value?"✓ 已完成（点击取消）":"标记完成本课 ✓";
      toast(value?"Day "+fmt(d)+" 已标记完成，可按自己的节奏继续。":"已取消本课完成标记。")
    });
    document.getElementById("print-lesson").addEventListener("click",()=>window.print());
    const recStart=document.getElementById("record-start"),recStop=document.getElementById("record-stop"),recStatus=document.getElementById("record-status");
    recStart.addEventListener("click",async()=>{
      if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==="undefined"){recStatus.textContent="当前浏览器不支持，请使用手机录音。";return}
      try{
        stream=await navigator.mediaDevices.getUserMedia({audio:true});
        const format=["audio/webm;codecs=opus","audio/webm","audio/mp4"].find(m=>MediaRecorder.isTypeSupported(m));
        media=new MediaRecorder(stream,format?{mimeType:format}:{});
        chunks=[];
        media.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
        media.onstop=()=>{
          const mime=media?.mimeType||"audio/webm";const ext=mime.includes("mp4")?"m4a":"webm";
          if(chunks.length){const blob=new Blob(chunks,{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`PracticeLab_Day${fmt(d)}_${new Date().toISOString().replace(/[:.]/g,"-")}.${ext}`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);recStatus.textContent="录音已在本地生成下载文件。"}
          if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
          recStart.disabled=false;recStop.disabled=true;
        };
        media.start();recStart.disabled=true;recStop.disabled=false;recStatus.textContent="录音中……点击“停止并下载”结束。";
      }catch(err){recStatus.textContent="未取得麦克风权限。可以使用手机录音。";if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}}
    });
    recStop.addEventListener("click",stopMedia);
    showTimer();
    window.scrollTo({top:0,behavior:"instant"});
  }
  function render(){
    const id=Number(new URLSearchParams(location.search).get("day"));
    if(Number.isInteger(id)&&id>=1&&id<=21){const lesson=ALL.find(x=>x.d===id);if(lesson){renderLesson(lesson);return}}
    destroy();renderHome();
    if(location.hash){const target=document.getElementById(location.hash.slice(1));if(target)setTimeout(()=>target.scrollIntoView({behavior:"instant"}),50)}
  }
  if(ALL.length!==21||new Set(ALL.map(x=>x.d)).size!==21){MAIN.innerHTML="<div class='container'><h1>教材尚未完整加载</h1><p>请刷新页面后重试。如果问题持续，请检查网络连接。</p></div>";return}
  const navBtn=document.getElementById("menu-toggle"),mobile=document.getElementById("mobile-nav");
  navBtn?.addEventListener("click",()=>{const newState=mobile.hidden;mobile.hidden=!newState;navBtn.setAttribute("aria-expanded",String(newState))});
  mobile?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{mobile.hidden=true;navBtn?.setAttribute("aria-expanded","false")}));
  window.addEventListener("scroll",()=>{const root=document.documentElement,extent=root.scrollHeight-root.clientHeight,pct=extent>0?Math.round(window.scrollY/extent*100):0;const el=document.getElementById("reading-meter");if(el)el.style.width=pct+"%"},{passive:true});
  window.addEventListener("pagehide",()=>{if(stream)stream.getTracks().forEach(t=>t.stop())});
  render();
})();
