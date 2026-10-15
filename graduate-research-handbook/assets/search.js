(function(){
"use strict";
var input=document.getElementById("search-query");
var box=document.getElementById("search-results");
var status=document.getElementById("search-status");
var docs=[];
function pad(n){return String(n).padStart(2,"0")}
function normalize(v){return String(v||"").toLocaleLowerCase()}
function parse(q){return normalize(q).trim().split(/\s+/).filter(Boolean).slice(0,6)}
function score(item,parts){
 var title=normalize(item.title),head=normalize((item.heads||[]).join(" ")),full=normalize(item.text);
 if(!parts.every(function(q){return title.includes(q)||head.includes(q)||full.includes(q)}))return -1;
 return parts.reduce(function(s,q){return s+(title.includes(q)?15:0)+(head.includes(q)?5:0)+(full.includes(q)?1:0)},0);
}
function summary(text,terms){
 var full=normalize(text),pos=-1;
 terms.forEach(function(q){var n=full.indexOf(q);if(n>=0&&(pos<0||n<pos))pos=n});
 if(pos<0)return text.slice(0,155)+(text.length>155?"…":"");
 var start=Math.max(0,pos-45),end=Math.min(text.length,pos+128);
 return (start?"…":"")+text.slice(start,end)+(end<text.length?"…":"");
}
function appendHighlighted(node,value,terms){
 var raw=String(value),low=normalize(raw),at=0;
 while(at<raw.length){
  var best=-1,term="";
  terms.forEach(function(q){var j=low.indexOf(q,at);if(j>=0&&(best<0||j<best)){best=j;term=q}});
  if(best<0){node.append(document.createTextNode(raw.slice(at)));break;}
  if(best>at)node.append(document.createTextNode(raw.slice(at,best)));
  var m=document.createElement("mark");m.textContent=raw.slice(best,best+term.length);node.append(m);
  at=best+term.length;
 }
}
function render(){
 var terms=parse(input.value);
 var url=new URL(location.href);
 if(terms.length)url.searchParams.set("q",input.value.trim());
 else url.searchParams.delete("q");
 history.replaceState(null,"",url.pathname+url.search);
 box.replaceChildren();
 if(!terms.length){status.textContent="搜索章节标题、小节及完整正文。可先选择下方的推荐主题。";return;}
 if(!docs.length){status.textContent="正在加载本地索引……";return;}
 var results=docs.map(function(x){return {value:x,rank:score(x,terms)}}).filter(function(x){return x.rank>=0})
  .sort(function(a,b){return b.rank-a.rank||a.value.n-b.value.n});
 status.textContent=results.length?"找到 "+results.length+" 个相关章节 · 结果依据正文与小节标题匹配":"没有找到匹配的章节，请尝试更短的词或相关同义词。";
 results.slice(0,50).forEach(function(item){
  var x=item.value;
  var card=document.createElement("article");card.className="search-result";
  var meta=document.createElement("div");meta.className="search-result-meta";meta.textContent="PART "+pad(x.part)+" · CHAPTER "+pad(x.n);
  var h=document.createElement("h2"),a=document.createElement("a");a.href="./?chapter="+pad(x.n)+"&find="+encodeURIComponent(terms[0]);
  appendHighlighted(a,x.title,terms);a.append(document.createTextNode(" →"));h.append(a);
  var sub=document.createElement("div");sub.className="search-result-heading";
  var chosen=(x.heads||[]).find(function(z){return terms.some(function(q){return normalize(z).includes(q)})})||(x.heads||[])[0]||"";
  appendHighlighted(sub,chosen,terms);
  var p=document.createElement("p");appendHighlighted(p,summary(x.text,terms),terms);
  card.append(meta,h,sub,p);box.append(card);
 });
}
document.querySelectorAll("[data-query]").forEach(function(el){el.addEventListener("click",function(){input.value=el.dataset.query;render();input.focus()})});
input.addEventListener("input",render);
document.getElementById("search-theme").addEventListener("click",function(){
 var html=document.documentElement;html.dataset.theme=html.dataset.theme==="dark"?"light":"dark";
 try{localStorage.setItem("gradbook:theme",JSON.stringify(html.dataset.theme))}catch(e){}
});
fetch("data/search-index.json").then(function(x){if(!x.ok)throw Error("index unavailable");return x.json()})
 .then(function(items){if(!Array.isArray(items)||items.length!==50)throw Error("incomplete index");docs=items;var q=new URLSearchParams(location.search).get("q");if(q)input.value=q;render()})
 .catch(function(){status.textContent="索引暂时不可用，请通过全书目录浏览章节。"});
})();