/** Meaningful retrieval checks against the exact public compressed catalogue.
 * Run: node tools/test_matcher.mjs
 * No browser or network is used. Scores are topic-retrieval signals only.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { performance } from 'node:perf_hooks';
import '../matcher.js';

const Matcher = globalThis.JournalMatcher;
const journals = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('../data/catalog.json.gz', import.meta.url)))).journals;
const names = new Map(journals.map((journal) => [journal.id, journal.name]));
const progress = [];
let start = performance.now();
const index = await Matcher.createIndex(journals, { onProgress: (value) => progress.push(value) });
const buildMs = Math.round(performance.now() - start);
assert.equal(index.count, journals.length);
assert.equal(progress[0].processed, 0);
assert.equal(progress.at(-1).processed, journals.length);
assert.ok(progress.every((value, i) => value.total === journals.length && (!i || value.processed >= progress[i - 1].processed)));

const cases = [
  { label: 'Chinese microbiome–brain title and paragraph', input: { title: '肠道微生物组生态变化与抑郁症脑功能影像的关联', abstract: '整合宏基因组与功能磁共振数据，探索微生物菌群和精神疾病中的脑网络连接与认知差异。' }, expected: /microbiom|microbiolog/i },
  { label: 'English microbiome–brain title', input: { title: 'Associations between gut microbiome composition, depression, and brain functional connectivity', keywords: 'microbiome depression functional connectivity metagenomics' }, expected: /microbiom|microbiolog/i },
  { label: 'English machine learning title', input: { title: 'Stochastic gradient optimization for interpretable machine learning models' }, expected: /machine learning|artificial intelligence/i },
  { label: 'English materials abstract only', input: { abstract: 'Perovskite solar cells and polymer nanomaterials for photovoltaic energy conversion.' }, expected: /solar|photovoltaic|nano|material|energy/i },
  { label: 'Chinese materials title', input: { title: '纳米材料与聚合物界面改善钙钛矿太阳能电池性能' }, expected: /nano|material|energy|solar/i },
  { label: 'Social inequality title', input: { title: 'Intergenerational educational inequality and social stratification' }, expected: /sociolog|education|inequality|stratification/i },
  { label: 'Humanities and philosophy', input: { title: '中国哲学与古典伦理思想' }, expected: /philosoph|ethic|中国|chinese/i }
];
const outcomes = [];
for (const test of cases) {
  const analysis = Matcher.analyze(test.input);
  assert.ok(analysis.terms.length > 0, test.label);
  start = performance.now();
  const ranked = Matcher.rank(index, analysis, { limit: 0 });
  const rankMs = Math.round(performance.now() - start);
  assert.ok(ranked.length > 0, test.label);
  assert.ok(ranked.slice(0, 15).some((entry) => test.expected.test(names.get(entry.id)) || entry.matchedTopics.some((topic) => test.expected.test(topic))), test.label);
  assert.ok(ranked.every((entry) => entry.score >= 0 && entry.score <= 100 && entry.matchedTerms.length && entry.reasons.length));
  assert.ok(ranked.every((entry, i) => !i || entry.score <= ranked[i - 1].score));
  assert.deepEqual(Matcher.rank(index, analysis, { limit: 10 }), ranked.slice(0, 10), 'Deterministic ranking');
  assert.deepEqual(Matcher.rank(index, analysis, { excludedTermIds: analysis.terms.map((term) => term.id), limit: 0 }), [], 'All deselected means no recommendations');
  const excluded = analysis.terms[0].id;
  assert.ok(Matcher.rank(index, analysis, { excludedTermIds: [excluded], limit: 10 }).every((entry) => entry.matchedTerms.every((term) => term.id !== excluded)));
  outcomes.push({ case: test.label, terms: analysis.terms.length, candidates: ranked.length, rankMs, top: ranked.slice(0, 3).map((entry) => ({ name: names.get(entry.id), score: entry.score })) });
}

for (const input of [
  {}, { title: 'This study presents a novel method with significant results and future applications' },
  { title: '本文研究结果表明，采用新的研究方法进行分析。' }, { title: '!!! --- 🧪' },
  { title: 'qzxvblorf qzx123xy' }
]) assert.deepEqual(Matcher.rank(index, Matcher.analyze(input), { limit: 0 }), [], 'Empty, generic and unmatched input must not invent recommendations');

const boundary = Matcher.analyze({ title: 'Airmail pressure pairwise small molecules' });
assert.ok(!boundary.terms.some((term) => ['concept:ai', 'concept:depression', 'concept:llm'].includes(term.id)), 'Match lexical boundaries, not acronym substrings');
const plain = Matcher.analyze({ title: '肠道微生物组与抑郁症' });
const emoji = Matcher.analyze({ title: '🧠肠道微生物组与抑郁症' });
const semanticTerms = (analysis) => analysis.terms.map(({ positions, ...term }) => term);
assert.deepEqual(semanticTerms(plain), semanticTerms(emoji), 'Emoji must not change extracted semantic terms');
assert.deepEqual(Matcher.rank(index, plain, { limit: 10 }), Matcher.rank(index, emoji, { limit: 10 }), 'Emoji offsets must not change retrieved journals');
assert.ok(!Matcher.analyze({ title: '钙钛矿太阳能电池' }).terms.some((term) => term.id === 'concept:battery'), 'Solar cells are not storage batteries');
assert.ok(!Matcher.analyze({ title: '脑神经网络连接与认知' }).terms.some((term) => term.id === 'concept:machine-learning'), 'Biological network wording must not imply machine learning');
assert.ok(!Matcher.analyze({ title: 'Brain neural networks and cognition' }).terms.some((term) => term.id === 'concept:machine-learning'), 'English brain networks must not imply machine learning');
assert.equal(names.get(Matcher.rank(index, Matcher.analyze({ title: 'Microbiome' }), { limit: 1 })[0].id), 'Microbiome', 'Exact name wins a relevance tie');

const fixture = [
  { id: 'name-evidence', name: 'Brain Research', topics: ['Neural connectivity'], fields: ['Neuroscience'], jifValue: 1 },
  { id: 'field-only', name: 'Journal of Civil Engineering', topics: ['Concrete structures'], fields: ['Neuroscience'], jifValue: 999 },
  { id: 'topic-evidence', name: 'Cross-disciplinary Studies', topics: ['Brain imaging'], fields: ['Engineering'], jifValue: 2 }
];
const fixtureIndex = await Matcher.createIndex(fixture);
const brain = Matcher.analyze({ title: 'Brain imaging' });
const first = Matcher.rank(fixtureIndex, brain, { limit: 0 });
assert.ok(first.some((entry) => entry.id === 'name-evidence') && first.some((entry) => entry.id === 'topic-evidence'));
assert.ok(!first.some((entry) => entry.id === 'field-only'), 'A broad field alone is not substantive topic evidence');
const changedImpact = await Matcher.createIndex(fixture.map((row) => ({ ...row, jifValue: 10000 - row.jifValue })));
assert.deepEqual(first, Matcher.rank(changedImpact, brain, { limit: 0 }), 'JIF and prestige must not change topic relevance');

const long = Matcher.analyze({ title: 'Microbiome and depression', abstract: ('This study investigates research methods and outcomes. Gut microbiota and mental health. ').repeat(400) });
assert.ok(long.inputLength <= 13000 && long.terms.length <= 40, 'Bound long pasted text');
assert.ok(Matcher.rank(index, long, { limit: 10 }).length > 0);
const relevant = Matcher.rank(index, plain, { limit: 0 });
assert.ok(relevant.length > 1000, 'Raw retrieval remains complete for screening before downstream hard filters');

const precisionCases = [
  { label: 'Microbiome, depression and brain networks', input: { title: '肠道微生物组与抑郁症脑功能网络的关联', abstract: '结合宏基因组测序与静息态功能磁共振，研究肠道微生物群落及代谢功能与抑郁症、认知表现和脑网络之间的关系，并在独立人群中检验结果。', keywords: 'gut microbiome, depression, functional brain networks' }, core: ['concept:microbiome','concept:gut'], exclude: /animal microbiome|functional foods|case reports/i },
  { label: 'Clinical machine learning and electronic records', input: { title: 'Interpretable machine learning for clinical risk prediction', abstract: 'We develop interpretable machine learning methods for early disease risk prediction using longitudinal electronic health records. External validation and uncertainty estimation assess model generalization across hospitals.', keywords: 'machine learning, medical informatics, clinical prediction' }, core: ['concept:medical-informatics','concept:machine-learning'], exclude: /cancer|oncolog/i },
  { label: 'Hydrogels for neural tissue repair', input: { title: '可降解导电水凝胶用于神经组织修复', abstract: '设计具有导电性与可降解性的水凝胶生物材料，研究其力学性能、电学性质和细胞相容性，并评价材料在组织工程与神经再生中的应用。', keywords: 'hydrogel, biomaterials, tissue engineering, nerve regeneration' }, core: ['concept:hydrogels','concept:biomaterials'] },
  { label: 'Housing affordability and social inequality', input: { title: 'Housing affordability and social inequality in urban communities', abstract: 'This study examines how housing costs and neighborhood change affect social inequality and residential mobility. Longitudinal survey data and urban policy analysis are used to compare communities.', keywords: 'housing, urban sociology, social inequality' }, core: ['concept:housing'], exclude: /working paper|dissertation|preprint/i },
  { label: 'Breast cancer machine learning with genomics', input: { title: 'Machine learning prediction of breast cancer survival using clinical and genomic features', keywords: 'breast cancer, machine learning, genomics, prognosis' }, core: ['concept:oncology','concept:machine-learning'], exclude: /radiology|imaging|medical advances|medical investigation/i },
  { label: 'Lithium battery solid electrolyte interface', input: { title: 'Solid electrolyte interfaces in lithium metal batteries', keywords: 'lithium metal battery, solid electrolyte, electrochemical stability' }, core: ['concept:battery'], exclude: /trace elements|clinical|medicine|energy reviews/i },
  { label: 'Medieval Chinese maritime trade', input: { title: 'Archival evidence of medieval Chinese maritime trade', keywords: 'Chinese maritime history, medieval trade, archives' }, core: ['concept:history'], exclude: /maritime law|archives of asian art|archives d histoire doctrinale/i }
];
const screeningOutcomes = [];
for (const test of precisionCases) {
  const analysis = Matcher.analyze(test.input), raw = Matcher.rank(index, analysis, { limit: 0 });
  const screened = Matcher.screen(index, analysis, { ranked: raw });
  assert.ok(screened.candidates.length > 0, test.label + ': preserve evidence-supported candidates');
  assert.ok(screened.candidates.length < raw.length / 10, test.label + ': substantive evidence gates must remove the broad retrieval tail');
  assert.equal(screened.diagnostics.retrieved, raw.length);
  assert.equal(screened.diagnostics.qualified, screened.candidates.length);
  assert.equal(Object.values(screened.diagnostics.counts).reduce((a, b) => a + b, 0), screened.diagnostics.rejected, 'Every rejected record has one diagnostic reason');
  assert.ok(screened.candidates.every((entry) => test.core.every((id) => entry.screening.directTermIds.includes(id))), test.label + ': central research topics require direct evidence');
  if (test.exclude) assert.ok(!screened.candidates.some((entry) => test.exclude.test(names.get(entry.id))), test.label + ': reject concrete known wrong-scope examples');
  assert.ok(screened.candidates.every((entry) => entry.screening.reason && entry.screening.evidenceGroups.length >= 2), 'Selection has inspectable supporting evidence');
  assert.deepEqual(screened, Matcher.screen(index, analysis, { ranked: raw }), 'Screening is deterministic');
  screeningOutcomes.push({ case: test.label, retrieved: raw.length, qualified: screened.candidates.length, defaultFive: screened.candidates.slice(0, 5).map((entry) => names.get(entry.id)) });
}

for (const input of [{ title: '医学' }, { title: '人工智能在医学中的应用' }, { title: 'research study data methods results' }, { title: 'qzxblorf qzzzyxxx' }]) {
  assert.deepEqual(Matcher.screen(index, Matcher.analyze(input)).candidates, [], 'Generic or insufficient content must not be padded with recommendations');
}
const microAnalysis = Matcher.analyze(precisionCases[0].input), microRaw = Matcher.rank(index, microAnalysis, { limit: 0 });
const microDefault = Matcher.screen(index, microAnalysis, { ranked: microRaw });
assert.ok(microDefault.candidates.every((entry) => entry.screening.missingCoreTerms.some((term) => term.id === 'concept:depression')), 'Uncovered depression topic is explicitly visible rather than claimed as covered');
assert.ok(microDefault.coreTerms.some((term) => term.id === 'concept:neuroscience'), 'An abstract-only child concept must not silently remove a title-level brain topic');
assert.ok(microDefault.candidates.every((entry) => entry.screening.missingCoreTerms.some((term) => term.id === 'concept:neuroscience')), 'Uncovered brain topic remains visible alongside depression');
const requiredMicro = Matcher.screen(index, microAnalysis, { ranked: microRaw, requiredTermIds: ['concept:microbiome', 'concept:depression'] });
assert.equal(requiredMicro.candidates.length, 0, 'Requiring both microbiome and depression must safely return zero when the catalogue lacks joint evidence');
assert.ok(requiredMicro.diagnostics.counts.missingRequired > 0);
const onlyMicro = Matcher.screen(index, Matcher.analyze({ title: 'Microbiome' }));
assert.equal(onlyMicro.candidates.length, 1, 'Exact journal name lookup must not produce hundreds of generic topic matches');
assert.equal(names.get(onlyMicro.candidates[0].id), 'Microbiome');
const reviewLookup = Matcher.screen(index, Matcher.analyze({ title: 'Nature Reviews Microbiology' }));
assert.equal(reviewLookup.candidates.length, 1, 'Exact lookup still finds review series even when an ordinary manuscript would not recommend them');
assert.equal(names.get(reviewLookup.candidates[0].id), 'Nature Reviews Microbiology');

const precisionFixture = [
  { id: 'brain-real', name: 'Brain Imaging and Cognition', topics: ['Brain functional imaging', 'Cognitive neuroscience'] },
  { id: 'brain-false', name: 'Machine Learning Applications', topics: ['Advanced Neural Network Applications', 'Cognitive computing'] },
  { id: 'polymer-only', name: 'Polymer Materials', topics: ['Polymer materials and biocompatibility'] },
  { id: 'hydrogel-real', name: 'Hydrogel Biomaterials', topics: ['Hydrogels in tissue engineering', 'Biomaterial synthesis'] },
  { id: 'battery-real', name: 'Battery Electrochemistry', topics: ['Electrochemical energy storage', 'Battery electrolyte materials'] },
  { id: 'battery-false', name: 'Trace Elements and Electrolytes', topics: ['Lithium and depression', 'Clinical metal toxicity'] },
  { id: 'category-only', name: 'Cross-disciplinary Studies', jcrCategories: ['HYDROGELS, BIOMATERIALS'], topics: [] },
  { id: 'pnas', name: 'Proceedings of the National Academy of Sciences', topics: ['Gut microbiota and health', 'Microbiome composition'] },
  { id: 'conference', name: 'International Conference Proceedings', topics: ['Gut microbiota and health', 'Microbiome composition'] }
];
const precisionIndex = await Matcher.createIndex(precisionFixture);
const brainRows = Matcher.rank(precisionIndex, Matcher.analyze({ title: 'Brain cognition' }), { limit: 0 });
assert.ok(brainRows.some((entry) => entry.id === 'brain-real'));
assert.ok(!brainRows.find((entry) => entry.id === 'brain-false')?.matchedTerms.some((term) => term.id === 'concept:neuroscience'), 'Artificial neural network metadata cannot count as neuroscience');
const gelAnalysis = Matcher.analyze({ title: 'Hydrogel biomaterials for tissue engineering' });
const gelRequired = Matcher.screen(precisionIndex, gelAnalysis, { requiredTermIds: ['concept:hydrogels'] });
assert.deepEqual(gelRequired.candidates.map((entry) => entry.id), ['hydrogel-real'], 'Related polymer aliases and category-only records cannot satisfy required hydrogel evidence');
const proceedings = Matcher.screen(precisionIndex, Matcher.analyze({ title: 'Gut microbiome composition' }));
assert.ok(proceedings.candidates.some((entry) => entry.id === 'pnas'), 'Proceedings in the name does not disqualify an established journal');
assert.ok(!proceedings.candidates.some((entry) => entry.id === 'conference'), 'Explicit conference proceedings are not submission-journal recommendations');
const excludedAll = Matcher.screen(index, microAnalysis, { excludedTermIds: microAnalysis.terms.map((term) => term.id) });
assert.deepEqual(excludedAll.candidates, [], 'Excluded topics never reappear through screening');

console.log(JSON.stringify({ status: 'PASS', engineVersion: Matcher.version, catalogueCount: journals.length, indexBuildMs: buildMs, vocabulary: index.postings.size, outcomes, screeningOutcomes, checks: ['bilingual retrieval', 'real full catalogue', 'topic evidence', 'boundary matching', 'generic zero results', 'unmatched zero results', 'score bounds', 'determinism', 'term exclusions', 'emoji masking', 'solar battery distinction', 'brain network distinction', 'exact-name lookup', 'field-only rejection', 'JIF independence', 'long input bounds', 'untruncated raw retrieval', 'specific researchobject and method gates', 'direct required topic conjunction', 'related alias rejection', 'category-only rejection', 'scope mismatch exclusions', 'explicit uncovered topics', 'no padding', 'conference versus legitimate proceedings names'] }, null, 2));
