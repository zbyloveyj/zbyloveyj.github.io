"use strict";
function parseTable(text, taxa, maxRows=100) {
  const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  function cells(line) {
    const result = [];
    let part = "", quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"' && quoted && line[i+1] === '"') {part += '"'; i++;}
      else if (c === '"') quoted = !quoted;
      else if (c === ',' && !quoted) {result.push(part.trim()); part = "";}
      else part += c;
    }
    if (quoted) throw Error("CSV 引号不完整。");
    result.push(part.trim());
    return result;
  }
  if (lines.length < 2 || lines.length > maxRows+1) throw Error("当前表的样本数应在 1–"+maxRows+" 之间。");
  const header = cells(lines.shift()), species = header.slice(1);
  if (new Set(species).size !== species.length) throw Error("物种列名重复。");
  const indices = taxa.map(t => species.indexOf(t));
  const missing = taxa.filter((t,k) => indices[k] < 0);
  if (missing.length) throw Error("缺少 " + missing.length + " 列，例如 " + missing.slice(0,3).join("、"));
  const ids = new Set();
  return lines.map(line => {
    const row = cells(line), id = row.shift();
    if (!id || ids.has(id) || row.length !== species.length) throw Error("请核对样本编号、重复记录和列数。");
    ids.add(id);
    const values = indices.map(k => row[k] === "" ? NaN : Number(row[k]));
    if (values.some(v => !Number.isFinite(v) || v < 0) || !values.some(v => v > 0)) throw Error("丰度必须为非负有限数，样本不能全零。");
    return {id,values};
  });
}
function scoreSample(v, params, emit) {
  const p = v.length-3, edges = p*(p-1)/2, offset = v[2] > 0 ? edges*9 : 0;
  const anchor = (Math.log(v[0])+Math.log(v[1]))/2;
  let k=0, no=0, np=0;
  for (let i=0;i<p;i++) for (let j=i+1;j<p;j++,k++) {
    const a=v[i+3], b=v[j+3], ix=offset+9*k;
    const occ=params[ix+2*Number(a>0)+Number(b>0)], r=params[ix+8];
    let pos=NaN;
    if (a>0 && b>0 && Number.isFinite(anchor) && Number.isFinite(r)) {
      if (r===0) pos=0;
      else {
        const u=(Math.log(a)-anchor-params[ix+4])/params[ix+6], w=(Math.log(b)-anchor-params[ix+5])/params[ix+7];
        pos=-.5*Math.log1p(-r*r)+(r*u*w-.5*r*r*(u*u+w*w))/(1-r*r);
      }
    }
    if (Number.isFinite(occ)) no++;
    if (Number.isFinite(pos)) np++;
    emit(i,j,occ,pos);
  }
  return [no,np];
}
if (typeof module !== "undefined") module.exports = {parseTable,scoreSample};
