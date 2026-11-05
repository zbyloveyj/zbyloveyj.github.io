(function (root) {
  'use strict';
  const cfg = root.UKE_CLOUD_CONFIG || {mode:'public'}, cloud = cfg.mode === 'cloud';
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mb = n => (Number(n || 0) / 1048576).toFixed(1) + ' MB';
  const entry = () => cloud ? '/signin-with-chatgpt?return_to=%2Fclassroom%2F%23%2Faccount' : cfg.origin + '/classroom/#/account';
  let user = null, storage = {}, revision = 0, busy = false, applying = false, initialized = false, timer, queued = false, lastSync = '', error = '', status = cloud ? '正在确认登录状态…' : '本机练习模式';
  const dirty = new Set(), log = [];
  function tell(text) { status = text; log.unshift(new Date().toLocaleTimeString('zh-CN') + '　' + text); if (log.length > 8) log.length = 8; paint(); }
  async function api(path, options = {}) {
    const response = await fetch('/api/' + path, {...options, credentials:'same-origin',cache:'no-store'});
    const isJSON = /application\/json/.test(response.headers.get('content-type') || '');
    if (response.status === 401 || !isJSON && response.status !== 204) { const err = new Error('登录状态已失效，请重新登录；本机练习和录音仍然保留。'); err.auth = true; throw err; }
    const data = response.status === 204 ? null : await response.json();
    if (!response.ok) { const err = new Error(data?.error || '同步没有完成，请保留本机文件并重试。'); err.code = data?.code; throw err; }
    return data;
  }
  function loginLink(label = '登录个人训练室') { return '<a class="btn cloud-login" href="'+esc(entry())+'">'+label+' →</a>'; }
  function bannerInner() {
    if (!cloud) return '<div><strong>课程、课内伴奏谱和本机录音直接可用</strong><p>登录个人训练室后，可把练习进度与录音同步到自己的账号。</p></div>'+loginLink();
    return '<div><strong>'+(user ? esc(user.displayName)+'的个人训练室' : '个人训练室')+'</strong><p data-cloud-status>'+esc(error || status)+'</p></div>'+(user ? '<a class="btn-small" href="#/account">查看同步状态 →</a>' : loginLink('使用 ChatGPT 登录'));
  }
  function banner() { return '<section class="cloud-banner" data-cloud-banner>'+bannerInner()+'</section>'; }
  function accountBody() {
    if (!cloud) return '<section class="account-card card"><span class="eyebrow">YOUR PRIVATE PRACTICE ROOM</span><h1>登录，让练习跟着你走</h1><p>这里的课程、三首课内伴奏谱、录音和专项测评都可以直接使用。个人训练室使用真实 ChatGPT 登录，保存你的进度、录音与分析报告。</p><div class="actions">'+loginLink()+'<a class="btn-secondary" href="#/recordings">先在本机录音</a></div></section><section class="card"><h2>把本机已有练习带过去</h2><ol class="account-steps"><li>打开“录音与自动测评”，点击“下载完整备份（含音频）”。</li><li>进入上方个人训练室并登录，在录音库点击“恢复完整备份”。</li><li>打开“登录与同步”，点击“立即同步”，等待显示成功。</li></ol><p class="note-line">成长学院与个人训练室是两个站点，浏览器不会自动共享本机数据。完整备份同时携带日课、测评、版本笔记和录音。已登录后，新录音和修改会自动同步。</p></section>';
    return '<section class="account-card card"><span class="eyebrow">SIGNED IN · KEEP PRACTICING</span><h1>'+(user ? esc(user.displayName)+'的练习账号' : '登录个人训练室')+'</h1><p>'+esc(error || status)+'</p><div class="actions">'+(user ? '<button class="btn" data-cloud="sync"'+(busy?' disabled':'')+'>'+(busy?'正在同步…':'立即同步')+'</button><a class="btn-secondary" href="/signout-with-chatgpt?return_to=%2F">退出登录</a>' : loginLink('使用 ChatGPT 登录'))+'<a class="btn-small" href="#/recordings">录音库与完整备份 →</a></div></section><section class="card"><h2>已保存到哪里</h2><div class="account-stats"><div><strong>'+esc(mb(storage.usedBytes))+'</strong><span>云端录音已用</span></div><div><strong>'+esc(mb(storage.quotaBytes || 262144000))+'</strong><span>当前录音空间</span></div><div><strong>'+esc(lastSync ? new Date(lastSync).toLocaleString('zh-CN') : '尚未成功同步')+'</strong><span>本机最近完整同步</span></div></div><p>日课进度、实操听评、曲目笔记、录音文件与分析报告会归到当前账号。每次录音先保存本机；同步失败时保留本机副本，恢复网络后可重试。</p><p class="note-line">每条录音不超过10分钟、20 MB。完整备份建议定期下载。跨设备合并以每一天、每次测评的较新记录为准；同一课不要同时在两台设备修改。</p></section><section class="card"><h2>已有备份与同步记录</h2><p>从成长学院迁移时，先到录音库恢复“完整备份”，再点立即同步。退出账号不会清空这台设备的本机副本；共用设备请另存备份后，在浏览器中清理该站点数据。</p><ul class="cloud-log">'+(log.length ? log.map(x=>'<li>'+esc(x)+'</li>').join('') : '<li>等待连接账号。</li>')+'</ul></section>';
  }
  function accountView() { return '<div data-cloud-account>'+accountBody()+'</div>'; }
  function paint() { document.querySelectorAll('[data-cloud-banner]').forEach(el=>el.innerHTML=bannerInner()); const el=document.querySelector('[data-cloud-account]');if(el)el.innerHTML=accountBody();document.querySelectorAll('.cloud-top-link').forEach(el=>el.textContent=user?'账号／同步':'登录／同步'); }
  const CLOUD_REPORT_NOTE = '云端副本保留既有汇总指标；较长的采样序列已抽样，不能用抽样点重新计算整段分数。本机原始报告与已导出的完整备份保持不变。';
  const IMPORTANT_KEYS = ['schema','engineVersion','mode','durationSeconds','sampleRate','quality','rhythm','pitch','chord','status','score','reasons','confidence','limitations','issueWindows','analysis'];
  function envelopeSize(value) {
    let nodes = 0, depth = 0, invalid = false;
    function visit(v, d) {
      nodes++; depth = Math.max(depth, d);
      if (nodes > 5500 || d > 11) return;
      if (Array.isArray(v)) { for (const x of v) { visit(x,d+1); if(nodes>5500)break; } }
      else if(v && typeof v === 'object') for(const [key,x] of Object.entries(v)) { if(['__proto__','prototype','constructor'].includes(key))invalid=true;visit(x,d+1);if(nodes>5500)break; }
    }
    visit(value,0);
    return {bytes:new TextEncoder().encode(JSON.stringify(value)).length,nodes,depth,invalid};
  }
  function fitsCloud(value) { const s=envelopeSize(value);return s.bytes<=60*1024&&s.nodes<=5500&&s.depth<=11&&!s.invalid; }
  // The server accepts at most 64 KiB / 6000 JSON nodes. Build a separate
  // bounded copy: original reports and their full onset arrays stay local.
  function boundedCopy(value, policy) {
    let nodes=0, omitted=0;const arrays=[];
    function copy(v,path,depth) {
      if(++nodes>policy.nodes||depth>8){omitted++;return null;}
      if(v===null||typeof v==='number'||typeof v==='boolean')return v;
      if(typeof v==='string'){if(v.length>policy.text){omitted++;return v.slice(0,policy.text)+'…';}return v;}
      if(Array.isArray(v)) {
        const count=Math.min(v.length,policy.array),result=[];
        for(let i=0;i<count;i++){if(nodes>=policy.nodes)break;const k=v.length>count?Math.round(i*(v.length-1)/Math.max(1,count-1)):i;result.push(copy(v[k],path+'['+k+']',depth+1));}
        if(result.length<v.length){omitted++;if(arrays.length<12)arrays.push({path:path.slice(0,120),originalLength:v.length,retainedLength:result.length,selection:result.length===count?'uniform-including-ends':'bounded-subset'});}
        return result;
      }
      if(v&&typeof v==='object') {
        const result={},keys=Object.keys(v).sort((a,b)=>{const ai=IMPORTANT_KEYS.indexOf(a),bi=IMPORTANT_KEYS.indexOf(b);return(ai<0?999:ai)-(bi<0?999:bi);});
        let kept=0;
        for(const key of keys){if(kept>=policy.keys||nodes>=policy.nodes){omitted++;break;}if(['__proto__','prototype','constructor'].includes(key)||key.length>120){omitted++;continue;}result[key]=copy(v[key],path?path+'.'+key:key,depth+1);kept++;}
        return result;
      }
      omitted++;return null;
    }
    return {value:copy(value,'',0),arrays,get omitted(){return omitted;}};
  }
  function envelope(item) {
    const original={schema:2,report:item.analysis || null,config:item.config || {},assessmentId:item.context?.assessmentId || null,label:item.label || '',source:item.source || 'uploaded',localUpdatedAt:item.updatedAt,cloudReport:item.cloudReport || null};
    // Normalize to actual JSON values once; do not edit objects from IndexedDB.
    const raw=JSON.parse(JSON.stringify(original));
    if(fitsCloud(raw))return raw;
    const originalBytes=envelopeSize(raw).bytes;
    const policies=[{array:512,text:2048,keys:64,nodes:4000},{array:128,text:768,keys:48,nodes:2500},{array:32,text:256,keys:32,nodes:1500},{array:8,text:160,keys:24,nodes:600}];
    for(const policy of policies) {
      const compact=boundedCopy(raw,policy),result=compact.value;
      result.schema=2;
      result.cloudReport={schema:1,compacted:true,originalBytes,arrays:compact.arrays,omittedFields:compact.omitted,note:CLOUD_REPORT_NOTE};
      if(result.report&&typeof result.report==='object'&&!Array.isArray(result.report)){
        const notes=Array.isArray(result.report.limitations)?result.report.limitations.filter(x=>typeof x==='string').slice(0,16):[];
        result.report.limitations=[...new Set([...notes,CLOUD_REPORT_NOTE])];
      }
      if(fitsCloud(result))return result;
    }
    // Malformed/unknown imported reports must not prevent the audio itself
    // from being saved, or turn an omitted report into a fabricated score.
    return {schema:2,report:{limitations:['此云端副本仅保留录音；原分析报告结构过大，请在原设备查看或导出完整备份。']},config:{mode:typeof item.config?.mode==='string'?item.config.mode.slice(0,40):'mixed'},assessmentId:typeof item.context?.assessmentId==='string'?item.context.assessmentId.slice(0,80):null,label:String(item.label||'').slice(0,160),source:item.source==='recorded'?'recorded':'uploaded',localUpdatedAt:item.updatedAt,cloudReport:{schema:1,compacted:true,reportOmitted:true,originalBytes,note:CLOUD_REPORT_NOTE}};
  }
  function metadata(item) { return {name:item.fileName.slice(0,200),mimeType:item.blob.type || item.mimeType,durationSeconds:item.duration,createdAt:item.createdAt,context:{day:item.context?.day || null,song:item.context?.songId || null,mode:item.config?.mode==='single-note'?'pitch':item.config?.mode==='mixed'?'song':item.config?.mode || 'practice'},analysis:envelope(item)}; }
  function fromRemote(row, blob) { const a=row.analysis?.schema===2?row.analysis:{};return {id:row.id,fileName:row.name,label:a.label || row.name,mimeType:row.mimeType,blob,duration:row.durationSeconds,createdAt:row.createdAt,updatedAt:row.updatedAt,context:{day:row.context?.day || null,songId:row.context?.song || null,assessmentId:a.assessmentId || null},config:a.config || {mode:'mixed'},analysis:a.report || null,cloudReport:a.cloudReport || null,source:a.source || 'uploaded',cloudSyncedAt:row.updatedAt,cloudUserId:user.id}; }
  async function pushRecording(id, exists) {
    const item=await root.UKE_RECORDINGS.get(id);if(!item)return;
    tell('正在同步录音：'+item.fileName);
    let result;const m=metadata(item);
    if(exists){result=await api('recordings/'+encodeURIComponent(id)+'/metadata',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({name:m.name,context:m.context,analysis:m.analysis})});}
    else {const form=new FormData();form.append('file',item.blob,item.fileName);form.append('metadata',JSON.stringify(m));result=await api('recordings/'+encodeURIComponent(id),{method:'PUT',body:form});}
    if(result.storage)storage=result.storage;
    const saved=await root.UKE_RECORDINGS.markCloudSynced(id,result.recording.updatedAt,item.contentVersion,user.id);if(saved?.cloudDirty){dirty.add(id);queued=true;}else dirty.delete(id);
    return {compacted:!!m.analysis.cloudReport?.compacted};
  }
  async function syncProgress() {
    const result=await api('progress',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({state:root.UKE_APP.getState(),baseRevision:revision})});
    revision=result.revision;applying=true;try{root.UKE_APP.importState(result.state);}finally{applying=false;}
  }
  async function syncAll() {
    if(!cloud||!user)return;if(busy){queued=true;return;}busy=true;error='';tell('正在合并日课进度与测评…');
    try {
      await syncProgress();
      const remote=new Map();let cursor=null;do{const result=await api('recordings?limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):''));storage=result.storage;for(const row of result.recordings)remote.set(row.id,row);cursor=result.nextCursor;}while(cursor);
      const local=await root.UKE_RECORDINGS.list(),localMap=new Map(local.map(x=>[x.id,x]));let incomplete=0,compactedReports=0;
      for(const row of remote.values()) {
        const here=localMap.get(row.id);
        if(row.status!=='ready'){incomplete++;continue;}
        if(!here){tell('正在取回录音：'+row.name);const response=await fetch(row.audioUrl,{credentials:'same-origin',cache:'no-store'});if(!response.ok||!/audio\//.test(response.headers.get('content-type')||''))throw new Error('录音取回失败，请重新登录后重试。');const applied=await root.UKE_RECORDINGS.applyCloudRecording(fromRemote(row,await response.blob()),null);if(!applied.applied)queued=true;}
        else if(!dirty.has(row.id)&&!here.cloudDirty&&here.cloudSyncedAt&&Date.parse(row.updatedAt)>Date.parse(here.cloudSyncedAt)){const applied=await root.UKE_RECORDINGS.applyCloudRecording(fromRemote(row,here.blob),here);if(!applied.applied)queued=true;}
      }
      for(const item of local) {
        const remoteItem=remote.get(item.id);
        if(remoteItem?.status==='deleting')continue;
        if(dirty.has(item.id)||item.cloudDirty||!item.cloudSyncedAt){const pushed=await pushRecording(item.id,remoteItem?.status==='ready');if(pushed?.compacted)compactedReports++;}
        else if(!remoteItem&&item.cloudSyncedAt){const marked=await root.UKE_RECORDINGS.markCloudMissing(item.id,item);if(!marked.applied&&marked.reason==='changed')queued=true;}
      }
      if(!incomplete&&!queued)lastSync=new Date().toISOString();error='';tell(queued?'正在保存刚更新的内容，下一轮同步即将继续。':incomplete?'进度已同步；有'+incomplete+'条云端录音尚在处理中，稍后点立即同步。':compactedReports?'进度与录音已同步；'+compactedReports+'份长报告的云端副本保留汇总指标与抽样点，完整报告仍在本机。':'进度、录音与分析报告已同步。');
      root.dispatchEvent(new CustomEvent('uke:cloud-recordings'));
    }catch(e){error=e.message;if(e.auth)user=null;tell('同步未完成。本机记录保留，稍后可重试。');}
    finally{busy=false;paint();if(queued){queued=false;clearTimeout(timer);timer=setTimeout(syncAll,1500);}}
  }
  async function boot() {
    if(!cloud||initialized)return;initialized=true;
    try{const me=await api('me');user=me.user;storage=me.storage;tell('已登录，正在连接你的练习记录。');await syncAll();}catch(e){error=e.message;tell('本机练习仍可使用。');}
  }
  function schedule() { if(!cloud||!user||applying)return;clearTimeout(timer);timer=setTimeout(syncAll,1400); }
  async function deleteRecording(id) { if(!cloud)return;const item=await root.UKE_RECORDINGS.get(id);if(!item?.cloudSyncedAt&&!user)return;if(!user)throw new Error('请先恢复登录，再删除已同步的录音。');if(busy)throw new Error('正在同步，请完成后再删除。');await api('recordings/'+encodeURIComponent(id),{method:'DELETE'});dirty.delete(id);const me=await api('me');storage=me.storage;paint(); }
  root.addEventListener('uke:progress',schedule);
  root.addEventListener('uke:recording-saved',ev=>{if(ev.detail?.id)dirty.add(ev.detail.id);schedule();});
  root.addEventListener('online',schedule);
  document.addEventListener('click',ev=>{const el=ev.target.closest('[data-cloud="sync"]');if(!el)return;ev.preventDefault();if(!user){initialized=false;boot();}else syncAll();});
  root.UKE_CLOUD={banner,accountView,paint,syncAll,deleteRecording,isCloud:cloud};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else setTimeout(boot,0);
})(window);
