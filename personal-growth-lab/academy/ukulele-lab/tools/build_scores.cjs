'use strict';
// Build a complete offline copy of the same notation/whole-song lyric editor used in the course.
// No remote scripts, fonts, images, lyrics service or third-party score is required.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, 'assets', name), 'utf8');
const scriptNames = ['music-data.js', 'score-data.js', 'score-notation.js', 'score-lyrics.js', 'score-whole-lyrics.js', 'score-player.js'];
const memory = new Map();
const context = {
  document: {addEventListener() {}, getElementById() { return null; }, querySelectorAll() { return []; }},
  localStorage: {getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value)},
  addEventListener() {},
};
context.window = context;
for (const file of scriptNames) vm.runInNewContext(read(file), context, {filename: file});
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const css = ['style.css','studio.css','score-notation.css','score-lyrics.css','score-whole-lyrics.css'].map(read).join('\n') + `
body{background:#f6f4ed}.offline-score{max-width:1160px;margin:24px auto;padding:0 24px}.offline-top{display:flex;gap:16px;align-items:center;justify-content:space-between;margin:0 0 18px;font-size:13px}.offline-note{font-size:13px;line-height:1.8;color:#617362;margin:18px 0}.score-page{width:100%}@media(max-width:650px){.offline-score{padding:0 12px;margin:16px auto}.offline-top{align-items:flex-start;flex-wrap:wrap}}@media print{.offline-score{max-width:none;margin:0;padding:0}.offline-top,.offline-note{display:none}}
`;
const scripts = scriptNames.map(name => '<script>' + read(name).replace(/<\/script/gi, '<\\/script') + '</script>').join('\n');
fs.mkdirSync(path.join(root, 'downloads'), {recursive: true});
for (const song of context.UKE_SCORES.songs) {
  const title = '《' + song.title + '》四线谱与弹唱谱 · 一心问道';
  const markup = context.UKE_SCORE_PLAYER.render(song.id, {offline: true});
  const html = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escape(title) + '</title><style>' + css + '</style></head><body><main class="offline-score"><div class="offline-top no-print"><strong>一心问道 · 离线练习谱</strong><a href="https://zbyloveyj.github.io/personal-growth-lab/academy/ukulele-lab/#/songs/' + song.id + '">回到在线课程 →</a></div><p class="offline-note no-print">此文件可离线查看、跟谱播放、填写自备歌词及打印。在线课程的本机歌词不会自动进入下载文件；可在下方导入歌词JSON。浏览器可能限制本地文件的存储，填写后请导出歌词备份。</p><div id="offline-score-root">' + markup + '</div><noscript><p>静态四线谱仍可阅读。播放、切换谱式、添加歌词需要启用JavaScript。</p></noscript></main>' + scripts + '<script>document.getElementById("offline-score-root").innerHTML=window.UKE_SCORE_PLAYER.render(' + JSON.stringify(song.id) + ',{offline:true});window.UKE_SCORE_PLAYER.mount(' + JSON.stringify(song.id) + ');</script></body></html>';
  fs.writeFileSync(path.join(root, 'downloads', 'score-' + song.id + '.html'), html);
}
console.log('Built 3 self-contained offline TAB/strum scores with optional personal lyrics and playback.');
