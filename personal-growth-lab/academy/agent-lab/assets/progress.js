'use strict';
((root)=>{
  function fresh(){return {schema:'agent-course-v1',records:{},last:1,lastAt:'',mode:'standard',startDate:'',pace:'daily',resourceSaved:[]};}
  function blank(d){return {checks:d.deliverable.checks.map(()=>false),done:false,lite:false,note:'',artifact:'',quiz:{},updatedAt:''};}
  function validDate(x){return typeof x==='string'&&Number.isFinite(Date.parse(x));}
  function normalize(raw,lessons,sources=[]){
    if(!raw||raw.schema!=='agent-course-v1'||!raw.records||typeof raw.records!=='object'||Array.isArray(raw.records))throw Error('请选择本课程导出的有效JSON备份。');
    const out=fresh();
    for(const d of lessons){
      const r=raw.records[d.day];if(!r||typeof r!=='object'||Array.isArray(r))continue;
      const x=blank(d);x.checks=d.deliverable.checks.map((_,i)=>Array.isArray(r.checks)&&r.checks[i]===true);
      x.done=r.done===true&&x.checks.every(Boolean);x.lite=r.lite===true;
      x.note=typeof r.note==='string'?r.note.slice(0,50000):'';x.artifact=typeof r.artifact==='string'?r.artifact.slice(0,2000):'';
      x.updatedAt=validDate(r.updatedAt)?r.updatedAt:'1970-01-01T00:00:00.000Z';
      for(const [i,q] of d.quiz.entries()){const v=r.quiz&&r.quiz[i];if(Number.isInteger(v)&&v>=0&&v<q.options.length)x.quiz[i]=v;}
      out.records[d.day]=x;
    }
    if(Number.isInteger(raw.last)&&raw.last>=1&&raw.last<=lessons.length)out.last=raw.last;
    out.lastAt=validDate(raw.lastAt)?raw.lastAt:'';
    out.mode=raw.mode==='lite'?'lite':'standard';
    if(typeof raw.startDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(raw.startDate)&&validDate(raw.startDate))out.startDate=raw.startDate;
    out.pace=raw.pace==='weekdays'?'weekdays':'daily';
    out.resourceSaved=Array.isArray(raw.resourceSaved)?[...new Set(raw.resourceSaved.filter(x=>sources.some(s=>s.id===x)))]:[];
    return out;
  }
  function merge(current,incoming){
    const out={...current,records:{...current.records}},changed=[];
    for(const [day,r] of Object.entries(incoming.records)){
      if(!out.records[day]||Date.parse(r.updatedAt)>Date.parse(out.records[day].updatedAt||0)){out.records[day]=r;changed.push(Number(day));}
    }
    if(Date.parse(incoming.lastAt||0)>Date.parse(current.lastAt||0)){out.last=incoming.last;out.lastAt=incoming.lastAt;}
    out.resourceSaved=[...new Set([...current.resourceSaved,...incoming.resourceSaved])];
    if(!out.startDate&&incoming.startDate){out.startDate=incoming.startDate;out.pace=incoming.pace;}
    return {state:out,changed};
  }
  root.AgentProgress={fresh,blank,normalize,merge};
})(typeof window!=='undefined'?window:globalThis);
