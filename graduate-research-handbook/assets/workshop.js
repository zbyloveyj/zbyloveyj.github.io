(function(){
"use strict";
const $=id=>document.getElementById(id);
const saved=()=>{try{return JSON.parse(localStorage.getItem("gradbook:workshop-v1"))||{}}catch{return {}}};
const write=x=>{try{localStorage.setItem("gradbook:workshop-v1",JSON.stringify(x))}catch{}};
let state=saved(),data=[];
const n=(v)=>Number(v),round=x=>Number.isFinite(x)?x.toFixed(2):"—";
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
function solve(matrix,rhs){
 const a=matrix.map((row,i)=>row.concat(rhs[i])),m=a.length;
 for(let k=0;k<m;k++){
  let pivot=k;for(let i=k+1;i<m;i++)if(Math.abs(a[i][k])>Math.abs(a[pivot][k]))pivot=i;
  if(Math.abs(a[pivot][k])<1e-10)throw Error("设计矩阵不可逆");
  [a[k],a[pivot]]=[a[pivot],a[k]];
  let div=a[k][k];for(let j=k;j<=m;j++)a[k][j]/=div;
  for(let i=0;i<m;i++)if(i!==k){let f=a[i][k];for(let j=k;j<=m;j++)a[i][j]-=f*a[k][j]}
 }
 return a.map(row=>row[m]);
}
function ols(records){
 const X=records.map(row=>[1,row.group,row.age,row.batch==="B"?1:0]),y=records.map(row=>row.score),k=4;
 const gram=Array.from({length:k},()=>Array(k).fill(0)),rhs=Array(k).fill(0);
 for(let i=0;i<X.length;i++)for(let p=0;p<k;p++){
  rhs[p]+=X[i][p]*y[i];
  for(let q=0;q<k;q++)gram[p][q]+=X[i][p]*X[i][q];
 }
 return solve(gram,rhs);
}
function update(){
 const boxes=Array.from(document.querySelectorAll(".lab-check"));
 let completed=0;boxes.forEach(box=>{box.checked=Boolean(state[box.dataset.key]);if(box.checked)completed++});
 $("lab-progress").textContent=completed+" / "+boxes.length+" 项研究检查已完成";
 $("lab-progress-bar").style.width=Math.round(100*completed/boxes.length)+"%";
 ["question","bias","conclusion"].forEach(key=>{const el=$("answer-"+key);if(document.activeElement!==el)el.value=state["answer-"+key]||""});
}
document.querySelectorAll(".lab-check").forEach(box=>box.addEventListener("change",()=>{state[box.dataset.key]=box.checked;write(state);update()}));
["question","bias","conclusion"].forEach(key=>$("answer-"+key).addEventListener("input",function(){state["answer-"+key]=this.value;write(state)}));
$("lab-export").addEventListener("click",()=>{
 const lines=["# 从研究问题到结果解释：模拟数据研究备忘录","",
  "## 我的研究问题",state["answer-question"]||"(尚未填写)","",
  "## 可能的偏倚与数据限制",state["answer-bias"]||"(尚未填写)","",
  "## 结果与适用范围",state["answer-conclusion"]||"(尚未填写)","",
  "## 训练检查",...Array.from(document.querySelectorAll(".lab-check")).map(x=>"- ["+(state[x.dataset.key]?"x":" ")+"] "+x.dataset.label),"",
  "> 本文件基于完全合成的数据，仅用于教学练习。"];
 const url=URL.createObjectURL(new Blob([lines.join("\n")],{type:"text/markdown;charset=utf-8"}));
 const link=document.createElement("a");link.href=url;link.download="capstone-research-memo.md";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$("lab-theme").addEventListener("click",()=>{const r=document.documentElement;r.dataset.theme=r.dataset.theme==="dark"?"light":"dark";try{localStorage.setItem("gradbook:theme",JSON.stringify(r.dataset.theme))}catch{}});
function fill(records){
 const groups=[[0,records.filter(x=>x.group===0)],[1,records.filter(x=>x.group===1)]];
 const mean0=mean(groups[0][1].map(x=>x.score)),mean1=mean(groups[1][1].map(x=>x.score));
 const raw=mean1-mean0,beta=ols(records),adj=beta[1];
 $("lab-total").textContent=records.length;
 $("lab-mean0").textContent=round(mean0);
 $("lab-mean1").textContent=round(mean1);
 $("lab-n0").textContent=groups[0][1].length;
 $("lab-n1").textContent=groups[1][1].length;
 $("lab-raw").textContent=round(raw);
 $("lab-adjusted").textContent=round(adj);
 $("lab-age").textContent=round(beta[2]);
 $("lab-batch").textContent=round(beta[3]);
 const max=Math.max(5,raw,adj);
 for(const [name,val] of [["raw",raw],["adjusted",adj]]){
  const bar=$("bar-"+name);bar.style.width=Math.max(0,Math.min(100,100*val/max))+"%";bar.setAttribute("aria-label",name+"差异为"+round(val));
 }
 const tbody=$("lab-data-preview");tbody.replaceChildren();
 records.slice(0,8).forEach(row=>{
  const tr=document.createElement("tr");
  [row.id,String(row.group),String(row.age),row.batch,round(row.score)].forEach(v=>{const td=document.createElement("td");td.textContent=v;tr.append(td)});
  tbody.append(tr);
 });
 $("lab-error").hidden=true;
 $("lab-results").hidden=false;
}
fetch("downloads/synthetic-demo.csv").then(r=>{if(!r.ok)throw Error("示例CSV下载失败");return r.text()}).then(text=>{
 const lines=text.trim().split(/\r?\n/);const names=lines[0].split(",");
 const items=lines.slice(1).filter(Boolean).map(line=>{
  const cells=line.split(","),row=Object.fromEntries(names.map((name,i)=>[name,cells[i]]));
  return {id:row.id,group:n(row.group),age:n(row.age),batch:row.batch,score:n(row.score)};
 });
 if(items.length!==64||items.some(x=>!Number.isFinite(x.score)||!Number.isFinite(x.age)))throw Error("示例数据结构错误");
 data=items;fill(data);update();
}).catch(err=>{$("lab-error").hidden=false;$("lab-error").textContent="示例计算未载入："+err.message+"。仍可下载数据并使用R或Python完成练习。";update()});
})();