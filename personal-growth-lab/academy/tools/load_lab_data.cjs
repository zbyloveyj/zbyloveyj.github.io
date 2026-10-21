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
  if(new Set(labs.map(l=>l.id)).size!==labs.length||data.totalRecords!==undefined&&data.totalRecords!==labs.length)throw Error('Directory identity/total mismatch');
  data.labs=labs;
  // The returned in-memory object is complete and safe as a browser fixture.
  delete data.dataParts;delete data.storageFormat;
  return data;
};
