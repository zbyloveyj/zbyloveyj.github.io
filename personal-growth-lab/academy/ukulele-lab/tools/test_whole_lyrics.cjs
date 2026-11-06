'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const s={document:{getElementById(){return null}},localStorage:{getItem(){return null},setItem(){}},addEventListener(){}};
s.window=s;
for(const file of ['music-data.js','score-data.js','score-lyrics.js','score-whole-lyrics.js']){
  vm.runInNewContext(fs.readFileSync(path.join(root,'assets',file),'utf8'),s,{filename:file});
}
const B=s.UKE_BULK_LYRICS,L=s.UKE_LYRICS,plain=x=>JSON.parse(JSON.stringify(x));
const verify=(name,fn)=>{try{fn();console.log('PASS '+name);}catch(e){console.error('FAIL '+name);throw e;}};
verify('All three song forms accept a full continuous original placeholder lyric draft',()=>{
  for(const song of s.UKE_SCORES.songs){
    const count=B.vocalForm(song).reduce((n,x)=>n+x.phrases.length,0);
    const lines=Array.from({length:count},(_,i)=>'原创测试短句'+(i+1)+'开始向前').join('\n');
    const p=B.plan(song.id,lines,'continuous',false);
    assert.equal(p.unused,0);
    assert(p.rows>0);
    assert.equal(L.validateDocument(p.document,song.id).songId,song.id);
    assert(p.outcomes.every(x=>x.lines===B.vocalForm(song).find(y=>y.label===x.label)?.phrases.length));
  }
});
verify('Each occurrence may receive different words without leaking into another song',()=>{
  const form=B.vocalForm(s.UKE_SCORES.songs.find(x=>x.id==='an-jing'));
  const blocks=form.map((entry,i)=>entry.phrases.map((_,j)=>'个人新词'+i+'段'+j+'句').join('\n'));
  const p=B.plan('an-jing',blocks.join('\n\n'),'blocks',false);
  const one=p.document.lyrics.verse['0'];
  const two=p.document.repeats.verse['2']['0'];
  assert.notDeepEqual(plain(p.document.lyrics.verse),plain(p.document.repeats.verse['2']));
  assert(one && two, 'both verse occurrences must be populated');
  assert(p.outcomes.every(x=>!x.reused));
  assert(!JSON.stringify(p.document).includes('一万次悲伤'));
});
verify('Missing repeated chorus may reuse earlier chorus only when explicitly selected',()=>{
  const form=B.vocalForm(s.UKE_SCORES.songs.find(x=>x.id==='qing-tian'));
  const firstThree=form.slice(0,3).map((entry,i)=>entry.phrases.map((_,j)=>'练习歌词'+i+'段'+j+'句').join('\n')).join('\n\n');
  const reused=B.plan('qing-tian',firstThree,'blocks',true);
  const spare=B.plan('qing-tian',firstThree,'blocks',false);
  assert(reused.outcomes.some(x=>x.reused));
  assert(spare.outcomes.some(x=>!x.lines&&!x.reused));
  assert(reused.rows>spare.rows);
  assert(reused.warnings.some(x=>x.includes('须')||x.includes('核对')));
});
verify('User text is preserved in data; no text is bundled or sent',()=>{
  const words='我自己的原创句子！';
  const p=B.plan('sadness',words+'\n另一个自己的句子','continuous',false);
  const chars=Object.values(p.document.lyrics.verse).flat().join('');
  assert(chars.includes('我'));
  assert(chars.includes('原创'));
  assert.equal(typeof s.fetch,'undefined');
});
verify('Unsupported data and empty content cannot overwrite lyric storage',()=>{
  assert.throws(()=>B.plan('an-jing','','auto',true));
  assert.throws(()=>B.plan('an-jing','a'.repeat(25001),'auto',true));
  assert.throws(()=>B.plan('missing','test','auto',true));
  assert.throws(()=>B.plan('an-jing','test','unknown',true));
});
console.log('All whole-song lyric layout checks passed.');
