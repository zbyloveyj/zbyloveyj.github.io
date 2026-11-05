#!/usr/bin/env node
'use strict';
/* Deterministic synthetic fixtures test observable DSP behaviour and abstention.
 * They are NOT a substitute for validation on real microphones and playing.
 * Run: node personal-growth-lab/academy/ukulele-lab/tools/test_audio_analysis.cjs
 * Add --performance to scan a full ten-minute, 48 kHz clip as well.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {performance} = require('node:perf_hooks');
const source = path.resolve(__dirname, '../assets/audio-analysis.js');
const A = require(source);
const tests = [];
const test = (name, fn) => tests.push({name, fn});
const near = (actual, expected, tolerance, name) => assert(Math.abs(actual - expected) <= tolerance, `${name}: ${actual} vs ${expected}, tolerance ${tolerance}`);
function random(seed = 91273) { let value = seed >>> 0; return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; }; }
function tone(midi, {seconds = 3, rate = 8000, cents = 0, amplitude = 0.25, harmonics = [1], dc = 0} = {}) {
  const out = new Float32Array(Math.round(seconds * rate)), frequency = A.midiToFrequency(midi) * 2 ** (cents / 1200), norm = harmonics.reduce((s, x) => s + x, 0);
  for (let i = 0; i < out.length; i++) { let v = 0; for (let h = 0; h < harmonics.length; h++) v += harmonics[h] * Math.sin(2 * Math.PI * frequency * (h + 1) * i / rate); out[i] = dc + amplitude * v / norm; }
  return out;
}
function noise({seconds = 8, rate = 8000, amplitude = 0.2, seed = 91421} = {}) { const rng = random(seed), out = new Float32Array(Math.round(seconds * rate)); for (let i = 0; i < out.length; i++) out[i] = (rng() * 2 - 1) * amplitude; return out; }
function pulses(times, {seconds = 16, rate = 8000, noiseBursts = false, amplitude = 0.5} = {}) {
  const out = new Float32Array(Math.round(seconds * rate)), rng = random(4721);
  for (const time of times) {
    const start = Math.round(time * rate);
    for (let j = 0; j < rate * 0.09 && start + j < out.length; j++) {
      const age = j / rate, attack = Math.min(1, age / 0.0015), carrier = noiseBursts ? rng() * 2 - 1 : Math.sin(2 * Math.PI * 650 * age);
      out[start + j] += amplitude * attack * Math.exp(-age / 0.016) * carrier;
    }
  }
  return out;
}
function pulseTimes(bpm, seconds = 16, beatsPerOnset = 1, offset = 0.5) { const out = []; for (let t = offset; t < seconds - 0.1; t += 60 / bpm * beatsPerOnset) out.push(t); return out; }
function chord(midis, {seconds = 4, rate = 8000, harmonics = [1]} = {}) {
  const out = new Float32Array(Math.round(seconds * rate)), norm = harmonics.reduce((s, h) => s + h, 0);
  for (const midi of midis) {
    const frequency = A.midiToFrequency(midi);
    for (let i = 0; i < out.length; i++) for (let h = 0; h < harmonics.length; h++) out[i] += 0.6 / midis.length / norm * harmonics[h] * Math.sin(2 * Math.PI * frequency * (h + 1) * i / rate);
  }
  return out;
}
function joined(...arrays) { const output = new Float32Array(arrays.reduce((s, a) => s + a.length, 0)); let offset = 0; for (const array of arrays) { output.set(array, offset); offset += array.length; } return output; }
function allUnscored(report) { ['quality', 'rhythm', 'pitch', 'chord'].forEach(key => assert.equal(report[key].score, null, key + ' must abstain')); }
function validReport(report) {
  const restored = JSON.parse(JSON.stringify(report)); assert.deepEqual(restored, report, 'report must be JSON safe without NaN/Infinity/undefined');
  for (const part of ['quality', 'rhythm', 'pitch', 'chord']) {
    const p = report[part]; assert(['ok', 'limited', 'unscorable', 'not-applicable'].includes(p.status)); assert(p.reasons.length > 0); assert(p.confidence.value >= 0 && p.confidence.value <= 1); assert.equal(p.confidence.calibratedProbability, false);
    if (p.score !== null) { assert.equal(p.status, 'ok'); assert(p.score >= 0 && p.score <= 100); }
  }
  assert.equal(report.quality.score, null, 'technical recording quality is not musical ability');
  assert(!Object.hasOwn(report, 'score')); assert(!Object.hasOwn(report, 'passed')); assert(!Object.hasOwn(report, 'graduated'));
}

test('UMD API and exact note conversion', () => {
  assert.equal(A.noteToMidi('A4'), 69); assert.equal(A.noteToMidi('C4'), 60); assert.equal(A.noteToMidi('B♭3'), 58); assert.equal(A.noteToMidi('F#4'), 66); assert.equal(A.noteToMidi('unknown'), null);
  near(A.midiToFrequency(69), 440, 0.00001, 'A4'); near(A.frequencyToMidi(440), 69, 0.00001, 'MIDI'); assert(A.SUPPORTED_CHORDS.includes('G7'));
});
test('silence, empty arrays and DC-only sound never produce a score', () => {
  for (const mode of A.MODES) {
    for (const signal of [new Float32Array(16000), new Float32Array(0), new Float32Array(16000).fill(0.3)]) {
      const r = A.analyze(signal, 8000, {mode, targetNote: 'A4', referenceBpm: 60, beatsPerOnset: 1, expectedChord: 'C', isolatedInstrument: true});
      allUnscored(r); validReport(r); assert.equal(r.quality.status, 'unscorable');
    }
  }
});
test('very short and too-quiet recordings abstain rather than return zero/full marks', () => {
  for (const signal of [tone(69, {seconds: 0.12}), tone(69, {amplitude: 0.00003})]) {
    const r = A.analyze(signal, 8000, {mode: 'single-note', targetNote: 'A4'}); allUnscored(r); validReport(r);
  }
});
test('stationary white noise is not a pitch, chord or stable beat', () => {
  const input = noise();
  for (const mode of A.MODES) {
    const r = A.analyze(input, 8000, {mode, targetNote: 'A4', referenceBpm: 60, beatsPerOnset: 1, expectedChord: 'C', isolatedInstrument: true}); allUnscored(r); validReport(r); assert.equal(r.quality.stationaryNoiseLike, true);
  }
});
test('all four GCEA reference tones give the correct octave and small cents error', () => {
  for (const [note, midi] of Object.entries(A.NOTE_TARGETS)) {
    const r = A.analyze(tone(midi), 8000, {mode: 'single-note', targetNote: note}); validReport(r); assert.equal(r.pitch.status, 'ok'); assert.equal(r.pitch.detectedNote, note); near(r.pitch.centsMedian, 0, 5, note + ' cents'); assert(r.pitch.score >= 92); assert(r.pitch.voicedRatio >= 0.95);
  }
});
test('detuning is measured with sign and a lower training score', () => {
  const sharp = A.analyze(tone(69, {cents: 40}), 8000, {mode: 'single-note', targetNote: 'A4'}), flat = A.analyze(tone(69, {cents: -45}), 8000, {mode: 'single-note', targetMidi: 69});
  near(sharp.pitch.centsMedian, 40, 5, 'sharp cents'); near(flat.pitch.centsMedian, -45, 5, 'flat cents'); assert(sharp.pitch.score < 50); assert(flat.pitch.score < 50); assert(sharp.pitch.issueWindows.length > 0); assert(flat.pitch.issueWindows.every(w => w.valueCents < 0)); validReport(sharp); validReport(flat);
});
test('a wrong semitone and a wrong octave remain wrong; no target-biased octave folding', () => {
  const semitone = A.analyze(tone(68), 8000, {mode: 'single-note', targetNote: 'A4'}), octave = A.analyze(tone(57), 8000, {mode: 'single-note', targetNote: 'A4'});
  assert.equal(semitone.pitch.status, 'ok'); assert.equal(octave.pitch.status, 'ok'); near(semitone.pitch.centsMedian, -100, 5, 'semitone'); near(octave.pitch.centsMedian, -1200, 5, 'octave'); assert.equal(semitone.pitch.score, 0); assert.equal(octave.pitch.score, 0); validReport(octave);
});
test('harmonic-rich single notes retain their fundamental or abstain on octave ambiguity', () => {
  const r = A.analyze(tone(60, {harmonics: [1, 0.6, 0.35, 0.2]}), 8000, {mode: 'single-note', targetNote: 'C4'}); assert.equal(r.pitch.status, 'ok'); near(r.pitch.centsMedian, 0, 6, 'harmonic C4');
  const ambiguous = A.analyze(tone(60, {harmonics: [0.08, 1]}), 8000, {mode: 'single-note', targetNote: 'C4'}); assert(ambiguous.pitch.score === null || ambiguous.pitch.detectedNote === 'C4', 'dominant second harmonic must not be silently marked as the intended octave');
});
test('a changing melody cannot be graded as one sustained target note', () => {
  const r = A.analyze(joined(tone(60, {seconds: 1.5}), tone(69, {seconds: 1.5})), 8000, {mode: 'single-note', targetNote: 'C4'}); assert.equal(r.pitch.status, 'unscorable'); assert.equal(r.pitch.score, null); validReport(r);
});
test('without a pitch target, only measured frequency is provided', () => {
  const r = A.analyze(tone(69), 8000, {mode: 'single-note'}); assert.equal(r.pitch.status, 'limited'); assert.equal(r.pitch.score, null); near(r.pitch.medianFrequencyHz, 440, 2, 'targetless A4'); validReport(r);
});
test('44.1 and 48 kHz resampling preserves pitch and duration', () => {
  for (const rate of [44100, 48000]) {
    const r = A.analyze(tone(64, {rate, seconds: 2.5, dc: 0.07}), rate, {mode: 'single-note', targetNote: 'E4'}); assert.equal(r.pitch.status, 'ok'); near(r.pitch.centsMedian, 0, 5, 'resampled E4'); near(r.durationSeconds, 2.5, 0.001, 'duration'); assert.equal(r.quality.status, 'limited'); validReport(r);
  }
});
test('the advertised custom MIDI range does not acquire a high-frequency interpolation bias', () => {
  for (const midi of [36, 48, 76, 81, 84, 88]) { const r = A.analyze(tone(midi, {seconds: 2}), 8000, {mode: 'single-note', targetMidi: midi}); assert.equal(r.pitch.status, 'ok'); near(r.pitch.centsMedian, 0, 5, 'custom MIDI ' + midi); }
});
test('high clipping risk invalidates training analysis while preserving the quality evidence', () => {
  const input = tone(69); for (let i = 0; i < input.length; i++) input[i] = Math.sign(input[i]);
  const r = A.analyze(input, 8000, {mode: 'single-note', targetNote: 'A4'}); assert(r.quality.clippedRatio > 0.99); assert.equal(r.quality.status, 'unscorable'); assert.equal(r.pitch.score, null); validReport(r);
});
test('regular isolated pulses align with explicit BPM and trigger times are observable', () => {
  const times = pulseTimes(60), r = A.analyze(pulses(times), 8000, {mode: 'rhythm', referenceBpm: 60, beatsPerOnset: 1});
  assert.equal(r.rhythm.status, 'ok'); assert(r.rhythm.score >= 95); near(r.rhythm.estimatedPerformanceBpm, 60, 0.6, 'pulse BPM'); assert.equal(r.rhythm.onsetCount, times.length); times.forEach((t, i) => near(r.rhythm.onsetsSeconds[i], t, 0.025, 'onset timestamp'));
  assert.equal(r.rhythm.missingPulseEstimate, 0); assert.equal(r.rhythm.extraPulseEstimate, 0); assert(r.rhythm.grid.meanDeviationMs < 5); validReport(r);
});
test('muted noise bursts may be legitimate rhythm; stationary noise is still rejected', () => {
  const r = A.analyze(pulses(pulseTimes(72), {noiseBursts: true}), 8000, {mode: 'rhythm', referenceBpm: 72, beatsPerOnset: 1}); assert.equal(r.rhythm.status, 'ok'); assert(r.rhythm.score >= 75); near(r.rhythm.estimatedPerformanceBpm, 72, 1.5, 'noise burst pulse'); validReport(r);
});
test('known twice/half-rate mistakes are not normalized into a correct tempo', () => {
  for (const bpm of [30, 120]) {
    const seconds = bpm === 30 ? 20 : 16, r = A.analyze(pulses(pulseTimes(bpm, seconds), {seconds}), 8000, {mode: 'rhythm', referenceBpm: 60, beatsPerOnset: 1}); assert.equal(r.rhythm.status, 'ok'); assert.equal(r.rhythm.tempoRelation, bpm === 30 ? 'half-rate' : 'double-rate'); assert(r.rhythm.score <= 15); near(r.rhythm.estimatedPerformanceBpm, bpm, 0.6, 'no octave-tempo folding'); validReport(r);
  }
});
test('an explicitly selected half-beat or two-beat exercise can correctly match the same BPM', () => {
  for (const beatsPerOnset of [0.5, 2]) {
    const seconds = 20, r = A.analyze(pulses(pulseTimes(60, seconds, beatsPerOnset), {seconds}), 8000, {mode: 'rhythm', referenceBpm: 60, beatsPerOnset}); assert.equal(r.rhythm.status, 'ok'); assert(r.rhythm.score >= 95); near(r.rhythm.estimatedPerformanceBpm, 60, 0.6, 'explicit subdivision');
  }
});
test('unspecified BPM or subdivision yields descriptive pulse metrics without a score', () => {
  const input = pulses(pulseTimes(120));
  for (const config of [{mode: 'rhythm'}, {mode: 'rhythm', referenceBpm: 60}]) { const r = A.analyze(input, 8000, config); assert.equal(r.rhythm.status, 'limited'); assert.equal(r.rhythm.score, null); near(r.rhythm.observedPulseBpm, 120, 0.6, 'observed pulses'); validReport(r); }
});
test('a stable but incorrect non-octave tempo scores below a correct task', () => {
  const r = A.analyze(pulses(pulseTimes(90)), 8000, {mode: 'rhythm', referenceBpm: 60, beatsPerOnset: 1}); assert.equal(r.rhythm.status, 'ok'); assert(r.rhythm.score < 30); assert.equal(r.rhythm.tempoRelation, 'different'); near(r.rhythm.estimatedPerformanceBpm, 90, 1.5, 'incorrect pulse BPM'); validReport(r);
});
test('timing jitter lowers a score and exposes only real, measured replay windows', () => {
  const times = pulseTimes(60).map((t, i) => t + 0.09 * Math.sin(i * 1.8));
  const r = A.analyze(pulses(times), 8000, {mode: 'rhythm', referenceBpm: 60, beatsPerOnset: 1}); assert.equal(r.rhythm.status, 'ok'); assert(r.rhythm.score < 85); assert(r.rhythm.grid.meanDeviationMs > 20); assert(r.rhythm.issueWindows.length > 0);
  for (const window of r.rhythm.issueWindows) { assert(r.rhythm.onsetsSeconds.some(t => Math.abs(t - window.timeSeconds) < 0.002)); assert(window.startSeconds >= 0 && window.endSeconds <= r.durationSeconds); } validReport(r);
});
test('missing and additional pulses cannot cancel each other in the counts', () => {
  const times = pulseTimes(60).filter((_, i) => i !== 7); times.push(3.8); times.sort((a, b) => a - b);
  const r = A.analyze(pulses(times), 8000, {mode: 'rhythm', referenceBpm: 60, beatsPerOnset: 1}); assert.equal(r.rhythm.status, 'ok'); assert(r.rhythm.missingPulseEstimate >= 1); assert(r.rhythm.extraPulseEstimate >= 1); assert(r.rhythm.score < 95); validReport(r);
});
test('unstructured attacks and a sustained tone are not invented beats', () => {
  const rng = random(993), times = []; for (let t = 0.2; t < 15.5; t += 0.15 + rng() * 1.7) times.push(t);
  for (const input of [pulses(times), tone(69, {seconds: 8})]) { const r = A.analyze(input, 8000, {mode: 'rhythm', referenceBpm: 60, beatsPerOnset: 1}); assert.equal(r.rhythm.status, 'unscorable'); assert.equal(r.rhythm.score, null); validReport(r); }
});
test('mixed song mode never becomes singing, chord or graduation scoring', () => {
  const input = pulses(pulseTimes(60)); for (let i = 0; i < input.length; i++) input[i] += 0.07 * Math.sin(2 * Math.PI * 330 * i / 8000);
  const r = A.analyze(input, 8000, {mode: 'mixed', referenceBpm: 60, beatsPerOnset: 1, targetNote: 'E4', expectedChord: 'C', isolatedInstrument: true}); allUnscored(r); assert.equal(r.pitch.status, 'not-applicable'); assert.equal(r.chord.status, 'not-applicable'); assert(r.rhythm.onsetCount >= 8); validReport(r);
});
test('clear isolated C, Am, F, G and G7 harmonies can be identified conservatively', () => {
  const cases = [['C', [60, 64, 67, 72]], ['Am', [57, 60, 64, 69]], ['F', [60, 65, 69]], ['G', [59, 62, 67]], ['G7', [59, 62, 65, 67]]];
  for (const [expectedChord, notes] of cases) { const r = A.analyze(chord(notes), 8000, {mode: 'chord', expectedChord, isolatedInstrument: true}); assert.equal(r.chord.status, 'ok', expectedChord + ': ' + JSON.stringify(r.chord)); assert.equal(r.chord.detectedChord, expectedChord); assert.equal(r.chord.matched, true); assert(r.chord.score >= 90); validReport(r); }
});
test('different isolated chord returns a mismatch without manufacturing the expected chord', () => {
  const r = A.analyze(chord([60, 64, 67]), 8000, {mode: 'chord', expectedChord: 'F', isolatedInstrument: true}); assert.equal(r.chord.status, 'ok'); assert.equal(r.chord.detectedChord, 'C'); assert.equal(r.chord.matched, false); assert(r.chord.score < 50); validReport(r);
});
test('harmonic-rich triad is distinguished from a single harmonic-rich note', () => {
  const config = {mode: 'chord', expectedChord: 'C', isolatedInstrument: true};
  const triad = A.analyze(chord([60, 64, 67], {harmonics: [1, 0.5, 0.25, 0.15]}), 8000, config); assert.equal(triad.chord.status, 'ok'); assert.equal(triad.chord.matched, true);
  const single = A.analyze(tone(60, {seconds: 4, harmonics: [1, 0.8, 0.6, 0.4, 0.25, 0.1]}), 8000, config); assert.equal(single.chord.status, 'unscorable'); assert.equal(single.chord.score, null); validReport(single);
});
test('chord mode requires isolated instrument confirmation and an explicit supported target', () => {
  const input = chord([60, 64, 67]);
  for (const config of [{mode: 'chord', expectedChord: 'C'}, {mode: 'chord', isolatedInstrument: true}, {mode: 'chord', expectedChord: 'H9', isolatedInstrument: true}]) { const r = A.analyze(input, 8000, config); assert.equal(r.chord.status, 'unscorable'); assert.equal(r.chord.score, null); validReport(r); }
});
test('changing chords or two-note fragments do not masquerade as a reliable single chord', () => {
  const input = joined(chord([60, 64, 67], {seconds: 2}), chord([57, 60, 64], {seconds: 2}));
  for (const signal of [input, chord([60, 67])]) { const r = A.analyze(signal, 8000, {mode: 'chord', expectedChord: 'C', isolatedInstrument: true}); assert.equal(r.chord.status, 'unscorable'); assert.equal(r.chord.score, null); validReport(r); }
});
test('input validation rejects non-finite samples and malformed config; input is immutable', () => {
  assert.throws(() => A.analyze(new Float32Array([0, NaN]), 8000), /NaN/); assert.throws(() => A.analyze([], 0), RangeError); assert.throws(() => A.analyze([], 44100, {mode: 'AI'}), RangeError); assert.throws(() => A.analyze([], 8000, {referenceBpm: 0}), RangeError); assert.throws(() => A.analyze([], 8000, {beatsPerOnset: 0}), RangeError); assert.throws(() => A.analyze([], 8000, {targetNote: 'no-note'}), RangeError); assert.throws(() => A.analyze('not pcm', 8000), TypeError);
  const input = tone(69), original = input.slice(); A.analyze(input, 8000, {mode: 'single-note', targetNote: 'A4'}); assert.deepEqual(input, original);
});
test('direct Worker protocol returns reports and recoverable errors without browser APIs', () => {
  let listener, result;
  class WorkerScope { static [Symbol.hasInstance]() { return true; } }
  const sandbox = {Float32Array, Float64Array, Uint32Array, ArrayBuffer, WorkerGlobalScope: WorkerScope, addEventListener: (_, fn) => { listener = fn; }, postMessage: value => { result = value; }};
  vm.runInNewContext(fs.readFileSync(source, 'utf8'), sandbox); assert(sandbox.UKE_AUDIO_ANALYSIS); assert(listener);
  listener({data: {type: 'analyze', id: 'fixture-1', samples: tone(69).buffer, sampleRate: 8000, config: {mode: 'single-note', targetNote: 'A4'}}}); assert.equal(result.type, 'analysis-result'); assert.equal(result.id, 'fixture-1'); assert.equal(result.report.pitch.status, 'ok');
  listener({data: {type: 'analyze', id: 'bad-rate', samples: new Float32Array(4), sampleRate: 0}}); assert.equal(result.type, 'analysis-error'); assert.equal(result.id, 'bad-rate'); assert.equal(result.error.name, 'RangeError');
});
if (process.argv.includes('--performance')) test('ten-minute 48 kHz recording is scanned fully with bounded sparse pitch/chord work', () => {
  const seconds = 600, rate = 48000, input = pulses(pulseTimes(60, seconds), {seconds, rate}), started = performance.now();
  const r = A.analyze(input, rate, {mode: 'rhythm', referenceBpm: 60, beatsPerOnset: 1}), elapsed = performance.now() - started;
  assert.equal(r.durationSeconds, 600); assert.equal(r.analysis.analyzedDurationSeconds, 600); assert.equal(r.analysis.fullClipQualityAndEnvelope, true); assert(r.rhythm.onsetCount >= 590); assert(r.rhythm.onsetsSeconds[r.rhythm.onsetsSeconds.length - 1] > 599); assert(r.rhythm.score >= 90); validReport(r);
  console.log(`  ten-minute fixture: ${elapsed.toFixed(0)} ms; ${r.rhythm.onsetCount} onsets; ${r.quality.spectralFrames} sparse quality spectra`);
});

let failed = 0;
for (const {name, fn} of tests) {
  try { fn(); console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + '\n' + error.stack); }
}
console.log(`\n${tests.length - failed}/${tests.length} audio-analysis fixture tests passed. Synthetic coverage does not establish real-recording accuracy.`);
if (failed) process.exitCode = 1;
