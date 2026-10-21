/* Recorded-tag discovery and transparent coverage, with no claim of scientific rank. */
'use strict';
((root, factory) => {
  const discovery = factory();
  if (typeof module === 'object' && module.exports) module.exports = discovery;
  else root.LabDiscovery = discovery;
})(typeof globalThis === 'object' ? globalThis : this, () => {
  const axes = ['domains','methods','diseases','modalities','researchScales','studyDesigns'];
  const weights = {domains:3,methods:4,diseases:4,modalities:1,researchScales:.5,studyDesigns:1};
  const caps = {domains:3,methods:3,diseases:2,modalities:2,researchScales:2,studyDesigns:2};
  const norm = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu,'').trim().toLowerCase().replace(/\s+/g,' ');
  const identityName = value => norm(value).replace(/[\s\p{P}\p{S}]/gu,'');
  const broad = new Set(['脑科学','生命科学','生物学','医学','生物医学','基础医学','生物医学工程','人工智能','计算机科学','神经科学','临床医学','neuroscience','biology','life sciences','medicine','artificial intelligence'].map(norm));
  const ignoredTags = new Set(['未知','待补充','待核验','无','unknown','not recorded','n/a'].map(norm));
  const roleNames = new Set(['current','emeritus','retired','visiting','industry','historical','deceased','unknown']);
  const dimensions = ['research','methods','outputs','resources','translation','collaboration','training'];
  const strings = value => Array.isArray(value) ? value.filter(v=>typeof v==='string' && v.trim()) : [];
  const unique = values => [...new Map(values.map(v=>[norm(v),v.trim()])).values()];
  function values(lab, axis) {
    return unique(axis==='domains' ? [...strings(lab?.directions),...strings(lab?.facets?.domains)] : strings(lab?.facets?.[axis])).filter(v=>!ignoredTags.has(norm(v)));
  }
  function canonicalUrl(raw) {
    try {
      const url = new URL(raw);
      if (!['https:','http:'].includes(url.protocol)) return '';
      url.protocol='https:'; url.hostname=url.hostname.toLowerCase().replace(/^www\./,'');
      url.pathname=url.pathname.replace(/\/+$/,'') || '/';
      for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
      url.searchParams.sort();
      if (['#top','#main','#content'].includes(url.hash.toLowerCase())) url.hash='';
      return url.href;
    } catch { return ''; }
  }
  function canonicalProfile(lab) {
    const url=canonicalUrl(lab?.profileUrl);
    if (!url) return '';
    // A directory shared by many people is not a personal identity key.
    if ((lab.sources||[]).some(s=>s.kind==='directory' && canonicalUrl(s.url)===url)) return '';
    return url;
  }
  function identity(lab) {
    return {id:lab.id,profile:canonicalProfile(lab),sharedGroup:norm(lab.sharedGroup),names:new Set([lab.name,...strings(lab.aliases)].map(identityName).filter(Boolean)),institutions:new Set([lab.institution,lab.institutionKey,...(lab.affiliations||[]).flatMap(a=>[a.institution,a.institutionKey])].map(norm).filter(Boolean))};
  }
  function sameIdentity(a,b) {
    if (a.id===b.id) return true;
    const sameName=[...a.names].some(n=>b.names.has(n));
    if (a.profile && b.profile) {
      // Explicit individual profiles distinguish verified namesakes at one institute.
      if (a.profile!==b.profile) return false;
      // Two named PIs may legitimately share a research group's official page.
      if (a.sharedGroup && a.sharedGroup===b.sharedGroup && !sameName) return false;
      return true;
    }
    return sameName && [...a.institutions].some(n=>b.institutions.has(n));
  }
  function similar(source, labs, {limit=6}={}) {
    if (!source || !Array.isArray(labs)) return [];
    const maximum=Number.isFinite(Number(limit)) ? Math.max(0,Math.min(6,Math.floor(Number(limit)))) : 6;
    if (!maximum) return [];
    const sourceIdentity=identity(source);
    const sourceValues=Object.fromEntries(axes.map(axis=>[axis,values(source,axis)]));
    const candidates=[];
    for (const lab of labs) {
      if (!lab || !lab.id || ['historical','deceased'].includes(lab.roleStatus)) continue;
      const candidateIdentity=identity(lab);
      if (sameIdentity(sourceIdentity,candidateIdentity)) continue;
      const shared=[];
      let score=0,specificSharedCount=0;
      for (const axis of axes) {
        const available=new Set(values(lab,axis).map(norm));
        const overlap=sourceValues[axis].filter(value=>available.has(norm(value)) && !(axis==='domains' && broad.has(norm(value))));
        if (!overlap.length) continue;
        shared.push({axis,values:overlap});
        score+=Math.min(overlap.length,caps[axis])*weights[axis];
        if (['domains','methods','diseases'].includes(axis)) specificSharedCount+=overlap.length;
      }
      // Shared imaging modality or research scale alone is too weak a signal.
      if (!specificSharedCount) continue;
      candidates.push({id:lab.id,shared,score,sharedAxes:shared.length,specificSharedCount,identity:candidateIdentity});
    }
    const lexical=(a,b)=>a<b?-1:a>b?1:0;
    candidates.sort((a,b)=>b.score-a.score || b.sharedAxes-a.sharedAxes || b.specificSharedCount-a.specificSharedCount || lexical(a.id,b.id));
    const selected=[];
    for (const candidate of candidates) {
      if (selected.some(row=>sameIdentity(row.identity,candidate.identity))) continue;
      selected.push(candidate);
      if (selected.length>=maximum) break;
    }
    return selected.map(({identity:unused,...row})=>row);
  }
  function coverage(labs) {
    const rows=Array.isArray(labs) ? labs.filter(l=>l && typeof l==='object') : [];
    const summary={total:rows.length,researchProfiles:0,reviewed:0,projects:0,directories:0,unknownEvidence:0,documentedProfiles:0,withMethods:0,withDiseases:0,withModalities:0,unknownRoles:0,withResearchEvidence:0,withRepresentativePapers:0,countryCount:0,institutionCount:0,dimensions:Object.fromEntries(dimensions.map(d=>[d,0]))};
    const countries=new Set(),institutions=new Set();
    for (const lab of rows) {
      // Older detailed cards use the original reviewed schema without a level.
      const level=lab.evidenceLevel || 'reviewed';
      if (level==='reviewed') summary.reviewed++;
      else if (level==='research_profile') summary.researchProfiles++;
      else if (level==='official_directory') summary.directories++;
      else if (level==='project_record') summary.projects++;
      else summary.unknownEvidence++;
      if (values(lab,'methods').length) summary.withMethods++;
      if (values(lab,'diseases').length) summary.withDiseases++;
      if (values(lab,'modalities').length) summary.withModalities++;
      if (!lab.roleStatus || !roleNames.has(lab.roleStatus) || lab.roleStatus==='unknown') summary.unknownRoles++;
      const evidence=Array.isArray(lab.assessmentEvidence)?lab.assessmentEvidence:[];
      for (const dimension of dimensions) if(evidence.some(e=>e.dimension===dimension && typeof e.summary==='string' && e.summary.trim() && canonicalUrl(e.url))) summary.dimensions[dimension]++;
      if (Array.isArray(lab.papers) && lab.papers.some(p=>p.title && canonicalUrl(p.url))) summary.withRepresentativePapers++;
      for (const country of [lab.country,...(lab.affiliations||[]).map(a=>a.country)]) if (typeof country==='string' && country.trim()) countries.add(norm(country));
      for (const institution of [lab.institutionKey||lab.institution,...(lab.affiliations||[]).map(a=>a.institutionKey||a.institution)]) if (typeof institution==='string' && institution.trim()) institutions.add(norm(institution));
    }
    summary.documentedProfiles=summary.researchProfiles+summary.reviewed;
    summary.withResearchEvidence=summary.dimensions.research;
    summary.countryCount=countries.size;summary.institutionCount=institutions.size;
    return summary;
  }
  return {similar,coverage};
});
