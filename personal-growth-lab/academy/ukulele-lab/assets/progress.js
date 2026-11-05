/* Ukulele classroom progress contract — no DOM/storage access; usable in Node VM.
 * KEY: yixindao.ukulele-academy.v1; schema: 1.
 * state = {schema,createdAt,updatedAt,lastDay,records:{"1":record},
 *          assessments:{"an-jing"|"qing-tian"|"sadness"|"stage-7"|"stage-14"|"stage-21"|"stage-30":assessment},
 *          songPlans:{songId:plan}}
 * record = {tasks:{"blockId:stepIndex":boolean}, quiz:[null|optionIndex],
 * metrics:{minutes,bpm,changesOk,changesTotal,stops,rhythmBars}, criteria:[boolean],
 * evidence:string,note:string,done:boolean,updatedAt:ISO} (metric blanks = null).
 * lessonDone(lesson, record) requires explicit done + every lesson step checked + minutes>0.
 * Practical day success is separately derived from all lesson criteria checked.
 * assessment = {scores:{rhythm,changes,coordination,pitch,structure}, complete,oneTake,
 * restarts:null|integer,bpm:null|number,evidence,note,updatedAt}; blank scores=null.
 * song plan = {version,source,key,verse,chorus,difficultBars,notes,updatedAt}.
 * checkpoint(lesson, record, assessment) checks day criteria + continuous test evidence.
 * Stage scores are optional observations; only song assess() determines graduation.
 * stats(state, course, music) is the read-only bridge for academy cards.
 * validate(raw) => {ok,errors,state}; normalize(raw) throws for invalid input.
 * merge(local, imported) validates both; newer per-record timestamp wins (ties keep local).
 */
(function (root) {
  'use strict';
  const KEY = 'yixindao.ukulele-academy.v1';
  const SONG_IDS = ['an-jing', 'qing-tian', 'sadness'];
  const SCORE_IDS = ['rhythm', 'changes', 'coordination', 'pitch', 'structure'];
  const WEIGHTS = [25, 20, 20, 20, 15];
  const ASSESS_IDS = SONG_IDS.concat(['stage-7', 'stage-14', 'stage-21', 'stage-30']);
  const epoch = '1970-01-01T00:00:00.000Z';
  const now = () => new Date().toISOString();
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const obj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  function fresh() { const t = now(); return { schema: 1, createdAt: t, updatedAt: t, lastDay: 1, records: {}, assessments: {}, songPlans: {} }; }
  function freshRecord() { return { tasks: {}, quiz: [], metrics: { minutes: null, bpm: null, changesOk: null, changesTotal: null, stops: null, rhythmBars: null }, criteria: [], evidence: '', note: '', done: false, updatedAt: now() }; }
  function freshAssessment() { return { scores: Object.fromEntries(SCORE_IDS.map(k => [k, null])), complete: false, oneTake: false, restarts: null, bpm: null, evidence: '', note: '', updatedAt: now() }; }
  function freshPlan() { return { version: '', source: '', key: '', verse: '', chorus: '', difficultBars: '', notes: '', updatedAt: now() }; }
  function validate(raw) {
    const errors = [];
    let input = raw;
    if (obj(raw) && own(raw, 'app')) {
      if (raw.app !== KEY) return { ok: false, errors: ['这不是尤克里里练习室的备份。'], state: null };
      input = raw.state;
    }
    if (!obj(input) || input.schema !== 1) return { ok: false, errors: ['备份格式或版本不受支持（需要 schema: 1）。'], state: null };
    const s = fresh();
    const bad = msg => { if (errors.length < 24) errors.push(msg); };
    const text = (v, p, max = 12000) => { if (v == null) return ''; if (typeof v !== 'string' || v.length > max) { bad(p + ' 必须是长度合理的文本。'); return ''; } return v; };
    const boolean = (v, p) => { if (v == null) return false; if (typeof v !== 'boolean') bad(p + ' 必须是布尔值。'); return v === true; };
    const num = (v, p, max, integer = true, min = 0) => { if (v == null || v === '') return null; if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) { bad(p + ' 数值超出范围。'); return null; } return v; };
    const date = (v, p) => { if (v == null || v === '') return epoch; if (typeof v !== 'string' || v.length > 40 || !/^\d{4}-\d\d-\d\dT/.test(v) || !Number.isFinite(Date.parse(v))) { bad(p + ' 时间无效。'); return epoch; } return new Date(v).toISOString(); };
    const array = (v, p, max) => { if (v == null) return []; if (!Array.isArray(v) || v.length > max) { bad(p + ' 数组无效。'); return []; } return v; };
    const map = (v, p, limit) => { if (v == null) return {}; if (!obj(v) || Object.keys(v).length > limit) { bad(p + ' 对象无效。'); return {}; } return v; };
    s.createdAt = date(input.createdAt, '创建时间');
    s.updatedAt = date(input.updatedAt, '更新时间');
    s.lastDay = num(input.lastDay == null ? 1 : input.lastDay, '最近课次', 30, true, 1) || 1;
    for (const [k, v] of Object.entries(map(input.records, '日课记录', 30))) {
      if (!/^(?:[1-9]|[12]\d|30)$/.test(k) || !obj(v)) { bad('日课记录包含非法课次。'); continue; }
      const r = freshRecord();
      for (const [tk, tv] of Object.entries(map(v.tasks, '任务', 160))) {
        if (!/^[a-zA-Z0-9_-]{1,90}:\d{1,3}$/.test(tk)) { bad('任务标识格式不正确。'); continue; }
        r.tasks[tk] = boolean(tv, '任务勾选');
      }
      r.quiz = array(v.quiz, '小测答案', 20).map(x => num(x, '小测答案', 9));
      r.criteria = array(v.criteria, '实操标准', 20).map(x => boolean(x, '实操标准'));
      const m = map(v.metrics, '训练数据', 12);
      r.metrics.minutes = num(m.minutes, '练习分钟', 600, false);
      r.metrics.bpm = num(m.bpm, '速度', 240, false, 20);
      r.metrics.changesOk = num(m.changesOk, '清晰换和弦次数', 1000);
      r.metrics.changesTotal = num(m.changesTotal, '尝试换和弦次数', 1000);
      r.metrics.stops = num(m.stops, '节奏中断数', 1000);
      r.metrics.rhythmBars = num(m.rhythmBars, '测试小节数', 1000);
      if (r.metrics.changesOk != null && r.metrics.changesTotal != null && r.metrics.changesOk > r.metrics.changesTotal) bad('清晰换和弦次数不能大于尝试次数。');
      if (r.metrics.changesTotal === 0 && (r.metrics.changesOk || 0) > 0) bad('分母为零时不能填写成功次数。');
      r.evidence = text(v.evidence, '证据引用', 4000);
      r.note = text(v.note, '日课复盘');
      r.done = boolean(v.done, '完成状态');
      r.updatedAt = date(v.updatedAt, '日课时间');
      s.records[k] = r;
    }
    for (const [k, v] of Object.entries(map(input.assessments, '测评', 7))) {
      if (!ASSESS_IDS.includes(k) || !obj(v)) { bad('测评项目不受支持。'); continue; }
      const a = freshAssessment(), scores = map(v.scores, '评分', 5);
      for (const id of SCORE_IDS) a.scores[id] = num(scores[id], id + '评分', 5);
      if (Object.keys(scores).some(id => !SCORE_IDS.includes(id))) bad('评分维度不受支持。');
      a.complete = boolean(v.complete, '完整演奏'); a.oneTake = boolean(v.oneTake, '一镜到底');
      a.restarts = num(v.restarts, '整段重来次数', 1000); a.bpm = num(v.bpm, '测评速度', 240, false, 20);
      a.evidence = text(v.evidence, '测评证据', 4000); a.note = text(v.note, '测评复盘');
      a.updatedAt = date(v.updatedAt, '测评时间'); s.assessments[k] = a;
    }
    for (const [k, v] of Object.entries(map(input.songPlans, '曲目版本', 3))) {
      if (!SONG_IDS.includes(k) || !obj(v)) { bad('曲目版本项目不受支持。'); continue; }
      const p = freshPlan();
      for (const field of ['version', 'source', 'key', 'verse', 'chorus', 'difficultBars', 'notes']) p[field] = text(v[field], '曲目' + field, 6000);
      p.updatedAt = date(v.updatedAt, '曲目版本时间'); s.songPlans[k] = p;
    }
    return { ok: errors.length === 0, errors, state: errors.length ? null : s };
  }
  function normalize(raw) { const v = validate(raw); if (!v.ok) { const e = new Error(v.errors.join(' ')); e.validationErrors = v.errors; throw e; } return v.state; }
  function stepKeys(lesson) { return (lesson.blocks || []).flatMap(b => (b.steps || []).map((_, i) => b.id + ':' + i)); }
  function lessonDone(lesson, record) { const keys = stepKeys(lesson); return !!record && record.done === true && keys.length > 0 && keys.every(k => record.tasks && record.tasks[k] === true) && record.metrics && Number(record.metrics.minutes) > 0; }
  function practicalDone(lesson, record) { return !!record && lesson.criteria && lesson.criteria.length > 0 && lesson.criteria.every((_, i) => record.criteria && record.criteria[i] === true); }
  function assess(a) {
    const validScore = id => a && a.scores && typeof a.scores[id] === 'number' && Number.isInteger(a.scores[id]) && a.scores[id] >= 0 && a.scores[id] <= 5;
    const assessed = SCORE_IDS.every(validScore);
    const score = assessed ? Math.round(SCORE_IDS.reduce((sum, id, i) => sum + a.scores[id] * WEIGHTS[i] / 5, 0)) : null;
    const gates = { scored: assessed, total: assessed && score >= 80, minimum: assessed && SCORE_IDS.every(id => a.scores[id] >= 3), complete: !!a && a.complete === true, oneTake: !!a && a.oneTake === true, noRestart: !!a && a.restarts === 0, evidence: !!a && typeof a.evidence === 'string' && a.evidence.trim().length > 0 };
    return { assessed, score, passed: Object.values(gates).every(Boolean), gates, weak: SCORE_IDS.filter(id => validScore(id) && a.scores[id] < 3) };
  }
  function checkpoint(lesson, record, assessment) {
    const a = assessment;
    const gates = { criteria: practicalDone(lesson, record), complete: !!a && a.complete === true, oneTake: !!a && a.oneTake === true, noRestart: !!a && a.restarts === 0, evidence: !!a && typeof a.evidence === 'string' && a.evidence.trim().length > 0 };
    return { passed: Object.values(gates).every(Boolean), gates };
  }
  function stats(state, course, music) {
    const lessons = course && course.lessons || [], records = state.records || {};
    const done = lessons.filter(l => lessonDone(l, records[l.day]));
    const practical = lessons.filter(l => practicalDone(l, records[l.day]));
    let quizCorrect = 0, quizAnswered = 0;
    lessons.forEach(l => (l.quiz || []).forEach((q, i) => { const v = (records[l.day] && records[l.day].quiz || [])[i]; if (Number.isInteger(v)) { quizAnswered++; if (v === q.answer) quizCorrect++; } }));
    const minutes = Object.values(records).reduce((n, r) => n + ((r.metrics && r.metrics.minutes) || 0), 0);
    const songsPassed = SONG_IDS.filter(id => assess((state.assessments || {})[id]).passed).length;
    return { practicedDays: done.length, practicalDays: practical.length, totalDays: lessons.length, minutes, quizCorrect, quizAnswered, songsPassed, graduated: songsPassed === 3, nextDay: (lessons.find(l => !lessonDone(l, records[l.day])) || { day: 30 }).day, lastDay: state.lastDay || 1, completedDays: done.map(l => l.day) };
  }
  function merge(local, imported) {
    const a = normalize(local), b = normalize(imported), out = JSON.parse(JSON.stringify(a));
    for (const group of ['records', 'assessments', 'songPlans']) for (const [k, v] of Object.entries(b[group])) if (!out[group][k] || Date.parse(v.updatedAt) > Date.parse(out[group][k].updatedAt)) out[group][k] = v;
    if (Date.parse(b.updatedAt) > Date.parse(a.updatedAt)) out.lastDay = b.lastDay;
    out.createdAt = Date.parse(a.createdAt) <= Date.parse(b.createdAt) ? a.createdAt : b.createdAt;
    out.updatedAt = now(); return out;
  }
  function feedback(state, course) {
    const entries = Object.entries(state.records || {}).filter(([, r]) => r.metrics).sort((a, b) => Number(a[0]) - Number(b[0]));
    const recent = entries.slice(-7), advice = [];
    const rateRows = recent.filter(([, r]) => r.metrics.changesTotal > 0 && r.metrics.changesOk != null);
    if (rateRows.length) {
      const ok = rateRows.reduce((x, [, r]) => x + r.metrics.changesOk, 0), total = rateRows.reduce((x, [, r]) => x + r.metrics.changesTotal, 0), rate = ok / total;
      if (rate < .8) advice.push({ title: '先把两个和弦接稳', text: '最近7条课次的换和弦成功率合计为 ' + Math.round(rate * 100) + '%（' + ok + '/' + total + '）。不同课次条件可能不同，这个合计只描述记录。下一次抽出5分钟，只练最卡的一对和弦；每4拍换一次，较当前速度降10 BPM。连续两轮8次中至少7次清晰再提速。' });
      else advice.push({ title: '在相同条件下验证连续性', text: '最近7条课次的换和弦成功率合计为 ' + Math.round(rate * 100) + '%（' + ok + '/' + total + '）。不同课次条件可能不同，不代表能力提升。保持当前速度，做连续8小节测试；右手不断，再加轻声唱词。两轮都稳定后每次只加3–5 BPM。' });
    }
    const stopRows = recent.filter(([, r]) => r.metrics.stops != null && r.metrics.rhythmBars > 0);
    if (stopRows.length && stopRows.some(([, r]) => r.metrics.stops > 0)) advice.push({ title: '把节奏与换和弦分开练', text: '最近' + stopRows.length + '次有分母的节奏记录中仍有中断。先闷音扫弦2分钟，再按原练习速度的80%做8小节和弦循环；换慢了也让右手继续。中断数降到0以后再唱。' });
    const latest = entries[entries.length - 1];
    if (latest) {
      const lesson = (course.lessons || []).find(l => l.day === Number(latest[0]));
      if (lesson && !practicalDone(lesson, latest[1])) advice.push({ title: '先补第' + lesson.day + '天未达成的实操项', text: (lesson.criteria || []).filter((_, i) => !(latest[1].criteria || [])[i]).join('；') + '。用本课降阶方案重做，再记录一次。' });
    }
    for (const id of SONG_IDS) { const a = (state.assessments || {})[id]; if (!a) continue; const r = assess(a); const labels = { rhythm: '节奏', changes: '和弦', coordination: '弹唱配合', pitch: '歌唱音准', structure: '结构' }; r.weak.forEach(dim => advice.push({ title: (id === 'an-jing' ? '《安静》' : id === 'qing-tian' ? '《晴天》' : '《一万次悲伤》') + '：补' + labels[dim], text: { rhythm: '用节拍器只做闷音伴奏，连续8小节不中断。先保留每拍下扫；稳定后再恢复原节奏。', changes: '圈出一对最常失误的换和弦，慢速按弦逐弦听清；每4拍换一次，记录10次中的清晰次数。', coordination: '把最卡的两小节分成只弹、只念节奏、弹加念词、弹加轻唱四步；每步连续成功3遍。', pitch: '先只唱舒适音区的短句，录音对照与你同调的参考旋律；可预先固定舒适八度，太高时整体换调或降八度，不靠提高嗓门硬顶。', structure: '给谱本标A主歌/B副歌/过门/尾奏，口头报出段落顺序；连续演到尾，局部错音后继续。' }[dim] })); }
    if (!advice.length) advice.push({ title: '先建立一次可比较的基线', text: '完成第1课后，填写实际分钟、练习BPM、清晰换和弦/总尝试次数，以及中断数/测试小节数。这里将依据你的记录给出补练建议；录音需要你或老师自行听评。' });
    return advice.slice(0, 8);
  }
  root.UKE_PROGRESS = { KEY, SONG_IDS, SCORE_IDS, WEIGHTS, fresh, freshRecord, freshAssessment, freshPlan, validate, normalize, stepKeys, lessonDone, practicalDone, assess, checkpoint, stats, merge, feedback };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.UKE_PROGRESS;
})(typeof window !== 'undefined' ? window : globalThis);
