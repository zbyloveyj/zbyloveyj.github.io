(function (root) {
  'use strict';

  // User-supplied words only. This module never requests, uploads or ships song lyrics.
  const SCHEMA = 'yixindao.ukulele.lyrics';
  const VERSION = 1;
  const KEY_PREFIX = 'yixindao.ukulele.lyrics.v1.';
  const MAX_BEAT_LENGTH = 40;
  const MAX_IMPORT_BYTES = 256 * 1024;
  const cache = new Map();
  const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const blank = () => ['', '', '', ''];
  let active = null;

  function songFor(value) {
    const id = typeof value === 'string' ? value : value && value.id;
    const song = root.UKE_SCORES && root.UKE_SCORES.songs.find(item => item.id === id);
    if (!song) throw new Error('没有找到这首课内曲目，未修改歌词。');
    return song;
  }

  function record(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + '格式不正确。');
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== null && !(Object.getPrototypeOf(prototype) === null && own(prototype, 'constructor') && prototype.constructor && prototype.constructor.name === 'Object')) {
      throw new Error(label + '必须是普通数据对象。');
    }
    for (const key of Object.keys(value)) if (forbidden.has(key)) throw new Error(label + '含有不允许的字段。');
    return value;
  }

  function sectionFor(song, sectionId) {
    const section = song.sections.find(item => item.id === sectionId);
    if (!section || forbidden.has(sectionId)) throw new Error('歌词含有未知段落，未修改原内容。');
    return section;
  }

  function versesFor(songOrId, sectionId) {
    const song = songFor(songOrId), section = sectionFor(song, sectionId);
    if (['intro', 'interlude', 'outro'].includes(section.role)) return 1;
    return Math.max(1, song.form.reduce((sum, part) => sum + (part.sectionId === sectionId ? (part.repeat || 1) : 0), 0));
  }

  function checkLocation(song, sectionId, barIndex, verse) {
    const section = sectionFor(song, sectionId);
    if (!Number.isInteger(barIndex) || barIndex < 0 || barIndex >= section.bars.length) throw new Error('歌词小节超出这一段的范围。');
    if (!Number.isInteger(verse) || verse < 1 || verse > versesFor(song, sectionId)) throw new Error('歌词遍次超出这首歌的演出顺序。');
    return section;
  }

  function beatsFor(value) {
    if (!Array.isArray(value) || value.length !== 4) throw new Error('每个小节必须恰好有4拍文字；没有歌词的拍子请留空。');
    return value.map(text => {
      if (typeof text !== 'string') throw new Error('每拍歌词必须是文字。');
      if (text.length > MAX_BEAT_LENGTH) throw new Error('每拍最多填写' + MAX_BEAT_LENGTH + '个字符，请按实际拍点分开。');
      if (/[\u0000-\u001f\u007f]/.test(text)) throw new Error('单拍歌词不能包含换行、制表符或控制字符。');
      return text.trim();
    });
  }

  function emptyDocument(song) {
    return {schema: SCHEMA, version: VERSION, songId: song.id, lyrics: {}, repeats: {}};
  }

  function validateRows(value, song, sectionId, verse) {
    record(value, '小节歌词');
    const rows = {};
    for (const key of Object.keys(value)) {
      if (!/^(0|[1-9]\d*)$/.test(key)) throw new Error('歌词小节编号格式不正确。');
      const index = Number(key);
      checkLocation(song, sectionId, index, verse);
      rows[key] = beatsFor(value[key]);
    }
    return rows;
  }

  function validateDocument(value, songOrId) {
    const song = songFor(songOrId);
    record(value, '歌词文件');
    if (Object.keys(value).some(key => !['schema', 'version', 'songId', 'lyrics', 'repeats'].includes(key))) throw new Error('歌词文件含有未知字段。');
    if (!own(value, 'schema') || value.schema !== SCHEMA || !own(value, 'version') || value.version !== VERSION) throw new Error('这不是受支持的歌词备份版本。');
    if (!own(value, 'songId') || value.songId !== song.id) throw new Error('这份歌词属于另一首歌，请先打开对应曲目。');
    if (!own(value, 'lyrics')) throw new Error('歌词文件缺少歌词内容。');
    record(value.lyrics, '歌词内容');
    const result = emptyDocument(song);
    for (const sectionId of Object.keys(value.lyrics)) {
      sectionFor(song, sectionId);
      result.lyrics[sectionId] = validateRows(value.lyrics[sectionId], song, sectionId, 1);
    }
    if (own(value, 'repeats')) {
      record(value.repeats, '不同遍次歌词');
      for (const sectionId of Object.keys(value.repeats)) {
        sectionFor(song, sectionId);
        record(value.repeats[sectionId], '段落遍次');
        result.repeats[sectionId] = {};
        for (const verseKey of Object.keys(value.repeats[sectionId])) {
          if (!/^[2-9]\d*$/.test(verseKey) && !/^1\d+$/.test(verseKey)) throw new Error('第1遍写在lyrics内，其余遍次必须使用有效编号。');
          const verse = Number(verseKey);
          if (!Number.isSafeInteger(verse) || verse > versesFor(song, sectionId)) throw new Error('歌词遍次超出这首歌的演出顺序。');
          result.repeats[sectionId][verseKey] = validateRows(value.repeats[sectionId][verseKey], song, sectionId, verse);
        }
      }
    }
    return result;
  }

  function rowsOf(document) {
    const rows = [];
    for (const sectionId of Object.keys(document.lyrics)) {
      for (const bar of Object.keys(document.lyrics[sectionId])) rows.push({sectionId, barIndex: Number(bar), verse: 1, beats: document.lyrics[sectionId][bar]});
    }
    for (const sectionId of Object.keys(document.repeats || {})) {
      for (const verse of Object.keys(document.repeats[sectionId])) {
        for (const bar of Object.keys(document.repeats[sectionId][verse])) rows.push({sectionId, barIndex: Number(bar), verse: Number(verse), beats: document.repeats[sectionId][verse][bar]});
      }
    }
    return rows;
  }

  function documentRow(document, sectionId, barIndex, verse) {
    const group = verse === 1 ? document.lyrics[sectionId] : document.repeats[sectionId] && document.repeats[sectionId][String(verse)];
    return group && group[String(barIndex)] ? group[String(barIndex)].slice() : blank();
  }

  function setRow(document, sectionId, barIndex, verse, beats) {
    let group;
    if (verse === 1) group = document.lyrics[sectionId] || (document.lyrics[sectionId] = {});
    else {
      const repeats = document.repeats[sectionId] || (document.repeats[sectionId] = {});
      group = repeats[String(verse)] || (repeats[String(verse)] = {});
    }
    if (beats.some(Boolean)) group[String(barIndex)] = beats.slice();
    else delete group[String(barIndex)];
  }

  function readStored(song) {
    let raw;
    try { raw = root.localStorage.getItem(KEY_PREFIX + song.id); }
    catch (_) { throw new Error('浏览器暂时没有开放歌词存储。输入不会上传，请保留原文后重试。'); }
    if (raw == null) return emptyDocument(song);
    try { return validateDocument(JSON.parse(raw), song); }
    catch (_) { throw new Error('本机歌词数据无法读取，原内容没有被覆盖。请先保留已有备份。'); }
  }

  function snapshot(song, force) {
    if (!cache.has(song.id) || force) {
      try { cache.set(song.id, {document: readStored(song), error: ''}); }
      catch (error) { cache.set(song.id, {document: cache.get(song.id)?.document || emptyDocument(song), error: error.message}); }
    }
    return cache.get(song.id);
  }

  function persist(song, document) {
    const checked = validateDocument(document, song);
    try { root.localStorage.setItem(KEY_PREFIX + song.id, JSON.stringify(checked)); }
    catch (_) { throw new Error('没有保存成功：本机存储可能已满或不可用。当前输入仍在，请先复制保留。'); }
    cache.set(song.id, {document: checked, error: ''});
    return JSON.parse(JSON.stringify(checked));
  }

  function getBeats(songId, sectionId, barIndex, verse = 1) {
    const song = songFor(songId);
    checkLocation(song, sectionId, barIndex, verse);
    return documentRow(snapshot(song).document, sectionId, barIndex, verse);
  }

  function exportDocument(songId) {
    const song = songFor(songId), document = readStored(song);
    cache.set(song.id, {document, error: ''});
    return JSON.parse(JSON.stringify(document));
  }

  function saveBeats(songId, sectionId, barIndex, beats, verse = 1) {
    const song = songFor(songId);
    checkLocation(song, sectionId, barIndex, verse);
    const checked = beatsFor(beats), document = readStored(song);
    setRow(document, sectionId, barIndex, verse, checked);
    return persist(song, document);
  }

  function mergeDocument(songId, value) {
    const song = songFor(songId), incoming = validateDocument(value, song);
    const rows = rowsOf(incoming).filter(row => row.beats.some(Boolean));
    if (!rows.length) throw new Error('导入内容全为空，已有歌词保持不变。');
    const document = readStored(song);
    for (const row of rows) setRow(document, row.sectionId, row.barIndex, row.verse, row.beats);
    return persist(song, document);
  }

  function parseText(text, songOrId, sectionId, startBarIndex, verse = 1) {
    const song = songFor(songOrId), section = checkLocation(song, sectionId, startBarIndex, verse);
    if (typeof text !== 'string' || text.length > MAX_IMPORT_BYTES) throw new Error('导入文字过长或格式不正确。');
    const lines = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    if (!lines.length) throw new Error('请先粘贴或选择要导入的歌词。');
    if (startBarIndex + lines.length > section.bars.length) throw new Error('导入行数超过这一段剩余小节；请分段导入。');
    const document = emptyDocument(song);
    lines.forEach((line, offset) => {
      if (!line.trim()) return; // A blank line keeps its bar position and does not clear stored words.
      const parts = line.split(line.includes('\t') ? '\t' : '|');
      if (parts.length !== 4) throw new Error('第' + (offset + 1) + '行需要用3个竖线或制表符分成4拍。');
      const beats = beatsFor(parts);
      if (beats.some(Boolean)) setRow(document, sectionId, startBarIndex + offset, verse, beats);
    });
    if (!rowsOf(document).length) throw new Error('导入内容全为空，已有歌词保持不变。');
    return document;
  }

  function rowHTML(songId, sectionId, barIndex) {
    const song = songFor(songId), section = sectionFor(song, sectionId), verses = versesFor(song, sectionId);
    checkLocation(song, sectionId, barIndex, 1);
    const rows = Array.from({length: verses}, (_, index) => ({verse: index + 1, beats: getBeats(song.id, sectionId, barIndex, index + 1)}));
    const instrumental = ['intro', 'interlude', 'outro'].includes(section.role) && rows.every(row => !row.beats.some(Boolean));
    if (instrumental) return '<div class="score-lyric-row score-lyric-instrumental" data-lyric-row="' + escape(song.id + ':' + sectionId + ':' + barIndex) + '">器乐段 · 不唱</div>';
    const phrase = (section.phrases || []).find(item => barIndex + 1 >= item.from && barIndex + 1 <= item.to);
    const cue = phrase ? phrase.label : section.title.replace(/\s*·.*/, '');
    return '<div class="score-lyric-row" data-lyric-row="' + escape(song.id + ':' + sectionId + ':' + barIndex) + '">' + rows.map(row =>
      row.beats.some(Boolean) ? '<div class="score-lyric-verse" data-lyric-verse="' + row.verse + '"><span class="score-lyric-verse-label">' + (verses > 1 ? '第' + row.verse + '遍' : '歌词') + '</span><div class="score-lyrics-grid" aria-label="第' + row.verse + '遍歌词，按第1至4拍排列">' + row.beats.map((text, index) => '<span class="score-lyric-word' + (text ? '' : ' is-empty') + '" data-lyric-beat="' + index + '" aria-label="第' + (index + 1) + '拍：' + escape(text || '延音或空拍') + '">' + (text ? escape(text) : '&#160;') + '</span>').join('') + '</div></div>' :
      '<div class="score-lyric-verse score-lyric-guide" data-lyric-verse="' + row.verse + '"><span class="score-lyric-verse-label">♫ ' + escape(cue) + (verses > 1 ? ' · 第' + row.verse + '遍' : '') + '</span></div>').join('') + '</div>';
  }

  function renderPanel(songOrId) {
    const song = songFor(songOrId), first = song.sections.find(section => section.role === 'verse') || song.sections[0];
    return '<details class="score-lyrics-editor no-print" id="score-lyrics-editor" data-lyrics-song="' + escape(song.id) + '"><summary><span>添加我的歌词</span><small>逐拍对齐 · 本机保存</small></summary><div class="lyrics-editor-content"><p class="lyrics-intro">添加你已有的歌词；只保存在当前浏览器，可单独备份。同一段的不同遍次可以分别填写，谱面会显示多行唱词。</p><div class="lyrics-location"><label for="lyrics-section">段落<select id="lyrics-section">' + song.sections.map(section => '<option value="' + escape(section.id) + '"' + (section.id === first.id ? ' selected' : '') + '>' + escape(section.title) + '</option>').join('') + '</select></label><label for="lyrics-verse">唱第几遍<select id="lyrics-verse"></select></label><label for="lyrics-bar">小节<select id="lyrics-bar"></select></label></div><p id="lyrics-chord-hint" class="lyrics-chord-hint"></p><div class="lyrics-beat-fields">' + [1, 2, 3, 4].map(beat => '<label for="lyrics-beat-' + beat + '"><span>第' + beat + '拍</span><input id="lyrics-beat-' + beat + '" type="text" data-lyric-input="' + (beat - 1) + '" maxlength="' + MAX_BEAT_LENGTH + '" autocomplete="off" placeholder="这一拍唱的字"></label>').join('') + '</div><p class="lyrics-help">把字放在实际唱入的那一拍；延音可写“—”，不唱可留空。一拍可以写多个字，这里不自动推算原曲旋律或入点。</p><div class="lyrics-actions"><button type="button" class="btn" data-lyrics-action="save">保存这一小节</button><button type="button" class="btn-secondary" data-lyrics-action="clear">清空输入</button><button type="button" class="btn-secondary" data-lyrics-action="reset">恢复已保存</button></div><p id="lyrics-status" class="lyrics-status" role="status" aria-live="polite"></p><details class="lyrics-import-area"><summary>批量添加／恢复歌词备份</summary><p class="lyrics-help">TXT从当前段落、遍次和小节开始，每行对应一个小节，以竖线或制表符分为4拍，例如：<code>第1拍|第2拍|第3拍|第4拍</code>。空白小节不覆盖已有歌词。JSON备份可恢复这首歌的所有段落和遍次。</p><div class="lyrics-import-tools"><label for="lyrics-format">导入格式<select id="lyrics-format"><option value="text">TXT · 一行一小节</option><option value="json">JSON · 本曲歌词备份</option></select></label><button type="button" class="btn-small" data-lyrics-action="file">选择本机文件</button><button type="button" class="btn-small" data-lyrics-action="template">下载空白TXT模板</button><input type="file" id="lyrics-import-file" accept=".json,.txt,application/json,text/plain" hidden></div><label for="lyrics-import-text" class="lyrics-text-label">粘贴歌词或备份内容</label><textarea id="lyrics-import-text" rows="5" spellcheck="false" placeholder="一行对应当前段落的一小节；用 | 分成4拍。"></textarea><button type="button" class="btn-secondary" data-lyrics-action="preview">预览待添加的小节</button><div id="lyrics-import-preview" class="lyrics-import-preview" hidden></div><div class="lyrics-actions"><button type="button" class="btn" id="lyrics-apply-import" data-lyrics-action="apply" hidden>确认添加这些歌词</button></div></details><div class="lyrics-backup"><button type="button" class="btn-small" data-lyrics-action="export">下载本曲歌词备份 JSON</button><p>歌词需单独备份，不包含在原有课程进度或录音ZIP内，也不参与云端同步。</p></div></div></details>';
  }

  function download(fileName, text, type) {
    const blob = new Blob([text], {type}), url = root.URL.createObjectURL(blob), link = root.document.createElement('a');
    link.href = url; link.download = fileName; root.document.body.appendChild(link); link.click(); link.remove();
    root.setTimeout(() => root.URL.revokeObjectURL(url), 1500);
  }

  function unmount() {
    if (!active) return;
    active.panel.removeEventListener('click', active.click);
    active.panel.removeEventListener('change', active.change);
    active.panel.removeEventListener('input', active.input);
    root.removeEventListener('storage', active.storage);
    active = null;
  }

  function openAt(sectionId, barIndex, verse = 1) {
    return active ? active.openAt(sectionId, barIndex, verse) : false;
  }

  function mount(songOrId, onChange) {
    unmount();
    const song = songFor(songOrId), panel = root.document.getElementById('score-lyrics-editor');
    if (!panel || panel.dataset.lyricsSong !== song.id) return;
    const find = id => panel.querySelector('#' + id);
    const sectionSelect = find('lyrics-section'), verseSelect = find('lyrics-verse'), barSelect = find('lyrics-bar');
    const inputs = [1, 2, 3, 4].map(beat => find('lyrics-beat-' + beat));
    const importText = find('lyrics-import-text'), formatSelect = find('lyrics-format'), preview = find('lyrics-import-preview'), apply = find('lyrics-apply-import');
    let location = {sectionId: sectionSelect.value, barIndex: 0, verse: 1}, dirty = false, pending = null, fileGeneration = 0;
    const changed = details => { if (typeof onChange === 'function') onChange({songId: song.id, ...details}); };

    function status(message, state = 'info') {
      const element = find('lyrics-status');
      element.textContent = message; element.dataset.state = state;
    }
    function invalidatePreview() { pending = null; preview.hidden = true; preview.innerHTML = ''; apply.hidden = true; }
    function rebuildSelectors() {
      const section = sectionFor(song, location.sectionId);
      sectionSelect.value = location.sectionId;
      verseSelect.innerHTML = Array.from({length: versesFor(song, section.id)}, (_, index) => '<option value="' + (index + 1) + '">第' + (index + 1) + '遍</option>').join('');
      barSelect.innerHTML = section.bars.map((_, index) => '<option value="' + index + '">第' + (index + 1) + '小节</option>').join('');
      verseSelect.value = String(location.verse); barSelect.value = String(location.barIndex);
    }
    function fillInputs() {
      getBeats(song.id, location.sectionId, location.barIndex, location.verse).forEach((value, index) => { inputs[index].value = value; });
      const section = sectionFor(song, location.sectionId), bar = section.bars[location.barIndex];
      let beat = 1;
      const changes = bar.chords.map(chord => {
        const from = beat; beat += chord.beats;
        return chord.name + '：第' + from + (chord.beats > 1 ? '–' + (beat - 1) : '') + '拍';
      });
      const phrase = (section.phrases || []).find(item => location.barIndex + 1 >= item.from && location.barIndex + 1 <= item.to);
      find('lyrics-chord-hint').textContent = changes.join('　｜　') + (phrase ? '　·　' + phrase.label : '');
      dirty = false;
    }
    function normalStatus() {
      const current = snapshot(song);
      if (current.error) status(current.error, 'error');
      else {
        const count = rowsOf(current.document).filter(row => row.beats.some(Boolean)).length;
        status(count ? '本曲已有' + count + '个小节／遍次的歌词。保存后可直接在谱面查看；请单独下载歌词备份。' : '还没有添加歌词。填好四拍后点击“保存这一小节”，再在谱面跟唱。');
      }
    }
    function makePreview() {
      const text = importText.value;
      if (text.length > MAX_IMPORT_BYTES) throw new Error('导入内容过大，请控制在256 KB以内。');
      let incoming;
      if (formatSelect.value === 'json') {
        let raw;
        try { raw = JSON.parse(text.replace(/^\uFEFF/, '')); }
        catch (_) { throw new Error('JSON内容无法解析，请选择完整的歌词备份文件。'); }
        incoming = validateDocument(raw, song);
      } else incoming = parseText(text, song, location.sectionId, location.barIndex, location.verse);
      const rows = rowsOf(incoming).filter(row => row.beats.some(Boolean));
      if (!rows.length) throw new Error('导入内容全为空，已有歌词保持不变。');
      const current = readStored(song), replaced = rows.filter(row => documentRow(current, row.sectionId, row.barIndex, row.verse).some(Boolean)).length;
      pending = {incoming, text, format: formatSelect.value, location: JSON.stringify(location)};
      preview.innerHTML = '<p><strong>待添加' + rows.length + '个小节／遍次</strong>' + (replaced ? '，其中' + replaced + '个已有歌词，将以预览内容替换。' : '。') + '未列出及空白小节保持原样。</p><div class="lyrics-preview-table-wrap"><table><thead><tr><th>位置</th><th>第1拍</th><th>第2拍</th><th>第3拍</th><th>第4拍</th></tr></thead><tbody>' + rows.map(row => '<tr><th>' + escape(sectionFor(song, row.sectionId).title) + '<small>第' + row.verse + '遍 · 第' + (row.barIndex + 1) + '小节</small></th>' + row.beats.map(text => '<td>' + (text ? escape(text) : '空') + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
      preview.hidden = false; apply.hidden = false;
      status('请核对预览中的段落、遍次、小节和四拍文字，再确认添加。');
    }

    async function click(event) {
      const button = event.target.closest('[data-lyrics-action]');
      if (!button || !panel.contains(button)) return;
      event.preventDefault();
      try {
        switch (button.dataset.lyricsAction) {
          case 'save': {
            saveBeats(song.id, location.sectionId, location.barIndex, inputs.map(input => input.value), location.verse);
            fillInputs();
            status('已保存到本机：第' + location.verse + '遍 · 第' + (location.barIndex + 1) + '小节。歌词已进入谱面，请单独下载备份。', 'success');
            changed({type: 'save', ...location});
            break;
          }
          case 'clear':
            inputs.forEach(input => { input.value = ''; }); dirty = true;
            status('已清空输入；点击保存才会修改谱面。“恢复已保存”可以撤回。');
            break;
          case 'reset':
            snapshot(song, true); fillInputs(); normalStatus();
            break;
          case 'file': find('lyrics-import-file').click(); break;
          case 'template': {
            const count = sectionFor(song, location.sectionId).bars.length - location.barIndex;
            download('ukulele-' + song.id + '-' + location.sectionId + '-verse' + location.verse + '-from' + (location.barIndex + 1) + '.txt', Array.from({length: count}, () => '|||').join('\n') + '\n', 'text/plain;charset=utf-8');
            status('已开始下载空白TXT模板；从当前小节起，一行一小节，保留3个竖线并填入四拍歌词。');
            break;
          }
          case 'preview': invalidatePreview(); makePreview(); break;
          case 'apply': {
            if (!pending || pending.text !== importText.value || pending.format !== formatSelect.value || pending.location !== JSON.stringify(location)) throw new Error('导入内容或位置已变更，请重新预览。');
            const count = rowsOf(pending.incoming).filter(row => row.beats.some(Boolean)).length;
            mergeDocument(song.id, pending.incoming); invalidatePreview();
            if (!dirty) fillInputs();
            status('已保存' + count + '个小节／遍次到本机。' + (dirty ? '当前编辑框尚未保存的输入仍保留。' : '') + '请单独下载歌词备份。', 'success');
            changed({type: 'import'});
            break;
          }
          case 'export':
            download('ukulele-lyrics-' + song.id + '.json', JSON.stringify(exportDocument(song.id), null, 2) + '\n', 'application/json;charset=utf-8');
            status('已开始下载本曲歌词备份；请确认文件保存在设备中。' + (dirty ? '当前编辑框未保存的输入尚未进入备份。' : '')); break;
        }
      } catch (error) { status(error.message || '没有完成，原有歌词保持不变。', 'error'); }
    }

    async function change(event) {
      if ([sectionSelect, verseSelect, barSelect].includes(event.target)) {
        if (dirty) { rebuildSelectors(); status('当前小节还有未保存输入。请先保存，或点“恢复已保存”后再切换。', 'error'); return; }
        const sectionId = sectionSelect.value;
        location = sectionId !== location.sectionId ? {sectionId, barIndex: 0, verse: 1} : {sectionId, barIndex: Number(barSelect.value), verse: Number(verseSelect.value)};
        rebuildSelectors(); fillInputs(); invalidatePreview(); normalStatus();
      } else if (event.target === formatSelect) invalidatePreview();
      else if (event.target === find('lyrics-import-file')) {
        const file = event.target.files && event.target.files[0], generation = ++fileGeneration;
        if (!file) return;
        try {
          if (file.size > MAX_IMPORT_BYTES) throw new Error('歌词文件请控制在256 KB以内。');
          const text = await file.text();
          if (generation !== fileGeneration || !panel.isConnected) return;
          formatSelect.value = /\.json$/i.test(file.name) || file.type === 'application/json' || /^\s*\{/.test(text.replace(/^\uFEFF/, '')) ? 'json' : 'text';
          importText.value = text; invalidatePreview(); makePreview();
        } catch (error) { invalidatePreview(); status(error.message || '未能读取歌词文件。', 'error'); }
        finally { event.target.value = ''; }
      }
    }

    function input(event) {
      if (inputs.includes(event.target)) { dirty = true; status('有未保存输入。点击“保存这一小节”后才会进入谱面。'); }
      else if (event.target === importText) { fileGeneration++; invalidatePreview(); }
    }
    function storage(event) {
      if (event.key !== KEY_PREFIX + song.id) return;
      snapshot(song, true);
      if (!dirty) fillInputs();
      status(dirty ? '另一个页面更新了本曲歌词。当前输入仍保留；保存将更新正在编辑的这一小节。' : '本曲歌词已从另一个页面更新。');
      changed({type: 'storage'});
    }

    function openLocation(sectionId, barIndex, verse = 1) {
      try {
        checkLocation(song, sectionId, barIndex, verse);
        const same = sectionId === location.sectionId && barIndex === location.barIndex && verse === location.verse;
        panel.open = true;
        if (dirty && !same) {
          status('当前小节还有未保存输入。请先保存，或点“恢复已保存”后再切换。', 'error');
          panel.scrollIntoView({behavior: 'smooth', block: 'start'});
          inputs[0].focus({preventScroll: true});
          return false;
        }
        if (!dirty) {
          location = {sectionId, barIndex, verse}; rebuildSelectors(); fillInputs(); invalidatePreview(); normalStatus();
        }
        panel.scrollIntoView({behavior: 'smooth', block: 'start'});
        inputs[0].focus({preventScroll: true});
        return true;
      } catch (error) { status(error.message, 'error'); return false; }
    }

    snapshot(song, true); rebuildSelectors(); fillInputs(); normalStatus();
    panel.addEventListener('click', click); panel.addEventListener('change', change); panel.addEventListener('input', input); root.addEventListener('storage', storage);
    active = {panel, click, change, input, storage, openAt: openLocation};
  }

  root.UKE_LYRICS = {SCHEMA, VERSION, KEY_PREFIX, MAX_BEAT_LENGTH, getBeats, versesFor, rowHTML, renderPanel, mount, unmount, openAt, validateDocument, parseText, exportDocument, saveBeats, mergeDocument};
})(window);
