#!/usr/bin/env node
'use strict';
// No browser launch here. Browser/IndexedDB/MediaRecorder behaviour is exercised
// separately in browser_check.py; these are deterministic contract checks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const root = path.resolve(__dirname, '..');
const P = require(path.join(root, 'assets/progress.js'));
const A = require(path.join(root, 'assets/audio-analysis.js'));
const data = {window: {}};
for (const file of ['course-data.js', 'music-data.js', 'score-data.js']) vm.runInNewContext(fs.readFileSync(path.join(root, 'assets', file), 'utf8'), data, {filename: file});
const C = data.window.UKE_COURSE, M = data.window.UKE_MUSIC, S = data.window.UKE_SCORES;
const tests = [];
const test = (name, fn) => tests.push({name, fn});
const near = (actual, expected, tolerance = 1e-7) => assert(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
function tone(midi, seconds = 2) { const samples = new Float32Array(seconds * 8000), hz = A.midiToFrequency(midi); for (let i = 0; i < samples.length; i++) samples[i] = 0.25 * Math.sin(2 * Math.PI * hz * i / 8000); return samples; }
function wav(samples, sampleRate = 8000) {
  const bytes = new Uint8Array(44 + samples.length * 2), view = new DataView(bytes.buffer), text = (at, value) => [...value].forEach((c, i) => { bytes[at + i] = c.charCodeAt(0); });
  text(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(8, 'WAVE'); text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, samples.length * 2, true); samples.forEach((x, i) => view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, x)) * 32767), true));
  return new Blob([bytes], {type: 'audio/wav'});
}
function recordingStore() {
  const sandbox = {Blob, TextEncoder, TextDecoder, Uint8Array, Uint32Array, DataView, crypto: webcrypto, UKE_PROGRESS: P}; sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/recording-store.js'), 'utf8'), sandbox);
  return sandbox.UKE_RECORDINGS;
}
function legacyProgress() {
  const state = P.fresh(), record = P.freshRecord(); record.note = '旧版第29课记录应保持'; record.done = true; record.metrics.minutes = 48;
  for (const key of P.stepKeys(C.lessons[28])) record.tasks[key] = true;
  state.records['29'] = record; state.assessments.sadness = P.freshAssessment(); state.songPlans['an-jing'] = {...P.freshPlan(), version: '已有C指型版本'};
  return state;
}
function item(id, blob, context = {}) {
  return {id, blob, fileName: id + '.wav', label: '合成测试音频', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', duration: 2, context, source: 'uploaded', config: {mode: 'single-note', targetNote: 'C4'}, analysis: A.analyze(tone(60), 8000, {mode: 'single-note', targetNote: 'C4'})};
}
function localZipEntries(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), output = []; let pos = 0;
  while (pos + 30 <= bytes.length && view.getUint32(pos, true) === 0x04034b50) {
    const size = view.getUint32(pos + 18, true), length = view.getUint16(pos + 26, true), extra = view.getUint16(pos + 28, true), start = pos + 30 + length + extra;
    assert.equal(view.getUint16(pos + 8, true), 0, 'portable STORE entry'); assert(start + size <= bytes.length);
    output.push({name: new TextDecoder().decode(bytes.subarray(pos + 30, pos + 30 + length)), nameStart: pos + 30, nameLength: length, start, size}); pos = start + size;
  }
  assert.equal(view.getUint32(pos, true), 0x02014b50, 'standard central directory follows local records');
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50, 'standard end of central directory');
  assert.equal(view.getUint16(bytes.length - 12, true), output.length);
  return output;
}

test('ZIP roundtrip retains actual WAV bytes, reports, contexts and all v1 progress', async () => {
  const store = recordingStore(), state = legacyProgress(), one = item('fixture-c4', wav(tone(60)), {day: 1}), two = item('fixture-mixed', wav(tone(64)), {songId: 'qing-tian', assessmentId: 'qing-tian'});
  two.config = {mode: 'mixed'}; two.analysis = A.analyze(tone(64), 8000, two.config);
  store.keepTemporary(one); store.keepTemporary(two);
  const zip = await store.exportArchive(state), bytes = new Uint8Array(await zip.arrayBuffer()), entries = localZipEntries(bytes);
  assert.deepEqual(entries.map(e => e.name).sort(), ['audio/fixture-c4', 'audio/fixture-mixed', 'manifest.json']);
  const parsed = await store.readArchive(zip); assert.deepEqual(JSON.parse(JSON.stringify(parsed.progress)), P.normalize(state)); assert.equal(parsed.rows.length, 2);
  for (const original of [one, two]) { const restored = parsed.rows.find(r => r.id === original.id); assert(restored.blob instanceof Blob); assert.equal(restored.blob.type, 'audio/wav'); assert.deepEqual(Buffer.from(await restored.blob.arrayBuffer()), Buffer.from(await original.blob.arrayBuffer())); assert.deepEqual(JSON.parse(JSON.stringify(restored.analysis)), original.analysis); assert.deepEqual(JSON.parse(JSON.stringify(restored.context)), original.context); }
  assert.equal(parsed.progress.records['29'].note, '旧版第29课记录应保持'); assert.equal(P.assess(parsed.progress.assessments.sadness).score, null); assert.equal(P.stats(parsed.progress, C, M).graduated, false);
});
test('corrupt audio CRC, invalid archive paths and invalid progress are rejected before restoration', async () => {
  const store = recordingStore(); store.keepTemporary(item('fixture-c4', wav(tone(60)), {day: 1}));
  const zip = await store.exportArchive(legacyProgress()), original = new Uint8Array(await zip.arrayBuffer()), entries = localZipEntries(original), audio = entries.find(e => e.name.startsWith('audio/'));
  const damaged = original.slice(); damaged[audio.start + 50] ^= 0x40; await assert.rejects(store.readArchive(new Blob([damaged])), /校验失败/);
  const traversal = original.slice(); traversal.set(new TextEncoder().encode('../bad'), audio.nameStart); await assert.rejects(store.readArchive(new Blob([traversal])), /文件路径/);
  const invalidState = await store.exportArchive({schema: 99}); await assert.rejects(store.readArchive(invalidState), /进度记录校验/);
  assert.equal((await store.list()).length, 1, 'parsing failures must not delete the existing recording');
});
test('temporary storage fallback keeps a downloadable blob and never claims persistence', async () => {
  const store = recordingStore(), original = item('memory-only', wav(tone(60)));
  await assert.rejects(store.put(original), /没有开放录音存储/);
  store.keepTemporary(original); const found = await store.get(original.id);
  assert.equal(found.persisted, false); assert.equal(found.blob.size, original.blob.size); assert.equal((await store.list()).length, 1);
  const metadata = store.metadata(found); assert(!Object.hasOwn(metadata, 'blob')); assert.equal(metadata.size, original.blob.size); assert.equal(metadata.mimeType, 'audio/wav');
});
test('recording metadata validation prevents unsupported lesson contexts and empty audio', async () => {
  const store = recordingStore(), valid = item('good-id', wav(tone(60)));
  for (const [patch, message] of [[{id: '../other'}, /编号/], [{blob: new Blob([])}, /文件/], [{duration: 900}, /时长/], [{context: {day: 31}}, /课次/], [{context: {songId: 'other-song'}}, /曲目/], [{createdAt: 'not-a-date'}, /时间/]]) await assert.rejects(store.put({...valid, ...patch}), message);
});
test('audio reports and attached evidence cannot manufacture course completion', () => {
  const state = legacyProgress(), report = A.analyze(tone(60), 8000, {mode: 'single-note', targetNote: 'C4'}); assert(report.pitch.score >= 90);
  const assessed = P.freshAssessment(); assessed.evidence = '录音库：fixture-c4.wav'; assessed.analysis = report;
  assert.equal(P.assess(assessed).score, null); assert.equal(P.assess(assessed).passed, false);
  for (const id of P.SONG_IDS) state.assessments[id] = assessed;
  assert.equal(P.stats(state, C, M).graduated, false);
  const newer = P.fresh(); newer.records['1'] = {...P.freshRecord(), evidence: '录音库：fixture-c4.wav'};
  const merged = P.merge(state, newer); assert.equal(merged.records['29'].note, state.records['29'].note); assert.equal(P.lessonDone(C.lessons[0], merged.records['1']), false);
});

async function playerRun(songId, sectionId, override, capo = 0) {
  const events = [], handlers = {}, fields = {'score-bpm': {value: '120'}, 'score-section': {value: sectionId}, 'score-pattern': {value: override}, 'score-capo': {value: String(capo)}, 'score-loop': {checked: false}, 'score-follow': {checked: false}, 'score-play-status': {textContent: ''}};
  let audio, tick;
  class AudioContext {
    constructor() { this.currentTime = 0; this.destination = {}; audio = this; }
    async resume() {}
    createGain() { return {level: 0, gain: {setValueAtTime() {}, linearRampToValueAtTime(value) { this.level = value; }, exponentialRampToValueAtTime() {}}, connect() { return this; }, disconnect() {}}; }
    createOscillator() { return {frequency: {value: 0}, connect(gain) { this.connected = gain; return gain; }, start(time) { events.push({time, frequency: this.frequency.value, level: this.connected.gain.level}); }, stop() {}}; }
  }
  const sandbox = {AudioContext, UKE_MUSIC: M, UKE_SCORES: S, UKE_APP: {stopSounds() {}}, UKE_STUDIO: {hasUnsaved: () => false}, setInterval: fn => { tick = fn; return 1; }, clearInterval() {}, requestAnimationFrame: () => 1, cancelAnimationFrame() {}, addEventListener() {}, document: {getElementById: id => fields[id], querySelectorAll: () => [], querySelector: () => null, addEventListener: (type, fn) => { handlers[type] = fn; }}};
  sandbox.window = sandbox; vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/score-player.js'), 'utf8'), sandbox);
  sandbox.UKE_SCORE_PLAYER.mount(songId); handlers.click({target: {closest: () => ({dataset: {sheet: 'play'}})}, preventDefault() {}});
  await new Promise(resolve => setImmediate(resolve)); assert(audio && tick, 'actual player scheduled audio');
  const song = S.songs.find(s => s.id === songId), parts = sectionId === 'all' ? song.form : [{sectionId, repeat: 1}];
  const expanded = parts.flatMap(part => Array.from({length: part.repeat}, () => song.sections.find(s => s.id === part.sectionId)).flatMap(s => s.bars.map(bar => ({bar, pattern: override === 'auto' ? s.pattern : override}))));
  for (let t = 0; t <= 0.12 + (4 + expanded.length * 4) * 0.5 + 0.2; t += 0.04) { audio.currentTime = t; tick(); }
  const expected = [];
  expanded.forEach(({bar, pattern}, index) => {
    const p = M.patterns[pattern], chordAt = offset => { let count = 0; for (const chord of bar.chords) { count += chord.beats; if (offset < count) return chord.name; } throw Error('offset outside bar'); };
    const add = (offset, string, spread = 0) => { const c = M.chords[chordAt(offset)], midi = [67, 60, 64, 69][4 - string] + c.frets[4 - string] + capo; expected.push({time: 0.12 + (4 + index * 4 + offset) * 0.5 + spread, frequency: 440 * 2 ** ((midi - 69) / 12)}); };
    if (p.kind === 'strum') p.steps.forEach((step, i) => { if (step) (step === 'U' ? [1, 2, 3, 4] : [4, 3, 2, 1]).forEach((string, n) => add(i / 2, string, n * 0.009)); });
    else p.strings.forEach((string, i) => add(i * 4 / p.strings.length, string));
  });
  const notes = events.filter(e => Math.abs(e.level - 0.055) < 1e-9), clicks = events.filter(e => Math.abs(e.level - 0.018) < 1e-9);
  assert.equal(notes.length, expected.length); assert.equal(clicks.length, 4 + expanded.length * 4, 'count-in plus all quarter-note clicks');
  expected.forEach((n, i) => { near(notes[i].time, n.time); near(notes[i].frequency, n.frequency); });
  return {bars: expanded.length, notes: notes.length};
}
test('score player plays the actual half-bar chord changes and capo pitch', async () => { const r = await playerRun('qing-tian', 'verse', 'down2', 2); assert.equal(r.bars, 8); assert.equal(r.notes, 64); });
test('fingerpicking changes harmony at beat three within a split bar', async () => { const r = await playerRun('an-jing', 'verse', 'pick4'); assert.equal(r.bars, 8); assert.equal(r.notes, 32); });
test('full-form player retains every reprise and outro rather than only unique sections', async () => { for (const [id, count] of [['an-jing', 90], ['qing-tian', 85], ['sadness', 92]]) assert.equal((await playerRun(id, 'all', 'auto')).bars, count); });
test('public classroom cloud entry has a real HTTPS destination and makes no API requests', async () => {
  let requests = 0;
  const sandbox = {setTimeout: fn => { fn(); return 1; }, clearTimeout() {}, fetch() { requests++; throw new Error('public mode must not call a private API'); }, addEventListener() {}, document: {readyState: 'complete', addEventListener() {}, querySelectorAll: () => [], querySelector: () => null}}; sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/cloud-config.js'), 'utf8'), sandbox); const origin = new URL(sandbox.UKE_CLOUD_CONFIG.origin); assert.equal(origin.protocol, 'https:'); assert(origin.hostname.endsWith('.chatgpt.site')); assert.equal(sandbox.UKE_CLOUD_CONFIG.mode, 'public');
  vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/cloud.js'), 'utf8'), sandbox); assert.equal(sandbox.UKE_CLOUD.isCloud, false); await sandbox.UKE_CLOUD.syncAll(); await sandbox.UKE_CLOUD.deleteRecording('anything');
  const page = sandbox.UKE_CLOUD.accountView(); assert(page.includes(origin.origin + '/classroom/#/account')); assert(!page.includes('href="#"')); assert.equal(requests, 0);
});

(async () => {
  let failed = 0;
  for (const {name, fn} of tests) { try { await fn(); console.log('PASS ' + name); } catch (error) { failed++; console.error('FAIL ' + name + '\n' + error.stack); } }
  console.log(`\n${tests.length - failed}/${tests.length} v2 contract checks passed. Actual browser media/storage checks run in GitHub Actions.`);
  if (failed) process.exitCode = 1;
})();
