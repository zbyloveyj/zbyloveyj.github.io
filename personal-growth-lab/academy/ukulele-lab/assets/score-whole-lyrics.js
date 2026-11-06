(function (root) {
  'use strict';
  // The user supplies text locally. This module does not retrieve, distribute,
  // transmit, embed, or publish any original song lyrics.
  var SCHEMA = 'yixindao.ukulele.lyrics';
  var VOCAL_ROLES = new Set(['verse','prechorus','chorus','bridge']);
  var MAX_TEXT = 25000;
  var MAX_FILE = 256 * 1024;
  var active = null;
  function songFor(id) {
    var song = root.UKE_SCORES && root.UKE_SCORES.songs.find(function(s){return s.id === id;});
    if (!song) throw new Error('没有找到当前歌曲。');
    return song;
  }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g,function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
    });
  }
  function isHeading(line) {
    return /^(?:[\s【\[(（]*)(?:第[一二三四五六七八九十\d]+遍[主副歌]?|主歌|副歌|预副歌|衔接段?|过渡|间奏|前奏|尾奏|桥段|verse|chorus|pre[- ]?chorus|bridge|intro|outro|instrumental)(?:[\d一二三四五六七八九十\s.\-:：、】\])）]*)$/i.test(line.trim());
  }
  function cleanLines(chunk) {
    return chunk.split(/\n/).map(function(x){return x.trim();})
      .filter(function(x){return x && !isHeading(x) && !/^(?:歌名|歌手|作词|作曲|编曲)\s*[:：]/.test(x);});
  }
  function vocalForm(song) {
    var count = {};
    var list = [];
    song.form.forEach(function(part){
      var section = song.sections.find(function(s){return s.id===part.sectionId;});
      if (!section || !VOCAL_ROLES.has(section.role)) return;
      for (var n=0;n<(part.repeat || 1);n++) {
        count[section.id] = (count[section.id] || 0)+1;
        list.push({section:section,verse:count[section.id],label:part.label || section.title,
          phrases:(section.phrases && section.phrases.length ? section.phrases :
            section.bars.map(function(_,i){return {from:i+1,to:i+1,label:'小节'+(i+1)};}))});
      }
    });
    return list;
  }
  function splitSlots(line, size) {
    var units=Array.from(String(line).trim()), cells=Array(size).fill('');
    if (!units.length) return cells;
    if (units.length>size*35) throw new Error('句子太长，请按唱句分行后重试。');
    if (units.length<size) {
      units.forEach(function(char,index){
        var position=Math.floor((index+0.5)*size/units.length);
        cells[Math.min(size-1,position)]+=char;
      });
    } else {
      for (var k=0;k<size;k++) {
        cells[k]=units.slice(Math.floor(k*units.length/size),
          Math.floor((k+1)*units.length/size)).join('');
      }
    }
    if (cells.some(function(t){return t.length>40;})) throw new Error('分配后的单拍文字过长，请将唱句拆短。');
    return cells;
  }
  function setLyrics(doc,entry,index,beats){
    if (!beats.some(Boolean)) return;
    var section=entry.section.id, verse=entry.verse;
    if (verse===1) {
      if (!doc.lyrics[section]) doc.lyrics[section]={};
      doc.lyrics[section][String(index)]=beats;
    } else {
      if (!doc.repeats[section]) doc.repeats[section]={};
      if (!doc.repeats[section][String(verse)]) doc.repeats[section][String(verse)]={};
      doc.repeats[section][String(verse)][String(index)]=beats;
    }
  }
  function rowsFor(doc,entry) {
    var section=entry.section.id,verse=entry.verse;
    return verse===1 ? doc.lyrics[section] :
      doc.repeats[section] && doc.repeats[section][String(verse)];
  }
  function assignLines(doc,entry,lines,warnings){
    var phrases=entry.phrases, mapped=0;
    if (lines.length!==phrases.length) warnings.push(entry.label+'：唱句'+lines.length+'行，对应教学谱'+phrases.length+'组；已做均匀分配，实际起唱拍点需校对。');
    if (!lines.length) return 0;
    if (lines.length<=phrases.length) {
      lines.forEach(function(line,i){
        var first=Math.floor(i*phrases.length/lines.length);
        var last=Math.max(first+1,Math.floor((i+1)*phrases.length/lines.length));
        var start=Math.max(0,phrases[first].from-1);
        var end=Math.min(entry.section.bars.length,phrases[last-1].to);
        if (end<=start) throw new Error('课程唱段小节范围不正确。');
        var cells=splitSlots(line,(end-start)*4);
        for(var bar=start;bar<end;bar++) {
          setLyrics(doc,entry,bar,cells.slice((bar-start)*4,(bar-start+1)*4));
          mapped++;
        }
      });
      return mapped;
    }
    var assignments=phrases.map(function(){return [];});
    {
      lines.forEach(function(line,i){
        assignments[Math.min(phrases.length-1,Math.floor(i*phrases.length/lines.length))].push(line);
      });
    }
    phrases.forEach(function(phrase,i) {
      var content=assignments[i].join(' / ').trim();
      if (!content) return;
      var start=Math.max(0,phrase.from-1),end=Math.min(entry.section.bars.length,phrase.to);
      if (end<=start) throw new Error('课程唱段小节范围不正确。');
      var cells=splitSlots(content,(end-start)*4);
      for(var bar=start;bar<end;bar++) {
        setLyrics(doc,entry,bar,cells.slice((bar-start)*4,(bar-start+1)*4));
        mapped++;
      }
    });
    return mapped;
  }
  function plan(songId,raw,mode,reuse) {
    var song=songFor(songId);
    if (typeof raw!=='string'||raw.length>MAX_TEXT) throw new Error('请提供25,000字以内的歌词正文。');
    var normalized=raw.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();
    if (!normalized) throw new Error('请粘贴整首歌词，或选择TXT文件。');
    var form=vocalForm(song);
    var groups=normalized.split(/\n[ \t]*\n+/).map(cleanLines).filter(function(x){return x.length;});
    var lines=cleanLines(normalized);
    if (!lines.length) throw new Error('没有找到有效的歌词正文。');
    var actual=mode==='auto' ? (groups.length>1&&groups.length<=form.length?'blocks':'continuous') : mode;
    if (!['blocks','continuous'].includes(actual)) throw new Error('不支持的排版方式。');
    var doc={schema:SCHEMA,version:1,songId:song.id,lyrics:{},repeats:{}};
    var warnings=[],outcomes=[],cursor=0,covered=0;
    var previous={};
    form.forEach(function(entry,i) {
      var sectionId=entry.section.id,source=[];
      if (actual==='blocks') source=groups[i] || [];
      else {
        var take=entry.phrases.length;
        source=lines.slice(cursor,cursor+take);
        cursor+=source.length;
      }
      var reused=false;
      if (!source.length && reuse && previous[sectionId] && Object.keys(previous[sectionId]).length) {
        Object.keys(previous[sectionId]).forEach(function(key){
          setLyrics(doc,entry,Number(key),previous[sectionId][key].slice());
          covered++;
        });
        reused=true;
        warnings.push(entry.label+'：没有独立歌词块，暂沿用上一遍相同唱段；请核对该遍的实际唱词。');
      } else if (source.length) {
        covered+=assignLines(doc,entry,source,warnings);
        previous[sectionId]=rowsFor(doc,entry);
      } else {
        warnings.push(entry.label+'：尚无歌词，保留空白。');
      }
      outcomes.push({label:entry.label,sectionId:sectionId,verse:entry.verse,
        lines:source.length,reused:reused,bars:entry.section.bars.length});
    });
    var extra=actual==='blocks'?groups.slice(form.length).flat():lines.slice(cursor);
    if (extra.length) warnings.push('还有'+extra.length+'行未对应到当前简化演出路线；不会丢弃原文本，请检查下方预览。');
    var count=Object.values(doc.lyrics).reduce(function(n,g){return n+Object.keys(g).length;},0);
    Object.values(doc.repeats).forEach(function(g){Object.values(g).forEach(function(v){count+=Object.keys(v).length;});});
    if (!count) throw new Error('当前格式未能匹配任何唱段，原谱不会被改变。');
    if (actual==='continuous') warnings.unshift('连续句序按照课程的唱句数量分组；该简化谱与原录音的小节时长不完全相同，需逐句复核。');
    return {document:doc,outcomes:outcomes,warnings:warnings,rows:count,unused:extra.length,mode:actual};
  }
  function panel(song) {
    var order=vocalForm(song).map(function(e){return e.label+'（'+e.phrases.length+'句）';}).join(' → ');
    return '<details class="score-whole-lyrics no-print" id="score-whole-lyrics" open data-whole-song="'+esc(song.id)+'">'+
      '<summary><strong>整首歌词一键排版</strong><span>一次粘贴 → 自动分段 → 预览 → 保存</span></summary>'+
      '<div class="score-whole-body"><p>将你有权使用的完整歌词一次粘贴进来，或导入TXT。工具只在当前浏览器处理，不会上传到公开网站或账户服务器。歌词与课程简化和弦谱自动排版；<strong>自动分拍是练习用初稿，不等于原唱真实起唱拍点。</strong></p>'+
      '<div class="score-whole-order"><strong>当前课程唱段顺序</strong><small>'+esc(order)+'</small></div>'+
      '<label for="whole-lyrics-text">整首歌词正文</label>'+
      '<textarea id="whole-lyrics-text" maxlength="'+MAX_TEXT+'" rows="9" placeholder="在这里一次粘贴整首歌词。推荐主歌、副歌等唱段之间空一行；或把每句单独写一行。歌词不会在网站公共内容中发布。"></textarea>'+
      '<div class="score-whole-controls"><label>排版规则<select id="whole-lyrics-mode"><option value="auto">自动判断</option><option value="blocks">每个空行分隔块对应一个唱段</option><option value="continuous">连续行按课程唱句顺序</option></select></label>'+
      '<label class="whole-check"><input type="checkbox" id="whole-lyrics-reuse" checked>缺少重复副歌时沿用上一遍（须校对）</label>'+
      '<button class="btn-small" type="button" data-whole-action="file">选择TXT</button>'+
      '<input type="file" id="whole-lyrics-file" hidden accept=".txt,text/plain"></div>'+
      '<div class="score-whole-actions"><button class="btn" type="button" data-whole-action="preview">自动排版并预览</button>'+
      '<button class="btn-secondary" type="button" id="whole-lyrics-apply" data-whole-action="apply" disabled>确认保存到曲谱</button></div>'+
      '<p class="score-whole-status" id="whole-lyrics-status" role="status" aria-live="polite">导入前可先选择歌曲唱段顺序。确认前不会修改已保存的任何歌词。</p>'+
      '<div id="whole-lyrics-preview" class="score-whole-preview" hidden></div>'+
      '<p class="score-whole-footnote">保存后的歌词在下方谱面按四拍显示，可在“添加我的歌词”里逐拍精修，并单独下载JSON备份。整首原词和第三方曲谱不会被复制到公开GitHub仓库。</p></div></details>';
  }
  function mount(songId) {
    if(active && active.panel && active.panel.isConnected) {
      active.panel.removeEventListener('click',active.click);
      active.panel.removeEventListener('change',active.change);
      active.panel.removeEventListener('input',active.input);
    }
    var song=songFor(songId);
    var box=root.document.getElementById('score-whole-lyrics');
    if(!box||box.dataset.wholeSong!==song.id) return;
    var find=function(id){return box.querySelector('#'+id);};
    var txt=find('whole-lyrics-text'),mode=find('whole-lyrics-mode'),reuse=find('whole-lyrics-reuse');
    var preview=find('whole-lyrics-preview'),apply=find('whole-lyrics-apply'),status=find('whole-lyrics-status');
    var file=find('whole-lyrics-file'),draft=null;
    function invalidate(){draft=null;apply.disabled=true;preview.hidden=true;preview.innerHTML='';}
    function show(message,problem){status.textContent=message;status.dataset.state=problem?'error':'info';}
    function previewIt(){
      invalidate();
      draft=plan(song.id,txt.value,mode.value,reuse.checked);
      var shown=[];
      Object.keys(draft.document.lyrics).forEach(function(s){
        Object.keys(draft.document.lyrics[s]).forEach(function(bar){
          shown.push({section:s,verse:1,bar:Number(bar),beats:draft.document.lyrics[s][bar]});
        });
      });
      Object.keys(draft.document.repeats).forEach(function(s){
        Object.keys(draft.document.repeats[s]).forEach(function(verse){
          Object.keys(draft.document.repeats[s][verse]).forEach(function(bar){
            shown.push({section:s,verse:Number(verse),bar:Number(bar),beats:draft.document.repeats[s][verse][bar]});
          });
        });
      });
      preview.innerHTML='<div class="whole-summary"><strong>已暂排 '+draft.rows+'个小节／遍次</strong><span>模式：'+(draft.mode==='blocks'?'空行分唱段':'连续句序')+'</span></div>'+
        '<div class="whole-groups">'+draft.outcomes.map(function(x){
          return '<span>'+esc(x.label)+'：'+(x.reused?'沿用前遍':x.lines?x.lines+'句':'尚空')+'</span>';
        }).join('')+'</div>'+
        '<div class="whole-table-scroll"><table><thead><tr><th>唱段·小节</th><th>第1拍</th><th>第2拍</th><th>第3拍</th><th>第4拍</th></tr></thead><tbody>'+
        shown.slice(0,24).map(function(x){return '<tr><th>'+esc(x.section)+' · 第'+x.verse+'遍 · '+(x.bar+1)+'</th>'+
          x.beats.map(function(t){return '<td>'+esc(t||'—')+'</td>';}).join('')+'</tr>';}).join('')+
        '</tbody></table></div>'+(shown.length>24?'<p>只预览前24个小节，全部'+shown.length+'个小节将在确认后一起写入。</p>':'')+
        (draft.warnings.length?'<div class="whole-warnings"><strong>需要人工核对</strong><ul>'+draft.warnings.map(function(s){return '<li>'+esc(s)+'</li>';}).join('')+'</ul></div>':'');
      preview.hidden=false;
      apply.disabled=false;
      show('已经生成预览，尚未修改你的谱面。请核对唱段行数、换和弦和歌词入点后确认。',false);
    }
    async function click(ev) {
      var button=ev.target.closest('[data-whole-action]');
      if (!button||!box.contains(button)) return;
      ev.preventDefault();
      try {
        if(button.dataset.wholeAction==='file') file.click();
        if(button.dataset.wholeAction==='preview') previewIt();
        if(button.dataset.wholeAction==='apply') {
          if(!draft) throw new Error('请先生成预览。');
          var savedCount=draft.rows;
          root.UKE_LYRICS.mergeDocument(song.id,draft.document);
          // Repopulate the single-bar editor from the newly saved canonical data.
          root.UKE_LYRICS.mount(song,root.UKE_SCORE_PLAYER.refreshSheet);
          root.UKE_SCORE_PLAYER.refreshSheet();
          invalidate();
          show('已把'+savedCount+'个小节写入本机谱面。请逐句校对起唱拍点，并在下方导出歌词备份。',false);
        }
      } catch(err){show('未修改原谱：'+err.message,true);}
    }
    function change(ev) {
      if(ev.target===file) {
        var f=file.files&&file.files[0];
        if(!f) return;
        if(f.size>MAX_FILE){show('文件超过256KB，请使用更短的纯文本歌词。',true);file.value='';return;}
        f.text().then(function(content){
          if(!box.isConnected) return;
          txt.value=content;
          invalidate();
          show('TXT已载入编辑框。点击“自动排版并预览”查看结果。',false);
        }).catch(function(){show('TXT读取失败，原谱未修改。',true);});
        file.value='';
      } else if(ev.target===mode||ev.target===reuse) invalidate();
    }
    function input(ev){if(ev.target===txt) invalidate();}
    box.addEventListener('click',click);box.addEventListener('change',change);
    box.addEventListener('input',input);
    active={panel:box,click:click,change:change,input:input};
  }
  root.UKE_BULK_LYRICS={plan:plan,panel:panel,mount:mount,vocalForm:vocalForm};
})(window);
