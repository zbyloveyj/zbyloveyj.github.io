(function(){
"use strict";
const body=document.getElementById("print-body");
const toc=document.getElementById("print-toc");
const button=document.getElementById("print-button");
const status=document.getElementById("print-status");
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
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

function render(text,catalog,preface){
 let book="<article class='print-chapter print-preface'><div class='chapter-label'>FOREWORD</div><h1>前言</h1>"+markdown(preface)+"</article>";
 let number=0,part=0;
 const reg=/^# 第(?:[一二三四五六七八九]编|[零一二三四五六七八九十\d]+章)[^\n]*$/gm;
 const matches=Array.from(text.matchAll(reg));
 for(let i=0;i<matches.length;i++){
  const m=matches[i];
  const content=text.slice(m.index,i+1<matches.length?matches[i+1].index:text.length);
  const title=m[0].slice(2).trim();
  if(title.includes("编")&&!title.includes("章")){
   part++;
   book+="<section class='print-part'><div class='part-number'>PART "+String(part).padStart(2,"0")+" / 09</div><h1>"+esc(title)+"</h1><p>从知识学习到独立研究</p></section>";
  }else{
   number++;
   book+="<article class='print-chapter' id='chapter-"+number+"'><div class='chapter-label'>CHAPTER "+String(number).padStart(2,"0")+"</div><h1>"+esc(title)+"</h1>"+markdown(content)+"</article>";
  }
 }
 if(number!==50||part!==9)throw Error("目录校验失败：识别到"+part+"编"+number+"章");
 body.innerHTML=book;
 let str="",section=0;
 catalog.chapters.forEach(c=>{
  if(c.part!==section){
   section=c.part;
   str+="<div class='toc-part'>第"+["一","二","三","四","五","六","七","八","九"][section-1]+"编　"+esc(catalog.volumes[section-1])+"</div>";
  }
  str+="<div class='toc-entry'><span>"+String(c.n).padStart(2,"0")+"</span><a href='#chapter-"+c.n+"'>"+esc(c.title)+"</a></div>";
 });
 toc.innerHTML=str;
 return number;
}
Promise.all([
 fetch("downloads/complete-manuscript.md").then(r=>{if(!r.ok)throw Error("合订稿下载失败");return r.text()}),
 fetch("data/catalog.json").then(r=>{if(!r.ok)throw Error("目录下载失败");return r.json()}),
 fetch("content/00-preface.md").then(r=>{if(!r.ok)throw Error("前言下载失败");return r.text()})
]).then(([md,catalog,preface])=>{
 let count=render(md,catalog,preface);
 status.textContent="已排版 "+count+" 章 · A5书籍版式 · 可以打印或另存为PDF";
 button.disabled=false;
}).catch(err=>{status.textContent="打印预览暂时不可用："+err.message+"。请从资源页面下载合订稿。"});
button.addEventListener("click",()=>{if(!button.disabled)window.print()});
document.getElementById("print-theme").addEventListener("click",()=>{
 const el=document.documentElement;el.dataset.theme=el.dataset.theme==="dark"?"light":"dark";
 try{localStorage.setItem("gradbook:theme",JSON.stringify(el.dataset.theme))}catch{}
});
})();
