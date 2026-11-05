importScripts('audio-analysis.js?v=20261105-v2');
self.onmessage = function (event) {
  const { id, samples, sampleRate, config } = event.data || {};
  try { self.postMessage({ id, report: self.UKE_AUDIO_ANALYSIS.analyze(samples, sampleRate, config) }); }
  catch (error) { self.postMessage({ id, error: error && error.message || '音频分析未完成' }); }
};
