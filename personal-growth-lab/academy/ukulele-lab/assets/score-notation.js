(function (root) {
  'use strict';

  // The note positions below are generated from this course's chord shapes and
  // accompaniment patterns. They do not transcribe a song melody or a recording.
  // A ukulele TAB has four lines: A / E / C / G from the top, strings 1 / 2 / 3 / 4.
  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g,
    char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
  const WIDTH = 400, HEIGHT = 190, FIRST = 64, BEAT_WIDTH = 80;
  const STRING_Y = [60, 80, 100, 120];
  const BEAT_LABELS = ['1', '&', '2', '&', '3', '&', '4', '&'];

  function music() {
    if (!root.UKE_MUSIC || !root.UKE_MUSIC.chords || !root.UKE_MUSIC.patterns) {
      throw new TypeError('和弦与节奏资料尚未载入，请刷新后重试。');
    }
    return root.UKE_MUSIC;
  }

  function patternFor(id) {
    const source = music().patterns;
    if (!own(source, id)) throw new TypeError('未找到伴奏节奏：' + String(id));
    const pattern = source[id];
    if (pattern.kind === 'strum') {
      if (!Array.isArray(pattern.steps) || pattern.steps.length !== 8 ||
          pattern.steps.some(step => !['D', 'U', ''].includes(step))) {
        throw new TypeError('扫弦谱需要完整的八分拍格。');
      }
    } else if (pattern.kind === 'pick') {
      if (!Array.isArray(pattern.strings) || ![4, 8].includes(pattern.strings.length) ||
          pattern.strings.some(string => !Number.isInteger(string) || string < 1 || string > 4)) {
        throw new TypeError('分解谱需要有效的四拍或八分拍拨弦顺序。');
      }
    } else {
      throw new TypeError('尚不支持这种伴奏节奏。');
    }
    return pattern;
  }

  function chordChanges(bar) {
    if (!bar || !Array.isArray(bar.chords) || !bar.chords.length) {
      throw new TypeError('这一小节缺少和弦。');
    }
    const source = music().chords;
    let beat = 0;
    const changes = bar.chords.map(chord => {
      if (!chord || typeof chord.name !== 'string' || !own(source, chord.name)) {
        throw new TypeError('未找到和弦指型：' + String(chord && chord.name));
      }
      if (typeof chord.beats !== 'number' || !Number.isFinite(chord.beats) || chord.beats <= 0) {
        throw new TypeError('和弦持续拍数必须大于零。');
      }
      const frets = source[chord.name].frets;
      if (!Array.isArray(frets) || frets.length !== 4 ||
          frets.some(fret => !Number.isInteger(fret) || fret < 0 || fret > 24)) {
        throw new TypeError('和弦指型缺少有效的四根弦品位：' + chord.name);
      }
      const result = {name: chord.name, beat, beats: chord.beats, frets};
      beat += chord.beats;
      return result;
    });
    if (Math.abs(beat - 4) > 1e-7) throw new TypeError('每小节的和弦拍数应合计为四拍。');
    return changes;
  }

  function chordAt(changes, beat) {
    const chord = changes.find(item => beat >= item.beat - 1e-8 && beat < item.beat + item.beats - 1e-8);
    if (!chord) throw new TypeError('无法确定这个拍点的和弦。');
    return chord;
  }

  /**
   * Pure, fresh event data; only attacks are returned, never silent hand swings.
   * beat is a zero-based quarter-note offset in one 4/4 bar.
   * notes follow the sounding order: D = strings 4→1, U = strings 1→4.
   * durationBeats is the distance to the next attack (or bar end), not a claim
   * about a synthesized or real string's sustain time.
   */
  function events(bar, patternId = 'down4') {
    const changes = chordChanges(bar), pattern = patternFor(patternId), output = [];
    function add(beat, kind, strings, direction) {
      const chord = chordAt(changes, beat);
      output.push({beat, kind, chord: chord.name, direction,
        notes: strings.map(string => ({string, fret: chord.frets[4 - string]}))});
    }
    if (pattern.kind === 'strum') {
      pattern.steps.forEach((direction, index) => {
        if (direction) add(index / 2, 'strum', direction === 'D' ? [4, 3, 2, 1] : [1, 2, 3, 4], direction);
      });
    } else {
      pattern.strings.forEach((string, index) => add(index * 4 / pattern.strings.length, 'pluck', [string], null));
    }
    return output.map((event, index) => ({...event,
      durationBeats: (output[index + 1] ? output[index + 1].beat : 4) - event.beat}));
  }

  function beatName(beat) {
    const whole = Math.floor(beat) + 1;
    return Number.isInteger(beat) ? '第' + whole + '拍' : '第' + whole + '拍后半拍';
  }

  function description(bar, patternId, played) {
    const pattern = patternFor(patternId);
    const intro = (pattern.kind === 'pick' ? '分解伴奏四线谱' : '弹唱扫弦四线谱') +
      '。自上而下为A第1弦、E第2弦、C第3弦、G第4弦；数字为品位，0为空弦。';
    const changes = chordChanges(bar).map(chord => beatName(chord.beat) + '换到' + chord.name + '，保持' + chord.beats + '拍。').join('');
    const notes = played.map(event => beatName(event.beat) + '：' + event.chord +
      (event.kind === 'strum' ? (event.direction === 'D' ? '下扫' : '上扫') : '分解拨弦') + '，' +
      event.notes.map(note => '第' + note.string + '弦' + note.fret + '品').join('、') + '。').join('');
    const air = pattern.kind === 'strum' ? pattern.steps.map((step, index) =>
      step ? '' : beatName(index / 2) + '为空扫，不触弦。').join('') : '';
    return intro + changes + notes + air;
  }

  function digit(note, x) {
    const y = STRING_Y[note.string - 1], width = String(note.fret).length > 1 ? 26 : 20;
    return '<g class="uke-tab-note" data-string="' + note.string + '" data-fret="' + note.fret + '">' +
      '<rect x="' + (x - width / 2) + '" y="' + (y - 10) + '" width="' + width + '" height="20" rx="2" fill="var(--score-paper, #fffef8)"/>' +
      '<text x="' + x + '" y="' + (y + 6) + '" text-anchor="middle" font-size="18" font-weight="600" fill="#294b3c">' + note.fret + '</text></g>';
  }

  function airArrow(x, down) {
    const tipY = down ? 151 : 138, startY = down ? 138 : 151, wingY = down ? 147 : 142;
    return '<g class="uke-tab-air" aria-hidden="true" stroke="#a1ac9c" fill="none" stroke-width="1.2">' +
      '<path d="M' + x + ' ' + startY + 'V' + tipY + '" stroke-dasharray="2 2"/>' +
      '<path d="M' + (x - 3) + ' ' + wingY + 'L' + x + ' ' + tipY + 'L' + (x + 3) + ' ' + wingY + '"/>' +
      '</g><text x="' + x + '" y="164" text-anchor="middle" font-size="9" fill="#909c87">空</text>';
  }

  function barSVG(bar, patternId = 'down4') {
    try {
      const changes = chordChanges(bar), pattern = patternFor(patternId), played = events(bar, patternId);
      const label = description(bar, patternId, played);
      const chordLabels = changes.map(chord => {
        const x = FIRST + chord.beat * BEAT_WIDTH;
        return '<g class="uke-tab-chord" data-beat="' + chord.beat + '">' +
          '<text x="' + x + '" y="23" font-size="21" font-weight="650" fill="#285441">' + escape(chord.name) + '</text>' +
          '<text x="' + x + '" y="38" font-size="9" fill="#7a8975">' + chord.beats + '拍</text>' +
          (chord.beat > 0 ? '<path d="M' + x + ' 44V128" stroke="#c5cfc1" stroke-width="1" stroke-dasharray="2 4"/>' : '') + '</g>';
      }).join('');
      const staff = STRING_Y.map((y, index) => '<g class="uke-tab-string" data-string="' + (index + 1) + '">' +
        '<text x="13" y="' + (y + 4) + '" font-size="12" fill="#5e7160">' + ['A', 'E', 'C', 'G'][index] + '</text>' +
        '<text x="28" y="' + (y + 3) + '" font-size="8" fill="#8b9884">' + (index + 1) + '</text>' +
        '<path d="M42 ' + y + 'H384" stroke="#97a794" stroke-width="1"/></g>').join('') +
        '<path d="M42 60V120M384 60V120" stroke="#768d79" stroke-width="1.2"/>';
      const sounding = played.map(event => {
        const x = FIRST + event.beat * BEAT_WIDTH;
        return '<g class="uke-tab-event" data-beat="' + event.beat + '" data-kind="' + event.kind + '" data-chord="' + escape(event.chord) + '">' +
          event.notes.map(note => digit(note, x)).join('') +
          (event.kind === 'strum' ? '<text x="' + x + '" y="153" text-anchor="middle" font-size="24" font-weight="600" fill="#496e52">' + (event.direction === 'D' ? '↓' : '↑') + '</text>' :
            '<text x="' + x + '" y="151" text-anchor="middle" font-size="10" fill="#72836a">' + event.notes[0].string + '弦</text>') + '</g>';
      }).join('');
      const silent = pattern.kind === 'strum' ? pattern.steps.map((step, index) =>
        step ? '' : airArrow(FIRST + index * BEAT_WIDTH / 2, index % 2 === 0)).join('') : '';
      const counts = BEAT_LABELS.map((count, index) => '<text x="' + (FIRST + index * BEAT_WIDTH / 2) +
        '" y="181" text-anchor="middle" font-size="' + (index % 2 ? '10' : '12') + '" font-weight="' + (index % 2 ? '400' : '650') +
        '" fill="' + (index % 2 ? '#a0aa97' : '#66795c') + '">' + escape(count) + '</text>').join('');
      return '<svg class="score-tab" viewBox="0 0 ' + WIDTH + ' ' + HEIGHT + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + escape(label) +
        '" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" data-pattern="' + escape(patternId) + '">' +
        '<title>' + escape(label) + '</title>' + chordLabels + staff + sounding + silent +
        '<g class="uke-tab-counts" aria-hidden="true">' + counts + '</g></svg>';
    } catch (error) {
      return '<p class="score-notation-error" role="status">这小节暂时无法显示：' + escape(error.message) + '</p>';
    }
  }

  function legend(patternId = 'down4') {
    const pattern = patternFor(patternId);
    const common = '四线谱从上到下为 A、E、C、G（第1→4弦）。数字是品位，0为空弦；夹变调夹时从夹子起算。';
    if (pattern.kind === 'pick') {
      return common + '本段为分解伴奏：按' + pattern.strings.join('→') + '弦顺序拨弦，' +
        (pattern.strings.length === 4 ? '每拍一音。' : '每半拍一音。') +
        '同一列的和弦、品位与下方歌词对应同一个拍点；这是和弦分解，不是歌曲主旋律。';
    }
    return common + '↓为下扫（第4→1弦），↑为上扫（第1→4弦）；标“空”的浅色箭头只摆动，不触弦。' +
      '按1 & 2 & 3 & 4 &数八格，换和弦以顶部标记为准。箭头表示手的扫弦方向。';
  }

  root.UKE_NOTATION = {barSVG, legend, events};
})(typeof window !== 'undefined' ? window : globalThis);
