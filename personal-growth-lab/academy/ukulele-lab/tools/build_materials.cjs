'use strict';
// Build reviewable snapshots and a complete, printable/downloadable curriculum.
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),context={window:{}};
for(const file of ['course-data.js','music-data.js','score-data.js'])vm.runInNewContext(fs.readFileSync(path.join(root,'assets',file),'utf8'),context,{filename:file});
const C=context.window.UKE_COURSE,M=context.window.UKE_MUSIC,S=context.window.UKE_SCORES;
fs.mkdirSync(path.join(root,'course'),{recursive:true});
fs.mkdirSync(path.join(root,'downloads'),{recursive:true});
let md=`# ${C.name}\n\n一心问道 · 成长学院｜版本 ${C.version}\n\n目标：按自选舒适调和明确谱本，完整弹唱周杰伦《安静》《晴天》和逃跑计划《一万次悲伤》。每天约50分钟，可以分两段；30天是训练顺序。总训练约25小时，不是人人一个月必然达标的保证。可以看谱、降速和简化伴奏，原版指弹前奏属于选修。\n\n在线课程：https://zbyloveyj.github.io/personal-growth-lab/academy/ukulele-lab/\n\n## 开始前\n\n`;
for(const x of M.basics)md+=`### ${x.title}\n\n${x.body}\n\n`;
md+='## 和弦速查\n\n数字固定按第4→1弦（G–C–E–A），不是左手手指号；0为空弦。手指号1食指、2中指、3无名指、4小指。\n\n| 和弦 | 品位 GCEA | 建议指号 GCEA | 检查点 |\n|---|---|---|---|\n';
for(const [name,c] of Object.entries(M.chords))md+=`| ${name} | ${c.frets.join('–')} | ${c.fingers.join('–')} | ${c.tip} |\n`;
md+='\n## 伴奏型\n\n';
for(const p of Object.values(M.patterns))md+=`### ${p.name}\n\n${p.description}\n\n${p.kind==='pick'?'拨弦顺序：'+p.strings.join(' → '):'八分拍格（1 & 2 & 3 & 4 &）：'+p.steps.map(s=>s||'空').join(' / ')}\n\n`;
md+='## 三首歌的分段路线\n\n三首歌默认使用课程内置的原创简化和弦伴奏编配，包含全曲演出顺序、每小节和弦与拍数，不需要购买谱站内容。页面可跟谱播放、慢速分段循环，并下载独立HTML伴奏谱。该编配不含歌词或旋律谱，不是原录音的逐音复刻；原版演唱音区或间奏长度可能不同。\n\n';
for(const s of M.songs){md+=`### ${s.title} · ${s.artist}\n\n${s.goal}\n\n${s.tempo}\n\n难点：${s.difficulties.join('；')}。\n\n`;md+=s.approach.map((x,i)=>`${i+1}. ${x}`).join('\n')+'\n\n';md+='分段执行：\n\n'+s.sectionPlan.map(x=>'- '+x).join('\n')+'\n\n';md+=s.resources.map(x=>`- [${x.title}](${x.url})：${x.note}`).join('\n')+'\n\n';}
md+='## 课内完整伴奏表\n\n每个竖线分隔一小节；括号内为该和弦的拍数，每小节合计4拍。同一段落按演出顺序重复。\n\n';
for(const s of S.songs){md+=`### 《${s.title}》· ${s.totalBars}小节\n\n${s.arrangementLabel}；C指型；起步${s.tempo.default} BPM。\n\n顺序：${s.form.map(f=>f.label+(f.repeat>1?'×'+f.repeat:'')).join(' → ')}。\n\n`;for(const section of s.sections){md+=`#### ${section.title}\n\n`;for(let i=0;i<section.bars.length;i+=4)md+=section.bars.slice(i,i+4).map((b,j)=>`${i+j+1}: `+b.chords.map(c=>`${c.name}（${c.beats}拍）`).join(' + ')).join(' | ')+'\n\n';md+=section.practice.join(' ')+'\n\n';}}
md+='## 录音、专项测评与同步\n\n每一天上方都能录音或上传手机音频。录音先保存到本机录音库，刷新后可继续回听；保留多次练习，支持A/B片段循环和含音频的完整ZIP备份。不要把进度JSON误当作音频备份。\n\n专项测评包括每拍一下闷弦的节奏、单根空弦的目标音高、纯乐器单和弦模板匹配。系统呈现实际测量、训练参考分、可靠性理由和可点回听位置；静音、噪声或条件不足时保留未评分。整曲人声琴声混音不自动输出音准、唱词或结业分。\n\n个人训练室使用ChatGPT登录，私密保存进度、录音与报告。成长学院与训练室的本机数据不同源；首次迁移在录音库导出完整ZIP，再到训练室恢复并同步。每条10分钟/20MB，当前个人云端录音空间250MB；不同设备按每条记录时间合并，不要同时改同一课。\n\n';
md+='## 逐日跟练\n\n';
for(const l of C.lessons){
 const id=String(l.day).padStart(2,'0');
 fs.writeFileSync(path.join(root,'course',`day${id}.json`),JSON.stringify(l,null,2)+'\n');
 md+=`# 第${l.day}天 · ${l.title}\n\n阶段：${l.phase}｜${l.minutes}分钟｜练习拍速：${l.bpm} BPM（教学速度）\n\n**今天的成果：**${l.goal}\n\n`;
 for(const p of l.concepts)md+=`## ${p.title}\n\n${p.body}\n\n`;
 for(const b of l.blocks)md+=`## □ ${b.title} · ${b.minutes}分钟\n\n`+b.steps.map((s,i)=>`${i+1}. ${s}`).join('\n')+'\n\n';
 md+=`## ${l.drill.label}\n\n${l.drill.chords.join(' → ')}\n\n${l.drill.instruction}\n\n## 实操验收\n\n`+l.criteria.map(s=>'- □ '+s).join('\n')+`\n\n**证据：**${l.evidence}\n\n**未达标补练：**${l.fallback}\n\n**达标后选修：**${l.stretch}\n\n## 自测与解析\n\n`;
 for(const [i,q] of l.quiz.entries())md+=`${i+1}. ${q.question}\n\n`+q.options.map((s,j)=>`   ${String.fromCharCode(65+j)}. ${s}`).join('\n')+`\n\n答案：${String.fromCharCode(65+q.answer)}。${q.explanation}\n\n`;
 md+='**记录栏**：实际练习____分钟；BPM____；成功转换____/____次；节奏中断____次；证据文件____；最弱小节____；明日只改一件事____。\n\n---\n\n';
}
md+='## 结课评分与补练\n\n每首单独评分。以下均为回听后的人工自评，网页按规则汇总，不把专项参考分作为整曲分数或教师认证。每项0–5分，按权重折算；未测量保持空值。\n\n';
for(const r of M.rubric)md+=`### ${r.name} · ${r.weight}%\n\n`+r.anchors.map((x,i)=>`- ${i}分：${x}`).join('\n')+'\n\n';
md+='每首≥80/100、所有维度≥3/5、所选版本全部唱段顺序完成、一镜到底、0整段重来、证据记录非空，方记为“自评达标”；三首都通过才达到本课程目标。只完成副歌记作阶段进步。未达标时连续两次练习只处理最弱的两小节，再录一次同条件测试。\n\n## 来源与查阅日期\n\n查阅日期：2026-11-05。课程时长、排序、速度与评分阈值是本课程的教学设计，并非外部研究证明的成功率。\n\n';
md+=M.sources.map(s=>`- [${s.title}](${s.url})：${s.note}`).join('\n')+'\n';
fs.writeFileSync(path.join(root,'downloads','ukulele-30-days.md'),md);
const bridge={id:'ukulele',number:'13',name:C.name,en:'THIRTY DAYS, THREE SONGS',unit:'天',priority:false,pace:'30天 · 每天约50分钟 · 可分两段',external:'ukulele-lab/',intro:'三首课内伴奏谱、30天跟练、录音库与专项音频分析。登录个人训练室，保存完整弹唱与每日进度。',outcome:'30次训练记录、三首完整弹唱录音、分项评分与下一步练习方案。',note:'课内伴奏谱、持久录音与专项分析；整曲结业采用完整录音回听量表。',lessons:C.lessons.map(l=>({id:l.day,title:l.title,stage:l.phase,minutes:l.minutes,concept:l.goal,tasks:l.blocks.map(b=>b.title+'：'+b.steps.join('；')),output:l.evidence,criteria:l.criteria,refs:[],progressTaskKeys:l.blocks.flatMap(b=>b.steps.map((_,i)=>b.id+':'+i))}))};
fs.writeFileSync(path.join(root,'..','assets','ukulele-bridge.js'),"'use strict';\nwindow.ACADEMY.externalCourses=[...(window.ACADEMY.externalCourses||[]).filter(c=>c.id!=='ukulele'),"+JSON.stringify(bridge)+"];\n");
fs.appendFileSync(path.join(root,'..','assets','ukulele-bridge.js'),`
window.UKE_BRIDGE_READ=function(){
 try{
  const raw=JSON.parse(localStorage.getItem('yixindao.ukulele-academy.v1')||'null');
  const c=window.ACADEMY.externalCourses.find(c=>c.id==='ukulele');
  if(!raw||raw.schema!==1||!raw.records||!c)return {done:0,next:1};
  const finished=c.lessons.filter(l=>{const r=raw.records[l.id];return r&&r.done===true&&r.metrics&&typeof r.metrics.minutes==='number'&&r.metrics.minutes>0&&l.progressTaskKeys.every(k=>r.tasks&&r.tasks[k]===true);}).map(l=>l.id);
  return {done:finished.length,next:c.lessons.find(l=>!finished.includes(l.id))?.id||30};
 }catch(_){return {done:0,next:1};}
};
`);
console.log(JSON.stringify({days:C.lessons.length,minutes:C.lessons.reduce((a,l)=>a+l.minutes,0),questions:C.lessons.reduce((a,l)=>a+l.quiz.length,0),blocks:C.lessons.reduce((a,l)=>a+l.blocks.length,0),markdown_bytes:Buffer.byteLength(md)}));
