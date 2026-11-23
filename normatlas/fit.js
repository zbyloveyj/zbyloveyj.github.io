"use strict";
// Lanczos approximation for the positive log-gamma arguments in the four-cell model.
function logGamma(x) {
  const c=[676.5203681218851,-1259.1392167224028,771.3234287776531,-176.6150291621406,12.507343278686905,-.13857109526572012,9.984369578019572e-6,1.5056327351493116e-7];
  const z=x-1, t=z+7.5;
  let a=.99999999999980993;
  for (let k=0;k<c.length;k++) a+=c[k]/(z+k+1);
  return .5*Math.log(2*Math.PI)+(z+.5)*Math.log(t)-t+Math.log(a);
}
function fitReference(ref) {
  const p=ref[0].length-3, edges=p*(p-1)/2, fit=new Float64Array(edges*18);
  const observed=[new Float64Array(edges),new Float64Array(edges)];
  const prec=[new Float64Array(edges),new Float64Array(edges)];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const lb=(a,b)=>logGamma(a)+logGamma(b)-logGamma(a+b);
  for(let g=0;g<2;g++) {
    const rows=ref.filter(v=>Number(v[2]>0)===g), n=rows.length, base=g*9*edges;
    const logs=rows.map(v=>{
      const a=(Math.log(v[0])+Math.log(v[1]))/2;
      return v.slice(3).map(x=>x>0 && Number.isFinite(a)?Math.log(x)-a:NaN);
    });
    const bf=new Float64Array(edges), support=new Uint8Array(edges);
    const independence=new Float64Array(edges*4);
    let e=0;
    for(let i=0;i<p;i++) for(let j=i+1;j<p;j++,e++) {
      const freq=[.5,.5,.5,.5], offset=base+9*e;
      let count=0, sx=0, sy=0, sxx=0, syy=0, sxy=0;
      for(let h=0;h<n;h++) {
        const v=rows[h], x=logs[h][i], y=logs[h][j];
        freq[2*Number(v[i+3]>0)+Number(v[j+3]>0)]++;
        if (Number.isFinite(x) && Number.isFinite(y)) {count++; sx+=x; sy+=y; sxx+=x*x; syy+=y*y; sxy+=x*y;}
      }
      const ni=freq[2]+freq[3]-1, nj=freq[1]+freq[3]-1;
      support[e]=Math.min(ni,n-ni,nj,n-nj)>=5;
      bf[e]=freq.reduce((total,v)=>total+logGamma(v),0)-4*logGamma(.5)-logGamma(n+2)-lb(ni+1,n-ni+1)-lb(nj+1,n-nj+1);
      for(let state=0;state<4;state++) {
        fit[offset+state]=freq[state]/(n+2);
        independence[4*e+state]=(state>=2?ni+1:n-ni+1)*(state%2?nj+1:n-nj+1)/(n+2)**2;
      }
      const m=Math.max(count,1), mx=sx/m, my=sy/m, dx=Math.sqrt(Math.max(1e-8,sxx/m-mx*mx)), dy=Math.sqrt(Math.max(1e-8,syy/m-my*my));
      fit.set([mx,my,dx,dy,count>=20?0:NaN],offset+4);
      if(count>=20) {
        const r=clamp((sxy/m-mx*my)/(dx*dy)*count/(count+5),-.98,.98)*(count+5)/count;
        observed[g][e]=Math.atanh(clamp(r,-.98,.98)); prec[g][e]=count-3;
      }
    }
    let prevalence=.10, post=new Float64Array(edges);
    for(let k=0;k<20;k++) {
      let sum=0;
      for(let i=0;i<edges;i++) {post[i]=1/(1+Math.exp(-(bf[i]+Math.log(prevalence/(1-prevalence)))));sum+=post[i];}
      prevalence=clamp((sum+1)/(edges+5),.01,.95);
    }
    for(let e=0;e<edges;e++) for(let h=0;h<4;h++) {
      const ix=base+9*e+h, ind=independence[4*e+h], mix=post[e]>.5 ? post[e] : 0;
      fit[ix]=support[e]?Math.log((ind+(fit[ix]-ind)*mix)/ind):NaN;
    }
  }
  const prior=[.87,.07,.02,.02,.02];
  function term(w,v) {const variance=1/(v+4);return [.5*(w*w*variance-Math.log1p(.25*v)),w*variance];}
  for(let e=0;e<edges;e++) {
    const vs=prec.map(v=>v[e]), ws=vs.map((v,g)=>v*observed[g][e]);
    const [b0,m0]=term(ws[0],vs[0]), [b1,m1]=term(ws[1],vs[1]), [bs,ms]=term(ws[0]+ws[1],vs[0]+vs[1]);
    const logs=[0,bs,b0,b1,b0+b1].map((x,k)=>x+Math.log(prior[k])), max=Math.max(...logs);
    const weights=logs.map(x=>Math.exp(x-max)), total=weights.reduce((a,b)=>a+b);
    const prob=weights.map(x=>x/total);
    for(let g=0;g<2;g++) {
      const ix=(g*edges+e)*9+8, local=prob[2+g]+prob[4];
      if(Number.isFinite(fit[ix])) fit[ix]=prob[1]+local>.5 ? Math.tanh(prob[1]*ms+local*[m0,m1][g]) : 0;
    }
  }
  return fit;
}
if(typeof module!=="undefined") module.exports={fitReference};
