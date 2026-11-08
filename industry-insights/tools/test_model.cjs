const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const model = require('../assets/insight-model.js');
const root = path.resolve(__dirname, '..');
const watch = JSON.parse(fs.readFileSync(path.join(root, 'data/watchlist.json')));
const report = JSON.parse(fs.readFileSync(path.join(root, 'data/latest.json')));

// Directory navigation must escape unrelated filters, including an empty result.
const blocked = {sector:'agents',view:'giants',q:'unrelated search',window:'week'};
for (const sector of watch.sectors) {
  const next = model.selectSector(blocked,sector.id,watch);
  assert.equal(next.sector,sector.id);
  assert.equal(next.view,'all');
  assert.equal(next.q,'');
  assert.equal(next.window,'all');
  const expected=report.entries.filter(e=>e.sectors.includes(sector.id)).map(e=>e.id);
  assert.deepEqual(model.matches(report,watch,next).map(e=>e.id),expected,sector.name);
  assert.ok(model.sources(watch,sector.id).length>0,sector.name+' needs a source route');
}
assert.deepEqual(blocked,{sector:'agents',view:'giants',q:'unrelated search',window:'week'},'navigation must not mutate previous state');

// Aliases, multiple dimensions and genuinely empty sectors remain distinguishable.
assert.ok(model.matches(report,watch,{q:'AI VC'}).every(e=>e.sectors.includes('virtualcell')));
assert.ok(model.matches(report,watch,{q:'AI VC'}).length>0);
const org=model.matches(report,watch,{sector:'organoids',view:'capital',window:'week'});
assert.ok(org.length>0);
assert.ok(org.every(e=>e.sectors.includes('organoids')&&e.tracks.includes('capital')&&e.window==='week'));
assert.equal(model.matches(report,watch,{sector:'organoids',q:'never-a-real-company-23987'}).length,0);
const emptySectorReport={...report,entries:report.entries.filter(e=>!e.sectors.includes('energy'))};
assert.equal(model.matches(emptySectorReport,watch,{sector:'energy'}).length,0);
assert.equal(model.selectSector({},'untrusted-sector',watch).sector,'all');
assert.equal(model.normalizeState({view:'invalid',window:'invalid'},watch).view,'all');
assert.equal(model.matches(report,watch,model.selectSector(blocked,'all',watch)).length,report.entries.length);
console.log(`PASS: ${watch.sectors.length} sector routes; filter reset; aliases; empty sectors; sources; immutable navigation.`);
