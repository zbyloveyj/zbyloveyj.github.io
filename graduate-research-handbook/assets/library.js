(function(){
"use strict";
var chapters=JSON.parse(document.getElementById("library-catalog").textContent),el=id=>document.getElementById(id);
var read=(key,fallback)=>{try{var x=JSON.parse(localStorage.getItem("gradbook:"+key));return x==null?fallback:x}catch{return fallback}};
var save=(key,value)=>{try{localStorage.setItem("gradbook:"+key,JSON.stringify(value));return true}catch{return false}};
var pad=n=>String(n).padStart(2,"0");
var make=(parent,tag,classname,text)=>{var x=document.createElement(tag);if(classname)x.className=classname;if(text!=null)x.textContent=text;parent.append(x);return x};
var notes=n=>{var data=read("notes-"+n,[]);return Array.isArray(data)?data.filter(x=>x&&typeof x.quote==="string"):[]};
function render(){
 var bookmarks=chapters.filter(c=>read("bookmark-"+c.n,false)===true);
 var completed=chapters.filter(c=>Number(read("progress-"+c.n,0))>=97);
 var annotations=chapters.flatMap(c=>notes(c.n).map(n=>({quote:n.quote,comment:n.comment||"",chapter:c})));
 el("metric-read").textContent=completed.length;el("metric-bookmarks").textContent=bookmarks.length;el("metric-notes").textContent=annotations.length;
 el("library-progress-fill").style.width=100*completed.length/chapters.length+"%";
 el("library-progress-info").textContent="已完成 "+completed.length+" / "+chapters.length+" 章 · 进度保存在本设备";
 var last=Number(read("last",1))||1,lastItem=chapters.find(c=>c.n===last)||chapters[0];
 var link=el("resume-link");link.href="./?chapter="+pad(lastItem.n);link.textContent="继续阅读第"+lastItem.n+"章 · "+lastItem.title+" →";
 var recent=chapters.filter(c=>Number(read("progress-"+c.n,0))>0).sort((a,b)=>b.n-a.n).slice(0,12);
 var list=el("library-recent");list.replaceChildren();
 if(!recent.length)make(list,"p","library-empty","你还没有留下阅读进度。打开任意章节，开始学习。");
 recent.forEach(c=>{var li=make(list,"li"),a=make(li,"a",null,"第"+c.n+"章 · "+c.title);a.href="./?chapter="+pad(c.n);make(li,"span","small",Math.round(Number(read("progress-"+c.n,0)))+"%")});
 var fav=el("library-bookmarks");fav.replaceChildren();
 if(!bookmarks.length)make(fav,"p","library-empty","目前没有收藏章节，可以在阅读页点击“收藏本章”。");
 bookmarks.forEach(c=>{var li=make(fav,"li"),a=make(li,"a",null,"第"+c.n+"章 · "+c.title);a.href="./?chapter="+pad(c.n);var btn=make(li,"button","library-action","取消收藏");btn.type="button";btn.addEventListener("click",()=>{save("bookmark-"+c.n,false);render()})});
 var noteArea=el("library-annotations");noteArea.replaceChildren();
 if(!annotations.length)make(noteArea,"p","library-empty","目前没有摘录。打开章节，选中正文文字即可添加笔记。");
 annotations.slice().reverse().slice(0,120).forEach(n=>{var card=make(noteArea,"article","library-note");make(card,"div","meta","第"+n.chapter.n+"章 · "+n.chapter.title);make(card,"blockquote",null,n.quote);if(n.comment)make(card,"p",null,n.comment);var a=make(card,"a",null,"查看这一章 →");a.href="./?chapter="+pad(n.chapter.n)});
}
function valid(name,value){
 if(name==="theme")return value==="light"||value==="dark";
 if(name==="scale")return typeof value==="number"&&Number.isFinite(value)&&value>=.7&&value<=1.5;
 if(name==="last")return Number.isInteger(value)&&value>=1&&value<=50;
 if(name==="plan-v1")return value&&typeof value==="object"&&!Array.isArray(value)&&Object.keys(value).length<=100&&Object.values(value).every(x=>typeof x==="boolean");
 var match=name.match(/^(notes|bookmark|progress|position)-(\d{1,2})$/);if(!match||Number(match[2])<1||Number(match[2])>50)return false;
 if(match[1]==="bookmark")return typeof value==="boolean";
 if(match[1]==="progress"||match[1]==="position")return typeof value==="number"&&Number.isFinite(value)&&value>=0&&value<=100;
 return Array.isArray(value)&&value.length<=1000&&value.every(x=>x&&typeof x==="object"&&typeof x.quote==="string"&&x.quote.length<=1000&&(x.comment==null||(typeof x.comment==="string"&&x.comment.length<=12000))&&(x.pId==null||typeof x.pId==="string"));
}
el("library-export").addEventListener("click",()=>{
 var data={};try{for(var i=0;i<localStorage.length;i++){var name=localStorage.key(i);if(name&&name.startsWith("gradbook:")){name=name.slice(9);var value=read(name,null);if(valid(name,value))data[name]=value}}}catch{}
 var backup={format:"gradbook-reader-backup",version:1,exported_at:new Date().toISOString(),data:data};
 var blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="gradbook-reading-backup.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 el("library-import-status").textContent="备份已生成。请自行保管，文件可能包含私人阅读笔记。";
});
el("library-import").addEventListener("change",async function(event){
 var file=event.target.files&&event.target.files[0],msg=el("library-import-status");if(!file)return;msg.textContent="";
 if(file.size>2*1024*1024){msg.textContent="文件超过2 MB，已拒绝导入。";this.value="";return}
 try{
  var doc=JSON.parse(await file.text());
  if(!doc||doc.format!=="gradbook-reader-backup"||doc.version!==1||!doc.data||typeof doc.data!=="object"||Array.isArray(doc.data))throw Error("不支持的备份格式");
  var entries=Object.entries(doc.data).filter(([name,value])=>valid(name,value));
  if(!entries.length)throw Error("未找到有效阅读记录");
  if(!confirm("将合并"+entries.length+"项记录，不主动删除现有笔记。确认导入？")){msg.textContent="已取消导入。";this.value="";return}
  var success=0;
  entries.forEach(([name,value])=>{
   var next=value;
   if(name.startsWith("notes-")){
    var old=read(name,[]),arr=Array.isArray(old)?old.slice():[],sig=x=>JSON.stringify([x.quote,x.comment||"",x.pId||"",x.at||x.time||""]),known=new Set(arr.map(sig));
    value.forEach(x=>{if(!known.has(sig(x))){arr.push(x);known.add(sig(x))}});
    next=arr.slice(0,1000);
   }else if(name.startsWith("progress-")||name.startsWith("position-"))next=Math.max(Number(read(name,0)),value);
   else if(name.startsWith("bookmark-"))next=Boolean(read(name,false)||value);
   else if(name==="plan-v1")next=Object.assign({},value,read(name,{}));
   else if(name==="last"&&Number(read("last",0))>=1)next=read(name,1);
   if(save(name,next))success++;
  });
  msg.textContent="已合并"+success+"项记录。其他已打开的阅读标签页需要刷新。";render();
 }catch(error){msg.textContent="导入失败："+(error.message||"文件无效")}finally{this.value=""}
});
el("library-theme").addEventListener("click",()=>{var h=document.documentElement;h.dataset.theme=h.dataset.theme==="dark"?"light":"dark";save("theme",h.dataset.theme)});
render();
})();