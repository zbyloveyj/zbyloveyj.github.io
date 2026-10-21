#!/usr/bin/env node
/**
 * Build the compact homepage-record index from the complete local data snapshot.
 *
 * Run:   node tools/build_submission_readiness.mjs
 * Check: node tools/build_submission_readiness.mjs --check
 *
 * Only URL syntax is checked. This script does not make network requests, infer
 * active submission status, or infer a homepage from catalog warning messages.
 * Rebuild after changing catalog.json.gz or any detail shard. Publisher/ISSN
 * eligibility and separately verified runtime overlays belong to the app.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const args = process.argv.slice(2);
assert(args.every((arg) => arg === '--check'), 'Only the optional --check flag is supported.');
const checkOnly = args.includes('--check');
const dataURL = new URL('../data/', import.meta.url);
const destination = new URL('submission-readiness.json', dataURL);

// Keep the semantics identical to safeURL() in app.js, including URL parsing.
function safeURL(value) {
  try {
    const url = new URL(String(value));
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch (_) {
    return '';
  }
}

const catalogBytes = await readFile(new URL('catalog.json.gz', dataURL));
const catalog = JSON.parse(gunzipSync(catalogBytes));
assert(Array.isArray(catalog.journals), 'Catalog must contain a journals array.');
const journals = catalog.journals;
const catalogIds = new Set();
for (const journal of journals) {
  assert(typeof journal.id === 'string' && journal.id, 'A catalog journal has no ID.');
  assert(!catalogIds.has(journal.id), `Duplicate catalog ID: ${journal.id}`);
  catalogIds.add(journal.id);
}

const checkedAt = String(catalog.meta?.checkedAt || '').slice(0, 10);
assert(/^\d{4}-\d{2}-\d{2}$/.test(checkedAt), 'Catalog must declare its checkedAt date.');
const detailURL = new URL('details/', dataURL);
const shardNames = (await readdir(detailURL)).filter((name) => /^\d{2}\.json\.gz$/.test(name)).sort();
assert(shardNames.length > 0, 'No detail shards were found.');
if (Number.isInteger(catalog.meta?.detailShardCount)) {
  assert.equal(shardNames.length, catalog.meta.detailShardCount, 'The detail shard set is incomplete.');
}

const homepageById = new Map();
for (const name of shardNames) {
  const parsed = JSON.parse(gunzipSync(await readFile(new URL(name, detailURL))));
  const records = parsed.journals || parsed;
  for (const journal of Array.isArray(records) ? records : Object.values(records)) {
    assert(journal && typeof journal.id === 'string', `Invalid detail record in ${name}`);
    assert(catalogIds.has(journal.id), `Detail ID missing from catalog: ${journal.id}`);
    assert(!homepageById.has(journal.id), `Duplicate detail ID: ${journal.id}`);
    homepageById.set(journal.id, Boolean(safeURL(journal.homepage)));
  }
}
assert.equal(homepageById.size, catalogIds.size, 'Details do not cover every catalog journal.');

// Use catalog order for deterministic output; no guesses from warnings or names.
const missingHomepageIds = journals.filter((journal) => !homepageById.get(journal.id)).map((journal) => journal.id);
const missing = new Set(missingHomepageIds);
assert.equal(missing.size, missingHomepageIds.length, 'The missing-homepage list has duplicate IDs.');
for (const id of catalogIds) {
  assert.equal(!missing.has(id), homepageById.get(id), `Homepage eligibility mismatch: ${id}`);
}

const result = {
  version: 1,
  checkedAt,
  catalogSha256: createHash('sha256').update(catalogBytes).digest('hex'),
  catalogCount: journals.length,
  description: '按完整期刊详情快照检查主页字段能否解析为 HTTP(S) URL。仅说明目录中有可定位的网址记录，不代表已实时访问、已核验官网身份或当前接受投稿；无有效记录的期刊 ID 列于 missingHomepageIds。出版方与 ISSN 由应用另行检查。',
  missingHomepageIds
};

if (checkOnly) {
  assert.deepEqual(JSON.parse(await readFile(destination, 'utf8')), result, 'Submission readiness index is stale; rebuild it.');
} else {
  // Keep the large ID array compact while leaving the small manifest readable.
  const header = Object.entries(result).filter(([key]) => key !== 'missingHomepageIds')
    .map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`);
  await writeFile(destination, '{\n' + header.join(',\n') + ',\n  "missingHomepageIds": ' + JSON.stringify(missingHomepageIds) + '\n}\n');
}

console.log(JSON.stringify({
  mode: checkOnly ? 'verified' : 'generated',
  catalogCount: journals.length,
  detailCount: homepageById.size,
  validHomepageCount: journals.length - missing.size,
  missingHomepageCount: missing.size,
  checkedAt,
  catalogSha256: result.catalogSha256
}));
