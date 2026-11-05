#!/usr/bin/env node
'use strict';
/* Run: node personal-growth-lab/academy/ukulele-lab/tools/test_cloud_sync.cjs
 * Loads the real browser modules. The IndexedDB fixture serializes complete
 * transactions, clones values, and rolls back aborts. Deliberate interleavings
 * test stale snapshots; this does not replace browser IndexedDB tests in CI.
 * No network, user account, persistent profile, or third-party package is used.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const storeSource = fs.readFileSync(path.join(__dirname, '../assets/recording-store.js'), 'utf8');
const cloudSource = fs.readFileSync(path.join(__dirname, '../assets/cloud.js'), 'utf8');
const tests = [];
const test = (name, fn) => tests.push({name, fn});
const T0 = '2026-01-01T00:00:00.000Z', T1 = '2026-01-02T00:00:00.000Z';
const clone = value => value === undefined ? undefined : structuredClone(value);

function indexedDBFixture() {
  let rows = new Map(), running = false, created = false;
  const queue = [];
  function runNext() {
    if(running || !queue.length)return;
    running = true;
    const tx = queue.shift(), staged = new Map([...rows].map(([k,v])=>[k,clone(v)]));
    const finish = () => {
      if(!tx.aborted && tx.mode === 'readwrite')rows = staged;
      running = false;
      if(tx.aborted)tx.onabort?.();else tx.oncomplete?.();
      setImmediate(runNext);
    };
    function step() {
      if(tx.aborted)return finish();
      const operation = tx.pending.shift();
      if(!operation)return finish();
      try { operation.request.result = operation.execute(staged);operation.request.onsuccess?.(); }
      catch(error){tx.error=error;tx.aborted=true;operation.request.onerror?.();}
      setImmediate(step);
    }
    setImmediate(step);
  }
  const database = {
    close(){},
    createObjectStore(){created=true;return {createIndex(){}};},
    transaction(_name,mode){
      const tx = {mode,pending:[],aborted:false,abort(){this.aborted=true;}};
      const enqueue = execute => {const request={};tx.pending.push({request,execute});return request;};
      tx.objectStore = () => ({
        get:key=>enqueue(data=>clone(data.get(key))),
        getAll:()=>enqueue(data=>[...data.values()].map(clone)),
        put:item=>{const copy=clone(item);return enqueue(data=>{data.set(copy.id,copy);return copy.id;});},
        delete:key=>enqueue(data=>{data.delete(key);return undefined;}),
      });
      queue.push(tx);setImmediate(runNext);return tx;
    },
  };
  return {open(){const request={};setImmediate(()=>{request.result=database;if(!created)request.onupgradeneeded?.();request.onsuccess?.();});return request;}};
}

function events() {
  const listeners = new Map();
  return {
    addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},
    dispatchEvent(event){for(const fn of listeners.get(event.type)||[])fn(event);},
    async fire(type){await Promise.all((listeners.get(type)||[]).map(fn=>fn({type})));},
  };
}

function environment() {
  const timers=new Map();let timerId=0;
  const document={...events(),readyState:'loading',querySelectorAll:()=>[],querySelector:()=>null};
  const window={...events(),indexedDB:indexedDBFixture(),crypto:webcrypto,UKE_CLOUD_CONFIG:{mode:'cloud'}};
  let state={schema:1,records:{}};
  window.UKE_APP={getState:()=>clone(state),importState:value=>{state=clone(value);}};
  const context={window,document,indexedDB:window.indexedDB,crypto:webcrypto,Blob,File,FormData,Response,Request,Headers,TextEncoder,TextDecoder,URL,Date,Uint8Array,Uint32Array,DataView,ArrayBuffer,CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail;}},setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)};
  vm.createContext(context);vm.runInContext(storeSource,context,{filename:'recording-store.js'});
  return {window,document,context,timers,store:window.UKE_RECORDINGS};
}

function recording(extra={}) {
  return {id:'record_fixture',fileName:'练习.wav',label:'练习',blob:new Blob(['RIFF0000WAVE'],{type:'audio/wav'}),mimeType:'audio/wav',duration:4,createdAt:T0,updatedAt:T0,context:{day:1,songId:null},config:{mode:'rhythm',referenceBpm:60},analysis:{rhythm:{score:70,onsetsSeconds:[0,1,2,3]},limitations:['只适用于所选节奏任务。']},source:'recorded',...extra};
}

async function clean(store,extra={}) {
  return store.put(recording({cloudSyncedAt:T0,cloudUserId:'owner',...extra}),{markDirty:false,preserveUpdatedAt:true});
}

function remote(item,extra={}) {
  return {id:item.id,name:item.fileName,mimeType:'audio/wav',bytes:item.blob.size,durationSeconds:item.duration,createdAt:item.createdAt,uploadedAt:T0,updatedAt:T1,context:{day:1,song:null,mode:'rhythm'},analysis:{schema:2,report:item.analysis,config:item.config},status:'ready',audioUrl:'/api/recordings/'+item.id,...extra};
}

function checkServerEnvelope(value) {
  assert.ok(new TextEncoder().encode(JSON.stringify(value)).length <= 65536,'server byte limit');
  let nodes=0;
  function visit(v,depth){nodes++;assert.ok(depth<=12,'server depth limit');if(Array.isArray(v))v.forEach(x=>visit(x,depth+1));else if(v&&typeof v==='object')for(const[key,x]of Object.entries(v)){assert.ok(!['__proto__','constructor','prototype'].includes(key),'forbidden server field');visit(x,depth+1);}}
  visit(value,0);assert.ok(nodes<=6000,'server JSON node limit');
}

async function startCloud(env,{rows=[],onUpload,onList}={}) {
  const remoteRows=new Map(rows.map(r=>[r.id,clone(r)])),uploads=[];
  const json=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
  env.context.fetch=async(input,options={})=>{
    const url=new URL(input,'https://studio.test'),p=url.pathname,method=options.method||'GET';
    if(p==='/api/me')return json({ok:true,user:{id:'owner',displayName:'测试'},storage:{usedBytes:0,quotaBytes:262144000}});
    if(p==='/api/progress')return json({ok:true,state:JSON.parse(options.body).state,revision:1});
    if(p==='/api/recordings'&&method==='GET'){await onList?.();return json({ok:true,recordings:[...remoteRows.values()],nextCursor:null,storage:{usedBytes:0,quotaBytes:262144000}});}
    const match=/^\/api\/recordings\/([^/]+)(\/metadata)?$/.exec(p);
    assert.ok(match,'unexpected fetch '+p);
    if(method==='GET')return new Response(new Blob(['RIFF0000WAVE'],{type:'audio/wav'}),{headers:{'content-type':'audio/wav'}});
    if(method==='PUT'||method==='PATCH'){
      const data=method==='PUT'?JSON.parse(options.body.get('metadata')):JSON.parse(options.body);
      if(method==='PATCH')assert.deepEqual(Object.keys(data).sort(),['analysis','context','name']);
      checkServerEnvelope(data.analysis);uploads.push({method,id:match[1],data});
      await onUpload?.(data,match[1]);
      const saved={...(remoteRows.get(match[1])||{}),id:match[1],name:data.name,updatedAt:T1,status:'ready',analysis:data.analysis};remoteRows.set(match[1],saved);
      return json({ok:true,recording:saved,storage:{usedBytes:12,quotaBytes:262144000}});
    }
    throw new Error('unexpected method '+method);
  };
  vm.runInContext(cloudSource,env.context,{filename:'cloud.js'});
  await env.document.fire('DOMContentLoaded');
  return {uploads,remoteRows};
}

test('remote metadata cannot overwrite newer analysis or restored local content',async()=>{
  const e=environment(),snapshot=await clean(e.store);
  const local=await e.store.update(snapshot.id,{analysis:{rhythm:{score:91},note:'本机新分析'}});
  const result=await e.store.applyCloudRecording({...snapshot,analysis:{rhythm:{score:10}},updatedAt:T1},snapshot);
  assert.equal(result.applied,false);assert.equal(result.reason,'changed');
  const current=await e.store.get(snapshot.id);
  assert.equal(current.analysis.rhythm.score,91);assert.equal(current.contentVersion,local.contentVersion);assert.equal(current.cloudDirty,true);
});

test('unchanged snapshot applies remote metadata atomically and preserves audio bytes',async()=>{
  const e=environment(),snapshot=await clean(e.store);
  const result=await e.store.applyCloudRecording({...snapshot,analysis:{rhythm:{score:88}},updatedAt:T1,cloudSyncedAt:T1},snapshot);
  assert.equal(result.applied,true);assert.equal(result.item.cloudDirty,false);assert.notEqual(result.item.contentVersion,snapshot.contentVersion);
  const current=await e.store.get(snapshot.id);
  assert.equal(current.analysis.rhythm.score,88);assert.equal(await current.blob.text(),await snapshot.blob.text());
  const oldMark=await e.store.markCloudMissing(snapshot.id,snapshot);
  assert.equal(oldMark.applied,false);assert.equal((await e.store.get(snapshot.id)).cloudMissing,false);
});

test('concurrent local write wins without a stale remote write erasing it',async()=>{
  const e=environment(),snapshot=await clean(e.store);
  await Promise.all([
    e.store.update(snapshot.id,{label:'本机新标题',analysis:{rhythm:{score:93}}}),
    e.store.applyCloudRecording({...snapshot,label:'旧远端标题',analysis:{rhythm:{score:20}},updatedAt:T1},snapshot),
  ]);
  const current=await e.store.get(snapshot.id);assert.equal(current.label,'本机新标题');assert.equal(current.analysis.rhythm.score,93);assert.equal(current.cloudDirty,true);
});

test('new pulls do not replace a concurrent insert or resurrect a deleted snapshot',async()=>{
  const e=environment(),incoming=recording({cloudSyncedAt:T1,cloudUserId:'owner'});
  const local=await e.store.put(recording({label:'恢复的本机版本'}));
  assert.equal((await e.store.applyCloudRecording(incoming,null)).applied,false);
  assert.equal((await e.store.get(incoming.id)).label,'恢复的本机版本');
  await e.store.remove(local.id);
  const rejected=await e.store.applyCloudRecording(incoming,local);assert.equal(rejected.applied,false);assert.equal(rejected.reason,'missing');assert.equal(await e.store.get(local.id),undefined);
  const inserted=await e.store.applyCloudRecording(incoming,null);assert.equal(inserted.applied,true);assert.equal(inserted.item.cloudDirty,false);
});

test('missing marks compare the current version and never replay stale metadata',async()=>{
  const e=environment(),snapshot=await clean(e.store);
  await e.store.update(snapshot.id,{label:'新版本不得丢失'});
  const stale=await e.store.markCloudMissing(snapshot.id,snapshot);assert.equal(stale.applied,false);
  assert.equal((await e.store.get(snapshot.id)).label,'新版本不得丢失');
  const stable=await clean(e.store,{id:'record_stable'}),missing=await e.store.markCloudMissing(stable.id,stable);
  assert.equal(missing.applied,true);assert.equal(missing.item.cloudMissing,true);assert.equal(missing.item.contentVersion,stable.contentVersion);assert.equal(missing.item.cloudDirty,false);
});

test('temporary audio keeps its version and remains visibly unpersisted after cloud confirmation',async()=>{
  const e=environment(),snapshot=await clean(e.store);
  const temporary=e.store.keepTemporary({...snapshot,analysis:{rhythm:{score:97}}});
  assert.equal(e.store.hasTemporary(),true);assert.notEqual(temporary.contentVersion,snapshot.contentVersion);
  assert.equal((await e.store.applyCloudRecording({...snapshot,updatedAt:T1},snapshot)).applied,false);
  assert.equal((await e.store.markCloudMissing(snapshot.id,snapshot)).applied,false);
  const marked=await e.store.markCloudSynced(temporary.id,T1,temporary.contentVersion,'owner');
  assert.equal(marked.persisted,false);assert.equal(marked.cloudDirty,false);assert.equal(marked.analysis.rhythm.score,97);
  const newer=e.store.keepTemporary({...temporary,analysis:{rhythm:{score:99}}});
  const oldConfirmation=await e.store.markCloudSynced(newer.id,T1,temporary.contentVersion,'owner');assert.equal(oldConfirmation.cloudDirty,true);assert.equal(oldConfirmation.analysis.rhythm.score,99);
});

test('long reports fit server limits without mutating scores, issue windows, or the local original',async()=>{
  const e=environment(),onsets=Array.from({length:10000},(_,i)=>Number((i*.06).toFixed(3)));
  const analysis={schema:1,engineVersion:'test',quality:{status:'ok',score:null,reasons:['条件有效'],confidence:{level:'high'}},rhythm:{status:'ok',score:73,onsetCount:onsets.length,onsetsSeconds:onsets,issueWindows:[{startSeconds:4,endSeconds:5,valueMs:41}],reasons:['原始汇总'],confidence:{level:'medium'}},limitations:['只适用于指定节奏任务。']};
  const item=await e.store.put(recording({analysis})),before=JSON.stringify(item.analysis);
  const {uploads}=await startCloud(e);
  assert.equal(uploads.length,1);const envelope=uploads[0].data.analysis;
  assert.equal(envelope.cloudReport.compacted,true);assert.equal(envelope.report.rhythm.score,73);assert.equal(envelope.report.rhythm.onsetCount,10000);
  assert.deepEqual(envelope.report.rhythm.issueWindows,analysis.rhythm.issueWindows);
  const sampled=envelope.report.rhythm.onsetsSeconds;assert.ok(sampled.length<=512);assert.equal(sampled[0],onsets[0]);assert.equal(sampled.at(-1),onsets.at(-1));
  assert.ok(envelope.report.limitations.some(x=>x.includes('抽样')));assert.ok(envelope.cloudReport.arrays.some(x=>x.originalLength===10000));
  assert.equal(JSON.stringify((await e.store.get(item.id)).analysis),before);
  assert.match(e.window.UKE_CLOUD.accountView(),/完整报告仍在本机/);
});

test('small reports remain complete and PATCH uses only supported metadata fields',async()=>{
  const e=environment(),item=await clean(e.store),row=remote(item,{updatedAt:T0});
  await e.store.update(item.id,{analysis:{rhythm:{score:85,onsetsSeconds:[0,1,2]},limitations:['小报告完整保留']}});
  const {uploads}=await startCloud(e,{rows:[row]});assert.equal(uploads[0].method,'PATCH');assert.equal(uploads[0].data.analysis.cloudReport,null);
  assert.deepEqual(uploads[0].data.analysis.report.rhythm.onsetsSeconds,[0,1,2]);assert.equal(uploads[0].data.analysis.report.rhythm.score,85);
  assert.match(e.window.UKE_CLOUD.accountView(),/进度、录音与分析报告已同步/);
});

test('pull conflict queues another sync and does not claim a complete save',async()=>{
  const e=environment(),snapshot=await clean(e.store),row=remote(snapshot);
  const apply=e.store.applyCloudRecording;
  e.store.applyCloudRecording=async(incoming,expected)=>{await e.store.update(incoming.id,{analysis:{rhythm:{score:96}},label:'网络等待期间的新内容'});return apply(incoming,expected);};
  const {uploads}=await startCloud(e,{rows:[row]});
  assert.equal(uploads.length,0);assert.equal((await e.store.get(snapshot.id)).analysis.rhythm.score,96);
  assert.match(e.window.UKE_CLOUD.accountView(),/下一轮同步即将继续/);assert.match(e.window.UKE_CLOUD.accountView(),/尚未成功同步/);
  assert.ok([...e.timers.values()].some(x=>x.ms===1500));
});

test('missing-marker conflict also queues retry instead of hiding local changes',async()=>{
  const e=environment(),snapshot=await clean(e.store),mark=e.store.markCloudMissing;
  e.store.markCloudMissing=async(id,expected)=>{await e.store.update(id,{label:'尚未同步的本机更改'});return mark(id,expected);};
  await startCloud(e);const current=await e.store.get(snapshot.id);
  assert.equal(current.label,'尚未同步的本机更改');assert.notEqual(current.cloudMissing,true);assert.equal(current.cloudDirty,true);
  assert.match(e.window.UKE_CLOUD.accountView(),/下一轮同步即将继续/);
});

(async()=>{let passed=0;for(const {name,fn} of tests){try{await fn();console.log('PASS '+name);passed++;}catch(error){console.error('FAIL '+name);throw error;}}console.log(`${passed}/${tests.length} cloud sync regression checks passed.`);})().catch(error=>{console.error(error);process.exitCode=1;});
