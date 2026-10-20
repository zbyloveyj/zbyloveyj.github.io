(function GrowthApp(){
  "use strict";
  const DATA=window.RESET100;
  const $=id=>document.getElementById(id);
  if(!DATA || !Array.isArray(DATA.days) || DATA.days.length!==100){
    const el=$("day-content");if(el)el.textContent="课程数据未加载，请刷新页面。";
    return;
  }
  const STORE="yixw_growth_100_v1";
  const GUIDES=window.RESET100_GUIDES?.guides||[];
  const SUPPORT=window.RESET100_SUPPORT;
  if(!SUPPORT||SUPPORT.version!==2){const el=document.getElementById("day-content");if(el)el.textContent="辅助课程数据未加载，请检查网络或刷新页面。";return;}
  const TASK_IDS=["core1","core2","core3","support1","support2"];
  const LEGACY_IDS=["sleep","food","movement","reading","focus","mindfulness","mission"];
  const names=DATA.categories;
  const modes={
    lite:{name:"轻量",hint:"完成核心第1步，即可记录当天。辅助练习完全自选。",time:"建议5—15分钟"},
    regular:{name:"标准",hint:"完成当天核心3个步骤，再确认完成。两项辅助练习按时间选择。",time:"建议20—35分钟"},
    deep:{name:"深入",hint:"核心3步 + 至少1项辅助练习 + 8字以上思考记录。",time:"建议35—60分钟"}
  };
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const pad=n=>String(n).padStart(2,"0");
  const todayString=()=>{
    const dt=new Date();
    return [dt.getFullYear(),pad(dt.getMonth()+1),pad(dt.getDate())].join("-");
  };
  const validDate=s=>{
    if(typeof s!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
    const [year,month,day]=s.split("-").map(Number),date=new Date(year,month-1,day);
    return date.getFullYear()===year&&date.getMonth()+1===month&&date.getDate()===day;
  };
  const fresh=()=>({version:1,startDate:todayString(),mode:"regular",theme:"light",days:{},weeklyNotes:{},lastOpened:1});
  let state=fresh();
  try{
    const loaded=JSON.parse(localStorage.getItem(STORE)||"null");
    if(loaded&&typeof loaded==="object"&&!Array.isArray(loaded)&&loaded.version===1){
      state={...state,...loaded,days:loaded.days&&typeof loaded.days==="object"&&!Array.isArray(loaded.days)?loaded.days:{},weeklyNotes:loaded.weeklyNotes&&typeof loaded.weeklyNotes==="object"&&!Array.isArray(loaded.weeklyNotes)?loaded.weeklyNotes:{}};
    }
  }catch(e){}
  if(!validDate(state.startDate))state.startDate=todayString();
  if(!modes[state.mode])state.mode="regular";
  if(!["dark","light"].includes(state.theme))state.theme="light";
  let toastTimer=null,savedWarning=false;
  function toast(message){
    const node=$("toast");if(!node)return;
    node.textContent=message;node.hidden=false;
    if(toastTimer)clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>node.hidden=true,3500);
  }
  function save(){
    try{localStorage.setItem(STORE,JSON.stringify(state));const node=$("save-status");if(node)node.textContent="已保存到当前浏览器 · "+new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"});}
    catch(e){if(!savedWarning){savedWarning=true;toast("浏览器禁止本地存储，请不要依赖当前打卡记录。");}}
  }
  function getDay(n){
    const d=state.days[String(n)];
    return d&&typeof d==="object"&&!Array.isArray(d)?d:{};
  }
  function updateDay(n,update){
    const old=getDay(n);
    state.days[String(n)]={...old,...update,updatedAt:new Date().toISOString()};
    state.lastOpened=n;
    save();
  }
  function startDateDay(n){
    const parts=state.startDate.split("-").map(Number);
    return new Date(parts[0],parts[1]-1,parts[2]+n-1);
  }
  function plannedToday(){
    const parts=state.startDate.split("-").map(Number),now=new Date();
    const x=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
    const y=Date.UTC(parts[0],parts[1]-1,parts[2]);
    return Math.min(100,Math.max(1,Math.floor((x-y)/86400000)+1));
  }
  function currentDayLabel(n){
    const d=startDateDay(n);
    return d.getFullYear()+"."+pad(d.getMonth()+1)+"."+pad(d.getDate());
  }
  const queryDay=Number(new URLSearchParams(location.search).get("day"));
  const persistedDay=Number(state.lastOpened);
  const initialResume=Number.isInteger(persistedDay)&&persistedDay>=1&&persistedDay<=100&&!state.days[String(persistedDay)]?.completed?persistedDay:DATA.days.find(x=>state.days[String(x.n)]?.completed!==true)?.n||100;
  let selectedDay=Number.isInteger(queryDay)&&queryDay>=1&&queryDay<=100?queryDay:initialResume;
  const countChecked=day=>TASK_IDS.reduce((n,k)=>n+(getDay(day).tasks?.[k]===true?1:0),0);
  const isDone=day=>getDay(day).completed===true;
  const doneTotal=()=>DATA.days.reduce((n,d)=>n+(isDone(d.n)?1:0),0);
  const countActivities=()=>DATA.days.reduce((sum,d)=>sum+countChecked(d.n),0);
  const phaseIndex=day=>Math.min(4,Math.floor((day-1)/20));
  function suggestedDay(){
    const n=Number(state.lastOpened);
    if(Number.isInteger(n)&&n>=1&&n<=100){
      if(!isDone(n))return n;
      const later=DATA.days.find(d=>d.n>n&&!isDone(d.n));
      if(later)return later.n;
    }
    return DATA.days.find(d=>!isDone(d.n))?.n||100;
  }
  const dayStatus=n=>{
    const info=getDay(n);
    if(isDone(n))return "done";
    if(countChecked(n)>0||String(info.note||"").trim()||Number.isInteger(info.energy))return "partial";
    return "todo";
  };
  function activityPlan(n){
    const day=DATA.days[n-1];
    const core=day.steps.map((description,i)=>({
      id:"core"+(i+1),category:day.category,title:["明确任务","实践行动","沉淀结果"][i],description,
      check:["完成所述准备并留下一个可见记录","按要求做出实际尝试","将结果或修订写进笔记"][i],group:"core"
    }));
    const supplementary=SUPPORT.choose(day).map(x=>({
      id:x.id,category:x.category,title:x.title,description:x.action,check:x.check,group:"support"
    }));
    return [...core,...supplementary];
  }
  function categoryCounts(){
    const out=Object.fromEntries(Object.keys(DATA.categories).map(k=>[k,0]));
    DATA.days.forEach(day=>{
      const complete=getDay(day.n).tasks||{};
      if(["core1","core2","core3"].some(k=>complete[k]===true))out[day.category]++;
      SUPPORT.choose(day).forEach(x=>{if(complete[x.id]===true)out[x.category]++;});
    });
    return out;
  }
  function completionGate(n,mode=state.mode){
    const s=getDay(n),checked=s.tasks||{},core=["core1","core2","core3"];
    if(mode==="lite")return {ok:checked.core1===true,text:"轻量：完成第1步即可"};
    if(mode==="regular")return {ok:core.every(k=>checked[k]===true),text:"标准：完成核心3步"};
    return {ok:core.every(k=>checked[k]===true)&&(checked.support1===true||checked.support2===true)&&String(s.note||"").trim().length>=8,text:"深入：核心3步＋辅助1项＋至少8字笔记"};
  }
  function refreshDaySummary(){
    const n=countChecked(selectedDay),gate=completionGate(selectedDay),d=getDay(selectedDay);
    const bar=$("day-content").querySelector(".completion-bar");
    if(bar){bar.setAttribute("aria-valuenow",n);const fill=bar.querySelector(".completion-fill");if(fill)fill.style.width=n*20+"%";}
    const done=$("day-content").querySelector(".completion-meta");
    if(done){
      const children=done.querySelectorAll("span");
      if(children[0])children[0].textContent="已完成 "+n+"/5 个具体任务";
    }
    const node=$("gate-status");if(node)node.textContent=d.completed===true?"已确认（"+(modes[d.completedMode]?.name||"历史记录")+"）":gate.ok?"已达到当前模式的验收条件":"尚未达到当前模式的验收条件";
  }
  function setTheme(){
    document.documentElement.dataset.theme=state.theme;
    const b=$("theme-toggle");if(b){b.setAttribute("aria-label",state.theme==="dark"?"切换浅色模式":"切换深色模式");b.title=state.theme==="dark"?"切换浅色模式":"切换深色模式";}
  }
  function renderDay(){
    const day=DATA.days[selectedDay-1],phase=DATA.phases[day.phase],d=getDay(selectedDay),tasks=activityPlan(selectedDay);
    const guide=GUIDES[selectedDay-1]||{materials:"纸笔或备忘录",template:"目标：[具体]；行动：[具体]；结果：[实际记录]",avoid:"根据身体情况和现实工作量调整，不用打卡代替真实行动。"};
    const week=Math.ceil(selectedDay/7),gate=completionGate(selectedDay);
    $("start-date").value=state.startDate;
    $("prev-day").disabled=selectedDay===1;
    $("next-day").disabled=selectedDay===100;
    for(const button of $("mode-picker").querySelectorAll("button[data-mode]")){
      button.setAttribute("aria-pressed",String(button.dataset.mode===state.mode));
    }
    $("day-heading").innerHTML=`
      <div class="day-heading-text">
        <span class="day-status ${d.completed===true?"done":""}">${esc(phase.name)} · 第${week}周 ${d.completed===true?" · 已完成":""}</span>
        <h3>${esc(day.title)}</h3>
        <p>${esc(currentDayLabel(selectedDay))} · ${esc(DATA.categories[day.category])} · ${esc(modes[state.mode].time)}</p>
      </div><strong class="day-no">DAY ${String(selectedDay).padStart(3,"0")}</strong>`;
    const coreHtml=tasks.slice(0,3).map((t,i)=>`
      <button type="button" class="task core-task" data-task="${esc(t.id)}" aria-pressed="${d.tasks?.[t.id]===true}" aria-label="${esc(t.title)}：${esc(t.description)}，${d.tasks?.[t.id]===true?"已完成":"未完成"}">
        <span class="task-check" aria-hidden="true">✓</span>
        <span class="task-content"><span class="task-top"><span class="task-name"><b class="task-step-no">STEP ${pad(i+1)}</b> ${esc(t.title)}</span><span class="task-length">${i===0?"准备":i===1?"实践":"记录"}</span></span><span class="task-detail">${esc(t.description)}</span><span class="task-acceptance">验收：${esc(t.check)}</span></span>
      </button>`).join("");
    const supportHtml=tasks.slice(3).map((t,i)=>`
      <button type="button" class="task support-task" data-task="${esc(t.id)}" aria-pressed="${d.tasks?.[t.id]===true}" aria-label="${esc(t.title)}：${esc(t.description)}，${d.tasks?.[t.id]===true?"已完成":"未完成"}">
        <span class="task-check" aria-hidden="true">✓</span>
        <span class="task-content"><span class="task-top"><span class="task-name">${esc(t.title)}</span><span class="task-length">${esc(DATA.categories[t.category])}</span></span><span class="task-detail">${esc(t.description)}</span><span class="task-acceptance">完成证据：${esc(t.check)}</span></span>
      </button>`).join("");
    const linked=day.link?DATA.days[day.link-1]:null;
    const linkedText=linked?`<a href="?day=${day.link}" class="path-link" data-open-day="${day.link}">↖ 相关前置 · Day ${pad(day.link)}「${esc(linked.title)}」</a>`:`<span class="path-link path-label">起点日 · 先观察，不急着改变</span>`;
    const next=selectedDay<100?DATA.days[selectedDay]:null;
    const nextText=next?`<a href="?day=${next.n}" class="path-link" data-open-day="${next.n}">下一个主题 · ${esc(next.title)} ↗</a>`:`<span class="path-link path-label">全部100天课程的最后一课</span>`;
    const checked=countChecked(selectedDay),completed=d.completed===true;
    const legacy=completed&&checked===0&&Object.keys(d.tasks||{}).some(k=>LEGACY_IDS.includes(k))?`<p class="legacy-note">此日保留了旧版完成记录；新版步骤尚未单独核验。</p>`:"";
    $("day-content").innerHTML=`
      <div class="weekly-brief"><div><span class="brief-label">THIS WEEK / WEEK ${pad(week)}</span><strong>${esc(SUPPORT.weeklyObjectives[week-1])}</strong></div><span class="brief-phase">本阶段：${esc(DATA.phaseOutcomes[day.phase])}</span></div>
      <div class="day-body">
        <div class="daily-left">
          <p class="card-microheading">01 / MAIN PRACTICE · ${esc(DATA.categories[day.category])}</p>
          <h4 class="block-title">今天只聚焦一件事。</h4>
          <p class="block-desc">3个具体步骤，按顺序完成。每个步骤有独立打卡，避免把“看过课程”当作“做过练习”。</p>
          <div class="outcome-card"><span class="mini-label">今天要留下什么</span><p>${esc(day.proof)}</p></div>
          <div class="task-list main-task-list">${coreHtml}</div>
          <details class="lesson-guide" id="lesson-guide">
            <summary><span class="guide-head-icon" aria-hidden="true">▤</span><span class="guide-summary-text"><strong>这一课怎样做得更扎实？</strong><small>材料准备 · 记录示例 · 常见误区</small></span><span class="guide-chevron" aria-hidden="true">⌄</span></summary>
            <div class="guide-body">
              <div class="guide-info"><span>01 / 需要准备</span><p>${esc(guide.materials)}</p></div>
              <div class="guide-info"><span>02 / 参考记录格式（示意，不是真实数据）</span><p class="guide-sample">${esc(guide.template)}</p><button type="button" class="copy-guide" id="copy-guide">复制空白记录结构 ↗</button></div>
              <div class="guide-info"><span>03 / 容易忽略的地方</span><p>${esc(guide.avoid)}</p></div>
            </div>
          </details>
          <div class="path-box"><div class="path-title">学习衔接 · 在旧成果上继续</div><div class="path-links">${linkedText}${nextText}</div><p>前置课程可随时查看，没有完成也可以继续当前课程；关联是学习建议，不是强制解锁。</p></div>
        </div>
        <div class="daily-right">
          <p class="card-microheading">02 / SUPPORTING PRACTICE</p><h4 class="block-title">穿插两项生活巩固。</h4>
          <p class="block-desc">结合本周节律安排，自动避开当天主线领域。与昨天不同，隔周可有目的地复练。</p>
          <div class="task-list support-task-list">${supportHtml}</div>
          <div class="training-rules"><span class="mini-label">本日确认规则</span><strong>${esc(gate.text)}</strong><p>${esc(modes[state.mode].hint)} 运动、饮食和冥想都应根据自己的健康状况与负荷调整。</p></div>
          <div class="journal-card">
            <span class="card-microheading">03 / WRITTEN REFLECTION</span><h4>给今天留一条证据。</h4>
            <p class="journal-question">${esc(day.question)}</p>
            <label class="sr-only" for="day-note">今日反思与成果笔记</label>
            <textarea id="day-note" maxlength="5000" placeholder="参考成果：${esc(day.proof)}&#10;只记录实际做过的事；不知道的部分可以写“尚不确定”。">${esc(d.note||"")}</textarea>
            <p class="journal-tip">笔记自动保存于当前浏览器；不要记录身份证、病历等敏感个人信息。</p>
            <div class="energy-row"><label>今天的精力状态（可选）</label><div class="energy-options" role="group" aria-label="精力状态，1分较低，5分充沛">${[1,2,3,4,5].map(i=>`<button type="button" data-energy="${i}" aria-label="精力 ${i} 分" aria-pressed="${d.energy===i}">${i}</button>`).join("")}</div></div>
          </div>
        </div>
      </div>
      <div class="day-checkout"><div class="checkout-progress"><div class="completion-bar" role="progressbar" aria-label="当天具体任务完成进度" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${checked}"><div class="completion-fill" style="width:${checked/5*100}%"></div></div><div class="completion-meta"><span>已完成 ${checked}/5 个具体任务</span><span id="gate-status">${completed?"已确认（"+esc(modes[d.completedMode]?.name||"历史记录")+"）":gate.ok?"已达到当前模式的验收条件":"尚未达到当前模式的验收条件"}</span></div>${legacy}</div><button type="button" class="done-button ${completed?"is-done":""}" id="finish-day">${completed?"✓ 已确认 · 点击撤销":"✓ 按本模式确认完成"}</button></div>`;
  }
  function renderStats(){
    const completed=doneTotal(),activities=countActivities(),ph=phaseIndex(plannedToday());
    const phaseDone=DATA.days.slice(ph*20,ph*20+20).filter(x=>isDone(x.n)).length;
    $("stats").innerHTML=[
      [pad(completed),"已经完成的课程"],
      [pad(plannedToday()),"当前日历计划日"],
      [String(activities),"已勾选的具体行动"],
      [pad(phaseDone)+"/20","本阶段累计完成"]
    ].map(([v,label])=>`<div class="stat"><b>${esc(v)}</b><span>${esc(label)}</span></div>`).join("");
    $("hero-progress").innerHTML=`<strong>${completed}<span class="dial-total">/100</span></strong><small>完成的课程</small>`;
    $("dashboard-dial").style.setProperty("--pct",Math.round(completed)+"%");
    const n=suggestedDay(),day=DATA.days[n-1];
    $("dashboard-next-day").textContent="DAY "+String(n).padStart(3,"0");
    $("dashboard-next-title").textContent=day.title;
    $("dashboard-next-meta").textContent=DATA.phases[day.phase].name+" · "+DATA.categories[day.category];
    const parts=state.startDate.split("-").map(Number);
    const elapsed=Math.floor((Date.UTC(new Date().getFullYear(),new Date().getMonth(),new Date().getDate())-Date.UTC(parts[0],parts[1]-1,parts[2]))/86400000);
    $("dashboard-date").textContent=elapsed<0?"尚未开始 · 可预览 Day 01":elapsed>=100?"百日已满 · 仍可自主补做":"日历计划日 "+pad(plannedToday());
    $("resume-day").innerHTML=completed===100?"回顾结业课程 <span aria-hidden=\"true\">→</span>":"继续 Day "+pad(n)+" <span aria-hidden=\"true\">→</span>";
  }
  function renderPhases(){
    $("phase-list").innerHTML=DATA.phases.map((p,i)=>{
      const completed=DATA.days.slice(i*20,i*20+20).filter(d=>isDone(d.n)).length;
      return `<button type="button" class="phase-card" data-open-day="${i*20+1}" aria-label="${esc(p.name)}，第${i*20+1}至${(i+1)*20}天，已完成${completed}天">
        <span class="phase-number">${p.code}</span><span class="phase-copy"><strong>${esc(p.name)}</strong><small>DAY ${esc(p.days)} · ${completed}/20</small><p>${esc(p.caption)}</p><span class="phase-progress"><span style="width:${completed*5}%"></span></span></span></button>`;
    }).join("");
  }
  function renderMap(){
    const current=plannedToday();
    $("day-map").innerHTML=DATA.days.map(d=>{
      const s=getDay(d.n),complete=s.completed===true,partial=countChecked(d.n)>0||!!s.note||Number.isInteger(s.energy);
      const className=complete?"done":partial?"partial":"";
      return `<button type="button" class="map-day ${className} ${d.n===current?"current":""}" data-open-day="${d.n}" style="--phase-color:${DATA.phases[d.phase].color}" title="第${d.n}天 · ${esc(d.title)}" aria-label="第 ${d.n} 天：${esc(d.title)}${complete?"，已完成":partial?"，进行中":""}" aria-current="${d.n===selectedDay?"true":"false"}"><span>${pad(d.n)}</span><small>${complete?"完成":partial?"记录":"DAY"}</small></button>`;
    }).join("");
  }
  function renderDimensions(){
    $("dimension-grid").innerHTML=DATA.dimensions.map((x,i)=>`<article class="dimension-card"><span class="dimension-icon" aria-hidden="true">${esc(x.icon)}</span><h3>${pad(i+1)}. ${esc(x.name)}</h3><p>${esc(x.desc)}</p></article>`).join("");
  }
  function renderCharts(){
    let weekHtml="";
    for(let w=0;w<15;w++){
      const low=w*7+1,high=Math.min(100,(w+1)*7),total=high-low+1;
      let count=0;for(let d=low;d<=high;d++)if(isDone(d))count++;
      weekHtml+=`<div class="week" title="第${w+1}周，${count}/${total}天" role="img" aria-label="第${w+1}周，完成${count}天，共${total}天"><div class="week-track"><div class="week-fill" style="height:${Math.round(count/total*100)}%"></div></div><small>${w+1}</small></div>`;
    }
    $("weekly-chart").innerHTML=weekHtml;
    const counts=categoryCounts(),max=Math.max(1,...Object.values(counts));
    $("habit-chart").innerHTML=Object.entries(DATA.categories).map(([k,name])=>{
      const n=counts[k];return `<div class="habit-row"><span>${esc(name)}</span><div class="habit-track" role="progressbar" aria-label="${esc(name)}训练次数" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${n}"><div class="habit-fill" style="width:${Math.round(n/max*100)}%"></div></div><b>${n}</b></div>`;
    }).join("");
    const week=Math.ceil(selectedDay/7);
    $("review-panel").innerHTML=`<div><span class="card-microheading">WEEKLY REVIEW / ${pad(week)}</span><h3>本周真正积累了什么？</h3><p>${esc(SUPPORT.weeklyObjectives[week-1])} · Day ${pad((week-1)*7+1)}—${pad(Math.min(100,week*7))}。</p><p>回看可见产出、没有做到的原因，以及下周准备调整的最小一件事。</p></div><div><label class="sr-only" for="weekly-note">第${week}周复盘笔记</label><textarea id="weekly-note" maxlength="5000" data-week="${week}" placeholder="本周保留什么证据？持续什么？调整什么？">${esc(state.weeklyNotes[String(week)]||"")}</textarea><p class="journal-tip">自动保存于当前浏览器，不公开上传。</p></div>`;
  }
  let catalogLimit=12;
  function renderCatalog(){
    const q=$("course-search").value.trim().toLocaleLowerCase("zh-CN");
    const phase=$("course-phase").value,domain=$("course-domain").value,status=$("course-state").value;
    const found=DATA.days.filter(day=>{
      if(phase!=="all"&&String(day.phase)!==phase)return false;
      if(domain!=="all"&&day.category!==domain)return false;
      if(status!=="all"&&dayStatus(day.n)!==status)return false;
      if(q){
        const source=[day.n,"day"+day.n,day.title,day.proof,day.question,...day.steps,DATA.categories[day.category],DATA.phases[day.phase].name].join(" ").toLocaleLowerCase("zh-CN");
        if(!source.includes(q))return false;
      }
      return true;
    });
    $("course-results-count").textContent=found.length+" 节课程符合筛选 · 当前显示 "+Math.min(catalogLimit,found.length)+" 节";
    $("course-list").innerHTML=found.length?found.slice(0,catalogLimit).map(day=>{
      const status=dayStatus(day.n);
      const label=status==="done"?"已完成":status==="partial"?"进行中":"未开始";
      return `<button type="button" class="course-entry ${status}" data-open-day="${day.n}" aria-label="打开 Day ${pad(day.n)}：${esc(day.title)}，${label}">
        <span class="entry-day">DAY <strong>${pad(day.n)}</strong></span>
        <span class="entry-copy"><span class="entry-meta">${esc(DATA.phases[day.phase].name)} · ${esc(DATA.categories[day.category])}</span><strong class="entry-title">${esc(day.title)}</strong><span class="entry-proof">${esc(day.proof)}</span></span>
        <span class="entry-side"><span class="entry-status ${status}">${label}</span><span class="entry-arrow" aria-hidden="true">↗</span></span>
      </button>`;
    }).join(""):`<div class="catalog-empty"><span aria-hidden="true">⌕</span><strong>没有找到匹配的课程</strong><p>试试“睡眠”“阅读”“表达”等更简单的关键词，或者清除筛选。</p></div>`;
    $("course-more").hidden=found.length<=catalogLimit;
  }
  function renderRecent(){
    const relevant=DATA.days.filter(x=>{
      const d=getDay(x.n);return !!d.completed||countChecked(x.n)>0||String(d.note||"").trim().length>0;
    }).sort((a,b)=>{
      const da=getDay(a.n),db=getDay(b.n);
      return String(db.updatedAt||"").localeCompare(String(da.updatedAt||""))||b.n-a.n;
    }).slice(0,6);
    $("recent-records").innerHTML=relevant.length?relevant.map(day=>{
      const d=getDay(day.n);
      const status=dayStatus(day.n),label=status==="done"?"已完成":"进行中";
      return `<button type="button" class="recent-entry" data-open-day="${day.n}"><span class="recent-num">${pad(day.n)}</span><span class="recent-info"><strong>${esc(day.title)}</strong><small>${esc(DATA.categories[day.category])} · ${label} · ${countChecked(day.n)}/5 项</small></span><span class="recent-chevron" aria-hidden="true">↗</span></button>`;
    }).join(""):`<div class="recent-empty">还没有学习记录。打开 Day 01 并完成第一个步骤，进度会自动出现在这里。</div>`;
  }
  function render(){setTheme();renderDay();renderStats();renderPhases();renderMap();renderCharts();renderCatalog();renderRecent();}
  function selectDay(n,scroll=true){
    const x=Number(n);
    if(!Number.isInteger(x)||x<1||x>100)return;
    const changed=selectedDay!==x;
    selectedDay=x;
    state.lastOpened=x;
    save();
    if(changed)history.pushState({day:x},"",location.pathname+"?day="+x+location.hash);
    renderDay();renderMap();renderCharts();renderCatalog();renderRecent();renderStats();
    if(scroll)$("today").scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});
  }
  function download(filename,content,type){
    const file=new Blob([content],{type}),url=URL.createObjectURL(file),a=document.createElement("a");
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  function exportData(){
    const out={...state,exportedAt:new Date().toISOString(),app:"100-days-of-becoming"};
    download("日有寸进-100天记录-"+todayString()+".json",JSON.stringify(out,null,2),"application/json;charset=utf-8");
    toast("完整记录已导出，请妥善保存。");
  }
  function exportReport(){
    const counts=categoryCounts();
    const lines=[
      "# 日有寸进｜100天个人成长记录","",
      "导出时间："+new Date().toLocaleString("zh-CN"),"起点日期："+state.startDate,
      "已确认完成："+doneTotal()+" / 100 天","具体任务勾选："+countActivities()+" 项","",
      "## 八个能力与生活领域",
      ...Object.entries(DATA.categories).map(([k,name])=>"- "+name+"："+counts[k]+" 项"),"","## 阶段记录",
      ...DATA.phases.flatMap((p,i)=>["### "+p.name,"阶段目标："+DATA.phaseOutcomes[i],DATA.days.slice(i*20,i*20+20).filter(x=>isDone(x.n)).length+" / 20 天",""]),
      "## 每日课程与成果笔记"
    ];
    DATA.days.forEach(day=>{
      const d=getDay(day.n),count=countChecked(day.n);
      if((d.note||"").trim()||d.completed===true||count>0){
        lines.push("### Day "+pad(day.n)+" · "+day.title+(d.completed?"（已确认完成）":""));
        lines.push("预期成果："+day.proof);
        lines.push("当前已勾选："+count+" / 5 项");
        if(Number.isInteger(d.energy))lines.push("主观精力："+d.energy+" / 5");
        if(d.note)lines.push("反思："+d.note.trim());
        lines.push("");
      }
    });
    lines.push("## 每周复盘");
    Object.entries(state.weeklyNotes).sort((a,b)=>Number(a[0])-Number(b[0])).forEach(([k,v])=>{if(v&&v.trim())lines.push("### 第 "+k+" 周",v.trim(),"")});
    lines.push("","---","个人练习记录，不代表医疗评估或客观健康结论。");
    download("日有寸进-成长档案-"+todayString()+".md",lines.join("\n"),"text/markdown;charset=utf-8");
    toast("成长档案已导出。");
  }
  function validateImport(obj){
    if(!obj||typeof obj!=="object"||Array.isArray(obj)||obj.version!==1||!validDate(obj.startDate))throw Error("备份文件格式不正确");
    const clean=fresh();
    clean.startDate=obj.startDate;
    const restored=Number(obj.lastOpened);if(Number.isInteger(restored)&&restored>=1&&restored<=100)clean.lastOpened=restored;
    clean.mode=modes[obj.mode]?obj.mode:"regular";
    clean.theme=["light","dark"].includes(obj.theme)?obj.theme:"light";
    if(obj.days&&typeof obj.days==="object"&&!Array.isArray(obj.days)){
      for(const [k,v] of Object.entries(obj.days)){
        const n=Number(k);
        if(!Number.isInteger(n)||n<1||n>100||!v||typeof v!=="object"||Array.isArray(v))continue;
        const tasks={};
        for(const id of [...TASK_IDS,...LEGACY_IDS]){if(v.tasks&&v.tasks[id]===true)tasks[id]=true;}
        clean.days[String(n)]={tasks,completed:v.completed===true,completedMode:modes[v.completedMode]?v.completedMode:null,note:typeof v.note==="string"?v.note.slice(0,5000):"",energy:Number.isInteger(v.energy)&&v.energy>=1&&v.energy<=5?v.energy:null,updatedAt:typeof v.updatedAt==="string"?v.updatedAt.slice(0,40):null};
      }
    }
    if(obj.weeklyNotes&&typeof obj.weeklyNotes==="object"&&!Array.isArray(obj.weeklyNotes)){
      for(const [k,v] of Object.entries(obj.weeklyNotes)){
        const w=Number(k);
        if(Number.isInteger(w)&&w>=1&&w<=15&&typeof v==="string")clean.weeklyNotes[String(w)]=v.slice(0,5000);
      }
    }
    return clean;
  }
  async function importData(file){
    if(!file)return;
    if(file.size>1024*1024){toast("文件超过1MB，请选择正确的JSON记录。");return;}
    try{
      const next=validateImport(JSON.parse(await file.text()));
      if(!confirm("导入将替换本浏览器中的现有100天记录，建议先导出备份。确定继续吗？"))return;
      state=next;selectedDay=next.lastOpened;save();render();
      toast("记录已导入，当前浏览器的进度已恢复。");
    }catch(e){toast("无法导入："+(e instanceof Error?e.message:"文件内容有误"));}
  }
  $("start-date").addEventListener("change",e=>{
    const value=e.target.value;
    if(!validDate(value)){toast("请选择有效日期。");e.target.value=state.startDate;return;}
    state.startDate=value;save();selectDay(plannedToday(),false);renderStats();
    toast("新的起点日期已保存，原有Day编号记录保持不变。");
  });
  $("theme-toggle").addEventListener("click",()=>{state.theme=state.theme==="light"?"dark":"light";save();setTheme();});
  $("resume-day").addEventListener("click",()=>selectDay(suggestedDay()));
  $("calendar-day").addEventListener("click",()=>selectDay(plannedToday()));
  $("backup-inline").addEventListener("click",exportData);
  const jump=()=>{
    const n=Number($("jump-day-input").value);
    if(!Number.isInteger(n)||n<1||n>100){toast("请输入1至100之间的完整课程编号。");$("jump-day-input").focus();return;}
    selectDay(n);
    $("jump-day-input").value="";
  };
  $("jump-day-btn").addEventListener("click",jump);
  $("jump-day-input").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();jump();}});
  $("prev-day").addEventListener("click",()=>selectDay(selectedDay-1));
  $("next-day").addEventListener("click",()=>selectDay(selectedDay+1));
  $("go-today").addEventListener("click",()=>selectDay(plannedToday()));
  $("mode-picker").addEventListener("click",e=>{
    const b=e.target.closest("button[data-mode]");
    if(!b||!modes[b.dataset.mode])return;
    if(state.mode===b.dataset.mode)return;
    state.mode=b.dataset.mode;save();renderDay();
    toast("已选择"+modes[state.mode].name+"模式；已完成日期仍保留原来的确认模式。");
  });
  $("day-content").addEventListener("click",e=>{
    const task=e.target.closest("button[data-task]");
    if(task){
      const key=task.dataset.task,d=getDay(selectedDay),tasks={...(d.tasks||{})};
      tasks[key]=!tasks[key];
      updateDay(selectedDay,{tasks});
      const pressed=tasks[key]===true;
      task.setAttribute("aria-pressed",String(pressed));
      const label=task.getAttribute("aria-label")||"";
      task.setAttribute("aria-label",label.replace(/，(?:已完成|未完成)$/,"，"+(pressed?"已完成":"未完成")));
      if(d.completed===true&&modes[d.completedMode]&&!completionGate(selectedDay,d.completedMode).ok){
        updateDay(selectedDay,{completed:false,completedMode:null});
        toast("核心验收条件已改变，此日已恢复为进行中。");
        renderDay();
      }
      refreshDaySummary();renderStats();renderMap();renderCharts();renderCatalog();renderRecent();
      return;
    }
    const energy=e.target.closest("button[data-energy]");
    if(energy){
      const value=Number(energy.dataset.energy),d=getDay(selectedDay);
      updateDay(selectedDay,{energy:d.energy===value?null:value});
      for(const b of $("day-content").querySelectorAll("button[data-energy]"))b.setAttribute("aria-pressed",String(Number(b.dataset.energy)===getDay(selectedDay).energy));
      renderMap();renderCatalog();renderRecent();return;
    }
    if(e.target.closest("#copy-guide")){
      const day=DATA.days[selectedDay-1],guide=GUIDES[selectedDay-1];
      if(!guide){toast("未找到这一课的参考格式。");return;}
      const value="Day "+pad(day.n)+" · "+day.title+"\n"+guide.template+"\n注：请用自己的真实记录替换[方括号]内容。";
      (async()=>{
        try{
          if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);
          else{
            const ta=document.createElement("textarea");ta.value=value;document.body.appendChild(ta);ta.select();
            const ok=document.execCommand("copy");ta.remove();if(!ok)throw Error("clipboard unavailable");
          }
          toast("空白记录结构已复制，可粘贴到笔记并填写。");
        }catch(error){toast("无法使用剪贴板；请手动选择上方的参考格式复制。");}
      })();
      return;
    }
    if(e.target.closest("#finish-day")){
      const d=getDay(selectedDay),isPrevious=d.completed===true;
      if(!isPrevious&&!completionGate(selectedDay).ok){
        toast("当前模式尚未达标。可以完成相应核心步骤，或选择更适合今天的轻量模式。");return;
      }
      updateDay(selectedDay,{completed:!isPrevious,completedMode:isPrevious?null:state.mode});
      render();toast(isPrevious?"已撤销当日完成确认。":"本日成果已记录，可以继续下一课。");
    }
  });
  $("day-content").addEventListener("input",e=>{
    if(e.target.id==="day-note"){
      updateDay(selectedDay,{note:e.target.value});
      const d=getDay(selectedDay);
      if(d.completed===true&&modes[d.completedMode]&&!completionGate(selectedDay,d.completedMode).ok)updateDay(selectedDay,{completed:false,completedMode:null});
      refreshDaySummary();
    }
  });
  $("day-content").addEventListener("click",e=>{
    const a=e.target.closest("a[data-open-day]");
    if(a){e.preventDefault();selectDay(Number(a.dataset.openDay));}
  });
  $("journey").addEventListener("click",e=>{
    const b=e.target.closest("button[data-open-day]");
    if(b)selectDay(Number(b.dataset.openDay));
  });
  $("course-domain").innerHTML='<option value="all">全部领域</option>'+Object.entries(DATA.categories).map(([k,v])=>'<option value="'+esc(k)+'">'+esc(v)+'</option>').join("");
  $("course-filter-form").addEventListener("submit",e=>e.preventDefault());
  for(const id of ["course-search","course-phase","course-domain","course-state"]){
    $(id).addEventListener(id==="course-search"?"input":"change",()=>{catalogLimit=12;renderCatalog();});
  }
  $("course-more").addEventListener("click",()=>{catalogLimit=Math.min(100,catalogLimit+12);renderCatalog();});
  $("course-reset").addEventListener("click",()=>{
    $("course-search").value="";$("course-phase").value="all";$("course-domain").value="all";$("course-state").value="all";
    catalogLimit=12;renderCatalog();$("course-search").focus();
  });
  $("history").addEventListener("input",e=>{
    if(e.target.id==="weekly-note"){
      const week=String(e.target.dataset.week);
      state.weeklyNotes[week]=e.target.value;save();
    }
  });
  $("history").addEventListener("click",e=>{
    const b=e.target.closest("button[data-open-day]");
    if(b)selectDay(Number(b.dataset.openDay));
  });
  $("export-data").addEventListener("click",exportData);
  $("export-report").addEventListener("click",exportReport);
  $("import-trigger").addEventListener("click",()=>$("import-file").click());
  $("import-file").addEventListener("change",async e=>{await importData(e.target.files?.[0]);e.target.value="";});
  $("print-day").addEventListener("click",()=>{const guide=$("lesson-guide");if(guide)guide.open=true;window.print();});
  $("clear-current-day").addEventListener("click",()=>{
    const d=getDay(selectedDay);
    if(!d.completed&&countChecked(selectedDay)===0&&!String(d.note||"").trim()&&!Number.isInteger(d.energy)){
      toast("当前课程没有需要清空的记录。");return;
    }
    if(!confirm("确定清空 Day "+pad(selectedDay)+" 的任务勾选、笔记与完成状态吗？该操作不可撤销，建议先导出备份。"))return;
    delete state.days[String(selectedDay)];save();render();
    toast("Day "+pad(selectedDay)+" 的本地记录已清空，其他课程不受影响。");
  });
  $("reset-all-records").addEventListener("click",()=>{
    const phrase=prompt("这将清空本浏览器的全部100天打卡、笔记和每周复盘，且不可撤销。\n请先导出JSON备份。确实要重置，请输入：清空100天");
    if(phrase!=="清空100天"){if(phrase!==null)toast("确认文字不匹配，未清除记录。");return;}
    if(!confirm("最后确认：重置全部100天本地记录？"))return;
    const preservedTheme=state.theme;
    state=fresh();state.theme=preservedTheme;selectedDay=1;
    history.replaceState({day:1},"",location.pathname+"?day=1"+location.hash);
    save();render();toast("100天的本地练习记录已重置。");
  });
  window.addEventListener("scroll",()=>{
    const max=document.documentElement.scrollHeight-window.innerHeight;
    const fraction=max>0?window.scrollY/max:0;
    $("site-progress").style.width=Math.round(Math.min(1,Math.max(0,fraction))*100)+"%";
  },{passive:true});
  window.addEventListener("popstate",()=>{
    const d=Number(new URLSearchParams(location.search).get("day"));
    if(Number.isInteger(d)&&d>=1&&d<=100){selectedDay=d;state.lastOpened=d;save();render();}
  });
  renderDimensions();
  render();
})();
