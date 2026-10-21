/* Navigation groups for recorded research labels. A group is not additional research evidence. */
'use strict';
((root,factory)=>{const taxonomy=factory();if(typeof module==='object'&&module.exports)module.exports=taxonomy;else root.LabTaxonomy=taxonomy;})(typeof globalThis==='object'?globalThis:this,()=>{
  const fields=[
    {id:'microbes',name:'微生物与微生态',short:'微生物与微生态',note:'微生物组 · 肠脑轴 · 感染与生态'},
    {id:'omics',name:'组学与计算生物',short:'组学与计算生物',note:'生物信息 · 多组学 · 虚拟细胞'},
    {id:'brain',name:'脑科学与精神健康',short:'脑科学与精神健康',note:'脑回路 · 认知 · 计算精神病学'},
    {id:'engineering',name:'脑机接口与生物医学工程',short:'脑机接口与生物医学工程',note:'神经工程 · 成像 · 材料与器械'},
    {id:'ai',name:'人工智能与数字医学',short:'人工智能与数字医学',note:'医学AI · 生物AI · 数字健康'},
    {id:'life',name:'基础与转化生命科学',short:'基础与转化生命科学',note:'分子细胞 · 免疫代谢 · 人群健康'}
  ];
  // Each expression only reads an existing domain tag. No institution, name or full-page keyword inference.
  const definitions=[
    ['微生物组',['microbes'],/微生物组|微生态|病毒组|真菌组|microbiom|microbiota|metagenom/i],
    ['肠脑轴',['microbes','brain'],/肠脑|肠.脑|脑.肠|gut.brain/i],
    ['宿主-微生物互作',['microbes'],/宿主.?微生物|药物.?微生物|微生物.?药物|host.microb/i],
    ['微生物学与感染',['microbes'],/微生物学|感染|病毒学|噬菌体|真菌生物|微生物耐药|耐药性|微生物生理|共生原生|microbiology|infection|infectious|virology|bacteriolog|parasitolog/i],
    ['微生物生态与进化',['microbes'],/微生物生态|微生物进化|微生物传播|环境微生物|病毒生态|microbial.ecolog|microbial.evol/i],
    ['基因组与遗传学',['omics'],/基因组|遗传|基因调控|基因治疗|gene[st]?\b|genomic|genetic|epigenetic/i],
    ['生物信息与计算生物学',['omics'],/生物信息|计算生物|bioinformatic|computational.biology/i],
    ['多组学与系统生物学',['omics'],/多组学|系统生物|代谢组|蛋白质组|暴露组|糖组|组学技术|multi.omics|systems.biology|metabolomic|proteomic/i],
    ['单细胞与空间组学',['omics'],/单细胞|空间组学|细胞图谱|single.cell|spatial.omics|cell.atlas/i],
    ['AI虚拟细胞（AIVC）',['omics','ai'],/虚拟细胞|AIVC|virtual.cell/i],
    ['蛋白质、结构与生物物理',['life'],/蛋白质|结构生物|生物物理|分子酶学|protein|structural.biology|biophysic/i],
    ['神经科学综合',['brain'],/^脑科学$|^神经科学$|神经疾病机制|临床神经科学|人类神经科学|神经生理|神经解剖|神经伦理|神经保护|神经疾病治疗|^neuroscience$|^neurobiology$|^neurology$/i],
    ['计算与理论神经科学',['brain'],/计算神经|理论神经|计算认知|神经数据|神经信息|类脑|NeuroAI|神经人工智能|computational.neuro|theoretical.neuro/i],
    ['认知、行为与决策',['brain'],/认知|行为|决策|记忆|感觉|知觉|意识|视觉|情绪|情感|动机|觉醒|应激|学习与记忆|预测学习|发声学习|强化学习神经机制|运动神经|社会神经|内感受|神经经济|个体差异|发声|感觉运动|cogniti|behavior|decision|memory|perception|conscious/i],
    ['精神疾病与心理健康',['brain'],/精神|心理|成瘾|身心|抑郁|精神分裂|精神病|psychiatr|mental.health|psycholog|depression|addiction/i],
    ['计算与精准精神病学',['brain'],/计算精神|精准精神|人工智能与精神|精神疾病建模|computational.psychiatr|precision.psychiatr/i],
    ['神经影像与连接组',['brain','engineering'],/神经影像|连接组|脑连接|网络神经|neuroimag|connectom/i],
    ['神经发育与可塑性',['brain'],/神经发育|发育神经|神经发生|神经干细胞|脑发育|轴突导向|突触可塑|neurodevelop|neurogenesis|neuroplastic/i],
    ['神经退行与损伤修复',['brain'],/神经退行|神经退变|神经疾病与损伤|神经损伤|神经再生|神经发育.*修复|神经发育.*再生|神经疾病|神经遗传病|癫痫|疼痛|认知衰老|神经肌肉|neurodegenerat|alzheimer|parkinson|neural.injury|epilepsy|pain/i],
    ['神经免疫与脑体互作',['brain','life'],/神经免疫|神经炎症|胶质|神经内分泌|脑体|脑身体|脑与身体|摄食|肠道神经|neuroimmun|neuroinflamm|glia|neuroendocrin/i],
    ['睡眠与昼夜节律',['brain'],/睡眠|昼夜|sleep|circadian/i],
    ['神经回路与突触',['brain'],/神经回路|神经调质|神经振荡|突触|分子.*神经科学|细胞.*神经科学|系统神经科学|神经兴奋|神经分子|neural.circuit|synap|systems.neuroscien/i],
    ['脑机接口与神经假体',['engineering'],/脑机接口|神经假体|神经工程|神经技术|brain.computer|neural.engineer|neuroengineer|neuroprosthe|neurotechnol|BCI\b/i],
    ['神经调控与康复',['engineering','brain'],/神经调控|神经反馈|神经康复|neuromodulat|neurofeedback|neurorehab/i],
    ['生物医学工程',['engineering'],/生物医学工程|生物工程|生物智能|医学检验技术|机器人|具身智能|biomedical.engineer|bioengineer|robotic|medical.device/i],
    ['医学成像与分析',['engineering'],/生物医学成像|医学影像|生物成像|分子成像|成像.*方法|细胞生物学与成像|放射组学|medical.imag|biomedical.imag|radiolog/i],
    ['合成生物学与生物制造',['engineering','life'],/合成生物|生物制造|synthetic.biology|biomanufactur/i],
    ['生物材料与组织工程',['engineering'],/生物材料|组织工程|微流控|DNA纳米|biomaterial|tissue.engineer|microfluid/i],
    ['医学人工智能',['ai'],/医学人工智能|医学AI|医疗.?AI|医疗人工智能|临床人工智能|临床机器学习|临床数据科学|临床自然语言|医学影像.?AI|计算病理|眼科AI|医学基础模型|人工智能与生物医学|AI 生物医学|clinical.ai|medical.ai|machine.learning.*health/i],
    ['AI for Biology',['ai','omics'],/AI for Biology|^AI\s*生物$|生物基础模型|单细胞基础模型|AI.for.bio|foundation.model.*biolog|single.cell.*foundation.model|foundation.model.*single.cell/i],
    ['AI药物发现',['ai','life'],/AI\s*药物|药学与人工智能|drug.discovery.*AI|AI.*drug.discov/i],
    ['数字医学与健康系统',['ai'],/数字医|数字精神|数字健康|健康系统建模|digital.health|digital.medicine|digital.psychiatr/i],
    ['人工智能与机器学习',['ai'],/^人工智能$|^机器学习$|^深度学习$|^强化学习$|^deep.learning$|^reinforcement.learning$|机器学习与人工智能|情绪计算|类脑智能|NeuroAI|神经人工智能|人工智能与精神|artificial.intelligence|^machine.learning$/i],
    ['分子与细胞生物学',['life'],/细胞生物|分子生物|生物化学|RNA|膜生物|膜蛋白|糖生物|受体|离子通道|相分离|信号转导|分子生理|cell.biology|molecular.biology|biochem|cell.signall/i],
    ['免疫与炎症',['life'],/免疫|炎症|immun|inflamm/i],
    ['肿瘤与精准治疗',['life'],/肿瘤|癌症|cancer|oncolog/i],
    ['干细胞、发育与再生',['life'],/干细胞|再生医学|发育生物|细胞治疗|类器官|生殖|发育遗传|遗传与发育|遗传学与发育|细胞与发育|细胞.*遗传与发育|stem.cell|developmental.bio|regenerat|organoid|reproduct/i],
    ['代谢、营养与生理',['life'],/代谢|营养|食品|生理|心血管|肥胖|胃肠|metaboli|nutrition|physiolog|cardiovascul|obes/i],
    ['药物发现与转化医学',['life'],/药物|药理|药学|药医|生物医药|生物与医药|转化|基因治疗|移植|器官疾病|pharmacol|drug.discov|translational|therapeut/i],
    ['流行病学与人群健康',['life'],/流行病|人群健康|生物统计|卫生|实施科学|定性研究|环境健康|环境与健康|女性健康|精准医学|生物标志物|epidemiolog|public.health|biostatistic|population.health/i],
    ['生态、进化与植物科学',['life'],/进化与生态|进化生物|演化生物|生态与演化|植物生物|植物分子|化学生态|环境化学|evolut.*biology|ecolog|plant.scien|botany/i],
    ['基础与转化生命科学',['life'],/^生命科学|^基础医学$|^生物医学研究$|^生物医学$|^生物学$|^医学与疾病机制$|病理生物|病理生理|分子病理|模式动物|天然产物|life.scien|biomedical.scien|^biology$|basic.medic|patholog/i]
  ];
  const topics=definitions.map(([name,fieldIds,pattern])=>({id:name,name,fields:fieldIds,pattern}));
  const topicMap=new Map(topics.map(t=>[t.id,t])),fieldMap=new Map(fields.map(f=>[f.id,f]));
  let cache=new WeakMap();
  const rawTags=lab=>[...new Set([...(lab?.directions||[]),...(lab?.facets?.domains||[])].filter(x=>typeof x==='string'&&x.trim()))];
  const boilerplate=/^(?:研究领域[：:]|研究方向[：:]|研究主题包括|官方|官网目录|长期方向候选|具体研究|Research (?:area|field)s?\s*:)/i;
  const substantive=text=>typeof text==='string'&&text.trim().length>=24&&!boilerplate.test(text.trim());
  function research(lab){
    const supplied=typeof lab.researchSummary==='string'?lab.researchSummary:lab.researchSummary?.summary||lab.researchSummary?.text;
    const rows=(lab.assessmentEvidence||[]).filter(e=>e.dimension==='research'&&substantive(e.summary)&&/^https?:\/\//.test(e.url));
    const question=(substantive(lab.question)||['reviewed','research_profile'].includes(lab.evidenceLevel||'reviewed')&&typeof lab.question==='string'&&lab.question.trim().length>=8&&!boilerplate.test(lab.question.trim()))?lab.question:'';
    const text=(substantive(supplied)?supplied:'')||question||rows.at(-1)?.summary||'';
    const source=rows.find(e=>e.summary===text)||rows.at(-1);
    const url=lab.researchSummary?.sourceUrl||lab.researchSummary?.url||lab.researchSummarySource||source?.url||lab.profileUrl;
    const documented=!!text&&(!!source||!!supplied||lab.evidenceLevel==='research_profile'||!lab.evidenceLevel||lab.evidenceLevel==='reviewed');
    const projectTitle=lab.evidenceLevel==='project_record'?(lab.projectEvidence||[]).find(p=>p.title&&/^https?:\/\//.test(p.url))?.title:'';
    const pending=projectTitle?'项目题目：'+projectTitle+'；具体研究问题仍待补充。':lab.evidenceLevel==='project_record'?'官方科研项目已记录；具体研究问题、方法和代表成果仍待补充。':'官方名录已核对；具体研究问题、方法和代表成果仍待补充。';
    return {text:documented?text:pending,specific:documented,url:documented?url:'',origin:lab.evidenceLevel==='project_record'?'科研项目研究依据':lab.evidenceLevel==='official_directory'?'目录中的研究说明':'个人研究摘要'};
  }
  function classify(lab){
    if(cache.has(lab))return cache.get(lab);
    const raw=rawTags(lab),chosen=new Set();
    for(const tag of raw){let matched=false;for(const t of topics)if(t.pattern.test(tag)){chosen.add(t.id);matched=true;}if(!matched)chosen.add('基础与转化生命科学');}
    if(!chosen.size)chosen.add('基础与转化生命科学');
    const fieldIds=new Set([...chosen].flatMap(id=>topicMap.get(id).fields));
    // A broad life-science directory label is retained as context, but does not
    // create an extra navigation membership when specific fields are available.
    if(chosen.size>1&&chosen.has('基础与转化生命科学')){
      chosen.delete('基础与转化生命科学');
      if(![...chosen].some(id=>topicMap.get(id).fields.includes('life')))fieldIds.delete('life');
    }
    const info={raw,topics:[...chosen],fields:[...fieldIds],research:research(lab)};
    cache.set(lab,info);return info;
  }
  const matchesDirection=(lab,value)=>!value||classify(lab).topics.includes(value)||classify(lab).raw.includes(value);
  const matchesResearch=(lab,value)=>!value||value==='summary'&&classify(lab).research.specific||value==='basic'&&!classify(lab).research.specific||value==='methods'&&(lab.facets?.methods||[]).length>0||value==='outputs'&&((lab.papers||[]).some(p=>p.title&&/^https?:\/\//.test(p.url))||(lab.assessmentEvidence||[]).some(e=>e.dimension==='outputs'&&e.summary&&/^https?:\/\//.test(e.url)));
  return {fields,topics,fieldMap,topicMap,rawTags,classify,matchesDirection,matchesResearch,reset(){cache=new WeakMap();}};
});
