'use strict';
// Node checks and maintenance scripts must load the same complete set as the UI.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
module.exports=function loadLabData(file=path.join(__dirname,'../data/labs.json')){
  const data=JSON.parse(fs.readFileSync(file,'utf8')),labs=[...data.labs],seenPaths=new Set();
  for(const part of data.dataParts||[]){
    if(!/^data\/[a-zA-Z0-9_.-]+\.json$/.test(part.path)||seenPaths.has(part.path))throw Error('Invalid data part path');
    seenPaths.add(part.path);
    const raw=fs.readFileSync(path.join(path.dirname(file),'..',part.path));
    if(crypto.createHash('sha256').update(raw).digest('hex')!==part.sha256)throw Error('Part checksum mismatch');
    const doc=JSON.parse(raw);
    if(doc.edition!==data.edition||doc.labs.length!==part.count)throw Error('Part edition/count mismatch');
    if(part.compressedPath&&!zlib.gunzipSync(fs.readFileSync(path.join(path.dirname(file),'..',part.compressedPath))).equals(raw))throw Error('Compressed part mismatch');
    labs.push(...doc.labs);
  }
  const overlayPath=path.join(path.dirname(file),'lab-editorial-overrides.json');
  if(fs.existsSync(overlayPath)){
    const overlay=JSON.parse(fs.readFileSync(overlayPath,'utf8'));
    if(overlay.schemaVersion!==1||!Array.isArray(overlay.updates))throw Error('Invalid editorial override schema');
    const byId=new Map(labs.map(l=>[l.id,l]));
    for(const update of overlay.updates){
      const record=byId.get(update.id);if(!record)throw Error('Editorial override references unknown stable ID: '+update.id);
      for(const [key,value] of Object.entries(update.set||{}))record[key]=key==='opportunity'?{...(record.opportunity||{}),...value}:value;
      for(const [field,items] of Object.entries(update.upsert||{})){
        if(!['sources','papers','assessmentEvidence'].includes(field))throw Error('Unsupported editorial override collection: '+field);
        record[field]=record[field]||[];
        for(const item of items){const key=field==='assessmentEvidence'?String(item.dimension)+'|'+String(item.url):item.url;const index=record[field].findIndex(old=>(field==='assessmentEvidence'?String(old.dimension)+'|'+String(old.url):old.url)===key);if(index<0)record[field].push(item);else record[field][index]={...record[field][index],...item};}
      }
    }
  }
  if(new Set(labs.map(l=>l.id)).size!==labs.length||data.totalRecords!==undefined&&data.totalRecords!==labs.length)throw Error('Directory identity/total mismatch');
  data.labs=labs;
  // The returned in-memory object is complete and safe as a browser fixture.
  delete data.dataParts;delete data.storageFormat;
  return data;
};
