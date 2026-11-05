#!/usr/bin/env node
'use strict';

// Independent music facts and user-data roundtrips. No browser, audio device,
// copyrighted lyric fixture, network request, or production storage is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const tests = [];
const test = (name, run) => tests.push({name, run});
const plain = value => JSON.parse(JSON.stringify(value));

function storage() {
  const values = new Map();
  return {
    values,
    failWrites: false,
    getItem(key) { return values.has(String(key)) ? values.get(String(key)) : null; },
    setItem(key, value) {
      if (this.failWrites) throw new Error('test storage quota exhausted');
      values.set(String(key), String(value));
    },
    removeItem(key) { values.delete(String(key)); },
    snapshot() { return JSON.stringify([...values]); }
  };
}

function classroom(localStorage = storage()) {
  const sandbox = {
    localStorage,
    addEventListener() {},
    document: {getElementById() { return null; }, querySelectorAll() { return []; }, addEventListener() {}},
    fetch() { throw new Error('Local notation and lyric editing must not make network requests'); },
    setTimeout, clearTimeout, Blob, URL, TextEncoder, TextDecoder
  };
  sandbox.window = sandbox;
  for (const file of ['music-data.js', 'score-data.js', 'score-notation.js', 'score-lyrics.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(root, 'assets', file), 'utf8'), sandbox, {filename: file});
  }
  return {N: sandbox.UKE_NOTATION, L: sandbox.UKE_LYRICS, M: sandbox.UKE_MUSIC, S: sandbox.UKE_SCORES, localStorage};
}

const fullC = {chords: [{name: 'C', beats: 4}]};
const splitCG = {chords: [{name: 'C', beats: 2}, {name: 'G', beats: 2}]};
const notes = rows => rows.map(row => row.notes.map(note => [note.string, note.fret]));
const doc = (lyrics, songId = 'an-jing', repeats = {}) => ({schema: 'yixindao.ukulele.lyrics', version: 1, songId, lyrics, repeats});
const words = ['今日', '轻拨', '琴弦', ''];

test('C chord TAB maps GCEA 0003 onto strings 4, 3, 2, 1 without turning frets into finger numbers', () => {
  const {N} = classroom();
  const rows = plain(N.events(fullC, 'down2'));
  assert.deepEqual(rows.map(row => row.beat), [0, 2]);
  assert.deepEqual(rows.map(row => row.direction), ['D', 'D']);
  assert.deepEqual(notes(rows), [[[4, 0], [3, 0], [2, 0], [1, 3]], [[4, 0], [3, 0], [2, 0], [1, 3]]]);
  assert(rows.every(row => row.kind === 'strum'));
});

test('the visible TAB has exactly four strings labelled A, E, C, G from top to bottom', () => {
  const {N} = classroom();
  const svg = N.barSVG(fullC, 'down4');
  const labels = [...svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)]
    .map(match => ({text: match[2], x: Number(/\bx="([\d.]+)"/.exec(match[1])?.[1]), y: Number(/\by="([\d.]+)"/.exec(match[1])?.[1])}))
    .filter(item => ['A', 'E', 'C', 'G'].includes(item.text) && item.x < 40)
    .sort((a, b) => a.y - b.y);
  assert.deepEqual(labels.map(item => item.text), ['A', 'E', 'C', 'G']);
  const strings = [...svg.matchAll(/<path\b[^>]*\bd="M([\d.]+) ([\d.]+)H([\d.]+)"[^>]*>/g)]
    .filter(match => Number(match[3]) - Number(match[1]) > 100);
  assert.equal(strings.length, 4, 'ukulele TAB must have four full-width horizontal string lines');
});

test('four-note picking changes to G exactly on beat three of a split bar', () => {
  const {N} = classroom();
  const rows = plain(N.events(splitCG, 'pick4'));
  assert.deepEqual(rows.map(row => row.beat), [0, 1, 2, 3]);
  assert.deepEqual(rows.map(row => row.chord), ['C', 'C', 'G', 'G']);
  assert.deepEqual(notes(rows), [[[3, 0]], [[2, 0]], [[1, 2]], [[2, 3]]]);
  assert(rows.every(row => row.kind === 'pluck' && row.direction == null));
});

test('eight-note picking keeps the high G fourth string and every half-beat in the right position', () => {
  const {N} = classroom();
  const rows = plain(N.events(splitCG, 'pick8'));
  assert.deepEqual(rows.map(row => row.beat), [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
  assert.deepEqual(rows.map(row => row.chord), ['C', 'C', 'C', 'C', 'G', 'G', 'G', 'G']);
  assert.deepEqual(notes(rows), [[[3, 0]], [[2, 0]], [[1, 3]], [[2, 0]], [[4, 0]], [[2, 3]], [[1, 2]], [[2, 3]]]);
});

test('island strum leaves beat three silent while the next upstroke already uses the new chord', () => {
  const {N} = classroom();
  const rows = plain(N.events(splitCG, 'island'));
  assert.deepEqual(rows.map(row => row.beat), [0, 1, 1.5, 2.5, 3, 3.5]);
  assert.deepEqual(rows.map(row => row.direction), ['D', 'D', 'U', 'U', 'D', 'U']);
  assert.deepEqual(rows.map(row => row.chord), ['C', 'C', 'C', 'G', 'G', 'G']);
  assert.deepEqual(rows[3].notes.map(note => note.string), [1, 2, 3, 4], 'upstroke runs from A to G');
  assert.deepEqual(rows[4].notes.map(note => note.string), [4, 3, 2, 1], 'downstroke runs from G to A');
  assert.deepEqual(rows[3].notes.map(note => note.fret), [2, 3, 2, 0]);
  const quarters = plain(N.events(fullC, 'down4'));
  assert.deepEqual(quarters.map(row => row.beat), [0, 1, 2, 3]);
});

test('notation rejects unknown harmony, unknown patterns and incomplete or overflowing bars', () => {
  const {N} = classroom();
  for (const [bar, pattern] of [
    [{chords: [{name: 'UnknownChord', beats: 4}]}, 'pick4'],
    [fullC, 'unknown-pattern'],
    [{chords: [{name: 'C', beats: 3}]}, 'pick4'],
    [{chords: [{name: 'C', beats: 5}]}, 'down4'],
    [{chords: [{name: 'C', beats: 0}, {name: 'G', beats: 4}]}, 'pick4']
  ]) assert.throws(() => N.events(bar, pattern));
  const errorHTML = N.barSVG({chords: [{name: 'UnknownChord', beats: 4}]}, 'pick4');
  assert.match(errorHTML, /UnknownChord|和弦/);
  assert(!/<text\b[^>]*>\s*0\s*<\/text>/.test(errorHTML), 'invalid harmony must not silently become open-string notation');
});

test('notation escapes chord labels in SVG attributes, visible text and error messages', () => {
  const {N, M} = classroom();
  const label = 'C<img src=x onerror=alert(1)>';
  M.chords[label] = M.chords.C;
  const svg = N.barSVG({chords: [{name: label, beats: 4}]}, 'pick4');
  assert(!/<img\b/i.test(svg));
  assert.match(svg, /&lt;img/);
  const error = N.barSVG({chords: [{name: '<script>alert(1)</script>', beats: 4}]}, 'pick4');
  assert(!/<script\b/i.test(error));
  assert.match(error, /&lt;script/);
});

test('all published score bars can be rendered with the available patterns and contain only four real strings', () => {
  const {N, S, M} = classroom();
  let count = 0;
  for (const song of S.songs) for (const section of song.sections) for (const bar of section.bars) {
    for (const pattern of Object.keys(M.patterns)) {
      const rows = N.events(bar, pattern);
      assert(rows.length > 0);
      assert(rows.every(row => row.beat >= 0 && row.beat < 4 && row.durationBeats > 0));
      assert(rows.every(row => row.notes.length >= 1 && row.notes.length <= 4));
      assert(rows.every(row => row.notes.every(note => [1, 2, 3, 4].includes(note.string) && Number.isInteger(note.fret) && note.fret >= 0)));
    }
    const svg = N.barSVG(bar, section.pattern || song.defaultPattern);
    assert.match(svg, /<svg\b/);
    assert.match(svg, /role="img"/);
    count++;
  }
  assert(count >= 100, 'check the course corpus, not just a fixture');
});

test('empty lyric slots do not invent words and saved beat positions survive a fresh page context', () => {
  const local = storage(), first = classroom(local);
  assert.deepEqual(plain(first.L.getBeats('an-jing', 'verse', 0)), ['', '', '', '']);
  first.L.saveBeats('an-jing', 'verse', 0, words);
  first.L.saveBeats('qing-tian', 'verse', 0, ['另一首', '', '', '']);
  assert.deepEqual(plain(classroom(local).L.getBeats('an-jing', 'verse', 0)), words);
  assert.deepEqual(plain(classroom(local).L.getBeats('qing-tian', 'verse', 0)), ['另一首', '', '', '']);
  assert.deepEqual(plain(first.L.getBeats('an-jing', 'verse', 1)), ['', '', '', '']);
});

test('JSON lyric backup is a detached copy and roundtrips without changing beat positions or other saved bars', () => {
  const {L} = classroom();
  L.saveBeats('an-jing', 'verse', 0, words);
  L.saveBeats('an-jing', 'verse', 7, ['旧笔记', '', '', '保留']);
  const backup = plain(L.exportDocument('an-jing'));
  const incoming = plain(L.validateDocument(JSON.parse(JSON.stringify(backup)), 'an-jing'));
  backup.lyrics.verse['0'][0] = '外部修改';
  assert.deepEqual(plain(L.getBeats('an-jing', 'verse', 0)), words);
  const restored = classroom();
  restored.L.mergeDocument('an-jing', incoming);
  assert.deepEqual(plain(restored.L.getBeats('an-jing', 'verse', 0)), words);
  assert.deepEqual(plain(restored.L.getBeats('an-jing', 'verse', 7)), ['旧笔记', '', '', '保留']);
  restored.L.mergeDocument('an-jing', doc({verse: {'1': ['让', '拍子', '慢慢', '走']}}));
  assert.deepEqual(plain(restored.L.getBeats('an-jing', 'verse', 0)), words, 'import must not erase another bar');
});

test('different occurrences of a verse keep different lyrics through editing, reload and JSON backup', () => {
  const local = storage(), {L} = classroom(local);
  const second = ['再', '拨一次', '琴弦', ''];
  L.saveBeats('an-jing', 'verse', 0, words, 1);
  L.saveBeats('an-jing', 'verse', 0, second, 2);
  const reloaded = classroom(local);
  assert.deepEqual(plain(reloaded.L.getBeats('an-jing', 'verse', 0, 1)), words);
  assert.deepEqual(plain(reloaded.L.getBeats('an-jing', 'verse', 0, 2)), second);
  const backup = plain(reloaded.L.exportDocument('an-jing'));
  assert.deepEqual(backup.lyrics.verse['0'], words);
  assert.deepEqual(backup.repeats.verse['2']['0'], second);
  const restored = classroom();
  restored.L.mergeDocument('an-jing', backup);
  assert.deepEqual(plain(restored.L.getBeats('an-jing', 'verse', 0, 1)), words);
  assert.deepEqual(plain(restored.L.getBeats('an-jing', 'verse', 0, 2)), second);
  restored.L.saveBeats('an-jing', 'verse', 0, ['', '', '', ''], 2);
  assert.deepEqual(plain(restored.L.getBeats('an-jing', 'verse', 0, 1)), words, 'clearing a second verse must not clear the first');
});

test('TXT import preserves explicit empty beats and starts at the selected zero-based bar', () => {
  const {L} = classroom();
  const incoming = plain(L.parseText('今日|轻拨|琴弦|\n让\t拍子\t慢慢\t走', 'an-jing', 'verse', 1));
  assert.deepEqual(incoming, doc({verse: {'1': words, '2': ['让', '拍子', '慢慢', '走']}}));
  assert.deepEqual(plain(L.getBeats('an-jing', 'verse', 1)), ['', '', '', ''], 'preview must not mutate saved lyrics');
  L.mergeDocument('an-jing', incoming);
  assert.deepEqual(plain(L.getBeats('an-jing', 'verse', 1)), words);
  const secondVerse = plain(L.parseText('再|听一遍|节拍|', 'an-jing', 'verse', 1, 2));
  assert.deepEqual(secondVerse, doc({}, 'an-jing', {verse: {'2': {'1': ['再', '听一遍', '节拍', '']}}}));
  L.mergeDocument('an-jing', secondVerse);
  assert.deepEqual(plain(L.getBeats('an-jing', 'verse', 1, 1)), words);
  assert.deepEqual(plain(L.getBeats('an-jing', 'verse', 1, 2)), ['再', '听一遍', '节拍', '']);
});

test('invalid lyric imports are rejected atomically, including wrong song, section, bar, schema and field lengths', () => {
  const {L, localStorage} = classroom();
  L.saveBeats('an-jing', 'verse', 0, words);
  const before = localStorage.snapshot();
  const invalid = [
    {...doc({}), schema: 'another-format'},
    {...doc({}), version: 2},
    doc({verse: {'0': words}}, 'qing-tian'),
    doc({missing: {'0': words}}),
    doc({verse: {'8': words}}),
    doc({verse: {'-1': words}}),
    doc({verse: {'0': ['a', 'b', 'c']}}),
    doc({verse: {'0': ['x'.repeat(41), '', '', '']}}),
    doc({verse: {'0': ['line\nbreak', '', '', '']}}),
    {...doc({verse: {'0': words}}), unexpected: 'field'},
    JSON.parse('{"schema":"yixindao.ukulele.lyrics","version":1,"songId":"an-jing","lyrics":{"__proto__":{"polluted":true}}}'),
    doc({constructor: {'0': words}}),
    doc({}, 'an-jing', {verse: {'3': {'0': words}}}),
    doc({}, 'an-jing', {intro: {'2': {'0': words}}}),
    doc({}, 'an-jing', {chorus: {'4': {'0': words}}})
  ];
  for (const item of invalid) assert.throws(() => L.mergeDocument('an-jing', item));
  assert.throws(() => L.parseText('one|two|three|four\nfive|six|seven|eight', 'an-jing', 'verse', 7));
  assert.equal(localStorage.snapshot(), before);
  assert.deepEqual(plain(L.getBeats('an-jing', 'verse', 0)), words);
  assert.equal({}.polluted, undefined);
});

test('lyric text is displayed as text, including markup-like content, rather than becoming active HTML', () => {
  const {L} = classroom();
  const text = '<img src=x onerror=alert(1)>';
  L.saveBeats('an-jing', 'verse', 0, [text, 'A&B', '"引号"', ''], 1);
  L.saveBeats('an-jing', 'verse', 0, ['第二遍', '', '', ''], 2);
  const html = L.rowHTML('an-jing', 'verse', 0);
  assert(!/<img\b/i.test(html));
  assert.match(html, /&lt;img/);
  assert.match(html, /A&amp;B/);
  assert.match(html, /第二遍/);
  assert.equal(L.getBeats('an-jing', 'verse', 0, 1)[0], text, 'escape on rendering rather than corrupt the stored text');
});

test('empty imports cannot erase existing lyrics and deliberate single-bar clearing leaves other bars untouched', () => {
  const {L} = classroom();
  L.saveBeats('an-jing', 'verse', 0, words);
  L.saveBeats('an-jing', 'verse', 1, ['保留', '', '', '']);
  assert.throws(() => L.mergeDocument('an-jing', doc({})));
  assert.throws(() => L.mergeDocument('an-jing', doc({verse: {'0': ['', '', '', '']}})));
  assert.throws(() => L.parseText('', 'an-jing', 'verse', 0));
  assert.throws(() => L.parseText('|||', 'an-jing', 'verse', 0));
  assert.deepEqual(plain(L.getBeats('an-jing', 'verse', 0)), words);
  L.saveBeats('an-jing', 'verse', 0, ['', '', '', '']);
  assert.deepEqual(plain(L.getBeats('an-jing', 'verse', 0)), ['', '', '', '']);
  assert.deepEqual(plain(L.getBeats('an-jing', 'verse', 1)), ['保留', '', '', '']);
});

test('storage quota failure leaves both persisted and in-memory lyric data unchanged', () => {
  const local = storage(), {L} = classroom(local);
  L.saveBeats('an-jing', 'verse', 0, words);
  const before = local.snapshot();
  local.failWrites = true;
  assert.throws(() => L.saveBeats('an-jing', 'verse', 0, ['不会保存', '', '', '']));
  assert.equal(local.snapshot(), before);
  assert.deepEqual(plain(L.getBeats('an-jing', 'verse', 0)), words);
  assert.deepEqual(plain(classroom(local).L.getBeats('an-jing', 'verse', 0)), words);
});

(async () => {
  let failed = 0;
  for (const {name, run} of tests) {
    try { await run(); console.log('PASS ' + name); }
    catch (error) { failed++; console.error('FAIL ' + name + '\n' + error.stack); }
  }
  console.log(`\n${tests.length - failed}/${tests.length} notation and lyric-data checks passed.`);
  if (failed) process.exitCode = 1;
})();
