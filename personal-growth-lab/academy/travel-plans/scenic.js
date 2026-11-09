(() => {
  'use strict';
  const records=window.SCENIC_INDEX||[];
  const $=s=>document.querySelector(s);
  const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  let page=1,filtered=[];
  const provinces=$('#registry-province'),cities=$('#registry-city'),levels=$('#registry-level'),query=$('#registry-query'),size=$('#registry-size');
  const params=new URLSearchParams(location.search);
  if(Array.from(provinces.options).some(o=>o.value===params.get('province')))provinces.value=params.get('province');
  function cityOptions(){
    const names=Array.from(new Set(records.filter(x=>provinces.value==='all'||x.regionId===provinces.value).map(x=>x.city).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'zh-CN'));
    cities.replaceChildren();const all=el('option','全部城市');all.value='all';cities.append(all);
    names.forEach(name=>{const option=el('option',name);option.value=name;cities.append(option);});
  }
  function filter(){
    const term=query.value.trim().toLowerCase();
    filtered=records.filter(x=>(provinces.value==='all'||x.regionId===provinces.value)&&(cities.value==='all'||x.city===cities.value)&&(levels.value==='all'||(levels.value==='local'?!x.level:x.level===levels.value))&&(!term||[x.name,x.regionName,x.city,x.district,x.address,x.kind].join(' ').toLowerCase().includes(term)));
    page=1;render();
  }
  function render(){
    const per=Number(size.value),pages=Math.max(1,Math.ceil(filtered.length/per));page=Math.min(page,pages);
    const tbody=$('#registry-rows');tbody.replaceChildren();
    const selected=filtered.slice((page-1)*per,page*per);
    selected.forEach(x=>{
      const tr=el('tr'),name=el('td'),title=el('strong',x.name);name.append(title);
      const loc=el('small',x.regionName);name.append(loc);
      if(x.sourceUrl){const source=el('a','名录原文 ↗');source.href=x.sourceUrl;source.target='_blank';source.rel='noopener noreferrer';name.append(source);}
      const address=el('td');address.append(el('span',x.city||'以原始名录为准'),el('small',x.district||x.address||''));
      const level=el('td',x.level||'当地目录');if(x.verification==='transcription'){level.append(el('small','转录待核'));}
      const version=el('td',x.sourceAsOf||'未标截止日，见来源');
      const link=el('a','打开详解 ↗');link.href=`regions/${x.regionId}.html#spot-${x.id}`;
      const action=el('td');action.append(link);tr.append(name,address,level,version,action);tbody.append(tr);
    });
    if(!selected.length){const tr=el('tr'),td=el('td','没有匹配条目。请换一个关键词，或重置筛选。');td.colSpan=5;tr.append(td);tbody.append(tr);}
    const first=filtered.length?(page-1)*per+1:0,last=Math.min(page*per,filtered.length);
    $('#registry-count').textContent=`显示 ${first.toLocaleString()}—${last.toLocaleString()} 条，共 ${filtered.length.toLocaleString()} 条匹配名录`;
    $('#registry-page').textContent=`第 ${page} / ${pages} 页`;
    $('#registry-prev').disabled=page===1;$('#registry-next').disabled=page>=pages;
  }
  provinces.addEventListener('change',()=>{cityOptions();filter();});
  cities.addEventListener('change',filter);levels.addEventListener('change',filter);query.addEventListener('input',filter);size.addEventListener('change',()=>{page=1;render();});
  $('#registry-reset').addEventListener('click',()=>{provinces.value='all';levels.value='all';query.value='';cityOptions();filter();query.focus();});
  $('#registry-prev').addEventListener('click',()=>{page--;render();$('#registry-count').scrollIntoView({block:'start'});});
  $('#registry-next').addEventListener('click',()=>{page++;render();$('#registry-count').scrollIntoView({block:'start'});});
  cityOptions();filter();
})();
