(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.IndustryInsightModel = model;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  const views = ['all', 'giants', 'frontier', 'capital'];
  const sourceMap = {
    virtualcell:['Microsoft Research','Google DeepMind','Nature'],
    organoids:['Vitroscope','bit.bio','Nature'],
    cellmodels:['bit.bio','Vitroscope','Nature'],
    drugdiscovery:['Roche','Novartis','NVIDIA','Google DeepMind'],
    biomanufacturing:['bit.bio','Roche','Nature'],
    agents:['Google DeepMind','Microsoft Research','OpenAI','Anthropic'],
    robotics:['NVIDIA','Amazon Science','Toyota'],
    mobility:['Toyota','NVIDIA','Amazon Science'],
    semiconductors:['TSMC','ASML','NVIDIA'],
    energy:['CATL','BNL','欧洲投资银行'],
    quantum:['IBM Quantum','QuiX Quantum','BNL'],
    medtech:['Siemens Healthineers','J&J','Google Research'],
    space:['SpaceX','Nature'],
    agfood:['Nature','欧洲投资银行']
  };
  function normalizeState(state, watch) {
    return {
      sector:watch.sectors.some(s=>s.id===state.sector)?state.sector:'all',
      view:views.includes(state.view)?state.view:'all',
      q:String(state.q || '').trim(),
      window:['week','context'].includes(state.window)?state.window:'all'
    };
  }
  function selectSector(state, sector, watch) {
    // A directory link starts a fresh sector view, regardless of earlier filters.
    return normalizeState({...state,sector,view:'all',q:'',window:'all'}, watch);
  }
  function matches(report, watch, state) {
    const s=normalizeState(state,watch), q=s.q.toLocaleLowerCase();
    return report.entries.filter(e=>
      (s.view==='all'||e.tracks.includes(s.view)) &&
      (s.sector==='all'||e.sectors.includes(s.sector)) &&
      (s.window==='all'||e.window===s.window) &&
      (!q || JSON.stringify(e).toLocaleLowerCase().includes(q) || e.sectors.some(id=>{
        const t=watch.sectors.find(x=>x.id===id);
        return t && `${t.name} ${(t.aliases||[]).join(' ')}`.toLocaleLowerCase().includes(q);
      }))
    );
  }
  function sources(watch, sector) {
    const s=watch.sectors.find(x=>x.id===sector);
    const labels=s?.sourceLabels || sourceMap[sector] || ['Nature'];
    return labels.map(label=>watch.sources.find(x=>x.label===label)).filter(Boolean);
  }
  return {normalizeState, selectSector, matches, sources};
});
