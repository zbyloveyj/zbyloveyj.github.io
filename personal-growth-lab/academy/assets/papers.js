'use strict';
(()=>{
const topics=['微生物与精神健康','精神分裂症与微生物','双相障碍与微生物','微生物与脑影像','代谢与免疫','宏基因组方法','脑网络与异质性','机器学习验证','神经解码与脑机接口','因果推断与可复现性'];
const queries=['gut microbiome depression','schizophrenia microbiome','bipolar disorder microbiome','gut microbiome neuroimaging','microbiome metabolomics immunity','metagenomic profiling methods','brain networks psychiatric heterogeneity','machine learning validation biomedical','brain computer interface neural decoding','causal inference reproducibility'];
const focus=['研究问题与主张','研究设计与独立单位','测量与数据处理','主要结果与效应量','混杂与偏差','方法假设与适用边界','内部与外部验证','竞争解释与机制证据','复现所需资源','对自己研究的启发'];
const catalog=window.PAPER_CATALOG||[];
const lessons=Array.from({length:100},(_,i)=>{
 const p=catalog[i],t=p?p.topic:topics[Math.floor(i/10)],f=focus[i%10];
 return{title:p?p.title:`选文任务 ${i+1} · ${t}`,stage:t,minutes:60,concept:`本次重点：${f}。先分清作者的主张与实际证据，再判断可借鉴的部分。`,example:p?`文献信息：${p.journal} · ${p.year} · PMID ${p.pmid}\n类型：${p.type||'以原文为准'}。书目信息来自PubMed；本站提供阅读问题，不冒充已完成的全文评审。`:'按下方检索入口选一篇尚未读过的论文。记录标题、作者、年份、DOI/PMID、研究类型及来源；不要把检索结果页当作全文。',tasks:[`10分钟：阅读标题、摘要与图注，确认研究类型，写出一句研究问题。`,`30分钟：阅读方法和关键结果，重点核查“${f}”；把支持结论的图、表或段落定位下来。`,'15分钟：写出一个最强证据、一个替代解释与一项限制；无法获取全文时如实标注只读摘要。','5分钟：用自己的话完成200—400字精读卡，提出一个可以迁移到研究的具体动作。'],output:'一张精读卡：书目信息／问题／设计／核心证据定位／局限／可迁移动作。',criteria:['明确全文阅读或仅摘要的范围','观点对应具体原文位置','保留至少一个尚待核查的问题'],refs:[],links:[{name:p?'打开PubMed原文入口':'在PubMed选择本主题论文',url:p?p.url:`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(queries[Math.floor(i/10)])}`}],paper:p||null};
});
addCourse({id:'papers',number:'04',name:'100篇论文深度精读',en:'THE PAPER READING ROOM',unit:'篇',pace:'100个精读单元 · 每篇约60分钟起',intro:'不追收藏数量，留下可检查的证据卡。连接微生物、精神疾病、脑影像与AI方法。',outcome:'100张阅读卡、专题证据链与一份可检索的个人阅读档案。',note:`当前书目已收录${catalog.length}篇。书目按主题从PubMed组织，不是期刊排名，也不表示本站已完成100篇全文评审。外部文章的获取权限与版权由原出版方决定；阅读任务可以替换为同主题论文。`,lessons});
ACADEMY.institutes=[
['美国','Stanford · Wu Tsai Neurosciences Institute','神经科学、脑健康与神经工程的机构发现入口','https://neuroscience.stanford.edu/'],
['美国','MIT · Picower Institute','学习记忆、神经回路与脑疾病研究入口','https://picower.mit.edu/'],
['英国','UCL · Gatsby Unit','理论神经科学与机器学习研究入口','https://www.ucl.ac.uk/life-sciences/gatsby'],
['英国','Sainsbury Wellcome Centre','神经回路与行为研究入口','https://www.sainsburywellcome.org/web/'],
['德国','Max Planck · Biological Cybernetics','计算神经科学、脑成像与信息处理研究入口','https://www.kyb.tuebingen.mpg.de/']
];
})();
