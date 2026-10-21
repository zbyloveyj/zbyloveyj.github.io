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
assert.deepEqual(plain.terms, emoji.terms, 'Emoji must not shift masked term indices');
assert.ok(!Matcher.analyze({ title: '钙钛矿太阳能电池' }).terms.some((term) => term.id === 'concept:battery'), 'Solar cells are not storage batteries');
assert.ok(!Matcher.analyze({ title: '脑神经网络连接与认知' }).terms.some((term) => term.id === 'concept:machine-learning'), 'Biological network wording must not imply machine learning');
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
assert.ok(relevant.length > 1000, 'The full candidate result remains available for downstream hard filtering');

console.log(JSON.stringify({ status: 'PASS', catalogueCount: journals.length, indexBuildMs: buildMs, vocabulary: index.postings.size, outcomes, checks: ['bilingual retrieval', 'real full catalogue', 'topic evidence', 'boundary matching', 'generic zero results', 'unmatched zero results', 'score bounds', 'determinism', 'term exclusions', 'emoji masking', 'solar battery distinction', 'brain network distinction', 'exact-name tie', 'field-only rejection', 'JIF independence', 'long input bounds', 'untruncated hard-filter candidates'] }, null, 2));
