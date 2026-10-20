'use strict';
(()=>{
const A=window.ACADEMY;if(!A||!window.DEPTH)throw Error('Load existing academy modules before lessonbooks.');
window.LESSONBOOK={version:'2026.10.20.3',coverage:{},
course(id){const c=A.courses.find(x=>x.id===id);if(!c)throw Error('Unknown course '+id);return c;},
section(title,body,kind='lesson',code=''){return {title,body,kind,code};},
attach(id,number,added,keep,sourceLinks=[]){const c=this.course(id),l=c.lessons[number-1];if(!l||l.id!==number)throw Error('Lesson not found '+id+':'+number);if(l.bookEdition)throw Error('Duplicate enrichment '+id+':'+number);const old=l.detail;
const selected=keep.map(i=>old[i]).filter(Boolean);if(added.length+selected.length>10)throw Error('Too many sections');
l.detail=[...added,...selected].map((s,i)=>({...s,title:String(i+1).padStart(2,'0')+' / '+s.title.replace(/^\d+\s*\/\s*/, '')}));
l.bookEdition=this.version;l.bookAddedCharacters=added.reduce((n,s)=>n+s.body.length+(s.code||'').length,0);l.links=[...(l.links||[]),...sourceLinks.filter(s=>!(l.links||[]).some(x=>x.url===s.url))];
(this.coverage[id]??=[]).push(number);
},
english(start,rows){const c=this.course('english');for(let k=0;k<rows.length;k++){const r=rows[k],scene=start+k;for(let phase=0;phase<3;phase++){const n=scene*3+phase+1;
const bilingual=r.pairs.map((p,j)=>'句'+(j+1)+'｜'+p[0]+'\n译意：'+p[1]).join('\n\n');
const problem=r.practice[phase];
this.attach('english',n,[this.section('双语精读：完整场景材料','以下为本课程原创示范，内容属于教学情境，真实介绍时应替换为自己的事实。\n\n'+bilingual,'example'),this.section('句法与表达精讲',r.grammar),this.section('现场对话与句式变换',r.dialogue+'\n\n'+problem[0],'exercise'),this.section('本课逐题讲解与参考答案',problem[1],'answer')],[1,2,4,5,6,9]);
}}},
finish(){A.version=this.version+'-lessonbook';A.lessonbookCoverage=Object.fromEntries(Object.entries(this.coverage).map(([id,ids])=>[id,{count:ids.length,ids}]));for(const c of A.courses){const n=this.coverage[c.id]?.length||0;c.note+=' 本轮教材增补覆盖'+n+'/'+c.lessons.length+'个单元；同一主题连续课会共用精读材料，练习与答案按阶段区分。';}}
};
})();