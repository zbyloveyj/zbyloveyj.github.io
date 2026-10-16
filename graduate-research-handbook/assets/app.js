
(function(){
"use strict";
var $=function(s){return document.querySelector(s);};
var $$=function(s){return Array.from(document.querySelectorAll(s));};
var store={get:function(k,f){try{var v=JSON.parse(localStorage.getItem("gradbook:"+k));return v==null?f:v;}catch(e){return f;}},set:function(k,v){try{localStorage.setItem("gradbook:"+k,JSON.stringify(v));}catch(e){}}};
var root=document.documentElement;
root.dataset.theme=store.get("theme","light");
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function fmt(n){return String(n).padStart(2,"0");}
function link(n){return "?chapter="+fmt(n);}
var catalog=JSON.parse($("#catalog-data").textContent);
var sections=catalog.sections,all=catalog.chapters;
function catalogView(target,sidebar){
 var html="",index=0;
 sections.forEach(function(t,i){
   var rows="";
   t.forEach(function(name){index++;var item=all[index-1],current=Number(new URLSearchParams(location.search).get("chapter"))===index;
     if(sidebar){rows+="<li>"+(item.ready?"<a class='"+(current?"selected":"")+"' href='"+link(index)+"'>"+fmt(index)+" · "+esc(name)+"</a>":"<span class='soon'>"+fmt(index)+" · "+esc(name)+"</span>")+"</li>";}
     else{rows+="<li class='"+(item.ready?"":"soon")+"'><span class='num'>"+fmt(index)+"</span>"+(item.ready?"<a href='"+link(index)+"'>"+esc(name)+"</a>":"<span style='flex:1'>"+esc(name)+"</span>")+"<span class='status'>"+(item.ready?"阅读":"待更新")+"</span></li>";}
   });
   if(sidebar)html+="<details "+(i===((Number(new URLSearchParams(location.search).get("chapter"))||1)-1>=0?all[(Number(new URLSearchParams(location.search).get("chapter"))||1)-1]?.part-1:0)?"open":"")+"><summary>第"+["一","二","三","四","五","六","七","八","九"][i]+"编　"+esc(catalog.volumes[i])+"</summary><ul>"+rows+"</ul></details>";
   else html+="<div class='volume'><div class='volume-label'><span>PART "+fmt(i+1)+" / 09</span><span>"+t.length+" 章</span></div><h3>第"+["一","二","三","四","五","六","七","八","九"][i]+"编 · "+esc(catalog.volumes[i])+"</h3><ul>"+rows+"</ul></div>";
 });
 $(target).innerHTML=html;
}
function markdown(md){
  var lines=md.replace(/\r/g,"").split("\n"),out=[],p=[],n=0,i=0,inCode=false,code=[],lang="";
  function inline(value){
    return esc(value)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,function(_,text,url){return "<a href=\""+url+"\" target=\"_blank\" rel=\"noopener noreferrer\">"+text+"</a>";})
      .replace(/\x60([^\x60]+)\x60/g,"<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g,"$1<em>$2</em>");
  }
  function flush(){if(p.length){out.push("<p id=\"para-"+(++n)+"\">"+inline(p.join(" "))+"</p>");p=[];}}
  function tableCells(s){return s.trim().replace(/^\|/,"").replace(/\|$/,"").split("|").map(function(x){return x.trim();});}
  while(i<lines.length){
    var line=lines[i],s=line.trim();
    if(inCode){
      if(s.startsWith("~~~")){out.push("<pre><code class=\"language-"+esc(lang)+"\">"+esc(code.join("\n"))+"</code></pre>");inCode=false;code=[];lang="";}
      else code.push(line);
      i++;continue;
    }
    if(s.startsWith("~~~")){flush();inCode=true;lang=s.slice(3).trim().replace(/[^a-z0-9_+#-]/gi,"");i++;continue;}
    if(!s){flush();i++;continue;}
    if(s.startsWith("# ")){flush();i++;continue;}
    if(s.startsWith("## ")){flush();out.push("<h2 id=\"sec-"+(++n)+"\">"+inline(s.slice(3))+"</h2>");i++;continue;}
    if(s.startsWith("### ")){flush();out.push("<h3 id=\"sec-"+(++n)+"\">"+inline(s.slice(4))+"</h3>");i++;continue;}
    if(s==="---"){flush();out.push("<hr>");i++;continue;}
    if(s.startsWith("> ")){flush();var quotes=[];while(i<lines.length&&lines[i].trim().startsWith("> ")){quotes.push(inline(lines[i].trim().slice(2)));i++;}out.push("<blockquote>"+quotes.join("<p></p>")+"</blockquote>");continue;}
    if(s.startsWith("|")&&i+1<lines.length&&/^\|?\s*:?-{3,}/.test(lines[i+1].trim())){
      flush();var headers=tableCells(lines[i]);i+=2;var rows=[];
      while(i<lines.length&&lines[i].trim().startsWith("|")){rows.push(tableCells(lines[i]));i++;}
      var table="<div class=\"table-scroller\"><table><thead><tr>"+headers.map(function(x){return "<th>"+inline(x)+"</th>";}).join("")+"</tr></thead><tbody>";
      rows.forEach(function(row){table+="<tr>"+headers.map(function(_,k){return "<td>"+inline(row[k]||"")+"</td>";}).join("")+"</tr>";});
      out.push(table+"</tbody></table></div>");continue;
    }
    if(/^([-*] |\d+\. )/.test(s)){
      flush();var ordered=/^\d+\./.test(s),tag=ordered?"ol":"ul",list=[];
      while(i<lines.length&&/^([-*] |\d+\. )/.test(lines[i].trim())){
        list.push("<li>"+inline(lines[i].trim().replace(/^([-*] |\d+\. )/,""))+"</li>");i++;
      }
      out.push("<"+tag+">"+list.join("")+"</"+tag+">");continue;
    }
    p.push(s);i++;
  }
  flush();if(inCode)out.push("<pre><code>"+esc(code.join("\n"))+"</code></pre>");
  return out.join("\n");
}
function setProgress(remember){
 var max=document.documentElement.scrollHeight-innerHeight;
 var p=max>0?Math.round(scrollY/max*100):100;
 $("#progress").style.width=p+"%";
 var n=new URLSearchParams(location.search).get("chapter");
 if(n){
   var old=Number(store.get("progress-"+Number(n),0))||0;
   if(p>old)store.set("progress-"+Number(n),p);
   if(remember!==false)store.set("position-"+Number(n),p);
 }
}
function openNotes(){var box=$("#notes");box.hidden=false;renderNotes();}
function notesList(){return store.get("notes-"+current,[]);}
var refreshHighlights=function(){};
function renderNotes(){
  var arr=notesList(),list=$("#notelist");list.replaceChildren();
  if(!arr.length){var p=document.createElement("p");p.textContent="在文章中选中文字，点击“保存摘录”，就可以在这里写笔记。笔记保存在本设备浏览器中。";list.appendChild(p);return;}
  arr.forEach(function(n,i){var item=document.createElement("div");item.className="noteitem";var q=document.createElement("blockquote");q.textContent=n.quote;var t=document.createElement("textarea");t.placeholder="为这段摘录写下自己的思考……";t.value=n.comment||"";t.addEventListener("input",function(){var a=notesList();if(a[i]){a[i].comment=t.value;store.set("notes-"+current,a);}});var d=document.createElement("button");d.textContent="删除摘录";d.addEventListener("click",function(){var a=notesList();a.splice(i,1);store.set("notes-"+current,a);renderNotes();refreshHighlights();});item.appendChild(q);item.appendChild(t);item.appendChild(d);list.appendChild(item);});
}
var current=Number(new URLSearchParams(location.search).get("chapter"))||0;
catalogView("#volume-list",false);catalogView("#side-content",true);
if(!current||current<1||current>all.length||!all[current-1].ready){
 $("#home").hidden=false;$("#reader").hidden=true;$("#mobile-menu").hidden=true;
 var finished=all.filter(function(x){return store.get("progress-"+x.n,0)>=97}).length;
 var tracker=$("#personal-reading");if(tracker)tracker.textContent=finished?"已完成 "+finished+" / "+all.length+" 章 · 阅读进度保存在本设备":"阅读记录保存在本设备 · 无需登录";
 var last=store.get("last",1);if(last>=1&&last<=all.length&&all[last-1].ready){$("#start-link").href=link(last);$("#start-link").textContent="继续阅读 · 第"+last+"章　→";}
 $("#chapter-search").addEventListener("input",function(){var q=this.value.trim().toLocaleLowerCase(),any=false;$$(".volume li").forEach(function(li){var ok=li.textContent.toLocaleLowerCase().includes(q);li.hidden=!ok;if(ok)any=true;});$$(".volume").forEach(function(v){v.hidden=!Array.from(v.querySelectorAll("li")).some(function(li){return !li.hidden;});});$("#search-empty").hidden=any;});
}else{
  $("#home").hidden=true;$("#reader").hidden=false;$("#mobile-menu").hidden=false;
 var dock=$("#reader-mobile-toolbar");if(dock)dock.hidden=false;
  store.set("last",current);$("#chapter-part").textContent="第"+["一","二","三","四","五","六","七","八","九"][all[current-1].part-1]+"编 · "+catalog.volumes[all[current-1].part-1];$("#ch-number").textContent=fmt(current);$("#ch-title").textContent="第"+current+"章　"+all[current-1].title;document.title=all[current-1].title+"｜从读研到做研究";
  var lastPosition=Number(store.get("position-"+current,0))||0;
  var scale=store.get("scale",1);document.documentElement.style.setProperty("--scale",scale);
  $("#font-up").addEventListener("click",function(){scale=Math.min(1.25,Math.round((scale+.08)*100)/100);root.style.setProperty("--scale",scale);store.set("scale",scale);});
  $("#font-down").addEventListener("click",function(){scale=Math.max(.88,Math.round((scale-.08)*100)/100);root.style.setProperty("--scale",scale);store.set("scale",scale);});
  $("#mobile-font-down").addEventListener("click",function(){$("#font-down").click()});
  $("#mobile-font-up").addEventListener("click",function(){$("#font-up").click()});
  $("#mobile-toc").addEventListener("click",function(){document.body.classList.toggle("mobile-menu")});
  $("#focus-mode").addEventListener("click",function(){document.body.classList.toggle("focus");});
  $("#mobile-menu").addEventListener("click",function(){document.body.classList.toggle("mobile-menu");});
  $("#open-notes").addEventListener("click",openNotes);
  $("#mobile-notes").addEventListener("click",openNotes);
  $("#close-notes").addEventListener("click",function(){$("#notes").hidden=true;});
  $("#notes-export").addEventListener("click",function(){var txt="# 第"+current+"章阅读笔记\n\n"+notesList().map(function(n){return "> "+n.quote+"\n\n"+(n.comment||"")+"\n";}).join("\n---\n\n");var blob=new Blob([txt],{type:"text/markdown;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="chapter-"+fmt(current)+"-notes.md";a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);});
  var refreshBookmark=function(){$("#bookmark").textContent=store.get("bookmark-"+current,false)?"★ 已收藏":"☆ 收藏本章";};refreshBookmark();
  $("#bookmark").addEventListener("click",function(){store.set("bookmark-"+current,!store.get("bookmark-"+current,false));refreshBookmark();});
  var prev=current>1?"<a href='"+link(current-1)+"'>← 上一章</a>":"<span>第一章</span>";
  var next=current<all.length?"<a href='"+link(current+1)+"'>下一章 →</a>":"<a href='./'>全书完 · 返回目录 →</a>";
  $("#reading-nav").innerHTML=prev+"<a href='./'>全书目录</a>"+next;
  $("#text-body").innerHTML="<p>正在载入本章正文……</p>";
  fetch("content/"+fmt(current)+".md").then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.text();}).then(function(md){
    $("#text-body").innerHTML=markdown(md);restoreMarks();
    $("#toc-heads").innerHTML=$("#text-body h2").map(function(h,i){return "<a href='#"+h.id+"'>"+(i+1)+". "+esc(h.textContent)+"</a>";}).join("");
    var span=$("#reading-estimate");if(span)span.textContent="　·　约"+Math.max(2,Math.ceil(md.replace(/\s/g,"").length/460))+"分钟阅读";
    var targetWord=new URLSearchParams(location.search).get("find");
    if(targetWord){var target=$("#text-body h2,#text-body h3,#text-body p").find(function(el){return el.textContent.toLocaleLowerCase().includes(targetWord.toLocaleLowerCase())});if(target){target.classList.add("search-target");requestAnimationFrame(function(){target.scrollIntoView({block:"center",behavior:"smooth"})})}}
    else if(location.hash){var anchor=document.getElementById(location.hash.slice(1));if(anchor)requestAnimationFrame(function(){anchor.scrollIntoView()})}
    var resume=$("#resume-position");
    if(resume&&lastPosition>8&&lastPosition<98&&!targetWord&&!location.hash){
      resume.hidden=false;
      resume.textContent="↳ 返回上次阅读位置（"+Math.round(lastPosition)+"%）";
      resume.addEventListener("click",function(){
        var max=document.documentElement.scrollHeight-innerHeight;
        window.scrollTo({top:Math.max(0,max*lastPosition/100),behavior:"smooth"});
        resume.hidden=true;
      },{once:true});
    }
    setProgress(false);
  }).catch(function(e){$("#text-body").textContent="章节载入失败，请刷新页面或从 GitHub 源码查看。"+e.message;});
  window.addEventListener("scroll",setProgress,{passive:true});
  function restoreMarks(){
    notesList().forEach(function(note){
      if(!note.pId||!note.quote)return;
      var p=document.getElementById(note.pId);
      if(!p||!p.textContent.includes(note.quote))p=$("#text-body p").find(function(el){return el.textContent.includes(note.quote)});
      if(!p)return;
      var walker=document.createTreeWalker(p,NodeFilter.SHOW_TEXT),node;
      while((node=walker.nextNode())){
        if(node.parentElement&&node.parentElement.closest("mark"))continue;
        var at=node.textContent.indexOf(note.quote);
        if(at<0)continue;
        var span=document.createElement("mark");
        var before=document.createTextNode(node.textContent.slice(0,at));
        span.textContent=note.quote;
        var after=document.createTextNode(node.textContent.slice(at+note.quote.length));
        node.replaceWith(before,span,after);
        break;
      }
    });
  }
  var selectedPId="";
  var selectionText="";
  document.addEventListener("mouseup",function(ev){
    if(ev.target.closest("button,.notes,textarea"))return;
    var s=window.getSelection();selectionText=s?s.toString().trim():"";
    var menu=$("#selection-button");
    if(!selectionText||selectionText.length>600||!$("#text-body").contains(s.anchorNode)){menu.style.display="none";return;}
    var para=s.anchorNode&&s.anchorNode.parentElement?s.anchorNode.parentElement.closest("p"):null;selectedPId=para?para.id:"";
    var rect=s.getRangeAt(0).getBoundingClientRect();
    menu.style.left=Math.max(8,Math.min(innerWidth-125,rect.left))+"px";menu.style.top=Math.max(13,rect.top-44)+"px";menu.style.display="block";
  });
  $("#selection-button").addEventListener("click",function(){if(!selectionText)return;var a=notesList();a.push({quote:selectionText,pId:selectedPId,comment:"",time:new Date().toISOString()});store.set("notes-"+current,a);restoreMarks();this.style.display="none";window.getSelection().removeAllRanges();openNotes();});
}
$("#theme-toggle").addEventListener("click",function(){root.dataset.theme=root.dataset.theme==="dark"?"light":"dark";store.set("theme",root.dataset.theme);});
document.addEventListener("keydown",function(ev){if(ev.key==="Escape"){$("#notes").hidden=true;$("#selection-button").style.display="none";}if(!current||["INPUT","TEXTAREA"].includes(document.activeElement.tagName))return;if(ev.key==="ArrowRight"&&current<all.length)location.href=link(current+1);if(ev.key==="ArrowLeft"&&current>1)location.href=link(current-1);});
})();
