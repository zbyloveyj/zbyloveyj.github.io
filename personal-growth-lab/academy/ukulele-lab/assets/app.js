(function () {
  'use strict';
  const P = window.UKE_PROGRESS, C = window.UKE_COURSE, M = window.UKE_MUSIC;
  const main = document.getElementById('main');
  if (!P || !C || !Array.isArray(C.lessons) || !M) {
    main.innerHTML = '<div class="notice error"><h1>课程尚未完整载入</h1><p>请刷新页面重试；若网络暂时中断，可以先使用下载讲义。</p><p><a href="downloads/ukulele-30-days.md">下载30天课程讲义</a> · <a href="../index.html">返回成长学院</a></p></div>'; return;
  }
  const e = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const htmlList = (items, ordered = false) => '<' + (ordered ? 'ol' : 'ul') + '>' + (items || []).map(t => '<li>' + e(t) + '</li>').join('') + '</' + (ordered ? 'ol' : 'ul') + '>';
  const url = s => /^https?:\/\//i.test(String(s || '')) ? e(s) : '#';
  const now = () => new Date().toISOString();
  const stamp = previous => new Date(Math.max(Date.now(), (Date.parse(previous) || 0) + 1)).toISOString();
  const getLesson = day => C.lessons.find(x => x.day === Number(day));
  const getSong = id => M.songs.find(x => x.id === id);
  const chordName = name => name === 'FsharpM' ? 'F♯m' : name;
  const fmt = n => n == null ? '—' : Number.isInteger(n) ? String(n) : Number(n).toFixed(1);
  const dateLabel = s => s && Date.parse(s) ? new Date(s).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) : '尚未记录';
  const STAGES = [
    { day: 7, title: '基础检查', short: '逐弦清晰、16次换和弦、16小节', target: '按第7天日课的三项实操标准完整测试。本阶段的“完整”指完成这组基础测试；歌唱相关维度若尚未测试，请保持未评，不因基础测试而判定单曲完成。', tasks: (getLesson(7) || {criteria: []}).criteria },
    { day: 14, title: '第一首连接', short: '《安静》主副歌与完整唱段', target: '以所选《安静》谱本为准，慢速弹唱完整版本。若目前只能完成主副歌片段，照实评分；先补结构，再进行单曲正式评估。', tasks: (getLesson(14) || {criteria: []}).criteria },
    { day: 21, title: '节奏迁移', short: '《晴天》弹唱与节奏保持', target: '按所选《晴天》版本完整慢速弹唱；检查唱词进入时右手是否断拍。不把原曲吉他前奏当作零基础结业要求。', tasks: (getLesson(21) || {criteria: []}).criteria },
    { day: 30, title: '三曲结业', short: '三次独立、一镜到底的作品', target: '《安静》《晴天》《一万次悲伤》分别录制完整版本，使用各自选定的舒适调与速度。三首歌曲需分别填写正式测评；本阶段记录不能代替三份单曲结果。', tasks: (getLesson(30) || {criteria: []}).criteria }
  ];
  let state = P.fresh(), storageProtected = false, corruptRaw = '', storageError = '', savePulse, toastTimer;
  try { const raw = localStorage.getItem(P.KEY); if (raw) { corruptRaw = raw; state = P.normalize(JSON.parse(raw)); corruptRaw = ''; } }
  catch (err) { storageError = '读取本机记录失败：' + err.message; storageProtected = true; }
  function showStorageWarning() {
    const el = document.getElementById('storage-warning');
    if (!storageError) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = '<strong>目前使用本页临时记录</strong><br>' + e(storageError) + '。为保留原记录，本页不会覆盖旧数据。请先导出当前进度；关闭前务必保存备份。' + (corruptRaw ? ' <button class="text-btn" data-action="export-raw">下载原始记录以便恢复</button>' : '') + ' <button class="text-btn" data-action="export">导出当前记录</button> <button class="text-btn" data-action="storage-recover">恢复本机保存</button>';
  }
  function toast(message) { const t = document.getElementById('toast'); t.textContent = message; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 4300); }
  function save() {
    state.updatedAt = stamp(state.updatedAt);
    const status = document.getElementById('save-status');
    try {
      if (storageProtected) throw new Error('原记录受到保护');
      const current = localStorage.getItem(P.KEY);
      if (current) { const other = P.validate(JSON.parse(current)); if (!other.ok) { corruptRaw = current; storageProtected = true; throw new Error('检测到无法识别的旧记录，已停止覆盖'); } state = P.merge(other.state, state); }
      localStorage.setItem(P.KEY, JSON.stringify(state));
      status.textContent = '已保存到本机';
    } catch (err) {
      storageError = storageError || ('保存失败：' + err.message); showStorageWarning(); status.textContent = '临时记录 · 请导出';
    }
    clearTimeout(savePulse); savePulse = setTimeout(() => { if (!storageError) status.textContent = '本机进度已保存'; }, 2000);
    window.dispatchEvent(new CustomEvent('uke:progress', { detail: { state: JSON.parse(JSON.stringify(state)), summary: P.stats(state, C, M) } }));
  }
  function recoverStorage() {
    flushPending();
    try {
      let recovered = P.normalize(state);
      const original = localStorage.getItem(P.KEY);
      if (original) {
        let checked;
        try { checked = P.validate(JSON.parse(original)); } catch (_) { checked = {ok: false}; }
        if (checked.ok) recovered = P.merge(checked.state, recovered);
        else localStorage.setItem(P.KEY + '.recovery.' + Date.now(), original);
      }
      localStorage.setItem(P.KEY, JSON.stringify(recovered)); state = recovered;
      storageProtected = false; storageError = ''; showStorageWarning();
      document.getElementById('save-status').textContent = '已恢复本机保存';
      toast('本机保存已恢复。无法识别的原记录已先另存副本；建议同时导出当前进度。');
    } catch (err) { toast('仍无法恢复保存，原记录未覆盖：' + err.message + '。请导出当前进度妥善保存。'); }
  }
  const record = day => state.records[day] || P.freshRecord();
  function writeRecord(day, r) { r.updatedAt = stamp(r.updatedAt); state.records[day] = r; save(); }
  function writeAssessment(id, a) { a.updatedAt = stamp(a.updatedAt); state.assessments[id] = a; save(); }
  function badge(text, kind = '') { return '<span class="badge ' + kind + '">' + e(text) + '</span>'; }
  function button(label, action, extra = '', style = 'btn-small') { return '<button type="button" class="' + style + '" data-action="' + action + '" ' + extra + '>' + label + '</button>'; }
  function link(label, href, style = 'btn') { return '<a class="' + style + '" href="' + e(href) + '">' + label + '</a>'; }
  function pageHeading(eyebrow, title, description, actions = '') { return '<div class="page-heading"><span class="eyebrow">' + e(eyebrow) + '</span><div class="page-title-row"><h1>' + e(title) + '</h1>' + (actions ? '<div class="actions no-print">' + actions + '</div>' : '') + '</div><p>' + e(description) + '</p></div>'; }
  function field(label, name, value, options = {}) {
    const { type = 'text', placeholder = '', wide = false, help = '', attrs = '', scope = 'day' } = options;
    return '<label class="field' + (wide ? ' wide' : '') + '">' + e(label) + (type === 'textarea' ? '<textarea data-field="' + name + '" data-scope="' + scope + '" placeholder="' + e(placeholder) + '" ' + attrs + '>' + e(value) + '</textarea>' : '<input type="' + type + '" data-field="' + name + '" data-scope="' + scope + '" value="' + e(value) + '" placeholder="' + e(placeholder) + '" ' + attrs + '>') + (help ? '<small>' + e(help) + '</small>' : '') + '</label>';
  }
  function checkedLabel(text, fieldName, checked, scope = 'assessment') { return '<label class="check-row"><input type="checkbox" data-scope="' + scope + '" data-field="' + fieldName + '"' + (checked ? ' checked' : '') + '><span class="check-text">' + e(text) + '</span></label>'; }
  function ukeIllustration() { return '<div class="hero-art" aria-hidden="true"><svg viewBox="0 0 210 290" fill="none"><path d="M97 63h22l-3 110H99L97 63z" fill="#624c37"/><path d="M96 16c0-5 4-8 8-8h12c4 0 7 3 6 8l-4 51H98l-2-51z" fill="#aa8156"/><path d="M95 25h-7m7 21h-7m36-22h7m-8 21h7" stroke="#4f6850" stroke-width="5" stroke-linecap="round"/><path d="M82 139c-21-8-44 6-39 30 3 15 9 18-4 35-21 26-11 69 27 78 32 8 65-8 77-37 10-26-8-42-7-59 2-18 7-41-12-48-20-7-25 7-42 1z" fill="#c9a370"/><path d="M83 146c-17-6-34 5-31 23 3 16 10 21-6 41-18 23-9 55 22 64 29 8 56-8 65-33 8-22-9-37-7-56 2-16 6-33-9-36-16-4-20 4-34-3z" fill="#d8b883"/><ellipse cx="91" cy="194" rx="20" ry="23" fill="#a78350"/><ellipse cx="91" cy="194" rx="16" ry="19" fill="#3c4b36"/><path d="M71 244h39v8H71z" fill="#6c5740"/><path d="M101 20L83 247M107 20L88 247M112 20L94 247M117 20L100 247" stroke="#f6edcf" stroke-width="1"/><path d="M98 81h20m-20 12h19m-18 12h17m-17 12h17m-17 12h17m-17 12h17" stroke="#c7b58c"/><circle cx="108" cy="102" r="1.8" fill="#e1ceb0"/><circle cx="107" cy="126" r="1.8" fill="#e1ceb0"/></svg><span>G · C · E · A</span></div>'; }
  function statsCards() { const s = P.stats(state, C, M); return '<div class="stats-grid"><div class="card stat"><span class="label">练习完成</span><strong>' + s.practicedDays + '<small>/ 30天</small></strong><span class="hint">任务与实际练习记录</span></div><div class="card stat"><span class="label">日课实操自评</span><strong>' + s.practicalDays + '<small>/ 30天</small></strong><span class="hint">逐项确认本课标准</span></div><div class="card stat"><span class="label">实际练习</span><strong>' + fmt(s.minutes) + '<small>分钟</small></strong><span class="hint">按你填写的练习时间累计</span></div><div class="card stat"><span class="label">完整弹唱达标</span><strong>' + s.songsPassed + '<small>/ 3首</small></strong><span class="hint">独立量表 + 完整作品证据</span></div></div>'; }
  function songCard(s, i) { const result = P.assess(state.assessments[s.id]); return '<article class="card song-card"><span class="song-no">TRACK / 0' + (i + 1) + '</span><h3>' + e(s.title) + '</h3><p>' + e(s.artist) + ' · 慢速简化弹唱</p><div class="card-bottom">' + badge(result.passed ? '自评达标' : result.assessed ? result.score + '分 · 继续打磨' : '尚未测评', result.passed ? 'good' : 'outline') + '<a href="#/songs/' + s.id + '">进入曲目 →</a></div></article>'; }
  function miniRoadmap() { const s = P.stats(state, C, M); return '<div class="mini-roadmap">' + C.lessons.map(l => '<a class="mini-day' + (s.completedDays.includes(l.day) ? ' done' : l.day === s.nextDay ? ' current' : '') + ([7, 14, 21, 30].includes(l.day) ? ' stage' : '') + '" title="第' + l.day + '天：' + e(l.title) + '" href="#/day/' + l.day + '">' + l.day + '</a>').join('') + '</div>'; }
  function home() {
    const s = P.stats(state, C, M), day = state.lastDay > 1 ? state.lastDay : s.nextDay, l = getLesson(day) || C.lessons[0];
    return '<section class="hero"><div><span class="eyebrow">30 DAYS / THREE SONGS / YOUR PACE</span><h1>用一个月，<br>把喜欢的歌弹给自己。</h1><p>从第一声干净的和弦，到三首歌的完整弹唱。每天一课，把节奏、双手和歌声慢慢连在一起。</p><div class="actions">' + link('开始今天的练习 <span>→</span>', '#/day/' + s.nextDay) + link('查看训练路线', '#/roadmap', 'btn-secondary') + '</div></div>' + ukeIllustration() + '</section>' + statsCards() + '<div class="notice"><strong>开练前准备：</strong>一把标准GCEA尤克里里、调音器和录音设备。先到<a href="#/songs">三首曲目页</a>确认能取得完整弹唱谱本及同调旋律参考；外部谱站可能需登录或付费。课内已提供逐日方法、四弦指法和原创技能示范，歌曲完整谱面请按选定资源准备。</div>' +
      '<div class="columns"><div class="section-stack"><section class="card continue-card"><div><span class="eyebrow">CONTINUE / 接着上次练</span><h3>第' + l.day + '天 · ' + e(l.title) + '</h3><p>' + e(l.goal) + '</p></div>' + link('继续练习 →', '#/day/' + l.day, 'btn-small') + '</section><section><div class="section-heading"><h2>这一个月的节奏</h2><a href="#/roadmap">查看每天的任务 →</a></div><div class="card" style="padding-top:8px;padding-bottom:8px">' + [
        ['01', '第1–7天 · 先让四根弦清楚发声', '调音、C/Am/F/G、四拍与换和弦', 1],
        ['02', '第8–14天 · 安静地唱完第一首', '《安静》：分段练习与主副歌连接', 8],
        ['03', '第15–21天 · 让手里的节奏继续', '《晴天》：右手保持与弹唱同步', 15],
        ['04', '第22–30天 · 留下三首完整作品', '《一万次悲伤》、排练与逐曲测评', 22]
      ].map(x => '<a class="phase-row" href="#/day/' + x[3] + '"><span class="number-tag">' + x[0] + '</span><div><h3>' + x[1] + '</h3><p>' + x[2] + '</p></div><span>↗</span></a>').join('') + '</div></section></div><aside class="card"><span class="eyebrow">30日练习地图</span><h3 style="margin:10px 0 16px">每次专注，都留下痕迹</h3>' + miniRoadmap() + '<div class="progress-track"><span style="width:' + s.practicedDays / 30 * 100 + '%"></span></div><div class="progress-label"><span>练习完成 ' + s.practicedDays + '/30</span><span>' + Math.round(s.practicedDays / 30 * 100) + '%</span></div><p class="note-line">建议每天约45–60分钟，可拆成两次。浅绿是练习完成，底部木色标记是阶段测评日；日课自评和单曲达标分别记录。</p></aside></div>' +
      '<div class="section-heading"><h2>你的三首歌</h2><a href="#/assessment">查看达标标准 →</a></div><div class="three-col">' + M.songs.map(songCard).join('') + '</div><div class="notice">30天是训练安排，达标以作品为准。课程目标是适合零基础的慢速、舒适调完整伴奏弹唱；可以继续补练。页面按你填写的数据和量表汇总，不会自动听评录音或识别音准。</div>';
  }
  function roadmap() {
    const phases = [...new Set(C.lessons.map(l => l.phase))];
    return pageHeading('THE 30-DAY PATH', '一步一步，把歌连起来', '每天先读方法，再做练习，最后留一条记录。所有课次均可打开；若前课实操未稳，优先使用降阶方案。', link('完整讲义与打印', '#/handbook', 'btn-small')) + statsCards() + phases.map((phase, i) => '<section class="roadmap-group"><header><span class="number-tag">' + (i + 1) + '</span><h2>' + e(phase) + '</h2></header><div class="roadmap-list">' + C.lessons.filter(l => l.phase === phase).map(l => { const r = record(l.day), done = P.lessonDone(l, r), skill = P.practicalDone(l, r); return '<a class="day-link" href="#/day/' + l.day + '"><span class="day-no">' + String(l.day).padStart(2, '0') + '</span><div><strong>' + e(l.title) + '</strong><small>' + e(l.goal) + '</small></div><div class="day-meta">' + badge(skill ? '实操自评达标' : done ? '练习已完成' : '待练习', skill ? 'good' : done ? 'wood' : '') + '<br><small>' + l.minutes + '分钟' + ([7, 14, 21, 30].includes(l.day) ? ' · 阶段测评' : '') + '</small></div></a>'; }).join('') + '</div></section>').join('');
  }
  function chordDiagram(name) {
    const c = M.chords[name]; if (!c) return '<p class="notice">本页暂未收录' + e(name) + '，请按所选尤克里里谱本核对指法。</p>';
    const xs = [20, 38, 56, 74];
    return '<div class="chord-card"><strong>' + e(chordName(name)) + '</strong><svg viewBox="0 0 96 128" role="img" aria-label="' + e(chordName(name)) + '，按第4至第1弦，品位' + c.frets.join('、') + '"><title>' + e(chordName(name)) + '：G C E A，品位 ' + c.frets.join(' ') + '</title>' + [0, 1, 2, 3, 4].map(i => '<path d="M20 ' + (25 + i * 20) + 'H74" stroke="#829079" stroke-width="' + (i === 0 ? 3 : 1) + '"/>').join('') + xs.map((x, i) => '<path d="M' + x + ' 25V105" stroke="#849279"/>' + (c.frets[i] ? '<circle cx="' + x + '" cy="' + (15 + c.frets[i] * 20) + '" r="7" fill="#315746"/><text x="' + x + '" y="' + (18 + c.frets[i] * 20) + '" text-anchor="middle" font-size="9" fill="#fffef5">' + c.fingers[i] + '</text>' : '<circle cx="' + x + '" cy="14" r="3" stroke="#819075" fill="none"/>') + '<text x="' + x + '" y="119" text-anchor="middle" font-size="9" fill="#79876d">' + ['G', 'C', 'E', 'A'][i] + '</text>').join('') + '<text x="7" y="39" font-size="8" fill="#98a18d">1</text><text x="7" y="59" font-size="8" fill="#98a18d">2</text><text x="7" y="79" font-size="8" fill="#98a18d">3</text><text x="7" y="99" font-size="8" fill="#98a18d">4</text></svg>' + button('♪ 听和弦', 'chord', 'data-chord="' + e(name) + '"') + '<p>' + e(c.frets.join('')) + '</p></div>';
  }
  function chordCards(names, tips = true) { return '<div class="chords-grid">' + names.map(chordDiagram).join('') + '</div><p class="chord-note">图从左到右＝第4、3、2、1弦（G C E A）；○为空弦，圆点数字是左手指号。上方粗线为琴枕，向下数品位。</p>' + (tips ? names.filter(n => M.chords[n]).map(n => '<p class="note-line"><strong>' + e(chordName(n)) + '：</strong>' + e(M.chords[n].tip) + '</p>').join('') : ''); }
  function patternCard(id) {
    const p = M.patterns[id]; if (!p) return '';
    return '<h3>' + e(p.name) + '</h3>' + (p.kind === 'strum' ? '<div class="pattern-grid">' + p.steps.map((x, i) => '<div class="pattern-cell ' + (x ? i % 2 ? '' : 'accent' : 'empty') + '"><span>' + ['1', '&', '2', '&', '3', '&', '4', '&'][i] + '</span><b aria-label="' + (x === 'D' ? '下扫' : x === 'U' ? '上扫' : '不触弦') + '">' + (x === 'D' ? '↓' : x === 'U' ? '↑' : '·') + '</b></div>').join('') + '</div>' : '<div class="pick-grid ' + (p.strings.length === 8 ? 'eight' : '') + '">' + p.strings.map((x, i) => '<div><small>' + (p.strings.length === 8 ? ['1', '&', '2', '&', '3', '&', '4', '&'][i] : i + 1) + '拍</small>' + x + '<small>弦</small></div>').join('') + '</div>') + '<p class="small muted">' + e(p.description) + '</p><div class="actions" style="margin-top:13px">' + button('▶ 听2小节示范', 'pattern', 'data-pattern="' + id + '"') + button('停止声音', 'audio-stop') + '</div><p class="note-line">合成音仅示意触弦时机和弦序，不是歌曲原曲或真人演奏音色。</p>';
  }
  function drillCard(l) {
    const span = l.drill.beatsPerChord || 4, entries = Math.ceil(l.drill.bars * 4 / span), omissions = l.drill.omitBeatIndices || [];
    const bars = Array.from({ length: l.drill.bars }, (_, b) => {
      const names = [];
      for (let offset = 0; offset < 4; offset++) {
        if (offset === 0 || (b * 4 + offset) % span === 0) names.push(chordName(l.drill.chords[Math.floor((b * 4 + offset) / span) % l.drill.chords.length]));
      }
      const pattern = M.patterns[(l.drill.barPatterns || [])[b] || l.pattern];
      const duration = span > 4 ? '同和弦第' + (Math.floor((b * 4 % span) / 4) + 1) + '/' + (span / 4) + '小节' : span === 4 ? '保持4拍' : '各' + span + '拍';
      const omitted = [0, 1, 2, 3].filter(i => omissions.includes(b * 4 + i));
      return '<span class="drill-bar"><small>第' + (b + 1) + '小节</small><strong>' + e(names.join(' → ')) + '</strong><small>' + e(duration) + '</small>' + (l.drill.barPatterns ? '<small>' + e(pattern.name) + '</small>' : '') + (omitted.length ? '<small class="wood">第' + omitted.map(i => i + 1).join('、') + '拍不触弦，保持数拍</small>' : '') + '</span>';
    });
    return '<span class="eyebrow">ORIGINAL SKILL DRILL</span><h3 style="margin-top:7px">' + e(l.drill.label) + '</h3><div class="drill-line">' + bars.join('') + '</div><p class="small muted">' + e(l.drill.instruction) + '</p><div class="actions" style="margin-top:15px">' + button('▶ 原创循环示范', 'drill', 'data-day="' + l.day + '"') + button('停止声音', 'audio-stop') + '</div><p class="note-line">4/4拍，每次和弦持续' + span + '拍' + (span >= 4 ? '（' + (span / 4) + '小节）' : '（半小节）') + '；共' + l.drill.bars + '小节、' + entries + '次和弦进入。播放前数4拍，只示范1组；任务要求的多组重复与转换计数所需的额外末拍，请按正文手动完成。' + (omissions.length ? '标注的省略拍保留节拍声与数拍，不触弦，下一拍继续。' : '') + '示范只演示本卡技能循环，歌曲的和弦、时值和换点请以已选谱本为准。</p>';
  }
  function timerCard() { return '<section class="card timer-card"><h3>专注练习</h3><div class="timer-display" id="timer-display">' + timerLabel() + '</div><div class="timer-preset">' + [2, 5, 10, 15, 25].map(n => button(n + '分', 'timer-preset', 'data-minutes="' + n + '"')).join('') + '</div><div class="actions timer-actions">' + button(timer.running ? '暂停' : '开始', 'timer-toggle', 'id="timer-toggle"') + button('重置', 'timer-reset') + '</div><p class="note-line">计时是辅助工具；记录里填写本课实际练习总分钟。后台页面的提示音可能被浏览器限制。</p></section>'; }
  function audioCard(bpm = 60) { return '<section class="card audio-card"><h3>让拍点替你守住节奏</h3><label class="tempo-control">速度 <input aria-label="节拍器BPM" id="audio-bpm" type="number" min="30" max="180" value="' + (audio.tempo || bpm) + '"> BPM</label><div class="audio-controls">' + button(audio.metroTimer ? '停止节拍器' : '▶ 节拍器', 'metronome', 'id="metro-toggle"') + button('停止全部', 'audio-stop') + '</div><div class="beat-lights" aria-hidden="true"><i></i><i></i><i></i><i></i></div><p id="audio-status" role="status">4/4拍 · 第一拍重音 · 点击后发声</p></section>'; }
  function recorderCard() { return '<section class="card record-card"><h3>留下这一遍的声音</h3><p>先停止示范音，再录自己的演奏。录音只在当前页面内存中，完成后立即下载；复盘由你或老师听评。</p><div class="actions" style="margin-top:13px">' + button(recorder.active ? '查看当前录音' : '● 开始录音', 'record-start') + '</div></section>'; }
  function renderQuiz(l, r) { return '<h2>两题理解检查</h2><p class="note-line">选择后查看解释；可以重答。答对表示理解概念，实操仍要实际弹奏验证。</p>' + l.quiz.map((q, i) => { const ans = r.quiz[i], has = Number.isInteger(ans), correct = ans === q.answer; return '<section class="quiz-item"><p>' + (i + 1) + '. ' + e(q.question) + '</p><div class="quiz-options">' + q.options.map((o, k) => '<button class="quiz-option' + (has && ans === k ? correct ? ' correct selected' : ' wrong selected' : has && q.answer === k ? ' correct' : '') + '" data-action="quiz" data-question="' + i + '" data-option="' + k + '" aria-pressed="' + (ans === k) + '"><span>' + String.fromCharCode(65 + k) + '</span>' + e(o) + '</button>').join('') + '</div>' + (has ? '<div class="quiz-explanation' + (correct ? '' : ' wrong') + '"><strong>' + (correct ? '回答正确。' : '再想一想，正确选项是' + String.fromCharCode(65 + q.answer) + '。') + '</strong> ' + e(q.explanation) + '</div>' : '') + '</section>'; }).join(''); }
  function dayView(l) {
    const r = record(l.day), keys = P.stepKeys(l), checked = keys.filter(k => r.tasks[k]).length;
    const song = getSong(l.song), stage = STAGES.find(s => s.day === l.day);
    return '<div class="breadcrumbs"><a href="#/roadmap">30天路线</a><span>/</span><span>' + e(l.phase) + '</span></div><div class="page-title-row"><div class="day-title"><span class="number-tag">' + String(l.day).padStart(2, '0') + '</span><div><span class="eyebrow">DAY ' + String(l.day).padStart(2, '0') + ' / ' + l.minutes + ' MINUTES</span><h1>' + e(l.title) + '</h1></div></div><div class="no-print">' + button('打印本课', 'print') + '</div></div><p class="day-goal">今日目标：' + e(l.goal) + '</p>' + (song ? '<div class="notice">本课练习曲目：<a href="#/songs/' + song.id + '">《' + e(song.title) + '》档案与资料 ↗</a>。先记录你使用的同一谱本版本、演唱调与段落位置，再做本课分段练习。</div>' : '') +
      '<div class="lesson-layout"><div class="lesson-material"><section class="card"><span class="eyebrow">READ / 先把方法弄清楚</span><h2 style="margin-top:8px">今天要学会的方法</h2><div class="concept-grid">' + l.concepts.map(c => '<article class="concept"><h3>' + e(c.title) + '</h3><p>' + e(c.body) + '</p></article>').join('') + '</div></section><section class="card"><h2>左手 · 今天的和弦</h2>' + chordCards(l.chords) + '</section><section class="card">' + patternCard(l.pattern) + '</section><section class="card">' + drillCard(l) + '</section><section><div class="section-heading" style="margin-top:8px"><h2>今天的练习清单</h2><span id="task-counter" class="badge">' + checked + '/' + keys.length + '项</span></div><div class="section-stack">' + l.blocks.map((b, bi) => '<article class="card block-card"><div class="block-header"><div><div class="block-no">练习 ' + String(bi + 1).padStart(2, '0') + '</div><h3>' + e(b.title) + '</h3></div>' + button('⏱ ' + b.minutes + '分钟', 'timer-preset', 'data-minutes="' + b.minutes + '"') + '</div>' + b.steps.map((step, i) => '<label class="check-row"><input type="checkbox" data-task="' + e(b.id + ':' + i) + '"' + (r.tasks[b.id + ':' + i] ? ' checked' : '') + '><span class="check-text">' + e(step) + '</span></label>').join('') + '</article>').join('') + '</div></section>' +
      '<section class="card" id="day-record"><h2>把这一课，留成可复盘的记录</h2><p class="note-line">数值留空代表未测试。两项换和弦数据填写同一轮的次数，节奏中断必须同时记录测试小节数。</p><div class="form-grid">' + field('实际练习（分钟）', 'minutes', r.metrics.minutes, { type: 'number', attrs: 'min="0" max="600" step="0.5"', help: '包含读方法、听音、休息；以实际投入填写。' }) + field('本轮练习速度（BPM）', 'bpm', r.metrics.bpm, { type: 'number', attrs: 'min="20" max="240"', placeholder: String(l.bpm), help: '建议从' + l.bpm + ' BPM起步；未测试可留空。' }) + field('清晰换和弦次数', 'changesOk', r.metrics.changesOk, { type: 'number', attrs: 'min="0" max="1000"', help: '同一轮里，落点准且发音清楚的次数。' }) + field('总尝试换和弦次数', 'changesTotal', r.metrics.changesTotal, { type: 'number', attrs: 'min="0" max="1000"', help: '这是成功率的分母，例如10次中的8次。' }) + field('节奏中断次数', 'stops', r.metrics.stops, { type: 'number', attrs: 'min="0" max="1000"' }) + field('这一轮共弹多少小节', 'rhythmBars', r.metrics.rhythmBars, { type: 'number', attrs: 'min="0" max="1000"', help: '同速度、同小节数比较才更有意义。' }) + field('证据文件名或链接', 'evidence', r.evidence, { wide: true, placeholder: '例如 Day' + String(l.day).padStart(2, '0') + '-C和弦.webm / 自己保存的视频链接', help: l.evidence, attrs: 'maxlength="4000"' }) + field('这次最卡在哪里？下次怎么改？', 'note', r.note, { type: 'textarea', wide: true, placeholder: '写清楚和弦对、具体小节、发生的问题，以及下一次减速或拆练的方法。', attrs: 'maxlength="12000"' }) + '</div><p id="metric-error" role="status" class="note-line" style="color:var(--red)"></p><p class="note-line">输入后自动保存。本页不上传音视频；这里保存的是文件名或你主动填写的链接。</p></section>' +
      '<section class="card"><h2>实操验收 · 真弹一遍再勾选</h2><p class="note-line">这些勾选是你的听评，不是系统自动检测。按每条规定实际演奏；未达到就保持未勾选。</p><div class="criterion-list">' + l.criteria.map((s, i) => '<label class="check-row"><input type="checkbox" data-criterion="' + i + '"' + (r.criteria[i] ? ' checked' : '') + '><span class="check-text">' + e(s) + '</span></label>').join('') + '</div><span id="practical-status">' + badge(P.practicalDone(l, r) ? '本课实操自评达标' : '实操仍待验证', P.practicalDone(l, r) ? 'good' : '') + '</span></section><section class="card" id="day-quiz">' + renderQuiz(l, r) + '</section><section class="card"><h3>卡住时，把难度调下来</h3><p class="small muted" style="margin-top:9px">' + e(l.fallback) + '</p><h3 style="margin-top:20px">基础稳了，再多走一步</h3><p class="small muted" style="margin-top:9px">' + e(l.stretch) + '</p></section>' +
      (stage ? '<section class="card soft-card"><span class="eyebrow">CHECKPOINT / 第' + l.day + '天</span><h3 style="margin:8px 0">' + stage.title + '</h3><p class="small muted">' + e(stage.target) + '</p><div class="actions" style="margin-top:15px">' + link('开始阶段测评 →', '#/assessment/stage-' + l.day, 'btn-small') + '</div></section>' : '') +
      '<section class="card complete-panel"><h3 id="completion-heading">' + (P.lessonDone(l, r) ? '这一天的练习，已经留下记录' : '练完今天，再认真按下完成') + '</h3><p>完成清单并填入实际练习分钟后，可以记录本课练习完成。是否实操达标由上方逐项自评单独显示；最终结业看三首完整作品。</p>' + button(P.lessonDone(l, r) ? '✓ 已完成本课练习' : '记录本课练习完成', 'mark-done', 'id="mark-done"' + (checked < keys.length || !(r.metrics.minutes > 0) ? ' disabled' : ''), 'btn') + '<p id="completion-hint" class="note-line">' + (checked < keys.length ? '还剩' + (keys.length - checked) + '项任务。' : !(r.metrics.minutes > 0) ? '请填写实际练习分钟。' : '可以保存本课的完成状态。') + '</p></section></div><aside class="lab-panel">' + timerCard() + audioCard(l.bpm) + recorderCard() + '</aside></div><div class="day-footer">' + (l.day > 1 ? link('← 第' + (l.day - 1) + '天', '#/day/' + (l.day - 1), 'btn-secondary') : '<a href="#/roadmap">← 全部课次</a>') + (l.day < 30 ? link('第' + (l.day + 1) + '天 →', '#/day/' + (l.day + 1), 'btn-secondary') : link('查看三曲测评 →', '#/assessment', 'btn-secondary')) + '</div>';
  }
  function songsView() {
    return pageHeading('THREE SONGS, THREE STORIES', '先选定版本，再把歌练完整', '三首歌分别留下谱本、演唱调、难点和完整作品。一周里的练习始终围绕同一份版本。') + '<div class="three-col">' + M.songs.map(songCard).join('') + '<section class="card" style="margin-top:24px"><h2>怎样选一个适合现在的版本</h2>' + htmlList(['先试听主歌与副歌，找到不用喊唱的舒适调；必要时整曲移调或预先固定降八度。', '优先选清楚标出和弦与唱段顺序的尤克里里入门编配，先保留最简单的伴奏。', '用同一谱本标出主歌、副歌、过门、尾奏及换和弦位置；不要每天换一份谱。', '外部资源的免费范围、登录与收费由原站决定。可使用你已有的合法谱本或原作者免费示范，不必为完成课程强制购买。', '六线吉他TAB不能直接在四弦尤克里里上照弹。不要把本站原创和弦练习误当成三首歌的实际谱。']) + '</section>';
  }
  function resourcesList(resources) { return '<div class="resource-list">' + (resources || []).map(r => '<div class="resource-item"><a href="' + url(r.url) + '" target="_blank" rel="noopener noreferrer">' + e(r.title) + '</a><p>' + e(r.note) + '</p></div>').join('') + '</div>'; }
  function songView(s) {
    const p = state.songPlans[s.id] || P.freshPlan(), result = P.assess(state.assessments[s.id]);
    return '<div class="breadcrumbs"><a href="#/songs">三首歌档案</a><span>/</span><span>' + e(s.title) + '</span></div><section class="song-detail-hero"><div><span class="eyebrow">YOUR SONG / ' + e(s.artist) + '</span><h1>' + e(s.title) + '</h1><p>' + e(s.tempo) + '</p><div class="actions" style="margin-top:18px">' + link('进入本曲测评 →', '#/assessment/' + s.id, 'btn') + badge(result.passed ? '自评达标' : result.assessed ? result.score + '分 · 尚需核对达标条件' : '未评', result.passed ? 'good' : 'outline') + '</div></div><div class="disc" aria-hidden="true"></div></section><div class="two-col"><section class="card"><h2>这首歌，怎样拆开练</h2><p class="small muted" style="margin-top:12px">' + e(s.goal) + '</p><h3 style="margin-top:20px">最需要留心的地方</h3><div class="small muted">' + htmlList(s.difficulties) + '</div><h3 style="margin-top:20px">练习顺序</h3><div class="small muted">' + htmlList(s.approach, true) + '</div></section><section class="card"><h2>分段练习安排</h2><div class="small muted">' + htmlList(s.sectionPlan, true) + '</div><h3 style="margin-top:24px">把细节弹稳</h3><div class="small muted">' + htmlList(s.practiceTips) + '</div></section></div><section class="card" style="margin-top:22px" id="song-plan"><span class="eyebrow">MY EDITION / 我的练习版本</span><h2 style="margin-top:8px">把你的谱本固定下来</h2><p class="note-line">记录自己选定的合法资料。主歌/副歌的时间位置依据你选的录音填写，便于每次练同一段。</p><div class="form-grid">' + field('谱本版本 / 编配者', 'version', p.version, { scope: 'plan', placeholder: '例如：某位老师的C调入门伴奏版', attrs: 'maxlength="6000"' }) + field('谱本或参考音源链接', 'source', p.source, { scope: 'plan', type: 'url', placeholder: 'https://… 或留空，版本栏写纸质谱本', attrs: 'maxlength="6000"' }) + field('演唱调与固定八度', 'key', p.key, { scope: 'plan', placeholder: '例如：C调，主歌按舒适八度；移调后保持一致', attrs: 'maxlength="6000"' }) + field('主歌起止位置', 'verse', p.verse, { scope: 'plan', placeholder: '例如 00:20–00:48 / 谱第1–8小节', attrs: 'maxlength="6000"' }) + field('副歌起止位置', 'chorus', p.chorus, { scope: 'plan', placeholder: '例如 01:10–01:40 / 谱第17–24小节', attrs: 'maxlength="6000"' }) + field('当前最难的小节 / 和弦对', 'difficultBars', p.difficultBars, { scope: 'plan', placeholder: '写谱本位置与具体难点', attrs: 'maxlength="6000"' }) + field('全曲结构、换点与下次安排', 'notes', p.notes, { scope: 'plan', type: 'textarea', wide: true, placeholder: '例如 A1 → A2 → B → 间奏 → A2 → B → 结束；副歌入点提前准备。', attrs: 'maxlength="6000"' }) + '</div><p class="note-line">自动保存在本机，导出进度时包含此档案。来源链接可留空；不要填写私人访问口令。</p>' + (p.source && /^https?:\/\//.test(p.source) ? '<a class="text-btn" target="_blank" rel="noopener noreferrer" href="' + url(p.source) + '">打开我选的资料 ↗</a>' : '') + '</section><section class="card" style="margin-top:22px"><h2>本阶段可能用到的和弦</h2><p class="note-line">这是课程技能覆盖范围；实际曲谱未必全用，也可能包含其他和弦，请以你选的编配为准。</p>' + chordCards(s.neededChords) + '</section><section class="card" style="margin-top:22px"><h2>原教学与谱本资源</h2><div class="notice">这里提供原站入口，不复制完整歌词或受版权保护的乐谱。公开页面不代表全部谱面免费；你可以使用已有合法谱本或免费原作者演示。六线吉他TAB不能直接照弹。</div>' + resourcesList(s.resources) + '</section><div class="section-heading"><h2>这首歌的日课</h2></div><div class="roadmap-list">' + C.lessons.filter(l => l.song === s.id).map(l => '<a class="day-link" href="#/day/' + l.day + '"><span class="day-no">' + String(l.day).padStart(2, '0') + '</span><div><strong>' + e(l.title) + '</strong><small>' + e(l.goal) + '</small></div><span>→</span></a>').join('') + '</div>';
  }
  function assessmentOverview() {
    const stats = P.stats(state, C, M);
    return pageHeading('LISTEN, ASSESS, PRACTICE AGAIN', '让作品说出你练到了哪里', '先录音或视频，再照量表听评。页面只做分数计算与条件核对；音准、节奏和弹唱质量由你或老师实际判断。') + '<section class="card soft-card"><div class="page-title-row"><div><span class="eyebrow">FINAL GOAL / 完整弹唱</span><h2 style="margin-top:9px">' + (stats.graduated ? '三首作品均已满足自评达标条件' : '三首歌，分别通过') + '</h2><p class="small muted" style="margin-top:12px">每首总分≥80，且每个维度≥3/5；完整版本、一镜到底、无整段重来，并留下可找回的证据引用。</p></div><span class="number-tag">' + stats.songsPassed + '/3</span></div><p class="note-line">结业结果基于你的真实评分与证据声明。任务勾选、理解小测和练习天数都不会直接把歌曲判为达标。</p></section><div class="section-heading"><h2>三首歌 · 正式实操测评</h2></div><div class="three-col">' + M.songs.map((s, i) => { const r = P.assess(state.assessments[s.id]); return '<section class="card song-card"><span class="song-no">PERFORMANCE / 0' + (i + 1) + '</span><h3>' + e(s.title) + '</h3><p>' + e(s.artist) + '</p><div class="card-bottom">' + badge(r.passed ? '自评达标' : r.assessed ? r.score + ' / 100' : '未评', r.passed ? 'good' : '') + '<a href="#/assessment/' + s.id + '">听评与打分 →</a></div></section>'; }).join('') + '</div><div class="section-heading"><h2>四个阶段 · 看清下一步</h2></div><div class="assessment-grid">' + STAGES.map(s => { const r = P.checkpoint(getLesson(s.day) || {criteria: []}, record(s.day), state.assessments['stage-' + s.day]); return '<section class="card assessment-card"><span class="eyebrow">DAY ' + String(s.day).padStart(2, '0') + '</span><h3>' + e(s.title) + '</h3><p>' + e(s.short) + '</p>' + badge(r.passed ? '阶段自评达标' : r.gates.criteria ? '待补证据' : '待检查', r.passed ? 'good' : '') + '<br>' + link('开始测评 →', '#/assessment/stage-' + s.day, 'btn-small') + '</section>'; }).join('') + '</div><div class="notice">歌唱音准请对照与你同调的参考旋律，允许在测试前固定适合自己的八度。不要拿原唱的原调声高去判定移调后的演唱“跑调”。</div>';
  }
  function resultCard(id, a) {
    const stageDay = id.startsWith('stage-') ? Number(id.slice(6)) : null;
    if (stageDay) {
      const l = getLesson(stageDay) || {criteria: []}, r = P.checkpoint(l, record(stageDay), a);
      const checks = [['criteria', '本课三项实操标准均自评达到'], ['complete', '完整完成本阶段测试'], ['oneTake', '连续录制，未剪辑拼接'], ['noRestart', '本次测试无整段重来'], ['evidence', '已填写可找回的证据引用']];
      return '<h3>阶段检查结果</h3><div class="score-total"><strong>' + (r.passed ? '通过' : '待完成') + '</strong><span>依据本阶段实操标准与证据声明</span></div>' + checks.map(x => '<div class="gate' + (r.gates[x[0]] ? ' pass' : '') + '"><span>' + x[1] + '</span><b>' + (r.gates[x[0]] ? '✓' : '待满足') + '</b></div>').join('') + '<p class="note-line">这是人工自评的阶段检查，五维观察可选填。三首歌的正式测评仍分别要求总分≥80、每项≥3及完整作品证据；阶段通过不会自动完成任何歌曲。</p>';
    }
    const r = P.assess(a), stage = false;
    const checks = [['scored', '五个维度均已评分'], ['total', '总分至少80 / 100'], ['minimum', '每一项至少3 / 5'], ['complete', stage ? '完整完成本阶段测试' : '完整演奏选定歌曲版本'], ['oneTake', '一镜到底，未剪辑拼接'], ['noRestart', '全曲 / 本测试无整段重来'], ['evidence', '已填写可找回的证据引用']];
    return '<h3>' + (stage ? '阶段结果' : '本曲结果') + '</h3><div class="score-total"><strong>' + (r.assessed ? r.score : '未评') + '</strong><span>' + (r.assessed ? '/ 100 · 加权得分' : '五项评分完整后计算总分') + '</span></div><div style="text-align:center;margin-bottom:16px">' + badge(r.passed ? '自评达标' : r.assessed ? '待完善 / 继续补练' : '尚未完成评估', r.passed ? 'good' : 'wood') + '</div>' + checks.map(x => '<div class="gate' + (r.gates[x[0]] ? ' pass' : '') + '"><span>' + x[1] + '</span><b>' + (r.gates[x[0]] ? '✓' : '待满足') + '</b></div>').join('') + '<p class="note-line">评分依据人工听评；系统未听取或分析你的音频。少一个条件都不会自动通过。</p>';
  }
  function assessmentView(id) {
    const song = getSong(id), stage = STAGES.find(s => 'stage-' + s.day === id), a = state.assessments[id] || P.freshAssessment();
    const title = song ? '《' + song.title + '》完整弹唱测评' : '第' + stage.day + '天 · ' + stage.title;
    return '<div class="breadcrumbs"><a href="#/assessment">测评中心</a><span>/</span><span>' + e(title) + '</span></div>' + pageHeading('PERFORMANCE / 用同一标准听评', title, song ? '用曲目档案里的同一版本、同一演唱调完成一条完整录音，再逐项打分。每一项都可以保持未评。' : stage.target, button('打印测评', 'print')) + (stage ? '<section class="card" style="margin-bottom:20px"><h3>本次测试标准 · 与日课同步</h3><p class="note-line">按原始录音逐项核对，仅在实际达到后勾选。这里的勾选也会同步到第' + stage.day + '课实操检查。</p>' + stage.tasks.map((t, i) => '<label class="criterion"><input type="checkbox" data-stage-criterion="' + i + '"' + ((record(stage.day).criteria || [])[i] ? ' checked' : '') + '><span>' + e(t) + '</span></label>').join('') + '</section>' : '<div class="notice">先核对<a href="#/songs/' + id + '">本曲版本档案</a>。允许慢速和固定移调；“完整”须包括所选版本全部唱段与结尾，不能只录副歌。</div>') + '<div class="columns"><div class="section-stack"><section class="card"><h2>' + (stage ? '五维观察量表（选填）' : '五维量表') + '</h2>' + (stage ? '<p class="note-line">阶段检查以本课实操标准为准。尚未涉及歌唱的第7天，请把歌唱相关维度留在未评；不要为了填表编造分数。</p>' : '') + '<p class="note-line">0＝当前未能完成该能力，5＝本维度稳定完成；空白＝尚未评。点击分值后显示对应锚点。</p>' + M.rubric.map(d => '<section class="rubric-dimension"><div class="rubric-head"><strong>' + e(d.name) + '</strong><span class="muted small">权重 ' + d.weight + '%</span></div><div class="score-buttons" role="group" aria-label="' + e(d.name) + '评分">' + d.anchors.map((anchor, i) => '<button class="score-button' + (a.scores[d.id] === i ? ' selected' : '') + '" data-action="score" data-dimension="' + d.id + '" data-score="' + i + '" aria-pressed="' + (a.scores[d.id] === i) + '" title="' + e(anchor) + '">' + i + '</button>').join('') + '</div><p class="score-description' + (a.scores[d.id] == null ? ' unscored' : '') + '" id="anchor-' + d.id + '">' + e(a.scores[d.id] == null ? '未评：听过这一维度后再选择分数。' : d.anchors[a.scores[d.id]]) + '</p><details class="rubric-all"><summary>查看0–5分完整标准</summary><ol>' + d.anchors.map((v, i) => '<li><strong>' + i + '分：</strong>' + e(v) + '</li>').join('') + '</ol></details>' + button('改为未评', 'score-clear', 'data-dimension="' + d.id + '"', 'text-btn') + '</section>').join('') + '<div class="notice">音准评分请对照与你同调的参考旋律。允许测试前固定舒服的八度，并在记录里注明；不要用原唱的原调声高衡量你的移调演唱。</div></section><section class="card" id="assessment-record"><h2>完整作品证据</h2>' + checkedLabel(stage ? '我完整完成了上方阶段测试的所有步骤。' : '我完成了所选版本全部唱段，顺序正确，并弹到结尾。', 'complete', a.complete) + checkedLabel('这是一条从头到尾的连续录制，没有拼接或剪掉失误。', 'oneTake', a.oneTake) + '<div class="form-grid">' + field('整段从头重来的次数', 'restarts', a.restarts, { scope: 'assessment', type: 'number', attrs: 'min="0" max="1000"', placeholder: '未统计请留空；一次也没有则填0', help: '局部错音后继续与整段重来分开计算。' }) + field('录制使用的速度（BPM）', 'bpm', a.bpm, { scope: 'assessment', type: 'number', attrs: 'min="20" max="240"', placeholder: '实际选择的练习速度' }) + field('完整录音 / 视频文件名或链接', 'evidence', a.evidence, { scope: 'assessment', wide: true, attrs: 'maxlength="4000"', placeholder: '例如 安静-C调-完整-2026-11-15.webm', help: '这里只保存引用；请先在自己设备或网盘实际保存作品。' }) + field('听评人、演唱调、听到的问题、下次补练', 'note', a.note, { scope: 'assessment', type: 'textarea', wide: true, attrs: 'maxlength="12000"', placeholder: '写出判断依据：第几小节/哪个入点/哪一对和弦；若有老师听评也可注明。' }) + '</div><p class="note-line">每次更改自动保存，最新版测评进入结业判断。重测前可先导出备份保留历史。</p></section></div><aside class="section-stack"><section class="card" id="assessment-result">' + resultCard(id, a) + '</section>' + recorderCard() + '<section class="card soft-card"><h3>分数之后，才是下一步</h3><p class="small muted" style="margin-top:10px">先补低于3分的维度，再改善总分；没有证据或完整演奏时，先录出一条能找回的作品。</p><div class="actions" style="margin-top:15px">' + link('查看补练建议 →', '#/insights', 'btn-small') + '</div></section></aside></div>';
  }
  function graph(data, maximum, unit, color) {
    if (!data.length) return '<div class="empty-state" style="margin-top:20px"><p>还没有可绘制的' + e(unit) + '记录。</p></div>';
    const W = 460, H = 170, left = 35, right = 15, top = 15, bottom = 30;
    const x = d => left + (d - 1) / 29 * (W - left - right), y = v => H - bottom - v / maximum * (H - top - bottom);
    const labels = [0, maximum / 2, maximum];
    return '<svg class="trend" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="第1至30课的' + e(unit) + '自报记录，完整数值在下方表格"><title>按课次展示' + e(unit) + '，不代表日历连续天数或自动检测能力</title>' + labels.map(n => '<path d="M' + left + ' ' + y(n) + 'H' + (W - right) + '" stroke="#e2e7da"/><text x="' + (left - 7) + '" y="' + (y(n) + 3) + '" text-anchor="end" font-size="9" fill="#829077">' + Math.round(n) + '</text>').join('') + [1, 7, 14, 21, 30].map(d => '<text x="' + x(d) + '" y="' + (H - 9) + '" text-anchor="middle" font-size="9" fill="#829077">D' + d + '</text>').join('') + '<path d="' + data.map((p, i) => (i ? 'L' : 'M') + x(p[0]) + ' ' + y(p[1])).join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2"/>' + data.map(p => '<circle cx="' + x(p[0]) + '" cy="' + y(p[1]) + '" r="3" fill="' + color + '"><title>第' + p[0] + '天：' + fmt(p[1]) + e(unit) + '</title></circle>').join('') + '</svg>';
  }
  function insights() {
    const entries = Object.entries(state.records).sort((a, b) => Number(a[0]) - Number(b[0]));
    const mins = entries.filter(([, r]) => r.metrics.minutes != null).map(([d, r]) => [Number(d), r.metrics.minutes]);
    const rates = entries.filter(([, r]) => r.metrics.changesTotal > 0 && r.metrics.changesOk != null).map(([d, r]) => [Number(d), r.metrics.changesOk / r.metrics.changesTotal * 100]);
    return pageHeading('REFLECT / 然后更有方向地练', '把记录，变成下一次的练法', '这些汇总来自你填写的分钟、次数和人工听评分数。页面没有上传、识别或分析你的录音。') + statsCards() + '<div class="notice warning">比较前先对齐条件：同一和弦对、同一BPM、同一节奏型、相同测试小节数，才适合前后对照。不同课次的曲目与难度在变化；连线只展示记录，不证明能力提升。每天改填会覆盖本课旧数值，重测前可先导出备份。</div><div class="two-col"><section class="card"><h3>实际练习时间</h3><p class="note-line">横轴是课次；纵轴单位为分钟。</p>' + graph(mins, Math.max(60, ...mins.map(x => x[1])), '分钟', '#668453') + '</section><section class="card"><h3>换和弦成功率</h3><p class="note-line">清晰次数 ÷ 总尝试次数；留空与分母0不作0分处理。</p>' + graph(rates, 100, '%', '#aa8550') + '</section></div><div class="section-heading"><h2>下一次，优先练这些</h2><span class="small muted">按已有记录提供规则建议</span></div><div class="two-col">' + P.feedback(state, C).map(a => '<section class="card advice-card"><h3>' + e(a.title) + '</h3><p>' + e(a.text) + '</p></section>').join('') + '</div><section class="card" style="margin-top:25px"><h2>课次记录明细</h2>' + (entries.length ? '<div class="table-scroll"><table><thead><tr><th>课次与练习内容</th><th>分钟</th><th>BPM</th><th>清晰/总次数</th><th>中断/小节</th><th>完成 / 实操</th><th>更新</th></tr></thead><tbody>' + entries.map(([d, r]) => { const l = getLesson(d); return '<tr><td><a class="insight-day" href="#/day/' + d + '">D' + d + ' · ' + e(l.title) + '</a><br><span class="muted tiny">' + e(l.chords.map(chordName).join(' · ')) + ' / ' + e(M.patterns[l.pattern].name) + '</span></td><td>' + fmt(r.metrics.minutes) + '</td><td>' + fmt(r.metrics.bpm) + '</td><td>' + fmt(r.metrics.changesOk) + ' / ' + fmt(r.metrics.changesTotal) + '</td><td>' + fmt(r.metrics.stops) + ' / ' + fmt(r.metrics.rhythmBars) + '</td><td>' + (P.lessonDone(l, r) ? '练完' : '进行中') + ' / ' + (P.practicalDone(l, r) ? '自评达标' : '待验证') + '</td><td>' + dateLabel(r.updatedAt) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty-state" style="margin-top:18px"><h3>第一条记录，就是起点</h3><p>先完成第1课，再回来看看你留下的线索。</p><div class="actions" style="justify-content:center;margin-top:15px">' + link('打开第1课', '#/day/1', 'btn-small') + '</div></div>') + '</section><section class="card" style="margin-top:22px"><h2>三首歌的五维得分</h2><div class="table-scroll"><table><thead><tr><th>曲目</th>' + M.rubric.map(d => '<th>' + e(d.name) + '</th>').join('') + '<th>总分</th><th>结果</th></tr></thead><tbody>' + M.songs.map(s => { const a = state.assessments[s.id], result = P.assess(a); return '<tr><td><a href="#/assessment/' + s.id + '">' + e(s.title) + '</a></td>' + M.rubric.map(d => '<td>' + (a && a.scores[d.id] != null ? a.scores[d.id] + '/5' : '未评') + '</td>').join('') + '<td>' + (result.score == null ? '未评' : result.score) + '</td><td>' + (result.passed ? '自评达标' : '待满足条件') + '</td></tr>'; }).join('') + '</tbody></table></div></section>';
  }
  function toolsView() {
    return pageHeading('PRACTICE TOOLS', '把注意力，留给手里的琴', '声音只在你点击后播放。参考音、合成示范和节拍器帮助你建立拍点；录音交给自己的耳朵和老师听评。') + '<div class="tool-grid"><section class="card"><h2>调音参考 · 高G GCEA</h2><p class="note-line">从靠近脸到靠近地面：第4、3、2、1弦。第3弦C是最低音。听参考音并配合调音器确认，不要只凭耳朵大幅拧紧琴弦。</p><div class="tuning-notes">' + [[4, 'G4', 392], [3, 'C4', 261.63], [2, 'E4', 329.63], [1, 'A4', 440]].map(x => '<button class="tuning-note" data-action="tune" data-string="' + x[0] + '"><small>第' + x[0] + '弦</small><strong>' + x[1] + '</strong><small>' + x[2] + ' Hz</small></button>').join('') + '</div>' + button('停止参考音', 'audio-stop') + '<p class="note-line">适用于常见高G尤克里里。低G或其他调弦请先核对自己的琴，勿照此把低G硬调高一八度。</p></section>' + audioCard(60) + timerCard() + recorderCard() + '</div><section class="card" style="margin-top:22px"><h2>节奏字典</h2><p class="note-line">点击示范前可先在上方调整BPM。分解弦序中的数字是弦号；图中和弦圆点里的数字才是左手指号。</p>' + Object.keys(M.patterns).map(id => '<details class="details-card"' + (id === 'down4' ? ' open' : '') + '><summary>' + e(M.patterns[id].name) + '</summary><div style="white-space:normal">' + patternCard(id) + '</div></details>').join('') + '</section><section class="card" style="margin-top:22px"><h2>和弦字典</h2><p class="note-line">从C、Am、F、G开始。其他和弦按所选谱本需要逐步增加；不要把和弦名字相似当作可以随意替换。</p>' + chordCards(Object.keys(M.chords), false) + '<div style="margin-top:20px">' + Object.entries(M.chords).map(([name, chord]) => '<details class="details-card"><summary>' + e(chordName(name)) + ' · 按法提示</summary><div>' + e(chord.tip) + '</div></details>').join('') + '</div></section>';
  }
  function resourcesView() {
    return pageHeading('LEARN THE FOUNDATIONS', '读懂琴，也读懂自己的练习', '需要时回来查一次。基础方法、原始资料、完整讲义和进度备份都在这里。') + '<section class="card"><h2>教材与练习数据</h2><div class="actions" style="margin-top:17px">' + link('完整30天讲义 ↓', 'downloads/ukulele-30-days.md', 'btn-secondary') + link('打开可打印教材', '#/handbook', 'btn-secondary') + button('导出进度 JSON', 'export', '', 'btn-secondary') + button('导入与合并进度', 'import', '', 'btn-secondary') + '</div><p class="note-line">导出包含日课、曲目版本和测评，不包含音频。导入会先校验，仅替换同一条目中时间较新的记录；相同时间保留本机版本。只在当前浏览器保存，不会自动跨设备同步。</p></section><div class="section-heading"><h2>零基础方法手册</h2></div>' + M.basics.map((b, i) => '<details class="details-card"' + (i === 0 ? ' open' : '') + '><summary>' + String(i + 1).padStart(2, '0') + ' · ' + e(b.title) + '</summary><div>' + e(b.body) + '</div></details>').join('') + '<section class="card" style="margin-top:25px"><h2>来源与延伸学习</h2><p class="note-line">音乐基础与外部曲目资料均保留原始来源。本站提供原创教学方法与通用练习，不托管三首歌完整歌词或乐谱。</p>' + resourcesList(M.sources) + '</section><div class="notice">手指疲劳可以缩短按弦时间、多做听音和节奏练习；出现明显疼痛、麻木或持续不适时先停止。比完成当天分钟数更重要的是能舒适地继续练。</div>';
  }
  function handbook() {
    return pageHeading('THE COMPLETE HANDBOOK', '30天完整练习讲义', '浏览器打印可保存为PDF。以下包含每一天的方法、任务、技能循环、验收标准与小测答案。', button('打印全部 / 保存PDF', 'print', '', 'btn') + link('下载Markdown讲义', 'downloads/ukulele-30-days.md', 'btn-small')) + '<div class="notice">标准高G调弦：G4–C4–E4–A4。原创循环只用于训练，不是歌曲乐谱。三曲实际唱段与和弦换点依据自己选定的合法尤克里里版本。30天达标需分别完成三首完整作品测评。</div>' + C.lessons.map(l => '<article class="handbook-lesson"><span class="eyebrow">DAY ' + String(l.day).padStart(2, '0') + ' / ' + l.minutes + '分钟 / ' + e(l.phase) + '</span><h2>第' + l.day + '天 · ' + e(l.title) + '</h2><p style="margin-top:15px"><strong>目标：</strong>' + e(l.goal) + '</p>' + l.concepts.map(c => '<div class="lesson-concept"><h3>' + e(c.title) + '</h3><p>' + e(c.body) + '</p></div>').join('') + '<h3>和弦与节奏</h3>' + chordCards(l.chords, false) + '<p><strong>' + e(M.patterns[l.pattern].name) + '</strong>：' + e(M.patterns[l.pattern].description) + '</p><p><strong>原创练习：</strong>' + e(l.drill.chords.join(' → ')) + '，共' + l.drill.bars + '小节，起步' + l.bpm + ' BPM。' + e(l.drill.instruction) + '</p>' + l.blocks.map(b => '<section><h3>□ ' + e(b.title) + ' · ' + b.minutes + '分钟</h3>' + htmlList(b.steps, true) + '</section>').join('') + '<h3>实操验收</h3>' + htmlList(l.criteria) + '<p><strong>证据：</strong>' + e(l.evidence) + '</p><h3>理解小测与解析</h3>' + l.quiz.map((q, i) => '<section><p><strong>' + (i + 1) + '. ' + e(q.question) + '</strong></p>' + htmlList(q.options.map((v, j) => String.fromCharCode(65 + j) + '. ' + v)) + '<p>答案：' + String.fromCharCode(65 + q.answer) + '。' + e(q.explanation) + '</p></section>').join('') + '<p><strong>降阶：</strong>' + e(l.fallback) + '</p><p><strong>进阶：</strong>' + e(l.stretch) + '</p></article>').join('');
  }
  // Audio starts only inside an explicit user interaction. No assets or microphone are preloaded.
  const audio = { ctx: null, tempo: 60, metroTimer: null, nextBeat: 0, beat: 0, nodes: new Set(), jobs: new Set(), demoTimer: null, status: '' };
  const tuning = [392, 261.625565, 329.627557, 440]; // 4,3,2,1; high-G
  async function audioContext() {
    const AudioClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioClass) { toast('当前浏览器不支持合成音频。可使用实体调音器与节拍器继续练习。'); return null; }
    try { if (!audio.ctx || audio.ctx.state === 'closed') audio.ctx = new AudioClass(); await audio.ctx.resume(); return audio.ctx; }
    catch (err) { toast('音频未能启动，请检查设备静音或更换浏览器后重试。'); return null; }
  }
  function sound(freq, start, duration = .8, volume = .11, kind = 'triangle') {
    const ctx = audio.ctx; if (!ctx) return;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = kind; osc.frequency.value = freq; gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + .007);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(start); osc.stop(start + duration + .02);
    audio.nodes.add(osc); osc.onended = () => { audio.nodes.delete(osc); try { osc.disconnect(); gain.disconnect(); } catch (_) {} };
  }
  function pluck(name, string, start, duration = .8, volume = .1) {
    const chord = M.chords[name] || M.chords.C, i = 4 - string;
    sound(tuning[i] * Math.pow(2, chord.frets[i] / 12), start, duration, volume);
  }
  function strum(name, start, up = false) { const strings = up ? [1, 2, 3, 4] : [4, 3, 2, 1]; strings.forEach((s, i) => pluck(name, s, start + i * .017, .7, up ? .065 : .08)); }
  function beatSound(start, beat) { sound(beat === 0 ? 1050 : 760, start, .045, beat === 0 ? .075 : .045, 'sine'); }
  function scheduleVisual(time, beat) {
    if (!audio.ctx) return;
    const job = setTimeout(() => { audio.jobs.delete(job); document.querySelectorAll('.beat-lights i').forEach((el, i) => el.classList.toggle('on', i === beat)); }, Math.max(0, (time - audio.ctx.currentTime) * 1000)); audio.jobs.add(job);
  }
  function updateAudioUI(text) {
    if (text != null) audio.status = text;
    const status = document.getElementById('audio-status'); if (status) status.textContent = audio.status || '4/4拍 · 第一拍重音 · 点击后发声';
    const metro = document.getElementById('metro-toggle'); if (metro) metro.textContent = audio.metroTimer ? '停止节拍器' : '▶ 节拍器';
  }
  function stopAudio(quiet = false) {
    if (audio.metroTimer) clearInterval(audio.metroTimer); audio.metroTimer = null;
    if (audio.demoTimer) clearInterval(audio.demoTimer); audio.demoTimer = null;
    for (const id of audio.jobs) clearTimeout(id); audio.jobs.clear();
    for (const node of audio.nodes) { try { node.stop(); } catch (_) {} } audio.nodes.clear();
    document.querySelectorAll('.beat-lights i').forEach(el => el.classList.remove('on'));
    updateAudioUI(quiet ? '' : '声音已停止');
  }
  function getTempo() {
    const el = document.getElementById('audio-bpm'), n = el ? Number(el.value) : audio.tempo;
    if (!Number.isFinite(n) || n < 30 || n > 180) { toast('请将工具速度设在30–180 BPM之间。'); if (el) el.focus(); return null; }
    audio.tempo = n; return n;
  }
  async function metronome() {
    if (audio.metroTimer) { stopAudio(); return; }
    const bpm = getTempo(); if (!bpm) return; stopAudio(true); const ctx = await audioContext(); if (!ctx) return;
    audio.nextBeat = ctx.currentTime + .06; audio.beat = 0;
    const tick = () => { while (audio.nextBeat < ctx.currentTime + .12) { beatSound(audio.nextBeat, audio.beat); scheduleVisual(audio.nextBeat, audio.beat); audio.nextBeat += 60 / audio.tempo; audio.beat = (audio.beat + 1) % 4; } };
    tick(); audio.metroTimer = setInterval(tick, 25); updateAudioUI('节拍器运行中 · ' + bpm + ' BPM · 4/4拍');
  }
  async function tune(string) {
    stopAudio(true); const ctx = await audioContext(); if (!ctx) return;
    sound(tuning[4 - string], ctx.currentTime + .03, 2.6, .15, 'sine');
    updateAudioUI('参考音：第' + string + '弦 ' + ['G4', 'C4', 'E4', 'A4'][4 - string]);
    toast('正在播放第' + string + '弦参考音（高G GCEA）');
  }
  async function playChord(name) {
    stopAudio(true); const ctx = await audioContext(); if (!ctx) return;
    strum(name, ctx.currentTime + .04); updateAudioUI(chordName(name) + '和弦合成示范');
  }
  async function playDemo(chords, bars, patternId, label, beatsPerChord = 4, barPatterns = [], omitBeatIndices = []) {
    const bpm = getTempo(); if (!bpm) return; stopAudio(true); const ctx = await audioContext(); if (!ctx) return;
    const beat = 60 / bpm, start = ctx.currentTime + .08, events = [];
    for (let i = 0; i < 4; i++) events.push({ t: start + i * beat, type: 'beat', b: i });
    for (let b = 0; b < bars; b++) {
      const pattern = M.patterns[barPatterns[b] || patternId];
      const chordAt = offset => chords[Math.floor((b * 4 + offset) / beatsPerChord) % chords.length], time = start + (4 + b * 4) * beat;
      const omitted = offset => omitBeatIndices.includes(Math.floor(b * 4 + offset));
      for (let i = 0; i < 4; i++) events.push({ t: time + i * beat, type: 'beat', b: i });
      if (pattern.kind === 'strum') pattern.steps.forEach((step, i) => { if (step && !omitted(i / 2)) events.push({ t: time + i / 2 * beat, type: 'strum', chord: chordAt(i / 2), up: step === 'U' }); });
      else pattern.strings.forEach((string, i) => { const offset = i * (4 / pattern.strings.length); if (!omitted(offset)) events.push({ t: time + offset * beat, type: 'pluck', chord: chordAt(offset), string }); });
    }
    events.sort((a, b) => a.t - b.t); let index = 0; const finish = start + (4 + bars * 4) * beat;
    const tick = () => {
      while (index < events.length && events[index].t < ctx.currentTime + .12) {
        const ev = events[index++];
        if (ev.type === 'beat') { beatSound(ev.t, ev.b); scheduleVisual(ev.t, ev.b); }
        else if (ev.type === 'strum') strum(ev.chord, ev.t, ev.up);
        else pluck(ev.chord, ev.string, ev.t, Math.min(beat * 1.5, 1.2));
      }
      if (ctx.currentTime > finish + .8) { clearInterval(audio.demoTimer); audio.demoTimer = null; updateAudioUI('示范已结束 · 现在轮到你'); document.querySelectorAll('.beat-lights i').forEach(el => el.classList.remove('on')); }
    };
    tick(); audio.demoTimer = setInterval(tick, 25); updateAudioUI('先数4拍 · ' + label + ' · ' + bpm + ' BPM'); toast('先听4拍预备，再进入' + bars + '小节技能示范。');
  }
  const timer = { total: 300, remaining: 300, running: false, end: 0, interval: null };
  function timerLabel() { const n = Math.max(0, Math.ceil(timer.running ? (timer.end - Date.now()) / 1000 : timer.remaining)); return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'); }
  function paintTimer() { const display = document.getElementById('timer-display'); if (display) display.textContent = timerLabel(); const toggle = document.getElementById('timer-toggle'); if (toggle) toggle.textContent = timer.running ? '暂停' : '开始'; }
  function timerStop() { timer.remaining = Math.max(0, (timer.end - Date.now()) / 1000); timer.running = false; clearInterval(timer.interval); timer.interval = null; paintTimer(); }
  function timerSet(minutes) { if (timer.running) timerStop(); timer.total = Number(minutes) * 60; timer.remaining = timer.total; paintTimer(); toast('已设为' + minutes + '分钟，点击“开始”计时。'); }
  async function timerToggle() {
    if (timer.running) { timerStop(); return; }
    if (timer.remaining <= 0) timer.remaining = timer.total || 300;
    // Unlock audio from this click so a gentle completion tone is possible later.
    await audioContext(); timer.end = Date.now() + timer.remaining * 1000; timer.running = true;
    timer.interval = setInterval(() => { if (Date.now() >= timer.end) { timerStop(); timer.remaining = 0; paintTimer(); toast('本段练习时间到了。放松双手，听一听刚才哪里更稳。'); if (audio.ctx && audio.ctx.state === 'running') { sound(660, audio.ctx.currentTime, .35, .08, 'sine'); sound(880, audio.ctx.currentTime + .25, .4, .06, 'sine'); } } else paintTimer(); }, 250); paintTimer();
  }
  const recorder = { active: false, pending: false, media: null, stream: null, chunks: [], url: '', blob: null, downloaded: true, filename: '', started: 0, timer: null };
  function recorderPanel(message) {
    const dock = document.getElementById('recording-dock'); dock.hidden = false;
    if (recorder.pending) { dock.innerHTML = '<header><strong>等待麦克风权限</strong></header><p>请在浏览器提示里选择是否允许。拒绝也能继续使用课程、打卡与人工测评。</p>'; return; }
    if (recorder.active) { dock.innerHTML = '<header><strong><span class="recording-dot"></span>正在录音 <span id="recording-time">00:00</span></strong>' + button('停止录音', 'record-stop') + '</header><p>录完后请下载。点击停止会关闭麦克风；音频只留在当前页面内存中。</p>'; return; }
    if (recorder.url) { dock.innerHTML = '<header><strong>本次练习录音</strong>' + button('关闭', 'record-close') + '</header><audio controls src="' + recorder.url + '" preload="metadata"></audio><div class="actions"><a class="btn-small" href="' + recorder.url + '" download="' + e(recorder.filename) + '" data-action="record-download">下载录音 ↓</a>' + button('复制文件名', 'record-copy') + '</div><p style="margin-top:9px">' + e(recorder.filename) + '<br>' + (recorder.downloaded ? '已发起下载，请确认文件保存在设备上。' : '尚未下载；刷新或离开此页会丢失。') + '</p>'; return; }
    dock.innerHTML = '<header><strong>录音提示</strong>' + button('关闭', 'record-close') + '</header><p>' + e(message || '暂无录音。可使用手机录音机录下演奏，并把文件名记入证据栏。') + '</p>';
  }
  function stopStream() { if (recorder.stream) recorder.stream.getTracks().forEach(t => t.stop()); recorder.stream = null; }
  async function recordStart() {
    if (recorder.active || recorder.pending) { recorderPanel(); return; }
    if (recorder.url && !recorder.downloaded) { recorderPanel(); toast('请先下载当前录音，再开始下一条，避免覆盖尚未保存的作品。'); return; }
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) { recorderPanel('此浏览器或页面环境不支持网页录音。请在HTTPS页面尝试较新的浏览器，或用手机自带录音机；把保存后的文件名填写到证据栏即可。'); return; }
    stopAudio(true); recorder.pending = true; recorder.context = currentRoute.type === 'day' ? 'Day' + String(currentRoute.day).padStart(2, '0') : currentRoute.type === 'assessment-detail' ? (getSong(currentRoute.id) || { title: currentRoute.id }).title : '练习'; recorderPanel();
    try {
      recorder.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const supported = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t));
      recorder.media = supported ? new MediaRecorder(recorder.stream, { mimeType: supported }) : new MediaRecorder(recorder.stream);
      if (recorder.url) URL.revokeObjectURL(recorder.url); recorder.url = ''; recorder.blob = null; recorder.chunks = []; recorder.downloaded = false;
      recorder.media.ondataavailable = ev => { if (ev.data && ev.data.size) recorder.chunks.push(ev.data); };
      recorder.media.onstop = () => {
        recorder.active = false; recorder.pending = false; clearInterval(recorder.timer); recorder.timer = null; stopStream();
        const mime = recorder.media.mimeType || supported || 'audio/webm'; recorder.blob = new Blob(recorder.chunks, { type: mime });
        if (!recorder.blob.size) { recorder.downloaded = true; recorderPanel('这次没有收到可用音频。请检查麦克风权限和输入设备后重试，或使用手机录音机。'); return; }
        recorder.url = URL.createObjectURL(recorder.blob);
        const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
        const context = recorder.context;
        recorder.filename = '尤克里里-' + context + '-' + new Date(recorder.started).toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.' + ext;
        recorderPanel(); toast('录音已停止，请播放检查并下载保存。');
      };
      recorder.media.onerror = () => { if (recorder.active && recorder.media.state !== 'inactive') recorder.media.stop(); stopStream(); recorder.active = false; recorder.pending = false; clearInterval(recorder.timer); recorderPanel('录音过程中出现错误；请检查已录下的片段，必要时改用手机录音机。'); };
      recorder.media.start(1000); recorder.started = Date.now(); recorder.active = true; recorder.pending = false; recorderPanel();
      recorder.timer = setInterval(() => { const el = document.getElementById('recording-time'), seconds = Math.floor((Date.now() - recorder.started) / 1000); if (el) el.textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0'); }, 500);
    } catch (err) { recorder.pending = false; recorder.active = false; recorder.downloaded = true; stopStream(); recorderPanel(err.name === 'NotAllowedError' ? '麦克风权限被拒绝或未开放。你仍可以完成课程：用手机录音机录下演奏，保存文件，再填写文件名；想重试时可在浏览器站点权限里开放麦克风。' : err.name === 'NotFoundError' ? '没有找到麦克风。连接输入设备后重试，或使用手机录音并记录文件名。' : '当前录音无法启动：' + err.message + '。可改用手机录音机，不影响打卡与人工评估。'); }
  }
  function recordStop() { if (recorder.media && recorder.media.state !== 'inactive') recorder.media.stop(); else stopStream(); }
  function recordClose() {
    if (recorder.active || recorder.pending) { toast('先停止录音，再关闭面板。'); return; }
    if (recorder.url && !recorder.downloaded) { recorderPanel(); toast('这条录音还没下载。请先点击“下载录音”，确认保存后再关闭。'); return; }
    if (recorder.url) URL.revokeObjectURL(recorder.url); recorder.url = ''; recorder.blob = null; recorder.chunks = []; document.getElementById('recording-dock').hidden = true;
  }
  function download(name, contents, mime = 'application/json;charset=utf-8') { const blob = new Blob([contents], { type: mime }), u = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = u; anchor.download = name; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(u), 10000); }
  function exportProgress() { flushPending(); download('ukulele-progress-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify({ app: P.KEY, schema: 1, courseVersion: C.version, exportedAt: now(), state }, null, 2)); toast('已导出课程记录。录音需在录音面板单独下载。'); }
  async function importProgress(file) {
    if (!file) return; if (file.size > 5 * 1024 * 1024) { toast('备份超过5MB，未导入。请确认选的是本课程JSON记录。'); return; }
    try {
      const input = JSON.parse(await file.text()), checked = P.validate(input);
      if (!checked.ok) { toast('未导入：' + checked.errors.slice(0, 2).join(' ')); return; }
      flushPending(); state = P.merge(state, checked.state); save(); render(false); toast('校验通过，已按条目更新时间合并；同时间保留本机版本。' + (storageError ? '请导出当前记录保存。' : ''));
    } catch (err) { toast('未导入，原有记录已保留：' + err.message); }
  }
  let currentRoute = { type: 'home' }, pendingField = null, fieldTimer = null;
  function route() {
    let path = (location.hash || '#/').replace(/^#\/?/, '').split('/');
    if (!path[0]) return { type: 'home' };
    if (path[0] === 'day' && /^\d+$/.test(path[1]) && getLesson(Number(path[1]))) return { type: 'day', day: Number(path[1]) };
    if (path[0] === 'songs' && path[1] && getSong(path[1])) return { type: 'song-detail', id: path[1] };
    if (path[0] === 'assessment' && path[1] && (getSong(path[1]) || STAGES.find(s => 'stage-' + s.day === path[1]))) return { type: 'assessment-detail', id: path[1] };
    if (['roadmap', 'songs', 'tools', 'assessment', 'insights', 'resources', 'handbook'].includes(path[0]) && !path[1]) return { type: path[0] };
    return { type: 'not-found' };
  }
  function render(scroll = true) {
    currentRoute = route();
    const type = currentRoute.type;
    let html = '', title = '学习首页';
    if (type === 'home') html = home();
    if (type === 'roadmap') { html = roadmap(); title = '30天训练路线'; }
    if (type === 'day') { const l = getLesson(currentRoute.day); if (state.lastDay !== l.day) { state.lastDay = l.day; save(); } if (!audio.metroTimer && !audio.demoTimer) audio.tempo = record(l.day).metrics.bpm || l.bpm; html = dayView(l); title = '第' + l.day + '天 · ' + l.title; }
    if (type === 'songs') { html = songsView(); title = '三首歌档案'; }
    if (type === 'song-detail') { const s = getSong(currentRoute.id); html = songView(s); title = s.title; }
    if (type === 'assessment') { html = assessmentOverview(); title = '阶段与结业测评'; }
    if (type === 'assessment-detail') { html = assessmentView(currentRoute.id); title = '实操测评'; }
    if (type === 'tools') { html = toolsView(); title = '练习工具'; }
    if (type === 'insights') { html = insights(); title = '练习复盘'; }
    if (type === 'resources') { html = resourcesView(); title = '基础与资料'; }
    if (type === 'handbook') { html = handbook(); title = '完整练习讲义'; }
    if (type === 'not-found') html = pageHeading('PAGE NOT FOUND', '这一页还不在训练路线里', '请从30天路线中选择要打开的课次。') + link('回到训练路线', '#/roadmap');
    main.innerHTML = html; document.title = title + ' · 尤克里里练习室 · 一心问道';
    const navKey = type === 'day' || type === 'handbook' ? 'roadmap' : type === 'song-detail' ? 'songs' : type === 'assessment-detail' ? 'assessment' : type;
    document.querySelectorAll('#primary-nav a').forEach(a => { a.classList.toggle('active', a.dataset.route === navKey); if (a.dataset.route === navKey) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    paintTimer(); updateAudioUI();
    if (scroll) { window.scrollTo({ top: 0, behavior: 'auto' }); main.focus({ preventScroll: true }); }
  }
  function updateDayUI() {
    if (currentRoute.type !== 'day') return;
    const l = getLesson(currentRoute.day), r = record(l.day), keys = P.stepKeys(l), complete = keys.filter(k => r.tasks[k]).length, done = P.lessonDone(l, r);
    const count = document.getElementById('task-counter'); if (count) count.textContent = complete + '/' + keys.length + '项';
    const mark = document.getElementById('mark-done'); if (mark) { mark.disabled = complete < keys.length || !(r.metrics.minutes > 0); mark.textContent = done ? '✓ 已完成本课练习' : '记录本课练习完成'; }
    const heading = document.getElementById('completion-heading'); if (heading) heading.textContent = done ? '这一天的练习，已经留下记录' : '练完今天，再认真按下完成';
    const hint = document.getElementById('completion-hint'); if (hint) hint.textContent = complete < keys.length ? '还剩' + (keys.length - complete) + '项任务。' : !(r.metrics.minutes > 0) ? '请填写实际练习分钟。' : done ? '练习已保存，实操验收单独记录。' : '可以保存本课的完成状态。';
    const skill = document.getElementById('practical-status'); if (skill) skill.innerHTML = badge(P.practicalDone(l, r) ? '本课实操自评达标' : '实操仍待验证', P.practicalDone(l, r) ? 'good' : '');
  }
  function updateAssessmentUI() {
    if (currentRoute.type !== 'assessment-detail') return;
    const a = state.assessments[currentRoute.id] || P.freshAssessment();
    const result = document.getElementById('assessment-result'); if (result) result.innerHTML = resultCard(currentRoute.id, a);
    M.rubric.forEach(d => { const desc = document.getElementById('anchor-' + d.id); if (desc) { desc.textContent = a.scores[d.id] == null ? '未评：听过这一维度后再选择分数。' : d.anchors[a.scores[d.id]]; desc.classList.toggle('unscored', a.scores[d.id] == null); } });
    document.querySelectorAll('[data-action="score"]').forEach(el => { const selected = a.scores[el.dataset.dimension] === Number(el.dataset.score); el.classList.toggle('selected', selected); el.setAttribute('aria-pressed', String(selected)); });
  }
  function commitMetrics() {
    if (currentRoute.type !== 'day') return true;
    const el = document.getElementById('day-record'); if (!el) return true;
    const r = record(currentRoute.day), metrics = { ...r.metrics };
    for (const inp of el.querySelectorAll('input[type=number]')) { if (!inp.validity.valid) { const error = document.getElementById('metric-error'); error.textContent = '请检查数值范围与步长；此次数值尚未保存。'; return false; } metrics[inp.dataset.field] = inp.value.trim() === '' ? null : Number(inp.value); }
    if (metrics.changesOk != null && metrics.changesTotal != null && metrics.changesOk > metrics.changesTotal) { document.getElementById('metric-error').textContent = '清晰次数不能大于总尝试次数，请修正后保存。'; return false; }
    r.metrics = metrics; if (!(r.metrics.minutes > 0)) r.done = false;
    document.getElementById('metric-error').textContent = ''; writeRecord(currentRoute.day, r); updateDayUI(); return true;
  }
  function commitField(el) {
    if (!el || !el.isConnected) return;
    const scope = el.dataset.scope, key = el.dataset.field;
    if (scope === 'day' && currentRoute.type === 'day') {
      if (el.type === 'number') { commitMetrics(); return; }
      const r = record(currentRoute.day); if (['evidence', 'note'].includes(key)) { r[key] = el.value; writeRecord(currentRoute.day, r); }
    }
    if (scope === 'plan' && currentRoute.type === 'song-detail') {
      const p = state.songPlans[currentRoute.id] || P.freshPlan();
      if (['version', 'source', 'key', 'verse', 'chorus', 'difficultBars', 'notes'].includes(key)) { p[key] = el.value; p.updatedAt = stamp(p.updatedAt); state.songPlans[currentRoute.id] = p; save(); }
    }
    if (scope === 'assessment' && currentRoute.type === 'assessment-detail') {
      const a = state.assessments[currentRoute.id] || P.freshAssessment();
      if (el.type === 'checkbox') a[key] = el.checked;
      else if (el.type === 'number') { if (!el.validity.valid) { toast('请填写允许范围内的数值。此次更改尚未保存。'); return; } a[key] = el.value.trim() === '' ? null : Number(el.value); }
      else a[key] = el.value;
      writeAssessment(currentRoute.id, a); updateAssessmentUI();
    }
  }
  function flushPending() { if (fieldTimer) clearTimeout(fieldTimer); fieldTimer = null; if (pendingField) { commitField(pendingField); pendingField = null; } }
  document.addEventListener('input', ev => {
    const el = ev.target;
    if (el.dataset && el.dataset.field && el.type !== 'checkbox') { if (pendingField && pendingField !== el) flushPending(); pendingField = el; clearTimeout(fieldTimer); fieldTimer = setTimeout(flushPending, 400); }
  });
  document.addEventListener('change', ev => {
    const el = ev.target;
    if (el.dataset.task && currentRoute.type === 'day') { const r = record(currentRoute.day); r.tasks[el.dataset.task] = el.checked; if (!el.checked) r.done = false; writeRecord(currentRoute.day, r); updateDayUI(); }
    else if (el.dataset.criterion != null && currentRoute.type === 'day') { const r = record(currentRoute.day); r.criteria[Number(el.dataset.criterion)] = el.checked; writeRecord(currentRoute.day, r); updateDayUI(); }
    else if (el.dataset.stageCriterion != null && currentRoute.type === 'assessment-detail' && currentRoute.id.startsWith('stage-')) { const d = Number(currentRoute.id.slice(6)), r = record(d); r.criteria[Number(el.dataset.stageCriterion)] = el.checked; writeRecord(d, r); updateAssessmentUI(); }
    else if (el.dataset.field) { if (pendingField === el) { pendingField = null; clearTimeout(fieldTimer); } commitField(el); }
    else if (el.id === 'audio-bpm') { const bpm = getTempo(); if (bpm && audio.metroTimer) updateAudioUI('节拍器运行中 · ' + bpm + ' BPM · 4/4拍'); }
    else if (el.id === 'import-file') { importProgress(el.files[0]); el.value = ''; }
  });
  document.addEventListener('click', async ev => {
    const target = ev.target.closest('[data-action]'); if (!target) return;
    const action = target.dataset.action;
    if (action !== 'record-download') ev.preventDefault();
    flushPending();
    try {
      if (action === 'export') exportProgress();
      else if (action === 'storage-recover') recoverStorage();
      else if (action === 'export-raw') { download('ukulele-original-record-for-recovery.txt', corruptRaw, 'text/plain;charset=utf-8'); toast('已导出原始记录，原本机数据保持不变。'); }
      else if (action === 'import') document.getElementById('import-file').click();
      else if (action === 'print') window.print();
      else if (action === 'timer-preset') timerSet(Number(target.dataset.minutes));
      else if (action === 'timer-toggle') await timerToggle();
      else if (action === 'timer-reset') { if (timer.running) timerStop(); timer.remaining = timer.total; paintTimer(); }
      else if (action === 'audio-stop') stopAudio();
      else if (action === 'metronome') await metronome();
      else if (action === 'tune') await tune(Number(target.dataset.string));
      else if (action === 'chord') await playChord(target.dataset.chord);
      else if (action === 'pattern') await playDemo(['C'], 2, target.dataset.pattern, 'C和弦节奏示范');
      else if (action === 'drill') { const l = getLesson(target.dataset.day); await playDemo(l.drill.chords, l.drill.bars, l.pattern, l.drill.label, l.drill.beatsPerChord || 4, l.drill.barPatterns || [], l.drill.omitBeatIndices || []); }
      else if (action === 'record-start') await recordStart();
      else if (action === 'record-stop') recordStop();
      else if (action === 'record-close') recordClose();
      else if (action === 'record-download') { recorder.downloaded = true; setTimeout(() => { const p = document.querySelector('#recording-dock p'); if (p) p.textContent = recorder.filename + ' · 已发起下载，请确认文件保存在设备上。'; }, 0); }
      else if (action === 'record-copy') { try { await navigator.clipboard.writeText(recorder.filename); toast('文件名已复制，可粘贴到本课证据栏。'); } catch (_) { toast('文件名：' + recorder.filename + '。当前环境无法自动复制，请手动选择。'); } }
      else if (action === 'quiz' && currentRoute.type === 'day') { const l = getLesson(currentRoute.day), r = record(l.day); r.quiz[Number(target.dataset.question)] = Number(target.dataset.option); writeRecord(l.day, r); document.getElementById('day-quiz').innerHTML = renderQuiz(l, r); }
      else if (action === 'mark-done' && currentRoute.type === 'day') { if (!commitMetrics()) return; const l = getLesson(currentRoute.day), r = record(l.day); if (!P.stepKeys(l).every(k => r.tasks[k]) || !(r.metrics.minutes > 0)) { toast('请先完成全部任务，并填写实际练习分钟。'); return; } r.done = true; writeRecord(l.day, r); updateDayUI(); toast('第' + l.day + '课练习已完成。实操自评与单曲测评独立记录。'); }
      else if ((action === 'score' || action === 'score-clear') && currentRoute.type === 'assessment-detail') { const a = state.assessments[currentRoute.id] || P.freshAssessment(); if (!P.SCORE_IDS.includes(target.dataset.dimension)) return; a.scores[target.dataset.dimension] = action === 'score-clear' ? null : Number(target.dataset.score); writeAssessment(currentRoute.id, a); updateAssessmentUI(); }
    } catch (err) { toast('这一步未能完成：' + err.message); }
  });
  window.addEventListener('hashchange', () => { flushPending(); if (location.hash === '#main') { main.focus(); return; } stopAudio(true); render(); });
  window.addEventListener('beforeunload', ev => { flushPending(); if (recorder.active || recorder.pending || (recorder.url && !recorder.downloaded) || storageError) { ev.preventDefault(); ev.returnValue = ''; } });
  window.addEventListener('pagehide', () => { stopStream(); stopAudio(true); });
  window.addEventListener('storage', ev => {
    if (ev.key !== P.KEY || !ev.newValue || storageProtected) return;
    try { const other = P.validate(JSON.parse(ev.newValue)); if (!other.ok) return; state = P.merge(state, other.state); const active = document.activeElement; if (!active || !['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) render(false); toast('已合并其他标签页的较新练习记录。'); } catch (_) {}
  });
  let printDetails = [];
  window.addEventListener('beforeprint', () => { flushPending(); printDetails = [...document.querySelectorAll('details:not([open])')]; printDetails.forEach(d => d.open = true); });
  window.addEventListener('afterprint', () => { printDetails.forEach(d => d.open = false); printDetails = []; });
  window.UKE_APP = { getState: () => JSON.parse(JSON.stringify(state)), getSummary: () => P.stats(state, C, M) };
  showStorageWarning(); render(false);
})();
