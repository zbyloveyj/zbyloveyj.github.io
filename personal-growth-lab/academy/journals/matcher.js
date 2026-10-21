/*
 * Journal Matcher 2.0 — deterministic, browser-local topic retrieval.
 * Inputs never leave this module. No network, storage, tracking, or URL writes.
 * Evidence comes from journal names, OpenAlex topic labels, and JCR categories.
 * These metadata labels are not a journal's complete aims and scope. The score
 * is a retrieval ranking signal, not an acceptance probability or quality grade.
 */
(() => {
  'use strict';

  const SOURCE = Object.freeze({ name: { label: '刊名', quality: 1 }, topic: { label: '主题标签', quality: 0.94 }, category: { label: 'JCR 学科', quality: 0.76 } });
  const ORIGIN = Object.freeze({ title: { label: '标题', weight: 2.4 }, keywords: { label: '关键词', weight: 2.8 }, abstract: { label: '摘要', weight: 1 } });
  const STOP = new Set(('a an and are as at be been being but by can could did do does doing each for from had has have having how i if in into is it its may might more most must no nor not of on once only or other our out over own same shall she should so some such than that the their theirs them themselves then there these they this those through to too under until up upon us using use used uses very via was we were what when where whether which while who whom why will with within without would you your ' +
    'study studies studied studying research researches researcher researchers result results conclusion conclusions introduction background objective objectives aim aims purpose purposes method methods methodology novel novelty new paper papers article articles journal journals review reviews overview systematic literature evidence findings finding report reports reported reporting based approach approaches application applications analysis analyses analyzing analysing evaluation evaluate evaluated evaluation association associations associated relationship relationships related effect effects impact impacts influence influences investigation investigate investigated explore exploring exploration development developed developments advances advance advancement advancements recent current future comprehensive potential important significant significance towards toward across among between role roles insights insight perspective perspectives framework frameworks demonstrated demonstrate demonstrates revealed reveal reveals showed show shows suggest suggests suggesting indicate indicates indicating observed observation observations compared compare comparing comparison including include includes included different differences difference better improved improve improvement large small high low two three four five first second third one several many various general specific possible promising effective efficient robust data dataset datasets collection collected samples sample subjects subject participant participants patient patients control controls healthy disease diseases disorder disorders treatment treatments therapy therapies therapeutic model models modeling modelling prediction predictive predicted predicts predict classification classified classification performance accuracy outcome outcomes feature features characteristic characteristics').split(/\s+/));
  const ZH_STOP = new Set('研究 方法 结果 结论 背景 目的 目标 分析 探索 探讨 揭示 发现 提出 构建 建立 一种 新型 新的 全新 基于 通过 使用 采用 利用 进行 针对 关于 相关 关系 关联 作用 影响 机制 变化 不同 特征 特性 表现 表明 显示 提示 证实 证明 验证 评估 评价 比较 应用 发展 创新 提升 优化 综合 系统 综述 患者 人群 人员 对照 健康 疾病 障碍 治疗 干预 研究者 数据 数据集 样本 模型 预测 分类 效果 性能 准确率 标题 摘要 论文 文章 投稿 期刊 以及 及其 其中 进一步 的 与 和 及 在 对 中 为 是 了 有 将 并 从 到 被 我们'.split(' '));
  'present presents presented presenting introduce introduces introduced describe describes described describing propose proposes proposed proposing provide provides provided providing assess assesses assessed assessing examine examines examined examining investigate investigates investigating integrate integrated integration integrate integrating underlying title abstract objective baseline participant observation'.split(' ').forEach((word) => STOP.add(word));
  '整合 改善 差异 连接 结合 中的 中有 发现了 及相关 一定 具有 能够 需要 关键 基础 水平 能力 主要 未来 目前 现在 总体 具体 方式 过程 情况 内容 范围 时间 方向 的研究'.split(' ').forEach((word) => ZH_STOP.add(word));
  const nameCollator = new Intl.Collator('en', { sensitivity: 'base' });
  const LITERAL_TRANSLATIONS = Object.freeze({
    '中国': ['chinese', 'china'], '古典': ['classical'], '思想': ['thought'], '文化': ['culture', 'cultural'],
    '城市': ['urban'], '农村': ['rural'], '界面': ['interface'], '表面': ['surface'],
    '异质性': ['heterogeneity'], '多尺度': ['multiscale'], '跨尺度': ['multiscale'],
    '可解释': ['interpretable', 'explainable'], '稳定性': ['stability'], '可持续': ['sustainable', 'sustainability']
  });
  const STEM = Object.freeze({
    analyses: 'analysis', analysis: 'analysis', children: 'child', women: 'woman', men: 'man',
    ecological: 'ecology', ecologies: 'ecology', sociological: 'sociology', sociologies: 'sociology',
    psychological: 'psychology', psychologies: 'psychology', psychiatric: 'psychiatry',
    neuroscientific: 'neuroscience', neurosciences: 'neuroscience', neurological: 'neurology',
    genetics: 'genetic', genomics: 'genomic', metagenomics: 'metagenomic', metabolomics: 'metabolomic', proteomics: 'proteomic',
    transcriptomics: 'transcriptomic', microbiomes: 'microbiome', microbiotas: 'microbiota', microbial: 'microbe', microbes: 'microbe',
    biology: 'biological', biological: 'biological', computing: 'computation', computational: 'computation',
    learning: 'learning', imaging: 'image', images: 'image', biomedical: 'biomedicine',
    depressive: 'depression', depressed: 'depression', immunological: 'immunology', immunologic: 'immunology',
    behavioral: 'behaviour', behavioural: 'behaviour', behavior: 'behaviour', behaviours: 'behaviour',
    educational: 'education', mathematical: 'mathematics', mathematics: 'mathematics',
    statistical: 'statistic', statistics: 'statistic', economic: 'economy', economics: 'economy',
    financial: 'finance', philosophical: 'philosophy', historic: 'history', historical: 'history',
    linguistic: 'linguistic', linguistics: 'linguistic', agricultural: 'agriculture',
    environmental: 'environment', pharmaceutical: 'pharmaceutic', pharmaceuticals: 'pharmaceutic',
    pharmacological: 'pharmacology', chemical: 'chemistry', chemistry: 'chemistry',
    physical: 'physics', physics: 'physics', material: 'material', materials: 'material',
    batteries: 'battery', nanoparticles: 'nanoparticle', nanomaterials: 'nanomaterial',
    energies: 'energy', dentistry: 'dental', dental: 'dental', veterinarians: 'veterinary',
    paediatric: 'pediatric', paediatrics: 'pediatric', pediatrics: 'pediatric',
    tumours: 'tumor', tumoral: 'tumor', tumour: 'tumor', tumorous: 'tumor', tumours: 'tumor'
  });
  const normalize = (value) => String(value || '').normalize('NFKC').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[‐‑–—_/]/g, ' ').replace(/\s+/g, ' ').trim();
  function stem(word) {
    if (STEM[word]) return STEM[word];
    if (/^[a-z]+$/.test(word) && word.length > 4) {
      if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
      if (word.endsWith('sses')) return word.slice(0, -2);
      if (word.endsWith('s') && !/(ss|us|is|ics)$/.test(word)) return word.slice(0, -1);
    }
    return word;
  }
  let segmenter;
  try { segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' }); } catch (_) { segmenter = null; }
  function tokens(value) {
    const text = normalize(value), result = [];
    for (const match of text.matchAll(/[a-z][a-z0-9]*|[\u3400-\u9fff]+/g)) {
      const part = match[0];
      if (/^[a-z]/.test(part)) result.push(stem(part));
      else if (segmenter) for (const s of segmenter.segment(part)) { if (s.isWordLike && s.segment.length > 1) result.push(s.segment); }
      else if (part.length > 1) result.push(part);
    }
    return result;
  }
  const tokenText = (value) => ' ' + tokens(value).join(' ') + ' ';

  // Deliberately bounded, inspectable bilingual concept mapping. It is not a
  // machine translation or language-model layer. Unknown terms retain their
  // literal spelling and can match metadata directly.
  const DEFINITIONS = [
    ['microbiome','微生物组 / Microbiome','微生物组|微生物群|微生态|菌群|microbiome|microbiota','microbiome|microbiota|microbial community|microbial ecology'],
    ['microbiology','微生物学','微生物学|微生物|细菌|microbiology|microbial|microorganism|microorganisms|bacterial|bacteria','microbiology|microbial|microorganism|bacteria|bacterial'],
    ['gut','肠道 / Gut','肠道|肠胃|胃肠|gut|intestinal|gastrointestinal','gut|intestinal|gastrointestinal|gastroenterology'],
    ['metagenomics','宏基因组','宏基因组|metagenomic|metagenomics','metagenomics|metagenomic|microbiome|microbial genomics'],
    ['ecology','生态学','生态学|生态|ecology|ecological|ecosystem|ecosystems','ecology|ecological|ecosystem'],
    ['psychiatry','精神病学','精神病|精神疾病|精神障碍|psychiatry|psychiatric|mental health|mental illness','psychiatry|psychiatric|mental health'],
    ['depression','抑郁 / Depression','抑郁|depression|depressive|depressed|major depressive|mdd','depression|depressive|affective|mood disorders'],
    ['schizophrenia','精神分裂症','精神分裂|schizophrenia|schizophrenic','schizophrenia|schizophrenic|psychosis|psychotic'],
    ['bipolar','双相障碍','双相|躁郁|bipolar|mania','bipolar|mania|mood disorders'],
    ['autism','自闭症 / ASD','自闭症|孤独症|autism|autistic|asd','autism|autistic|neurodevelopmental'],
    ['neuroscience','脑与神经科学','脑科学|神经科学|脑网络|脑功能|大脑|脑区|神经网络连接|neuroscience|neural|brain|neurological|neurology|neuronal','neuroscience|neural|brain|neurology|neuronal'],
    ['neuroimaging','脑影像 / Neuroimaging','脑影像|脑功能影像|神经影像|功能磁共振|磁共振成像|脑磁共振|neuroimaging|fmri|functional magnetic resonance|functional connectivity','neuroimaging|brain imaging|functional connectivity|magnetic resonance'],
    ['bci','脑机接口','脑机接口|脑电|脑电图|brain computer interface|brain machine interface|electroencephalography|eeg','brain computer|brain machine|neural engineering|electroencephalography|eeg'],
    ['cognition','认知科学','认知|cognition|cognitive','cognition|cognitive|neuropsychology'],
    ['psychology','心理学','心理学|心理|psychology|psychological','psychology|psychological|behaviour'],
    ['alzheimer','阿尔茨海默病','阿尔茨海默|阿尔兹海默|老年痴呆|alzheimer|alzheimers|dementia','alzheimer|dementia|neurodegeneration'],
    ['aging','衰老与老龄化','衰老|老龄化|老年|aging|ageing|gerontology','aging|ageing|gerontology|geriatric'],
    ['immunology','免疫学','免疫|immunology|immunological|immunologic|immune|immunity','immunology|immune|immunity|immunological'],
    ['inflammation','炎症','炎症|炎性|inflammation|inflammatory|neuroinflammation','inflammation|inflammatory|neuroinflammation'],
    ['metabolism','代谢与代谢组','代谢组|代谢|metabolism|metabolic|metabolomics|metabolomic|metabolite|metabolites','metabolism|metabolic|metabolomics|metabolite'],
    ['genomics','基因组与遗传','基因组|遗传|基因|genomics|genomic|genetics|genetic|genome|genomes','genomics|genomic|genetics|genetic|genome'],
    ['transcriptomics','转录组','转录组|单细胞|空间转录|transcriptomics|transcriptomic|single cell|rna sequencing','transcriptomics|transcriptomic|single cell|rna sequencing|gene expression'],
    ['proteomics','蛋白质组','蛋白质组|蛋白组|蛋白质|proteomics|proteomic|protein|proteins','proteomics|protein|proteomic'],
    ['bioinformatics','生物信息与计算生物学','生物信息|计算生物|bioinformatics|bioinformatic|computational biology','bioinformatics|computational biology|genomic analysis'],
    ['ai','人工智能','人工智能|artificial intelligence|ai','artificial intelligence|intelligent systems'],
    ['machine-learning','机器学习','机器学习|深度学习|人工神经网络|卷积神经网络|图神经网络|machine learning|deep learning|neural network|neural networks','machine learning|deep learning|neural network|artificial intelligence'],
    ['llm','大语言模型与自然语言处理','大语言模型|大模型|语言模型|自然语言处理|large language model|large language models|language modeling|natural language processing|llm|llms','language model|natural language|computational linguistics|text mining'],
    ['vision','计算机视觉','计算机视觉|图像识别|目标检测|computer vision|image recognition|object detection','computer vision|image recognition|image processing|pattern recognition'],
    ['medical-imaging','医学影像','医学影像|医学图像|放射学|medical imaging|medical image|radiology|radiological','medical imaging|medical image|radiology|image processing'],
    ['robotics','机器人与自动化','机器人|自动化|robotics|robotic|robot|robots|automation','robotics|robotic|robot|automation|control systems'],
    ['software','软件与计算机','计算机|软件|computer science|software|computing|computation','computer science|software|computing|computation'],
    ['statistics','统计与推断','统计学|统计|因果推断|statistical|statistics|statistic|causal inference','statistics|statistical|inference|causal'],
    ['optimization','优化与运筹','运筹|最优化|梯度优化|optimization|optimisation|stochastic gradient|operations research','optimization|optimisation|stochastic|operations research'],
    ['mathematics','数学','数学|mathematics|mathematical|algebra|topology','mathematics|mathematical|algebra|topology'],
    ['materials','材料科学','材料科学|材料|materials science|material|materials','materials science|material|materials'],
    ['nanotechnology','纳米科学','纳米|nanotechnology|nanoscience|nanomaterial|nanomaterials|nanoparticle|nanoparticles','nanotechnology|nanoscience|nanomaterials|nanoparticle|nano'],
    ['biomaterials','生物材料','生物材料|生物医用材料|组织工程|biomaterial|biomaterials|tissue engineering','biomaterial|biomaterials|tissue engineering|biomedical material'],
    ['hydrogels','水凝胶','水凝胶|hydrogel|hydrogels','hydrogel|hydrogels|polymer'],
    ['polymers','高分子与聚合物','高分子|聚合物|polymer|polymers|polymeric','polymer|polymeric|macromolecular'],
    ['battery','电池与储能','电池|储能|锂离子|钠离子|battery|batteries|energy storage|lithium ion|sodium ion','battery|energy storage|lithium|sodium ion|electrochemical'],
    ['photovoltaics','光伏与太阳能','光伏|太阳能|钙钛矿|photovoltaic|photovoltaics|solar cell|solar cells|perovskite','photovoltaic|solar|perovskite'],
    ['semiconductor','半导体与电子器件','半导体|电子器件|semiconductor|semiconductors|electronic device|electronics','semiconductor|electronic|electronics'],
    ['catalysis','催化与电化学','催化|电化学|catalysis|catalytic|catalyst|electrochemistry|electrochemical','catalysis|catalytic|catalyst|electrochemistry|electrochemical'],
    ['chemistry','化学','化学|chemistry|chemical','chemistry|chemical'],
    ['physics','物理学','物理|physics|physical','physics|physical'],
    ['quantum','量子科学','量子|quantum','quantum'],
    ['astronomy','天文与空间科学','天文|天体|宇宙|astronomy|astrophysics|cosmology|astronomical','astronomy|astrophysics|cosmology|space science'],
    ['engineering','工程学','工程学|机械工程|结构工程|土木工程|engineering|mechanical|civil engineering','engineering|mechanical|civil engineering'],
    ['energy','能源','能源|可再生能源|风能|energy|renewable|wind energy','energy|renewable|wind'],
    ['environment','环境科学','环境|污染|environment|environmental|pollution|pollutant|pollutants','environment|pollution|pollutant'],
    ['climate','气候变化','气候|全球变暖|climate|global warming','climate|global warming'],
    ['water','水资源与水处理','水资源|水处理|污水|废水|water resources|water treatment|wastewater|hydrology','water|wastewater|hydrology|hydrological'],
    ['earth','地球与地质科学','地球科学|地质|地球物理|地球化学|geology|geological|geophysics|geochemistry|earth science','geology|geological|geophysics|geochemistry|earth science'],
    ['agriculture','农业科学','农业|农作物|农学|作物|agriculture|agricultural|agronomy|crop|crops','agriculture|agricultural|agronomy|crop'],
    ['plant','植物科学','植物|植物学|plant|plants|botany|botanical','plant|botany|botanical'],
    ['soil','土壤科学','土壤|soil|soils','soil'],
    ['food','食品与营养','食品|营养|food|nutrition|nutritional','food|nutrition|nutritional'],
    ['veterinary','兽医学','兽医|动物医学|veterinary|veterinarian','veterinary'],
    ['marine','海洋科学','海洋|海洋生物|水产|marine|ocean|oceanography|aquaculture','marine|ocean|oceanography|aquaculture'],
    ['medicine','临床医学','临床医学|医学|medical|medicine|clinical','medicine|medical|clinical'],
    ['oncology','肿瘤学','肿瘤|癌症|癌细胞|oncology|oncological|cancer|tumor|tumour','oncology|cancer|tumor|tumour'],
    ['cardiology','心血管医学','心血管|心脏|cardiology|cardiovascular|cardiac|heart','cardiology|cardiovascular|cardiac|heart'],
    ['diabetes','糖尿病与内分泌','糖尿病|内分泌|diabetes|diabetic|endocrinology|endocrine','diabetes|diabetic|endocrinology|endocrine'],
    ['public-health','公共卫生与流行病学','公共卫生|流行病学|公共健康|public health|epidemiology|epidemiological','public health|epidemiology|epidemiological'],
    ['infectious','感染与传染病','传染病|感染|infectious|infection|infections','infectious|infection'],
    ['virology','病毒学','病毒|病毒学|virology|virus|viruses|viral','virology|virus|viral'],
    ['pharmacology','药理与药学','药理|药学|药物|pharmacology|pharmacological|pharmaceutical|drug|drugs','pharmacology|pharmaceutic|drug'],
    ['toxicology','毒理学','毒理|毒性|toxicology|toxicological|toxicity','toxicology|toxicity|toxicological'],
    ['nursing','护理学','护理|nursing|nurse|nurses','nursing|nurse'],
    ['dentistry','口腔与牙科学','口腔|牙科|牙周|dentistry|dental|oral|periodontal','dentistry|dental|oral|periodontal'],
    ['rehabilitation','康复与运动科学','康复|运动科学|体育|rehabilitation|physiotherapy|sports|sport|exercise','rehabilitation|physiotherapy|sports|exercise'],
    ['surgery','外科学','外科|手术|surgery|surgical','surgery|surgical'],
    ['pediatrics','儿科学','儿科|儿童|pediatric|paediatric|pediatrics|child|children','pediatric|child|children'],
    ['sociology','社会学','社会学|社会科学|社会关系|社会结构|sociology|sociological|social science','sociology|sociological|social science'],
    ['inequality','社会不平等','不平等|社会分层|阶层|代际|inequality|inequalities|social stratification|intergenerational','inequality|inequalities|stratification|intergenerational'],
    ['education','教育学','教育|教学|学习成效|education|educational|teaching|pedagogy|school|schools','education|educational|teaching|pedagogy|school'],
    ['migration','人口与迁移','人口|移民|迁移|migration|immigration|demography|demographic','migration|immigration|demography|demographic|population'],
    ['gender','性别研究','性别|女性|gender|feminism|feminist','gender|feminism|feminist|women'],
    ['economics','经济学','经济|economics|economic|economy','economics|economic|economy'],
    ['finance','金融与会计','金融|财务|会计|finance|financial|accounting','finance|financial|accounting'],
    ['management','管理与商业','管理|商业|企业|management|business|enterprise','management|business|enterprise'],
    ['marketing','市场与消费','市场营销|消费者|消费行为|marketing|consumer|consumers','marketing|consumer'],
    ['politics','政治与政策','政治|公共政策|治理|politics|political|public policy|governance','politics|political|public policy|governance'],
    ['law','法学','法学|法律|law|legal|jurisprudence','law|legal|jurisprudence'],
    ['communication','传播与媒体','传播|媒体|新闻|communication|communications|media|journalism','communication|media|journalism'],
    ['history','历史学','历史|史学|history|historical|historiography','history|historical|historiography'],
    ['philosophy','哲学','哲学|伦理|philosophy|philosophical|ethics|ethical','philosophy|philosophical|ethics|ethical'],
    ['literature','文学与语言','文学|语言学|语言|literary|linguistics|linguistic|literature|language','literary|linguistics|linguistic|literature|language'],
    ['arts','艺术与设计','艺术|美术|音乐|设计|arts|art|music|design','arts|art|music|design'],
    ['anthropology','人类学与考古','人类学|考古|anthropology|anthropological|archaeology|archaeological','anthropology|archaeology|archaeological']
  ];
  const BROAD = new Set(['medicine','materials','chemistry','physics','engineering','software','mathematics','management','sociology','arts','literature']);
  const RELATED_ALIASES = {
    'concept:microbiome': ['microbial ecology'],
    'concept:metagenomics': ['microbiome', 'microbial genomics'],
    'concept:autism': ['neurodevelopmental'],
    'concept:alzheimer': ['neurodegeneration'],
    'concept:machine-learning': ['artificial intelligence'],
    'concept:hydrogels': ['polymer'],
    'concept:biomaterials': ['tissue engineering'],
    'concept:medical-imaging': ['image processing'],
    'concept:llm': ['text mining'],
    'concept:depression': ['affective', 'mood disorders']
  };
  const relatedAliasMap = new Map(Object.entries(RELATED_ALIASES).map(([id, aliases]) => [id, new Set(aliases.map(tokenText))]));
  const escapeRE = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const CONCEPTS = DEFINITIONS.map(([id, label, triggers, aliases]) => ({
    id: 'concept:' + id, label, kind: 'concept', broad: BROAD.has(id),
    triggers: triggers.split('|').map((value) => ({ value: normalize(value), regex: new RegExp((/[a-z]/i.test(value) ? '(?<![a-z0-9])' : '') + escapeRE(normalize(value)) + (/[a-z]/i.test(value) ? '(?![a-z0-9])' : ''), 'g') })),
    aliases: [...new Set([...aliases.split('|'), ...triggers.split('|').filter((value) => /[\u3400-\u9fff]/.test(value))].map(tokenText))].filter((value) => value.trim())
  }));

  function analyze(input = {}) {
    const values = { title: String(input.title || '').slice(0, 500), keywords: String(input.keywords || '').slice(0, 500), abstract: String(input.abstract || '').slice(0, 12000) };
    const found = new Map(), warnings = [], inputLength = Object.values(values).reduce((sum, value) => sum + value.trim().length, 0);
    function add(key, term, origin, count = 1) {
      const rawChinese = term.kind === 'keyword' && !term.translated && /[\u3400-\u9fff]/.test(term.label);
      const weight = ORIGIN[origin].weight * (term.broad ? 0.58 : 1) * (rawChinese ? 0.45 : 1) * (origin === 'abstract' ? Math.min(1.3, 1 + Math.log2(Math.max(1, count)) * 0.09) : 1);
      const old = found.get(key);
      if (old) { old.weight = Math.max(old.weight, weight); if (!old.origins.includes(origin)) old.origins.push(origin); }
      else found.set(key, { ...term, id: key, weight, origin: ORIGIN[origin].label, origins: [origin] });
    }
    for (const origin of ['title', 'keywords', 'abstract']) {
      const value = normalize(values[origin]).replace(/\b(?:systematic )?literature review\b/g, ' ');
      if (!value) continue;
      const covered = new Uint8Array(value.length);
      for (const concept of CONCEPTS) {
        let count = 0;
        const preferredAliases = new Set();
        for (const trigger of concept.triggers) {
          trigger.regex.lastIndex = 0;
          for (const match of value.matchAll(trigger.regex)) {
            // A solar cell is not an electrochemical storage battery. Chinese
            // compounds have no spaces, so guard this ambiguous substring.
            if (concept.id === 'concept:battery' && trigger.value === '电池' && /(?:太阳能|光伏)$/.test(value.slice(Math.max(0, match.index - 5), match.index))) { covered.fill(1, match.index, match.index + match[0].length); continue; }
            if (concept.id === 'concept:genomics' && /^基因/.test(trigger.value) && value[match.index - 1] === '宏') continue;
            count++;
            if (/[a-z]/.test(match[0])) preferredAliases.add(tokenText(match[0]));
            else for (const alias of concept.aliases) if (!relatedAliasMap.get(concept.id)?.has(alias)) preferredAliases.add(alias);
            covered.fill(1, match.index, match.index + match[0].length);
          }
        }
        if (count) {
          const old = found.get(concept.id);
          if (old) for (const alias of old.preferredAliases || []) preferredAliases.add(alias);
          add(concept.id, { label: concept.label, kind: concept.kind, aliases: [...new Set([...preferredAliases, ...concept.aliases])], preferredAliases: [...preferredAliases], canonicalAlias: concept.aliases[0], broad: concept.broad }, origin, count);
          const term = found.get(concept.id);
          term.preferredAliases = [...preferredAliases];
          term.aliases = [...new Set([...preferredAliases, ...concept.aliases])];
        }
      }
      const remaining = value.split('').map((char, index) => covered[index] ? ' ' : char).join('');
      const counts = new Map();
      for (const token of tokens(remaining)) {
        if (STOP.has(token) || ZH_STOP.has(token) || (/^[a-z]/.test(token) && token.length < 3) || /^\d+$/.test(token)) continue;
        counts.set(token, (counts.get(token) || 0) + 1);
      }
      for (const [token, count] of counts) {
        const translated = LITERAL_TRANSLATIONS[token];
        const aliases = [...new Set([token, ...(translated || [])].map(tokenText))];
        add('term:' + token, { label: token, kind: 'keyword', aliases, preferredAliases: aliases, translated: Boolean(translated), broad: false }, origin, count);
      }
    }
    const terms = [...found.values()].map((term) => ({ ...term, weight: Number((term.weight * (1 + Math.min(2, term.origins.length - 1) * 0.08)).toFixed(3)), origin: term.origins.map((key) => ORIGIN[key].label).join(' / ') }))
      .sort((a, b) => b.weight - a.weight || Number(b.kind === 'concept') - Number(a.kind === 'concept') || a.id.localeCompare(b.id)).slice(0, 40);
    if (inputLength && !terms.length) warnings.push('没有识别到具体研究主题。请补充研究对象、疾病、方法或材料名称，也可以添加英文关键词。');
    if (found.size > 40) warnings.push('已保留权重最高的 40 个主题词。可以取消宽泛词，突出论文的主要研究对象。');
    if (inputLength && !values.abstract.trim()) warnings.push('当前主要依据标题或关键词。补充一段研究摘要，通常能提供更多主题线索。');
    if (/[\u3400-\u9fff]/.test(Object.values(values).join(' ')) && terms.some((term) => term.kind === 'keyword' && /[\u3400-\u9fff]/.test(term.label))) warnings.push('部分中文术语采用原词匹配；补充对应英文关键词有助于检索英文期刊资料。');
    return { terms, warnings, inputLength, literalTitle: tokenText(values.title), version: '2.0.0' };
  }

  async function createIndex(journals, { onProgress } = {}) {
    const rows = Array.isArray(journals) ? journals : [], documents = [], postings = new Map(), textCache = new Map();
    const report = (processed) => { if (typeof onProgress === 'function') onProgress({ processed, total: rows.length }); };
    const cachedText = (text) => { const key = String(text || ''); if (!textCache.has(key)) textCache.set(key, tokenText(key)); return textCache.get(key); };
    report(0);
    for (let position = 0; position < rows.length; position++) {
      const row = rows[position];
      if (!row || !row.id || !row.name) continue;
      const segments = [{ source: 'name', text: String(row.name), normalized: cachedText(row.name) }];
      for (const topic of (Array.isArray(row.topics) ? row.topics : [])) if (typeof topic === 'string' && topic.trim()) segments.push({ source: 'topic', text: topic, normalized: cachedText(topic) });
      const categories = new Set([...(Array.isArray(row.jcrCategories) ? row.jcrCategories : []), ...Object.keys(row.jcrByCategory || {})]);
      for (const category of categories) if (typeof category === 'string' && category.trim()) segments.push({ source: 'category', text: category, normalized: cachedText(category) });
      const index = documents.length;
      documents.push({ id: row.id, name: row.name, segments });
      const unique = new Set(segments.flatMap((segment) => segment.normalized.trim().split(' ')).filter(Boolean));
      for (const term of unique) { if (!postings.has(term)) postings.set(term, []); postings.get(term).push(index); }
      if ((position + 1) % 1200 === 0) { report(position + 1); await new Promise((resolve) => setTimeout(resolve, 0)); }
    }
    report(rows.length);
    return { documents, postings, count: documents.length, version: '2.0.0' };
  }

  function rank(index, analysis, { excludedTermIds = [], limit = 1000 } = {}) {
    if (!index?.documents || !index?.postings || !analysis?.terms) return [];
    const excluded = new Set(Array.isArray(excludedTermIds) ? excludedTermIds : []);
    const active = analysis.terms.filter((term) => !excluded.has(term.id) && term.weight > 0);
    if (!active.length) return [];
    const scored = new Map();
    let denominator = 0;
    for (const term of active) {
      const matches = new Map();
      for (const alias of term.aliases || []) {
        const words = alias.trim().split(' ').filter(Boolean);
        if (!words.length || words.some((word) => !index.postings.has(word))) continue;
        const least = words.reduce((best, word) => index.postings.get(word).length < best.length ? index.postings.get(word) : best, index.postings.get(words[0]));
        const aliasWeight = (term.preferredAliases || []).includes(alias) ? 1 : relatedAliasMap.get(term.id)?.has(alias) ? 0.65 : alias === term.canonicalAlias ? 0.94 : 0.88;
        for (const docIndex of least) {
          const doc = index.documents[docIndex];
          for (const segment of doc.segments) {
            if (!segment.normalized.includes(alias)) continue;
            const old = matches.get(docIndex), quality = SOURCE[segment.source].quality * aliasWeight;
            if (!old) matches.set(docIndex, { source: segment.source, quality, topics: new Set(segment.source === 'topic' ? [segment.text] : []), evidence: segment.text });
            else { if (segment.source === 'topic') old.topics.add(segment.text); if (quality > old.quality) { old.source = segment.source; old.quality = quality; old.evidence = segment.text; } }
          }
        }
      }
      // Bounded IDF rewards specific metadata evidence without allowing one rare
      // word to dominate a full abstract. Unmatched terms remain in the score's
      // denominator so a fragment cannot look like complete topic coverage.
      const rarity = matches.size ? 1 + Math.min(1.4, Math.log(1 + index.count / matches.size) / 4) : 1.45;
      const weight = term.weight * rarity;
      denominator += weight;
      for (const [docIndex, match] of matches) {
        if (!scored.has(docIndex)) scored.set(docIndex, { sum: 0, matchedWeight: 0, terms: [], topics: new Set(), categories: new Set(), nameMatched: false });
        const record = scored.get(docIndex);
        record.sum += weight * match.quality;
        record.matchedWeight += weight;
        record.terms.push({ id: term.id, label: term.label, source: SOURCE[match.source].label, evidence: match.evidence });
        for (const topic of match.topics) record.topics.add(topic);
        if (match.source === 'category') record.categories.add(match.evidence);
        if (match.source === 'name') record.nameMatched = true;
      }
    }
    if (!denominator) return [];
    const result = [];
    for (const [docIndex, record] of scored) {
      const doc = index.documents[docIndex];
      const matchedTopics = [...record.topics], matchedCategories = [...record.categories];
      const reasons = [];
      if (record.nameMatched) reasons.push('刊名包含相关主题词');
      if (matchedTopics.length) reasons.push('主题标签：' + matchedTopics.slice(0, 3).join('；'));
      if (matchedCategories.length) reasons.push('JCR 学科：' + matchedCategories.slice(0, 2).join('；'));
      const unrounded = 100 * record.sum / denominator;
      result.push({ id: doc.id, score: Math.round(Math.min(100, unrounded) * 10) / 10, matchedTerms: record.terms, matchedTopics,
        matchedCategories, reasons, evidenceLevel: matchedTopics.length && record.nameMatched ? 'name-and-topic' : matchedTopics.length ? 'topic' : record.nameMatched ? 'name' : 'category',
        coverage: Math.round(1000 * record.matchedWeight / denominator) / 1000, matchedTermCount: record.terms.length, activeTermCount: active.length,
        _rank: unrounded, _name: doc.name, _exact: analysis.literalTitle === doc.segments[0].normalized });
    }
    result.sort((a, b) => b._rank - a._rank || Number(b._exact) - Number(a._exact) || b.matchedTermCount - a.matchedTermCount || nameCollator.compare(a._name, b._name) || a.id.localeCompare(b.id));
    const selected = limit > 0 ? result.slice(0, Math.floor(limit)) : result;
    for (const entry of selected) { delete entry._rank; delete entry._name; delete entry._exact; }
    return selected;
  }

  globalThis.JournalMatcher = Object.freeze({ version: '2.0.0', createIndex, analyze, rank });
})();
