(function(){
"use strict";
const weeks=JSON.parse(document.getElementById("plan-data").textContent);
const grid=document.getElementById("week-grid"),count=document.getElementById("plan-count"),bar=document.getElementById("plan-bar");
let saved={};try{saved=JSON.parse(localStorage.getItem("gradbook:plan-v1"))||{}}catch(e){}
function persist(){try{localStorage.setItem("gradbook:plan-v1",JSON.stringify(saved))}catch(e){}}
function update(){
 const total=weeks.reduce((s,w)=>s+w.tasks.length,0),complete=Object.values(saved).filter(Boolean).length;
 count.textContent=complete+" / "+total+" 项训练已完成";bar.style.width=Math.min(100,Math.round(complete/total*100))+"%";
}
const roman=["一","二","三","四","五","六","七","八","九","十","十一","十二"];
weeks.forEach(function(w,i){
 const card=document.createElement("section");card.className="study-week";
 const meta=document.createElement("div");meta.className="study-week-top";meta.textContent="WEEK "+String(i+1).padStart(2,"0")+" / 12";
 const h=document.createElement("h2");h.textContent=w.title;
 const focus=document.createElement("p");focus.className="study-focus";focus.textContent=w.focus;
 const links=document.createElement("div");links.className="study-chapters";
 const label=document.createElement("span");label.textContent="阅读章节 · ";links.append(label);
 w.chap.forEach(function(n){const a=document.createElement("a");a.href="./?chapter="+String(n).padStart(2,"0");a.textContent="第"+n+"章";links.append(a)});
 const ul=document.createElement("ul");ul.className="study-checklist";
 w.tasks.forEach(function(t,j){
   const key=String(i+1)+"-"+String(j+1);
   const li=document.createElement("li"),label=document.createElement("label"),input=document.createElement("input");
   input.type="checkbox";input.checked=Boolean(saved[key]);input.setAttribute("aria-label","第"+(i+1)+"周："+t);
   const text=document.createElement("span");text.textContent=t;
   input.addEventListener("change",function(){saved[key]=this.checked;persist();update()});
   label.append(input,text);li.append(label);ul.append(li);
 });
 card.append(meta,h,focus,links,ul);grid.append(card);
});
update();
document.getElementById("plan-export").addEventListener("click",function(){
 const lines=["# 《从读研到做研究》12周科研训练记录","","导出日期："+new Date().toLocaleDateString(),""];weeks.forEach((w,i)=>{
  lines.push("## 第"+(i+1)+"周："+w.title,"");
  w.tasks.forEach((t,j)=>lines.push("- ["+(saved[String(i+1)+"-"+String(j+1)]?"x":" ")+"] "+t));
  lines.push("");
 });
 const url=URL.createObjectURL(new Blob([lines.join("\n")],{type:"text/markdown;charset=utf-8"}));
 const a=document.createElement("a");a.href=url;a.download="research-12-week-progress.md";a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
});
document.getElementById("plan-theme").addEventListener("click",function(){
 const h=document.documentElement;h.dataset.theme=h.dataset.theme==="dark"?"light":"dark";try{localStorage.setItem("gradbook:theme",JSON.stringify(h.dataset.theme))}catch(e){}
});
})();