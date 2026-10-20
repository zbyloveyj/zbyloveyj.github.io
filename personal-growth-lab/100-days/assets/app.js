(function GrowthApp(){
  "use strict";
  const DATA=window.RESET100;
  const $=id=>document.getElementById(id);
  if(!DATA || !Array.isArray(DATA.days) || DATA.days.length!==100){
    const el=$("day-content");if(el)el.textContent="课程数据未加载，请刷新页面。";
    return;
  }
  const STORE="yixw_growth_100_v1";
  const TASK_IDS=["sleep","food","movement","reading","focus","mindfulness","mission"];
  const names={sleep:"睡眠与作息",food:"均衡饮食",movement:"身体运动",reading:"持续阅读",focus:"专注行动",mindfulness:"正念与情绪",mission:"当天主题"};
  const modes={
    lite:{name:"轻量",walk:8,read:5,focus:10,mind:2,mission:"完成主题练习的第一步即可"},
    regular:{name:"标准",walk:20,read:15,focus:25,mind:5,mission:"尝试完成主题练习的前两步"},
    deep:{name:"深入",walk:30,read:25,focus:45,mind:10,mission:"完成三个步骤，再用自己的话复盘"}
  };
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const pad=n=>String(n).padStart(2,"0");
  const todayString=()=>{
    const dt=new Date();
    return [dt.getFullYear(),pad(dt.getMonth()+1),pad(dt.getDate())].join("-");
  };
  const validDate=s=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(new Date(s+"T12:00:00").getTime());
  const fresh=()=>({version:1,startDate:todayString(),mode:"regular",theme:"light",days:{},weeklyNotes:{}});
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
    try{localStorage.setItem(STORE,JSON.stringify(state));}
    catch(e){if(!savedWarning){savedWarning=true;toast("浏览器禁止本地存储，请不要依赖当前打卡记录。");}}
  }
  function getDay(n){
    const d=state.days[String(n)];
    return d&&typeof d==="object"&&!Array.isArray(d)?d:{};
  }
  function updateDay(n,update){
    const old=getDay(n);
    state.days[String(n)]={...old,...update,updatedAt:new Date().toISOString()};
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
  let selectedDay=Number.isInteger(queryDay)&&queryDay>=1&&queryDay<=100?queryDay:plannedToday();
  const countChecked=day=>TASK_IDS.reduce((n,k)=>n+(getDay(day).tasks?.[k]===true?1:0),0);
  const isDone=day=>getDay(day).completed===true;
  const doneTotal=()=>DATA.days.reduce((n,d)=>n+(isDone(d.n)?1:0),0);
  const countActivities=()=>DATA.days.reduce((sum,d)=>sum+countChecked(d.n),0);
  const phaseIndex=day=>Math.min(4,Math.floor((day-1)/20));
  function activityPlan(n){
    const day=DATA.days[n-1],phase=phaseIndex(n),mode=modes[state.mode];
    const mv=mode.walk+(state.mode==="lite"?0:phase*(state.mode==="deep"?3:2));
    const rd=mode.read+(state.mode==="lite"?0:phase*(state.mode==="deep"?2:2));
    const fc=mode.focus+(state.mode==="lite"?0:phase*5);
    const md=mode.mind+(state.mode==="lite"?0:Math.floor(phase/2)*2);
    const food=[
      "任选一餐，留意蔬菜水果、蛋白质和主食的合理搭配；以个人需要和条件为准。",
      "按饥饿与饱腹感规律进食，避免忙到忘记吃饭或用极端方式补偿。",
      "给今天的餐食增加一种不同的蔬菜、果实或其他适合的食物。",
      "提前想好一顿方便的饭，让忙碌时也有现实可行的选择。",
      "安静吃完一顿饭，观察味道和饱腹感，不评价食物好坏。",
      "留意今天食物的多样性与满足感，不必记录卡路里。",
      "允许饮食弹性，尝试维持舒适的节奏，不因一次外食自责。"
    ];
    const moving=[
      ["轻快步行","选择安全路线，适度加快步频；能说话、不过度喘即可。"],
      ["基础力量","按能力练椅子起立、推墙与提踵，保持呼吸自然，不追求极限。"],
      ["轻有氧","快走、骑车或其他喜欢的轻中等强度活动；以舒适为先。"],
      ["灵活恢复","选择轻松散步或舒展肩背、下肢，身体不适时适当休息。"],
      ["力量与稳定","以可控动作完成一轮基础力量练习；出现疼痛应立即停止。"],
      ["自由选择运动","快走、球类、骑行或舞蹈任选一种适合自己的活动。"],
      ["恢复与观察","散步或做温和伸展，回顾本周是否有足够的恢复时间。"]
    ];
    const reading=[
      "读完后合上书，用一句话复述最重要的观点。",
      "读书时记下一个值得继续追问的问题。",
      "把读到的一段内容与你的生活或研究连接。",
      "尝试区分作者的事实陈述与解释。",
      "用自己的语言写一个三行摘要。",
      "记录一个与之前认识不同的观点。",
      "翻看本周笔记，挑出最值得保留的一句。"
    ];
    const mindful=[
      "自然呼吸，注意呼吸节奏；走神时温和地重新开始。",
      "观察身体的紧绷与放松，无需强迫自己改变。",
      "闭眼或睁眼，留心周围三个声音与三个视觉细节。",
      "缓慢走动，注意脚掌触地，不必清空思绪。",
      "写下此刻最真实的一种感受，允许它存在。",
      "暂停手机，让注意力回到当下的呼吸与环境。",
      "回顾最近一次情绪起伏，分开事实与解释。"
    ];
    const k=(n-1)%7;
    return [
      {id:"sleep",name:"作息与睡眠",time:"每日",desc:"为今晚保留足够的睡眠窗口；多数成年人通常需要7—9小时，不靠强迫早起来换进度。"},
      {id:"food",name:"饮食与营养",time:"一餐",desc:food[k]},
      {id:"movement",name:"身体运动 · "+moving[k][0],time:mv+" 分钟",desc:moving[k][1]+" 目标约 "+mv+" 分钟，按体力调整。"},
      {id:"reading",name:"阅读与理解",time:rd+" 分钟",desc:"选一本自己愿意读的书或高质量长文，专注阅读 "+rd+" 分钟。"+reading[k]},
      {id:"focus",name:"高价值专注",time:fc+" 分钟",desc:"先写清今天最重要的任务及完成标准，关闭不必要通知，进行一段 "+fc+" 分钟单任务学习或工作。"},
      {id:"mindfulness",name:"冥想与觉察",time:md+" 分钟",desc:"进行 "+md+" 分钟温和的觉察练习。"+mindful[k]},
      {id:"mission",name:"主题练习 · "+day.title,time:"5—15分钟",desc:mode.mission+"。可在右侧查看当天的完整步骤。"}
    ];
  }
  function setTheme(){
    document.documentElement.dataset.theme=state.theme;
    const b=$("theme-toggle");if(b){b.setAttribute("aria-label",state.theme==="dark"?"切换浅色模式":"切换深色模式");b.title=state.theme==="dark"?"切换浅色模式":"切换深色模式";}
  }
  function renderDay(){
    const day=DATA.days[selectedDay-1],phase=DATA.phases[day.phase],d=getDay(selectedDay),tasks=activityPlan(selectedDay);
    $("start-date").value=state.startDate;
    $("prev-day").disabled=selectedDay===1;
    $("next-day").disabled=selectedDay===100;
    for(const button of $("mode-picker").querySelectorAll("button[data-mode]")){
      button.setAttribute("aria-pressed",String(button.dataset.mode===state.mode));
    }
    $("day-heading").innerHTML=`
      <div class="day-heading-text">
        <span class="day-status ${d.completed===true?"done":""}">${esc(phase.name)} · ${esc(phase.en)} ${d.completed===true?" · 已完成":""}</span>
        <h3>${esc(day.title)}</h3>
        <p>${esc(currentDayLabel(selectedDay))} · 第 ${selectedDay} 天</p>
      </div>
      <strong class="day-no">DAY ${String(selectedDay).padStart(3,"0")}</strong>`;
    const taskHtml=tasks.map(t=>`
      <button type="button" class="task" data-task="${t.id}" aria-pressed="${d.tasks?.[t.id]===true}" aria-label="${esc(t.name)}，${d.tasks?.[t.id]===true?"已勾选":"未勾选"}">
        <span class="task-check" aria-hidden="true">✓</span>
        <span class="task-content"><span class="task-top"><span class="task-name">${esc(t.name)}</span><span class="task-length">${esc(t.time)}</span></span><span class="task-detail">${esc(t.desc)}</span></span>
      </button>`).join("");
    const steps=day.steps.map((s,i)=>`<div class="mission-step"><span class="mission-step-num">${pad(i+1)}</span><p>${esc(s)}</p></div>`).join("");
    const checked=countChecked(selectedDay),completed=d.completed===true;
    $("day-content").innerHTML=`
      <div class="day-body">
        <div class="daily-left">
          <p class="card-microheading">YOUR SEVEN DAILY ANCHORS</p>
          <h4 class="block-title">今天的七件小事</h4>
          <p class="block-desc">睡眠、饮食、运动、阅读、专注、觉察、主题练习。不需要全做完，允许从轻量版开始。</p>
          <div class="task-list">${taskHtml}</div>
          <div class="completion-bar" role="progressbar" aria-label="当日锚点完成进度" aria-valuemin="0" aria-valuemax="7" aria-valuenow="${checked}"><div class="completion-fill" style="width:${checked/7*100}%"></div></div>
          <div class="completion-meta"><span>已勾选 ${checked} / 7 项</span><span>${completed?"已记录为完成":"不追求完美的一天"}</span></div>
          <button type="button" class="done-button ${completed?"is-done":""}" id="finish-day">${completed?"✓ 已确认完成 · 点击可撤销":"✓ 确认完成今天"}</button>
        </div>
        <div class="daily-right">
          <div class="mission-card">
            <div class="mission-heading"><span class="card-microheading">TODAY'S SPECIAL PRACTICE</span><span class="mission-tag">${esc(phase.name)}</span></div>
            <h4>${esc(day.title)}</h4>${steps}
            <p class="journal-tip">本模式建议：${esc(modes[state.mode].mission)}。</p>
          </div>
          <div class="journal-card">
            <span class="card-microheading">A QUESTION FOR YOURSELF</span>
            <h4>今晚，问自己一个问题。</h4>
            <p class="journal-question">${esc(day.question)}</p>
            <label class="sr-only" for="day-note">今日反思笔记</label>
            <textarea id="day-note" maxlength="5000" placeholder="写下真实的观察、问题或感受。不需要写得很漂亮。">${esc(d.note||"")}</textarea>
            <p class="journal-tip">笔记自动保存在这个浏览器，请定期导出。</p>
            <div class="energy-row"><label>今天的精力状态（可选）</label><div class="energy-options" role="group" aria-label="精力状态，1表示较低，5表示充沛">${[1,2,3,4,5].map(i=>`<button type="button" data-energy="${i}" aria-label="精力 ${i} 分" aria-pressed="${d.energy===i}">${i}</button>`).join("")}</div></div>
          </div>
        </div>
      </div>`;
  }
  function renderStats(){
    const completed=doneTotal(),activities=countActivities(),ph=phaseIndex(plannedToday());
    const phaseDone=DATA.days.slice(ph*20,ph*20+20).filter(x=>isDone(x.n)).length;
    $("stats").innerHTML=[
      [pad(completed),"亲自确认完成的天数"],
      [pad(plannedToday()),"距离起点的计划日"],
      [String(activities),"已经完成的小行动"],
      [pad(phaseDone)+"/20","本阶段已完成天数"]
    ].map(([v,label])=>`<div class="stat"><b>${esc(v)}</b><span>${esc(label)}</span></div>`).join("");
    $("hero-progress").innerHTML=`<strong>${completed} / 100</strong><small>完成的日子 · ${Math.round(completed)}% 的旅程</small>`;
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
      const low=w*7+1,high=Math.min(100,(w+1)*7);
      const total=high-low+1;
      let count=0;for(let d=low;d<=high;d++)if(isDone(d))count++;
      weekHtml+=`<div class="week" title="第${w+1}周，${count}/${total}天" role="img" aria-label="第${w+1}周，完成${count}天，共${total}天"><div class="week-track"><div class="week-fill" style="height:${Math.round(count/total*100)}%"></div></div><small>${w+1}</small></div>`;
    }
    $("weekly-chart").innerHTML=weekHtml;
    $("habit-chart").innerHTML=TASK_IDS.map(k=>{
      const n=DATA.days.reduce((sum,day)=>sum+(getDay(day.n).tasks?.[k]===true?1:0),0);
      return `<div class="habit-row"><span>${esc(names[k])}</span><div class="habit-track" role="progressbar" aria-label="${esc(names[k])}完成次数" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${n}"><div class="habit-fill" style="width:${n}%"></div></div><b>${n}</b></div>`;
    }).join("");
    const week=Math.ceil(selectedDay/7);
    $("review-panel").innerHTML=`<div><span class="card-microheading">WEEKLY REVIEW / ${pad(week)}</span><h3>这一周，哪些方法有用？</h3><p>你正在查看第 ${week} 个课程周（Day ${pad((week-1)*7+1)}—${pad(Math.min(100,week*7))}）。记下值得保留、需要调整和愿意放下的一件事。</p></div><div><label class="sr-only" for="weekly-note">第${week}周复盘笔记</label><textarea id="weekly-note" maxlength="5000" data-week="${week}" placeholder="继续什么？调整什么？停止什么？">${esc(state.weeklyNotes[String(week)]||"")}</textarea><p class="journal-tip">自动保存于当前浏览器，不公开上传。</p></div>`;
  }
  function render(){setTheme();renderDay();renderStats();renderPhases();renderMap();renderCharts();}
  function selectDay(n,scroll=true){
    const x=Number(n);
    if(!Number.isInteger(x)||x<1||x>100)return;
    selectedDay=x;
    history.replaceState(null,"",location.pathname+"?day="+x+location.hash);
    renderDay();renderMap();renderCharts();
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
    const lines=[
      "# 日有寸进｜我的100天成长记录","",
      "导出时间："+new Date().toLocaleString("zh-CN"),"起点日期："+state.startDate,
      "已确认完成："+doneTotal()+" / 100 天","已勾选行动："+countActivities()+" 项","",
      "## 七项锚点",
      ...TASK_IDS.map(k=>"- "+names[k]+"："+DATA.days.filter(x=>getDay(x.n).tasks?.[k]===true).length+" 次"),
      "","## 阶段记录",
      ...DATA.phases.flatMap((p,i)=>["### "+p.name,DATA.days.slice(i*20,i*20+20).filter(x=>isDone(x.n)).length+" / 20 天",""]),
      "## 每日笔记"
    ];
    DATA.days.forEach(day=>{
      const d=getDay(day.n);
      if((d.note||"").trim()||d.completed===true){
        lines.push("### Day "+pad(day.n)+" · "+day.title+(d.completed?"（已完成）":""));
        if(Number.isInteger(d.energy))lines.push("当日精力："+d.energy+" / 5");
        if(d.note)lines.push(d.note.trim());
        lines.push("");
      }
    });
    lines.push("## 每周复盘");
    Object.entries(state.weeklyNotes).sort((a,b)=>Number(a[0])-Number(b[0])).forEach(([k,v])=>{if(v&&v.trim())lines.push("### 第 "+k+" 周",v.trim(),"")});
    lines.push("","---","记录属于本人；导出自个人浏览器中的本地数据。");
    download("日有寸进-个人成长报告-"+todayString()+".md",lines.join("\n"),"text/markdown;charset=utf-8");
    toast("个人成长报告已导出。");
  }
  function validateImport(obj){
    if(!obj||typeof obj!=="object"||Array.isArray(obj)||obj.version!==1||!validDate(obj.startDate))throw Error("备份文件格式不正确");
    const clean=fresh();
    clean.startDate=obj.startDate;
    clean.mode=modes[obj.mode]?obj.mode:"regular";
    clean.theme=["light","dark"].includes(obj.theme)?obj.theme:"light";
    if(obj.days&&typeof obj.days==="object"&&!Array.isArray(obj.days)){
      for(const [k,v] of Object.entries(obj.days)){
        const n=Number(k);
        if(!Number.isInteger(n)||n<1||n>100||!v||typeof v!=="object"||Array.isArray(v))continue;
        const tasks={};
        for(const id of TASK_IDS){if(v.tasks&&v.tasks[id]===true)tasks[id]=true;}
        clean.days[String(n)]={tasks,completed:v.completed===true,note:typeof v.note==="string"?v.note.slice(0,5000):"",energy:Number.isInteger(v.energy)&&v.energy>=1&&v.energy<=5?v.energy:null};
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
      state=next;selectedDay=plannedToday();save();render();
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
  $("prev-day").addEventListener("click",()=>selectDay(selectedDay-1));
  $("next-day").addEventListener("click",()=>selectDay(selectedDay+1));
  $("go-today").addEventListener("click",()=>selectDay(plannedToday()));
  $("mode-picker").addEventListener("click",e=>{
    const b=e.target.closest("button[data-mode]");
    if(!b||!modes[b.dataset.mode])return;
    state.mode=b.dataset.mode;save();renderDay();
    toast("已切换到"+modes[state.mode].name+"模式。");
  });
  $("day-content").addEventListener("click",e=>{
    const task=e.target.closest("button[data-task]");
    if(task){
      const key=task.dataset.task,d=getDay(selectedDay),tasks={...(d.tasks||{})};
      tasks[key]=!tasks[key];updateDay(selectedDay,{tasks});
      renderDay();renderStats();renderMap();renderCharts();
      return;
    }
    const energy=e.target.closest("button[data-energy]");
    if(energy){
      const value=Number(energy.dataset.energy),d=getDay(selectedDay);
      updateDay(selectedDay,{energy:d.energy===value?null:value});
      renderDay();renderMap();return;
    }
    if(e.target.closest("#finish-day")){
      const d=getDay(selectedDay);
      if(d.completed!==true&&countChecked(selectedDay)===0){toast("先完成并勾选至少一项，再确认当天完成。");return;}
      updateDay(selectedDay,{completed:d.completed!==true});
      render();toast(d.completed===true?"已撤销当日完成确认。":"今天的努力已记录。");
    }
  });
  $("day-content").addEventListener("input",e=>{
    if(e.target.id==="day-note"){updateDay(selectedDay,{note:e.target.value});}
  });
  $("journey").addEventListener("click",e=>{
    const b=e.target.closest("button[data-open-day]");
    if(b)selectDay(Number(b.dataset.openDay));
  });
  $("history").addEventListener("input",e=>{
    if(e.target.id==="weekly-note"){
      const week=String(e.target.dataset.week);
      state.weeklyNotes[week]=e.target.value;
      save();
    }
  });
  $("export-data").addEventListener("click",exportData);
  $("export-report").addEventListener("click",exportReport);
  $("import-trigger").addEventListener("click",()=>$("import-file").click());
  $("import-file").addEventListener("change",async e=>{await importData(e.target.files?.[0]);e.target.value="";});
  $("print-day").addEventListener("click",()=>window.print());
  window.addEventListener("scroll",()=>{
    const max=document.documentElement.scrollHeight-window.innerHeight;
    const fraction=max>0?window.scrollY/max:0;
    $("site-progress").style.width=Math.round(Math.min(1,Math.max(0,fraction))*100)+"%";
  },{passive:true});
  window.addEventListener("popstate",()=>{
    const d=Number(new URLSearchParams(location.search).get("day"));
    if(Number.isInteger(d)&&d>=1&&d<=100){selectedDay=d;renderDay();renderMap();renderCharts();}
  });
  renderDimensions();
  render();
})();
