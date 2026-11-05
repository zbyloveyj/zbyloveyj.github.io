/*
 * Local, explainable practice analysis. No model, network, DOM, or course state.
 * UMD: UKE_AUDIO_ANALYSIS.analyze(monoFloat32, sampleRate, config).
 * A Worker may load this file directly. Post {type:'analyze',id,samples,
 * sampleRate,config}; receive {type:'analysis-result',id,report} or an error.
 *
 * status: ok | limited | unscorable | not-applicable. score:null means no score.
 * Confidence is an engineering quality indicator, NOT a calibrated probability.
 * There is deliberately no overall score, pass flag, or graduation API.
 *
 * Pitch: cumulative mean normalized difference / parabolic interpolation,
 * following the YIN method (de Cheveigne & Kawahara, 2002):
 * https://doi.org/10.1121/1.1458024
 * https://labrosa.ee.columbia.edu/doc/yin.html
 * Onsets: positive changes in short-time RMS / high-pass RMS, adaptive peaks.
 * This lightweight detector is NOT a beat tracker or source separator.
 * Onset limitations and alternatives: Dixon, Onset Detection Revisited (2006),
 * https://www.dafx.de/paper-archive/details/_kscRgr98aSFW4l-j1YJuA
 * Chords: sparse Hann spectra, harmonic-suppressed peaks, pitch-class templates.
 * Similarity does not establish fingering, inversion, clean strings or melody.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.UKE_AUDIO_ANALYSIS = api;
  if (typeof WorkerGlobalScope !== 'undefined' && root instanceof WorkerGlobalScope) {
    root.addEventListener('message', function (event) {
      const m = event.data || {};
      if (m.type !== 'analyze') return;
      try {
        const samples = m.samples instanceof ArrayBuffer ? new Float32Array(m.samples) : m.samples;
        root.postMessage({type: 'analysis-result', id: m.id, report: api.analyze(samples, m.sampleRate, m.config)});
      } catch (err) {
        root.postMessage({type: 'analysis-error', id: m.id, error: {name: err.name, message: err.message}});
      }
    });
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ENGINE_VERSION = '1.0.0';
  const MODES = ['mixed', 'rhythm', 'single-note', 'chord'];
  const PC_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  const NOTE_TARGETS = Object.freeze({G4: 67, C4: 60, E4: 64, A4: 69});
  const LIMIT_SECONDS = 600;
  const ANALYSIS_RATE = 8000;
  const CHORD_TYPES = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], dim: [0, 3, 6], sus2: [0, 2, 7], sus4: [0, 5, 7] };
  const CHORD_TEMPLATES = [];
  Object.keys(CHORD_TYPES).forEach(type => {
    for (let root = 0; root < 12; root++) {
      const pcs = CHORD_TYPES[type].map(x => (x + root) % 12), vector = new Array(12).fill(0);
      pcs.forEach(pc => { vector[pc] = 1 / Math.sqrt(pcs.length); });
      CHORD_TEMPLATES.push({name: PC_NAMES[root] + type, root, type, pitchClasses: pcs, vector});
    }
  });
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const round = (n, digits = 3) => Number.isFinite(n) ? (Math.round(n * 10 ** digits) / 10 ** digits || 0) : null;
  const db = x => round(20 * Math.log10(Math.max(1e-6, x)), 2);
  const mean = xs => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
  const quantile = (xs, q) => {
    if (!xs.length) return null;
    const a = Array.from(xs).sort((x, y) => x - y), p = (a.length - 1) * q, i = Math.floor(p);
    return a[i] + (a[Math.min(i + 1, a.length - 1)] - a[i]) * (p - i);
  };
  const median = xs => quantile(xs, 0.5);
  const mad = xs => { const m = median(xs); return m === null ? null : median(xs.map(x => Math.abs(x - m))); };
  const midiToFrequency = midi => 440 * 2 ** ((midi - 69) / 12);
  const frequencyToMidi = hz => 69 + 12 * Math.log2(hz / 440);
  function noteToMidi(note) {
    if (typeof note !== 'string') return null;
    const m = /^([A-Ga-g])([#b♯♭]?)(-?\d)$/.exec(note.trim());
    if (!m) return null;
    const base = {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11}[m[1].toUpperCase()];
    return (Number(m[3]) + 1) * 12 + base + (m[2] === '#' || m[2] === '♯' ? 1 : m[2] ? -1 : 0);
  }
  const midiName = midi => PC_NAMES[((Math.round(midi) % 12) + 12) % 12] + (Math.floor(Math.round(midi) / 12) - 1);
  function confidence(value, basis) {
    value = clamp(value || 0, 0, 1);
    return {level: value >= 0.85 ? 'high' : value >= 0.65 ? 'medium' : value > 0 ? 'low' : 'none', value: round(value), basis, calibratedProbability: false};
  }
  function section(status, reasons, metrics) {
    return Object.assign({status, reasons: reasons || [], confidence: confidence(0, '证据不足，尚不能可靠比较。'), score: null, scoreLabel: '训练参考分'}, metrics || {});
  }
  function unavailable(reason, metrics) { return section('unscorable', [reason], metrics); }
  function notApplicable(reason) { return section('not-applicable', [reason]); }
  function chordFromName(name) {
    if (typeof name !== 'string') return null;
    const m = /^([A-G])([#b♯♭]?)(maj7|m7|sus2|sus4|dim|m|7)?$/.exec(name.trim());
    if (!m) return null;
    let root = {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11}[m[1]];
    root = (root + (m[2] === '#' || m[2] === '♯' ? 1 : m[2] ? -1 : 0) + 12) % 12;
    return CHORD_TEMPLATES.find(c => c.root === root && c.type === (m[3] || ''));
  }
  function parseConfig(config) {
    if (config == null) config = {};
    if (typeof config !== 'object' || Array.isArray(config)) throw new TypeError('分析设置必须是对象。');
    const c = Object.assign({mode: 'mixed'}, config);
    if (!MODES.includes(c.mode)) throw new RangeError('未知的练习模式。');
    if (c.referenceBpm != null && (!Number.isFinite(c.referenceBpm) || c.referenceBpm < 30 || c.referenceBpm > 240)) throw new RangeError('参考速度必须为30–240 BPM。');
    if (c.beatsPerOnset != null && ![0.5, 1, 2, 4].includes(c.beatsPerOnset)) throw new RangeError('每次触弦间隔只支持0.5、1、2或4拍。');
    if (c.targetMidi == null && c.targetNote != null) c.targetMidi = noteToMidi(c.targetNote);
    if ((c.targetNote != null || c.targetMidi != null) && (!Number.isFinite(c.targetMidi) || c.targetMidi < 36 || c.targetMidi > 88)) throw new RangeError('单音目标必须为C2–E6内的有效音名或MIDI音高。');
    return c;
  }

  // Full-clip quality scan. A DC-only waveform is not treated as usable sound.
  function scan(samples, sampleRate) {
    let sum = 0, squares = 0, peak = 0, nearFull = 0;
    for (let i = 0; i < samples.length; i++) {
      const x = samples[i];
      if (!Number.isFinite(x)) throw new TypeError('音频包含NaN或无穷采样，无法分析。');
      sum += x; squares += x * x; peak = Math.max(peak, Math.abs(x));
      if (Math.abs(x) >= 0.995) nearFull++;
    }
    const dc = samples.length ? sum / samples.length : 0;
    return {durationSeconds: samples.length / sampleRate, dc, rms: Math.sqrt(Math.max(0, squares / Math.max(1, samples.length) - dc * dc)), peak, clippedRatio: nearFull / Math.max(1, samples.length)};
  }
  // Two low-pass biquads before linear rate conversion; bounded memory at 8 kHz.
  // Filtering scans the entire clip. No section is silently omitted.
  function resample(samples, sampleRate, dc) {
    if (sampleRate === ANALYSIS_RATE) {
      const out = new Float32Array(samples.length);
      for (let i = 0; i < samples.length; i++) out[i] = samples[i] - dc;
      return out;
    }
    const length = Math.max(1, Math.floor(samples.length * ANALYSIS_RATE / sampleRate)), out = new Float32Array(length);
    const omega = 2 * Math.PI * 3200 / sampleRate, cs = Math.cos(omega), sn = Math.sin(omega);
    const coeff = q => { const alpha = sn / (2 * q), a0 = 1 + alpha; return [(1 - cs) / 2 / a0, (1 - cs) / a0, (1 - cs) / 2 / a0, -2 * cs / a0, (1 - alpha) / a0]; };
    const a = coeff(0.5411961), b = coeff(1.306563), step = sampleRate / ANALYSIS_RATE;
    let ax1 = 0, ax2 = 0, ay1 = 0, ay2 = 0, bx1 = 0, bx2 = 0, by1 = 0, by2 = 0, previous = 0, next = 0;
    for (let i = 0; i < samples.length; i++) {
      const x = samples[i] - dc, y = a[0] * x + a[1] * ax1 + a[2] * ax2 - a[3] * ay1 - a[4] * ay2;
      ax2 = ax1; ax1 = x; ay2 = ay1; ay1 = y;
      const z = b[0] * y + b[1] * bx1 + b[2] * bx2 - b[3] * by1 - b[4] * by2;
      bx2 = bx1; bx1 = y; by2 = by1; by1 = z;
      while (next < length && next * step <= i) {
        const f = clamp(next * step - (i - 1), 0, 1);
        out[next++] = previous + f * (z - previous);
      }
      previous = z;
    }
    return out;
  }
  function envelope(signal) {
    const hop = 80, n = Math.ceil(signal.length / hop), rms = new Float64Array(n), high = new Float64Array(n);
    let previous = 0;
    for (let frame = 0; frame < n; frame++) {
      let e = 0, h = 0; const start = frame * hop, end = Math.min(signal.length, start + hop);
      for (let i = start; i < end; i++) { const x = signal[i], diff = x - 0.85 * previous; previous = x; e += x * x; h += diff * diff; }
      rms[frame] = Math.sqrt(e / Math.max(1, end - start)); high[frame] = Math.sqrt(h / Math.max(1, end - start));
    }
    const smooth = input => { const out = new Float64Array(input.length); for (let i = 0; i < input.length; i++) out[i] = (input[Math.max(0, i - 1)] + 2 * input[i] + input[Math.min(input.length - 1, i + 1)]) / 4; return out; };
    return {rms: smooth(rms), high: smooth(high), hopSeconds: hop / ANALYSIS_RATE};
  }
  const fftCache = new Map();
  function fftPlan(n) {
    if (fftCache.has(n)) return fftCache.get(n);
    const reverse = new Uint32Array(n), cos = new Float64Array(n / 2), sin = new Float64Array(n / 2), hann = new Float64Array(n);
    const bits = Math.log2(n);
    for (let i = 0; i < n; i++) { let v = i, r = 0; for (let j = 0; j < bits; j++) { r = (r << 1) | (v & 1); v >>= 1; } reverse[i] = r; hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)); }
    for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos(2 * Math.PI * i / n); sin[i] = -Math.sin(2 * Math.PI * i / n); }
    const plan = {reverse, cos, sin, hann}; fftCache.set(n, plan); return plan;
  }
  function spectrum(signal, start, n) {
    const plan = fftPlan(n), real = new Float64Array(n), imag = new Float64Array(n);
    for (let i = 0; i < n; i++) real[plan.reverse[i]] = (signal[start + i] || 0) * plan.hann[i];
    for (let size = 2; size <= n; size *= 2) {
      const half = size / 2, step = n / size;
      for (let i = 0; i < n; i += size) for (let j = 0; j < half; j++) {
        const k = j * step, odd = i + j + half, even = i + j;
        const tr = real[odd] * plan.cos[k] - imag[odd] * plan.sin[k], ti = real[odd] * plan.sin[k] + imag[odd] * plan.cos[k];
        real[odd] = real[even] - tr; imag[odd] = imag[even] - ti; real[even] += tr; imag[even] += ti;
      }
    }
    const power = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) power[i] = real[i] * real[i] + imag[i] * imag[i];
    return power;
  }
  function framePositions(length, size, limit, minimumHop) {
    if (length < size) return [];
    const count = Math.min(limit, 1 + Math.floor((length - size) / minimumHop)), out = [];
    for (let i = 0; i < count; i++) out.push(count === 1 ? Math.floor((length - size) / 2) : Math.round(i * (length - size) / (count - 1)));
    return out;
  }
  function spectralQuality(signal, env) {
    const positions = framePositions(signal.length, 512, 160, 800), flatness = [];
    const threshold = Math.max(0.0003, quantile(env.rms, 0.9) * 0.06);
    for (const position of positions) {
      if (env.rms[Math.min(env.rms.length - 1, Math.floor(position / 80))] < threshold) continue;
      const power = spectrum(signal, position, 512); let total = 0, logarithm = 0, count = 0;
      for (let i = 7; i < 193; i++) { const p = Math.max(1e-18, power[i]); total += p; logarithm += Math.log(p); count++; }
      flatness.push(Math.exp(logarithm / count) / Math.max(1e-18, total / count));
    }
    return {median: median(flatness), noiseLikeRatio: flatness.length ? flatness.filter(x => x > 0.32).length / flatness.length : null, sampledFrames: flatness.length};
  }
  function qualityReport(raw, env, spectral) {
    const peakRms = quantile(env.rms, 0.99) || 0, gate = Math.max(0.0005, peakRms * 0.06);
    const activeFrames = Array.from(env.rms).filter(x => x >= gate).length;
    const reasons = [], silent = raw.rms < 0.0001, tooQuiet = raw.rms < 0.0007;
    let status = 'ok';
    if (raw.durationSeconds < 0.35) { status = 'unscorable'; reasons.push('录音不足0.35秒，无法形成可靠观察。'); }
    if (silent) { status = 'unscorable'; reasons.push('几乎没有可用的交流声音，可能静音、麦克风未采到声或只有直流偏移。'); }
    else if (tooQuiet) { status = 'unscorable'; reasons.push('录音电平过低，无法可靠区分触弦、音高与背景声音。'); }
    if (raw.clippedRatio > 0.02) { status = 'unscorable'; reasons.push('超过2%的采样接近满幅，削波风险较高；请减小输入电平后重录。'); }
    else if (raw.clippedRatio > 0.001 || raw.peak > 0.98) { if (status === 'ok') status = 'limited'; reasons.push('峰值接近满幅；这表示削波风险，不能证明编码前是否已经失真。'); }
    if (Math.abs(raw.dc) > 0.05) { if (status === 'ok') status = 'limited'; reasons.push('存在较大直流偏移，已去除偏移后分析。'); }
    const p10 = quantile(env.rms, 0.1) || 0;
    const envelopeContrast = Math.max(1, peakRms / Math.max(p10, 0.00001));
    const stationaryNoiseLike = spectral.noiseLikeRatio > 0.75 && envelopeContrast < 1.8;
    if (stationaryNoiseLike) { if (status === 'ok') status = 'limited'; reasons.push('信号呈持续宽带噪声特征，未发现足够证据把它当作音符或节拍。'); }
    if (!reasons.length) reasons.push('电平和时长允许继续做对应练习的分析；这不是音乐能力成绩。');
    return section(status, reasons, {
      scoreLabel: '录音质量不计音乐能力分', confidence: confidence(raw.durationSeconds >= 0.35 ? 1 : 0, '时长、电平与近满幅比例直接由完整PCM采样计算；噪声特征仅作启发式提示。'),
      durationSeconds: round(raw.durationSeconds), rmsDbfs: db(raw.rms), peakDbfs: db(raw.peak), peak: round(raw.peak, 5), dcOffset: round(raw.dc, 5),
      clippedRatio: round(raw.clippedRatio, 6), clippingDefinition: '|sample| ≥ 0.995的采样比例，仅指示近满幅／削波风险。',
      activeRatio: round(activeFrames / Math.max(1, env.rms.length)), activeSeconds: round(activeFrames * env.hopSeconds),
      activityThresholdDbfs: db(gate), spectralFlatnessMedian: round(spectral.median), noiseLikeFrameRatio: round(spectral.noiseLikeRatio),
      stationaryNoiseLike, envelopeContrast: round(envelopeContrast), spectralFrames: spectral.sampledFrames,
      limitations: ['未测量房间声学或真实信噪比；活动阈值和宽带噪声特征不等于声源识别。']
    });
  }

  function detectOnsets(env) {
    const n = env.rms.length, novelty = new Float64Array(n), sum = new Float64Array(n + 1), squares = new Float64Array(n + 1);
    let maximum = 0, maximumRms = 0;
    for (let i = 0; i < n; i++) {
      novelty[i] = Math.max(0, env.rms[i] - env.rms[Math.max(0, i - 2)]) + 0.6 * Math.max(0, env.high[i] - env.high[Math.max(0, i - 2)]);
      maximum = Math.max(maximum, novelty[i]); maximumRms = Math.max(maximumRms, env.rms[i]);
      sum[i + 1] = sum[i] + novelty[i]; squares[i + 1] = squares[i] + novelty[i] * novelty[i];
    }
    const onsets = [];
    for (let i = 2; i < n - 2; i++) {
      if (novelty[i] < novelty[i - 1] || novelty[i] <= novelty[i + 1]) continue;
      const lo = Math.max(0, i - 25), hi = Math.min(n, i + 26), count = hi - lo;
      const localMean = (sum[hi] - sum[lo]) / count, deviation = Math.sqrt(Math.max(0, (squares[hi] - squares[lo]) / count - localMean * localMean));
      // A steady sinusoid has tiny periodic RMS ripples when its period does
      // not divide the frame size. They must never become invented beats.
      if (novelty[i] < Math.max(maximum * 0.055, localMean + 1.4 * deviation, env.rms[i] * 0.12, 0.00012) || env.rms[i] < maximumRms * 0.025) continue;
      const candidate = {time: (i + 0.5) * env.hopSeconds, strength: novelty[i], prominence: novelty[i] / Math.max(0.00001, localMean)};
      const previous = onsets[onsets.length - 1];
      if (previous && candidate.time - previous.time < 0.08) { if (candidate.strength > previous.strength) onsets[onsets.length - 1] = candidate; }
      else onsets.push(candidate);
    }
    return onsets;
  }
  function gridFit(times, period) {
    if (!times.length) return null;
    let cosine = 0, sine = 0;
    times.forEach(t => { const phase = 2 * Math.PI * t / period; cosine += Math.cos(phase); sine += Math.sin(phase); });
    let phase = Math.atan2(sine, cosine) * period / (2 * Math.PI);
    if (phase < 0) phase += period;
    const indices = times.map(t => Math.round((t - phase) / period));
    const deviations = times.map((t, i) => Math.abs(t - phase - indices[i] * period));
    const occupied = new Set(indices).size, expected = Math.max(1, indices[indices.length - 1] - indices[0] + 1);
    return {phaseSeconds: round(phase, 4), meanDeviationMs: round(mean(deviations) * 1000, 2), medianDeviationMs: round(median(deviations) * 1000, 2), p90DeviationMs: round(quantile(deviations, 0.9) * 1000, 2), matchedFraction: round(deviations.filter(d => d <= Math.max(0.03, period * 0.08)).length / deviations.length), expectedPulseCount: expected, observedPulseCount: times.length, occupiedGridCount: occupied, unfilledGridEstimate: expected - occupied, duplicateGridEstimate: times.length - occupied, countAgreement: round(2 * occupied / (expected + times.length)), phaseConcentration: round(Math.hypot(cosine, sine) / times.length)};
  }
  function rhythmAnalysis(env, quality, c) {
    if (c.mode !== 'rhythm' && c.mode !== 'mixed') return notApplicable('此模式不评价节奏；单音或单和弦录音不能代表稳定连续触弦。');
    const base = {referenceBpm: c.referenceBpm == null ? null : c.referenceBpm, beatsPerOnset: c.beatsPerOnset == null ? null : c.beatsPerOnset, observedPulseBpm: null, estimatedPerformanceBpm: null, tempoRelation: null, tempoCandidatesBpm: [], onsetCount: 0, onsetsSeconds: [], medianIntervalMs: null, intervalMadMs: null, intervalCv: null, grid: null, referenceGridFits: [], missingPulseEstimate: null, extraPulseEstimate: null, issueWindows: [], scoreFormula: '仅对显式设定速度和触弦间隔的独立节奏任务：100×exp(−P90偏差毫秒/max(25,间隔毫秒×0.12))×exp(−3×|log2(期望间隔/实际中位间隔)|)×2×占用网格数/(期望音头数+检测音头数)。', limitations: ['音头来自能量上升沿，可能漏掉轻扫或把说话、敲击、伴奏中的其他声源当音头。', '相位从本段录音拟合，不代表相对外放节拍器的绝对抢拍／拖拍。', '空缺／重复数量只是首末音头之间网格占用的估计，不证明真实漏拍；录音起止的空白不计漏拍。', '只有相同速度、触弦间隔、录音条件下的同一练习才适合前后比较。']};
    if (quality.status === 'unscorable') return unavailable('录音质量不足，不能分析节奏。', base);
    if (quality.durationSeconds < 4) return unavailable('节奏任务至少录4秒，并保留8个以上清楚音头。', base);
    const onsets = detectOnsets(env), times = onsets.map(o => o.time), intervals = times.slice(1).map((t, i) => t - times[i]);
    base.onsetCount = times.length; base.onsetsSeconds = times.map(t => round(t, 4));
    if (times.length < 8 || times[times.length - 1] - times[0] < 3) return unavailable('可识别的音头不足8个或跨度不足3秒，无法可靠判断节奏。', base);
    const med = median(intervals), dispersion = 1.4826 * mad(intervals) / med, prominence = median(onsets.map(o => o.prominence));
    base.observedPulseBpm = round(60 / med, 2); base.medianIntervalMs = round(med * 1000, 2); base.intervalMadMs = round(mad(intervals) * 1000, 2); base.intervalCv = round(dispersion);
    base.tempoCandidatesBpm = [30 / med, 60 / med, 120 / med].map(v => round(v, 2));
    const nearMultiples = intervals.filter(dt => { const k = Math.max(1, Math.round(dt / med)); return k <= 4 && Math.abs(dt - k * med) <= med * 0.18; }).length / intervals.length;
    const reliability = clamp((Math.min(1, prominence / 4) * 0.35 + clamp(1 - dispersion / 0.4, 0, 1) * 0.35 + nearMultiples * 0.3), 0, 1);
    if (quality.stationaryNoiseLike || dispersion > 0.32 || nearMultiples < 0.65 || prominence < 2.2 || reliability < 0.65) return section('unscorable', ['没有足够清楚、重复的脉冲结构；不把随机噪声或不明确节拍转换成0分或满分。'], Object.assign(base, {confidence: confidence(Math.min(0.5, reliability), '音头突出度、间隔稳健离散度与重复性不足。')}));
    const report = section('limited', [], Object.assign(base, {confidence: confidence(reliability, '由音头突出度、间隔重复性和稳健离散度组成；不是识别正确的概率。')}));
    if (c.referenceBpm == null) { report.reasons.push('未设参考BPM；只能描述脉冲间隔，不能判断练习速度是否正确。'); return report; }
    report.referenceGridFits = [0.5, 1, 2].map(b => Object.assign({beatsPerOnset: b}, gridFit(times, 60 / c.referenceBpm * b)));
    if (c.beatsPerOnset == null) { report.reasons.push('未说明每几拍触弦一次；半拍、每拍、两拍一次均可能合理，因此不自动把半速或倍速判对／判错。'); return report; }
    const period = 60 / c.referenceBpm * c.beatsPerOnset, rateRatio = period / med;
    report.estimatedPerformanceBpm = round(60 * c.beatsPerOnset / med, 2);
    report.tempoRelation = Math.abs(rateRatio - 1) <= 0.08 ? 'near-reference' : Math.abs(rateRatio - 2) <= 0.16 ? 'double-rate' : Math.abs(rateRatio - 0.5) <= 0.04 ? 'half-rate' : 'different';
    report.grid = gridFit(times, period);
    report.missingPulseEstimate = report.grid.unfilledGridEstimate;
    report.extraPulseEstimate = report.grid.duplicateGridEstimate;
    const phase = report.grid.phaseSeconds, tolerance = Math.max(0.03, period * 0.08);
    report.issueWindows = times.map(t => ({time: t, error: t - phase - Math.round((t - phase) / period) * period})).filter(p => Math.abs(p.error) > tolerance).sort((a, b) => Math.abs(b.error) - Math.abs(a.error)).slice(0, 8).sort((a, b) => a.time - b.time).map(p => ({kind: 'off-grid-onset', timeSeconds: round(p.time, 3), startSeconds: round(Math.max(0, p.time - 0.3), 3), endSeconds: round(Math.min(quality.durationSeconds, p.time + 0.5), 3), valueMs: round(p.error * 1000, 2), reason: '检测音头偏离本段拟合网格；回听核对是否真是自己的触弦。'}));
    if (c.mode === 'mixed') { report.reasons.push('整曲混音的音头可能来自人声、琴或外放节拍器。这里只给节奏线索，不给音乐能力分。'); return report; }
    const alignment = Math.exp(-report.grid.p90DeviationMs / Math.max(25, period * 1000 * 0.12));
    const rate = Math.exp(-3 * Math.abs(Math.log2(rateRatio)));
    report.score = Math.round(100 * alignment * rate * report.grid.countAgreement);
    report.status = 'ok';
    report.reasons.push('仅比较本次独立节奏练习与所设触弦网格；分数不代表歌曲节奏、弹唱协调或结业。');
    if (report.tempoRelation === 'half-rate' || report.tempoRelation === 'double-rate') report.reasons.push('检测到接近半／倍触弦速率。已保留真实间隔，不通过翻倍或减半计算把它改成高分；请先核对任务的每次触弦间隔。');
    return report;
  }

  function yin(signal, start, size) {
    const window = Math.floor(size / 2), maxTau = Math.min(window - 1, Math.floor(ANALYSIS_RATE / 55)), minTau = Math.max(2, Math.floor(ANALYSIS_RATE / 1500));
    const difference = new Float64Array(maxTau + 1), normalized = new Float64Array(maxTau + 1);
    let sum = 0; normalized[0] = 1;
    for (let tau = 1; tau <= maxTau; tau++) {
      let d = 0;
      for (let j = 0; j < window; j++) { const v = signal[start + j] - signal[start + j + tau]; d += v * v; }
      difference[tau] = d; sum += d; normalized[tau] = sum > 1e-18 ? d * tau / sum : 1;
    }
    let chosen = -1;
    for (let tau = minTau; tau < maxTau; tau++) {
      if (normalized[tau] < 0.15) { while (tau + 1 <= maxTau && normalized[tau + 1] < normalized[tau]) tau++; chosen = tau; break; }
    }
    if (chosen < 0) return null;
    let offset = 0;
    if (chosen > 1 && chosen < maxTau) {
      // Interpolate the raw difference after CMND has selected the period.
      // This avoids the CMND normalization's frequency bias at short lags.
      const left = difference[chosen - 1], center = difference[chosen], right = difference[chosen + 1], denominator = left - 2 * center + right;
      if (Math.abs(denominator) > 1e-12) offset = clamp(0.5 * (left - right) / denominator, -0.5, 0.5);
    }
    // Compare interpolated minima, not integer-bin errors: a pure sinusoid's
    // second period can land nearer an integer lag without being octave-ambiguous.
    const minimumValue = tau => {
      if (tau < 1 || tau >= maxTau) return normalized[tau];
      const left = normalized[tau - 1], center = normalized[tau], right = normalized[tau + 1], denominator = left - 2 * center + right;
      const shift = Math.abs(denominator) > 1e-12 ? clamp(0.5 * (left - right) / denominator, -0.5, 0.5) : 0;
      return Math.max(0, center - 0.25 * (left - right) * shift);
    };
    let octaveAmbiguous = false;
    const firstMinimum = minimumValue(chosen);
    if (chosen * 2 + 2 <= maxTau && firstMinimum > 0.004) {
      let bestDouble = 1;
      for (let lag = chosen * 2 - 2; lag <= chosen * 2 + 2; lag++) bestDouble = Math.min(bestDouble, minimumValue(lag));
      octaveAmbiguous = bestDouble < firstMinimum * 0.3;
    }
    return {frequency: ANALYSIS_RATE / (chosen + offset), periodicity: 1 - normalized[chosen], octaveAmbiguous};
  }
  function pitchAnalysis(signal, env, quality, c) {
    if (c.mode !== 'single-note') return notApplicable('只有指定单音任务才做音高比较；混合弹唱没有旋律参照，不能据此评价唱得准不准。');
    const target = c.targetMidi == null ? null : {midi: c.targetMidi, note: midiName(c.targetMidi), frequencyHz: round(midiToFrequency(c.targetMidi), 3)};
    const base = {target, medianFrequencyHz: null, detectedMidi: null, detectedNote: null, centsMedian: null, centsAbsoluteMedian: null, centsP10: null, centsP90: null, centsSpread: null, within25CentsRatio: null, within50CentsRatio: null, voicedFrames: 0, activeFrames: 0, analyzedFrames: 0, voicedRatio: 0, medianPeriodicity: null, octaveAmbiguousFrames: 0, issueWindows: [], scoreFormula: 'max(0,100 − 1.5×绝对音分偏差中位数 − 0.2×max(0,音分P90−P10−20))。', limitations: ['适用持续的一个音；说话、同时多弦、其他声源和强混响都可能使结果失效。', '音分P10–P90是被采样帧的分布范围，不是统计置信区间。', '按实际八度比较，不自动移高／移低八度；这不是目标歌曲旋律或声乐音准评分。']};
    if (quality.status === 'unscorable') return unavailable('录音质量不足，不能可靠估计单音。', base);
    if (quality.durationSeconds < 0.8) return unavailable('单音任务至少持续0.8秒；建议独立录3–5秒清楚单音。', base);
    if (quality.stationaryNoiseLike) return unavailable('信号更像持续噪声，没有可靠单音周期。', base);
    const positions = framePositions(signal.length, 1024, 600, 640), voiced = [], threshold = Math.max(0.0005, (quantile(env.rms, 0.9) || 0) * 0.08);
    base.analyzedFrames = positions.length;
    for (const position of positions) {
      let energy = 0; for (let j = 0; j < 1024; j++) energy += signal[position + j] ** 2;
      if (Math.sqrt(energy / 1024) < threshold) continue;
      base.activeFrames++;
      const value = yin(signal, position, 1024);
      if (!value) continue;
      if (value.octaveAmbiguous) { base.octaveAmbiguousFrames++; continue; }
      value.startSeconds = position / ANALYSIS_RATE;
      voiced.push(value);
    }
    base.voicedFrames = voiced.length; base.voicedRatio = round(voiced.length / Math.max(1, base.activeFrames));
    if (voiced.length < 6 || base.voicedRatio < 0.6 || base.activeFrames / Math.max(1, positions.length) < 0.15) return unavailable('可靠周期帧不足，或疑似混音／噪声／八度歧义。请单独拨一根弦，待声音稳定再录。', base);
    const frequencies = voiced.map(v => v.frequency), midis = frequencies.map(frequencyToMidi), middle = median(midis), spread = (quantile(midis, 0.9) - quantile(midis, 0.1)) * 100;
    base.medianFrequencyHz = round(midiToFrequency(middle), 3); base.detectedMidi = round(middle, 3); base.detectedNote = midiName(middle); base.centsSpread = round(spread, 2); base.medianPeriodicity = round(median(voiced.map(v => v.periodicity)));
    const reliability = Math.min(base.medianPeriodicity, base.voicedRatio, clamp(1 - Math.max(0, spread - 25) / 200, 0, 1));
    if (spread > 120 || base.octaveAmbiguousFrames > base.activeFrames * 0.2 || reliability < 0.65) return section('unscorable', ['音高分布跨越较大、有效周期不足或存在明显八度歧义，不能把多音／变化中的音当作持续单音评分。'], Object.assign(base, {confidence: confidence(Math.min(0.5, reliability), '单音稳定性不足。')}));
    const report = section('limited', [], Object.assign(base, {confidence: confidence(reliability, '由周期性、有效周期帧比例与帧间音高稳定性给出；不是统计概率。')}));
    if (!target) { report.reasons.push('检测到可重复音高，但没有指定目标音，所以不判断正确或给分。'); return report; }
    const cents = midis.map(m => (m - c.targetMidi) * 100);
    report.centsMedian = round(median(cents), 2); report.centsAbsoluteMedian = round(median(cents.map(Math.abs)), 2); report.centsP10 = round(quantile(cents, 0.1), 2); report.centsP90 = round(quantile(cents, 0.9), 2);
    report.within25CentsRatio = round(cents.filter(x => Math.abs(x) <= 25).length / cents.length); report.within50CentsRatio = round(cents.filter(x => Math.abs(x) <= 50).length / cents.length);
    const candidates = voiced.map((v, i) => ({start: v.startSeconds, cents: cents[i]})).filter(v => Math.abs(v.cents) > 25).sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents));
    const selected = [];
    for (const candidate of candidates) { if (selected.every(v => Math.abs(v.start - candidate.start) >= 0.5)) selected.push(candidate); if (selected.length === 6) break; }
    report.issueWindows = selected.sort((a, b) => a.start - b.start).map(v => ({kind: 'target-pitch-deviation', timeSeconds: round(v.start + 0.064, 3), startSeconds: round(v.start, 3), endSeconds: round(Math.min(quality.durationSeconds, v.start + 0.128), 3), valueCents: round(v.cents, 2), reason: '这个被采样的周期帧偏离指定单音超过25音分；不是整曲旋律判错。'}));
    report.score = Math.round(clamp(100 - 1.5 * report.centsAbsoluteMedian - 0.2 * Math.max(0, spread - 20), 0, 100));
    report.status = 'ok'; report.reasons.push('仅为所选单音与目标频率的训练比较；负音分偏低，正音分偏高。');
    return report;
  }

  function chordFrame(signal, start) {
    const size = 2048, power = spectrum(signal, start, size), peaks = []; let bandEnergy = 0, maximum = 0;
    const low = Math.ceil(65 * size / ANALYSIS_RATE), high = Math.floor(2200 * size / ANALYSIS_RATE);
    for (let i = low; i < high; i++) { bandEnergy += power[i]; maximum = Math.max(maximum, power[i]); }
    if (maximum < 1e-9) return null;
    for (let i = low + 1; i < high - 1; i++) {
      if (power[i] <= power[i - 1] || power[i] < power[i + 1] || power[i] < maximum * 0.0025) continue;
      const left = Math.log(Math.max(1e-18, power[i - 1])), center = Math.log(power[i]), right = Math.log(Math.max(1e-18, power[i + 1]));
      const denominator = left - 2 * center + right, delta = Math.abs(denominator) > 1e-12 ? clamp(0.5 * (left - right) / denominator, -0.5, 0.5) : 0;
      const hz = (i + delta) * ANALYSIS_RATE / size, midi = frequencyToMidi(hz), nearest = Math.round(midi);
      if (Math.abs(midi - nearest) > 0.35) continue;
      peaks.push({hz, midi: nearest, magnitude: Math.sqrt(power[i]), bin: i});
    }
    const bases = [], chroma = new Array(12).fill(0); let peakEnergy = 0;
    for (const p of peaks) {
      let harmonic = false;
      for (const lower of bases) {
        const ratio = p.hz / lower.hz, integer = Math.round(ratio);
        if (integer >= 2 && integer <= 6 && Math.abs(1200 * Math.log2(ratio / integer)) < 32 && lower.magnitude > p.magnitude * 0.1) { harmonic = true; break; }
      }
      for (let k = p.bin - 2; k <= p.bin + 2; k++) peakEnergy += power[k] || 0;
      if (harmonic) continue;
      bases.push(p); const pc = ((p.midi % 12) + 12) % 12;
      chroma[pc] = Math.max(chroma[pc], Math.sqrt(p.magnitude));
    }
    const total = chroma.reduce((a, b) => a + b, 0);
    if (!total) return null;
    const normalized = chroma.map(x => x / total), norm = Math.sqrt(normalized.reduce((s, x) => s + x * x, 0));
    const vector = normalized.map(x => x / norm), ranked = CHORD_TEMPLATES.map(t => ({name: t.name, similarity: t.vector.reduce((s, x, i) => s + x * vector[i], 0)})).sort((a, b) => b.similarity - a.similarity);
    return {chroma: normalized, tonalEnergy: Math.min(1, peakEnergy / Math.max(1e-18, bandEnergy)), distinct: normalized.filter(x => x >= 0.07).length, ranked};
  }
  function chordAnalysis(signal, env, quality, c) {
    if (c.mode !== 'chord') return notApplicable('只有单独录制的一个和弦才比较色度；不会从整曲人声与琴声混音猜和弦是否弹对。');
    const expected = chordFromName(c.expectedChord), base = {expectedChord: expected ? expected.name : c.expectedChord || null, detectedChord: null, expectedSimilarity: null, bestSimilarity: null, templateMargin: null, matched: null, pitchClasses: [], chroma: null, analyzedFrames: 0, usableFrames: 0, frameAgreement: null, tonalEnergyRatio: null, scoreFormula: '100×归一化色度与目标和弦模板的余弦相似度；只有稳定而明确的单和弦才给出。', limitations: ['只能比较音级集合，无法辨别转位、指法、漏弹重复音或每根弦是否干净。', '谐波抑制与谱峰阈值是保守启发式，复杂音色、混响、环境声可能导致无法评分。', '参考分不是和弦技术合格线；还需核对matched和实际听辨。']};
    if (c.isolatedInstrument !== true) return unavailable('请先确认录音只有尤克里里、保持一个和弦，没有人声、伴奏或外放节拍器。', base);
    if (!expected) return unavailable('请指定支持的目标和弦，例如C、Am、F、G、G7或Em7。', base);
    if (quality.status === 'unscorable') return unavailable('录音质量不足，不能做和弦色度比较。', base);
    if (quality.durationSeconds < 1.2) return unavailable('单和弦至少录1.2秒；建议缓慢重复拨同一个和弦3–5秒。', base);
    if (quality.stationaryNoiseLike || quality.spectralFlatnessMedian > 0.28) return unavailable('没有足够清楚的音调谱峰，不能把噪声归到某个和弦。', base);
    const positions = framePositions(signal.length, 2048, 120, 800), frames = [], threshold = Math.max(0.0005, (quantile(env.rms, 0.9) || 0) * 0.08);
    base.analyzedFrames = positions.length;
    for (const start of positions) {
      if (env.rms[Math.min(env.rms.length - 1, Math.floor((start + 1024) / 80))] < threshold) continue;
      const frame = chordFrame(signal, start);
      if (frame && frame.distinct >= 3 && frame.tonalEnergy >= 0.65) frames.push(frame);
    }
    base.usableFrames = frames.length;
    if (frames.length < 5 || frames.length < positions.length * 0.3) return unavailable('独立的和弦音级证据不足；单音及其泛音不会自动算作一个和弦。', base);
    const profile = new Array(12).fill(0);
    frames.forEach(f => f.chroma.forEach((value, i) => { profile[i] += value / frames.length; }));
    const norm = Math.sqrt(profile.reduce((sum, x) => sum + x * x, 0)), vector = profile.map(x => x / norm);
    const ranked = CHORD_TEMPLATES.map(t => ({name: t.name, template: t, similarity: t.vector.reduce((sum, x, i) => sum + x * vector[i], 0)})).sort((a, b) => b.similarity - a.similarity);
    const best = ranked[0], margin = best.similarity - ranked[1].similarity, agreement = frames.filter(f => f.ranked[0].name === best.name).length / frames.length;
    const tonal = median(frames.map(f => f.tonalEnergy)), expectedSimilarity = expected.vector.reduce((sum, x, i) => sum + x * vector[i], 0);
    base.chroma = profile.map(x => round(x, 4)); base.pitchClasses = profile.map((x, i) => x >= 0.07 ? PC_NAMES[i] : null).filter(Boolean); base.bestSimilarity = round(best.similarity); base.expectedSimilarity = round(expectedSimilarity); base.templateMargin = round(margin); base.frameAgreement = round(agreement); base.tonalEnergyRatio = round(tonal);
    const reliability = Math.min(agreement, tonal, clamp(margin / 0.1, 0, 1));
    if (best.similarity < 0.9 || margin < 0.075 || agreement < 0.75) return section('unscorable', ['和弦候选太接近或各时段不一致；不把不确定的色度归类转成分数。'], Object.assign(base, {confidence: confidence(Math.min(0.5, reliability), '模板区分度或跨帧一致性不足。')}));
    base.detectedChord = best.name; base.matched = best.name === expected.name && expected.pitchClasses.every(pc => profile[pc] >= 0.07);
    return section('ok', ['仅比较这个独立和弦片段的音级集合；音级匹配不证明指法、每根弦清晰度或歌曲和弦位置正确。'], Object.assign(base, {score: Math.round(expectedSimilarity * 100), confidence: confidence(reliability, '由谱峰调性、候选模板间距和跨帧一致性决定；没有真实录音统计校准。')}));
  }

  function analyze(samples, sampleRate, config) {
    if (!(samples instanceof Float32Array) && !(samples instanceof Float64Array) && !Array.isArray(samples)) throw new TypeError('请传入单声道PCM采样数组。');
    if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new RangeError('采样率应在8000–192000 Hz之间。');
    if (samples.length / sampleRate > LIMIT_SECONDS + 1 / sampleRate) throw new RangeError('单次分析最多10分钟，请裁剪或分段后再分析。');
    const c = parseConfig(config), raw = scan(samples, sampleRate), signal = resample(samples, sampleRate, raw.dc), env = envelope(signal), spectral = spectralQuality(signal, env), quality = qualityReport(raw, env, spectral);
    return {
      schema: 1, engineVersion: ENGINE_VERSION, mode: c.mode, durationSeconds: round(raw.durationSeconds), sampleRate,
      analysis: {sampleRate: ANALYSIS_RATE, analyzedDurationSeconds: round(raw.durationSeconds), fullClipQualityAndEnvelope: true, sparsePitchFrameLimit: 600, sparseChordFrameLimit: 120, onsetResolutionMs: 10, sourceSeparation: false, machineLearning: false},
      quality, rhythm: rhythmAnalysis(env, quality, c), pitch: pitchAnalysis(signal, env, quality, c), chord: chordAnalysis(signal, env, quality, c),
      limitations: ['本地数字信号分析，仅提供有条件的训练参考，不是AI教师听评。', '没有目标旋律、所用谱本与人声分离时，不能判断整曲是否唱准、弹对或具备结业能力。', '每部分的status、reasons与confidence必须与数值一起呈现；null表示无法评分，不能替换成0。', '启发式可信度和采样帧分布不是统计置信区间；在真实设备和真实录音上的误差尚未校准。']
    };
  }
  return Object.freeze({ENGINE_VERSION, MODES: Object.freeze(MODES), NOTE_TARGETS, SUPPORTED_CHORDS: Object.freeze(CHORD_TEMPLATES.map(c => c.name)), analyze, midiToFrequency, frequencyToMidi, noteToMidi});
});
