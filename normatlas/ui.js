"use strict";
const byId = id => document.getElementById(id);
let previousURL, cached;
async function fetchOK(path) {
  const resp = await fetch(path);
  if (!resp.ok) throw Error("资源读取失败，HTTP "+resp.status);
  return resp;
}
async function run(demo) {
  byId("demo").disabled=byId("run").disabled=true;
  byId("download").hidden=true; byId("results").replaceChildren();
  byId("status").textContent="正在读取参考并计算…";
  try {
    const f=byId("input").files[0];
    if (!demo && !f) throw Error("请先选择丰度 CSV 文件。");
    const text=demo ? await (await fetchOK("example.csv")).text() : await f.text();
    const refFile=byId("ref").files[0];
    if (!demo && !refFile) throw Error("请选择独立参考表，或运行合成示例。");
    const referenceText=demo ? await (await fetchOK("reference.csv")).text() : await refFile.text();
    const taxa=referenceText.trimStart().split(/\r?\n/,1)[0].split(",").slice(1).map(x=>x.trim().replace(/^"|"$/g,""));
    if (taxa.length<5 || taxa.length>203) throw Error("参考表应有两个分母菌、一个背景菌及 2–200 个目标菌。");
    const refRows=parseTable(referenceText,taxa,3000);
    const refIds=new Set(refRows.map(s=>s.id));
    cached={panel:{taxa},data:fitReference(refRows.map(s=>s.values))};
    const {panel,data}=cached, samples=parseTable(text,panel.taxa);
    if (samples.some(s=>refIds.has(s.id))) throw Error("待测与参考样本编号重叠。");
    const table=document.createElement("table");
    function appendRow(values,tag) {
      const tr=table.insertRow();
      for (const value of values) {const cell=document.createElement(tag);cell.textContent=value;tr.append(cell);}
    }
    appendRow(["样本","可估计检出边","可估计正丰度边"],"th");
    const chunks=["sample_id,taxon_i,taxon_j,occurrence_nats,positive_nats\r\n"];
    const num=v=>Number.isFinite(v)?v.toPrecision(8):"";
    const escape=s=>'"'+String(s).replace(/"/g,'""')+'"';
    for (const sample of samples) {
      const rows=[], id=escape(sample.id);
      const n=scoreSample(sample.values,data,(i,j,o,z)=>rows.push([id,panel.taxa[i+3],panel.taxa[j+3],num(o),num(z)].join(",")));
      chunks.push(rows.join("\r\n")+"\r\n"); appendRow([sample.id,...n],"td");
    }
    byId("results").append(table);
    if (previousURL) URL.revokeObjectURL(previousURL);
    previousURL=URL.createObjectURL(new Blob(chunks,{type:"text/csv;charset=utf-8"}));
    byId("download").href=previousURL; byId("download").hidden=false;
    byId("status").textContent="计算完成，共 "+samples.length+" 个样本。";
  } catch (err) {byId("status").textContent=err.message;}
  finally {cached=null; byId("demo").disabled=byId("run").disabled=false;}
}
byId("demo").onclick=()=>run(true);
byId("run").onclick=()=>run(false);
