/* Shared, dependency-free rules for the public research directory. */
'use strict';
((root, factory) => {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.LabModel = model;
})(typeof globalThis === 'object' ? globalThis : this, () => {
  const axes = {
    domains: '研究方向', methods: '研究方法', diseases: '疾病 / 健康问题',
    modalities: '数据 / 实验模态', researchScales: '研究尺度', studyDesigns: '研究设计'
  };
  const dimensions = {
    research: ['研究问题', '具体研究对象、机制或预测问题；是否与你希望回答的问题相近。'],
    methods: ['方法与技术', '团队实际使用或开发的方法；进一步确认你能参与的技术环节。'],
    outputs: ['代表成果', '可追溯的论文、模型、工具或研究项目；条目数不等于成果总量。'],
    resources: ['开放资源', '代码、数据、软件或平台的公开证据；公开论文不代表数据可直接取得。'],
    translation: ['实验 / 临床转化', '从模型到实验验证、患者研究或临床应用的证据；不等于已获临床批准。'],
    collaboration: ['跨学科合作', '公开的共同项目、跨机构网络或合作方式；机构成员资格不保证合作名额。'],
    training: ['培养与申请路径', '明确的训练、访问或申请说明；具体身份、资助、导师资格仍须单独确认。']
  };
  const roles = {current:'在职 / 活跃研究',emeritus:'荣休 / 名誉',retired:'退休',visiting:'访问任职',industry:'产业研究',historical:'历史研究线索',deceased:'已故 · 历史贡献',unknown:'任职类型待细分'};
  const stages = {watch:'持续关注',reading:'待读代表作',priority:'重点了解',preparing:'准备申请',eligibility:'已核对资格'};
  const norm = s => String(s || '').normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase();
  const values = (lab, axis) => [...new Set((axis === 'domains' ? [...(lab.directions || []), ...(lab.facets?.domains || [])] : lab.facets?.[axis] || []).filter(Boolean))];
  const evidence = (lab, dimension) => (lab.assessmentEvidence || []).filter(e => e.dimension === dimension && e.summary && /^https?:\/\//.test(e.url));
  const evidenceCount = lab => Object.keys(dimensions).filter(d => evidence(lab,d).length).length;
  function matchesFacets(lab, criteria) {
    return Object.keys(axes).every(axis => !criteria[axis] || values(lab,axis).includes(criteria[axis]));
  }
  function match(lab, preferences) {
    const chosen = Object.entries(preferences || {}).filter(([axis,p]) => axes[axis] && p && typeof p.value === 'string' && p.value && Number(p.weight) > 0);
    const matched = [], missing = []; let earned = 0, total = 0;
    for (const [axis,p] of chosen) {
      const weight = Math.min(3,Math.max(0,Number(p.weight))); total += weight;
      const row = {axis, value:p.value, weight, recorded:values(lab,axis).length > 0};
      if(values(lab,axis).includes(p.value)){earned += weight;matched.push(row);}else missing.push(row);
    }
    return {score:total ? Math.round(100*earned/total) : null, earned,total,matched,missing,criteriaCount:chosen.length};
  }
  function searchText(lab) {
    return norm([lab.name,lab.institution,lab.groupName,lab.question,lab.fit,lab.bridge,lab.role,lab.searchTerms,
      ...(lab.aliases||[]),...(lab.platforms||[]),...Object.keys(axes).flatMap(a=>values(lab,a)),
      ...(lab.affiliations||[]).flatMap(a=>[a.institution,a.country]),lab.country,
      ...(lab.assessmentEvidence||[]).map(e=>e.summary)].filter(Boolean).join(' '));
  }
  const notebookType = 'growthlab-research-notebook';
  const storageKey = 'growthlab.research-directory.notebook.v1';
  function validateNotebook(raw) {
    if(!raw || raw.type !== notebookType || raw.schemaVersion !== 1 || !Array.isArray(raw.entries) || raw.entries.length > 5000) throw Error('这不是可识别的研究名单备份（版本1，最多5000条）。');
    const seen = new Set();
    const entries = raw.entries.map(e => {
      if(!e || typeof e.id !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(e.id) || ['__proto__','prototype','constructor'].includes(e.id) || seen.has(e.id)) throw Error('备份含无效或重复的记录标识。');
      seen.add(e.id);
      if(typeof e.note !== 'string' || e.note.length > 3000 || !Object.hasOwn(stages,e.stage) || typeof e.saved !== 'boolean' || typeof e.updatedAt !== 'string' || !Number.isFinite(Date.parse(e.updatedAt))) throw Error('备份中的阶段、笔记或日期不符合格式。');
      return {id:e.id,name:String(e.name || '').slice(0,300),saved:e.saved,stage:e.stage,note:e.note,updatedAt:e.updatedAt};
    });
    return {type:notebookType,schemaVersion:1,entries};
  }
  function mergeNotebooks(current, incoming) {
    const out = new Map(validateNotebook(current).entries.map(e=>[e.id,e]));
    for(const e of validateNotebook(incoming).entries){const previous=out.get(e.id);if(!previous || Date.parse(e.updatedAt)>=Date.parse(previous.updatedAt))out.set(e.id,e);}
    if(out.size>5000)throw Error('合并后超过5000条，请先精简备份。');
    return {type:notebookType,schemaVersion:1,entries:[...out.values()]};
  }
  return {axes,dimensions,roles,stages,norm,values,evidence,evidenceCount,matchesFacets,match,searchText,storageKey,notebookType,validateNotebook,mergeNotebooks};
});
