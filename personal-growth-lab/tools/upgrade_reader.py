#!/usr/bin/env python3
"""Apply the editorial reader update without replacing user progress or unrelated pages."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
MARK='// growth-reader-edition-r3'
p=ROOT/'assets/app.js';s=p.read_text(encoding='utf8')
if MARK not in s:
    def rep(old,new):
        global s
        if old not in s:raise RuntimeError('Missing expected reader anchor: '+old[:100])
        s=s.replace(old,new,1)
    rep('function getRubric(d){return dailyRubrics[d]||(d===21?finalRubric:normalRubric)}','function getRubric(d){const x=ALL.find(v=>v.d===d);return x?.assessment?.map(r=>[r.name,r.max])||dailyRubrics[d]||(d===21?finalRubric:normalRubric)}')
    rep('function scheduleFor(d){','function scheduleFor(d){\n    const own=ALL.find(x=>x.d===d)?.schedule;if(own)return own;')
    rep('<div class="pdf-grid">${ALL.map','<div class="download-actions"><a class="button primary" href="downloads/21-daily-pdfs.zip" download>下载全部21份PDF ↓</a><a class="button" href="downloads/21-days-complete-workbook.pdf" download>完整合订本 ↓</a><a class="button" href="downloads/">独立下载目录 ↗</a></div><div class="pdf-grid">${ALL.map')
    rep('<small>完整PDF教材 · 下载 ↓</small>','<small>${x.pdfPages||""}页 · ${(Number(x.pdfBytes||0)/1024).toFixed(0)} KB · 下载 ↓</small>')
    rep('<p>可离线阅读、打印；含本课详解与打卡。</p>','<p>详细自学版 · ${x.pdfPages||""}页 · ${(Number(x.pdfBytes||0)/1024).toFixed(0)} KB；含完整带练与独立打卡页。</p><small><a href="downloads/">全部21课PDF目录</a> · <a href="downloads/21-daily-pdfs.zip" download>一键打包下载</a></small>')
    rep('<p class="section-explain">时间从0分钟开始连续计入，可分段暂停，但不要跳过录音复盘。</p>','<p class="section-explain">${esc(x.common)}</p><div class="note-box"><h4>今日可核对目标</h4><p>${esc(x.target)}</p></div>')
    def section_line(prefix,new):
        global s
        lines=s.splitlines();hits=[i for i,l in enumerate(lines) if l.strip().startswith(prefix)]
        if len(hits)!=1:raise RuntimeError('Expected one section: '+prefix)
        lines[hits[0]]=new;s='\n'.join(lines)+'\n'
    section_line('${section("02A",','''          ${section("02A","本课核心方法",`<div class="workbook-panel"><p>${esc(x.concept)}</p><p>${esc(x.explain)}</p><p class="course-safety">${esc(x.safety)}</p></div>`)}
          ${section("02B","一段话怎样改得更清楚",`<p>${esc(x.case?.situation)}</p><div class="comparison weak"><h3>常见说法</h3><p>${decorate(x.case?.weak)}</p></div><div class="comparison better"><h3>修正示范</h3><p>${decorate(x.case?.good)}</p></div>${list(x.case?.notes)}`)}''')
    section_line('${section("03A",','''          ${section("03A","三道逐步带练题",`<div class="guided-tasks">${arr(x.guided).map((g,i)=>`<article class="guided-task"><p class="guided-label">带练 ${fmt(i+1)}</p><p>${decorate(g.prompt)}</p><details class="answer-panel"><summary>先练一遍，再展开参考与核对</summary><div><h3>参考做法</h3><p>${decorate(g.answer)}</p><h3>核对标准</h3><p>${decorate(g.check)}</p></div></details></article>`).join("")}</div>`,`<p class="section-explain">按时间表在专项时段完成；已有完整输入材料，不需要另找题目。</p>`)}''')
    rep('每句三轮：慢速准确、自然表达、最后尽量不看文字复述。“／”短停顿，“∥”较长停顿。','每句两遍：慢读、自然读；只挑两句不看文字重讲。“／”短停顿，“∥”较长停顿，不机械数秒。')
    rep('"增加难度：完整表达迁移"','"选做复练：完整表达迁移"')
    rep('先照读，合上文字后只按意思重讲一遍。重点检查专项能力能否迁移到自然语言。','这是备用素材，不额外挤入今天必做60分钟；复练时替换原句，重点看自然讲话是否仍然清楚。')
    section_line('${section("06",','''          ${section("06","脱稿复述练习",`<div class="retell-chain">${arr(x.retell).map(v=>`<span>${esc(v)}</span>`).join("")}</div><p class="section-explain">只看五个关键词准备1分钟，再讲60—90秒。先保存首录；不为凑时长拖字，不按背出原句计分。</p><details class="answer-panel"><summary>完成首录后，查看完整复述示范</summary>${sample}</details>`)}''')
    rep('每次选择至少一套实战稿练习，先录原始版，再修正一处具体问题。','两套示范为同一实战时段的替代材料，不要求全部练完；经历与数字均为教学情境，不能冒充自己的实际工作。')
    section_line('${section("07A",','''          ${section("07A","独立实战：先作答，再看示范",`<div class="workbook-panel"><h3>新情境</h3><p>${decorate(x.transfer?.situation)}</p><p class="transfer-brief">${esc(x.transfer?.brief)}</p><h3>三项核对标准</h3>${list(x.transfer?.checks)}<details class="answer-panel"><summary>保留独立首录后，展开完整参考</summary><p>${decorate(x.transfer?.model)}</p></details></div>`)}''')
    section_line('${section("08A",','''          ${section("08A","100分：每一分按什么记录",`<div class="assessment-scroll"><table class="assessment-table"><thead><tr><th>项目</th><th>满分</th><th>具体依据</th></tr></thead><tbody>${arr(x.assessment).map(r=>`<tr><td>${esc(r.name)}</td><td>${r.max}</td><td>${esc(r.rule)}</td></tr>`).join("")}</tbody></table></div><p class="course-safety">${esc(x.scoreNote)}</p><h3>回听时请回答</h3>${list(x.questions)}`)}
          ${x.baselineReading?section("08B","同题复测材料",`<p>${esc(x.baselineIntro)}</p><div class="sample">${decorate(x.baselineReading)}</div><p class="course-safety">没有早期录音时建立当前基线；不推算、更不补造过去成绩。</p>`):""}''')
    rep('<div class="note-box"><h4>今日必须保留的录音</h4>${rec}</div>','<div class="note-box"><h4>今日必须保留的录音</h4>${rec}</div><div class="note-box"><h4>如何回听与保存</h4>${list(x.recordingGuide)}</div><p class="section-explain"><a href="https://www.nidcd.nih.gov/health/taking-care-your-voice" target="_blank" rel="noopener">发声保护参考：NIDCD</a> · 课程设计量表不是专业等级认证。</p>')
    rep('打印 / 保存PDF','打印当前网页')
    rep('save()}\n  function isDone','return save()}\n  function isDone')
    rep('update(d,"notes",memo.value);document.getElementById("memo-status").textContent="已保存到本机浏览器"','const ok=update(d,"notes",memo.value);document.getElementById("memo-status").textContent=ok?"已保存到本机浏览器":"浏览器未能保存，请复制笔记或导出记录";')
    s=MARK+'\n'+s;p.write_text(s,encoding='utf8')
css=ROOT/'assets/workbook.css';c=css.read_text(encoding='utf8')
if '/* detailed-reader-r3 */' not in c:
    c+='''
/* detailed-reader-r3 */
.download-actions{display:flex;flex-wrap:wrap;gap:12px;margin:12px 0 28px}.comparison,.guided-task{border:1px solid var(--line,#ddd);padding:22px;margin:16px 0;border-radius:12px;line-height:1.9}.comparison h3,.answer-panel h3{font-size:15px;margin:0 0 10px}.comparison.weak{background:#f6f1e9;border-left:3px solid #ba9e7b}.comparison.better{background:#edf4ed;border-left:3px solid #719276}.guided-label{font-size:12px;letter-spacing:1px;color:var(--muted)}.answer-panel{margin:16px 0;border-top:1px solid #dce3da;padding-top:14px}.answer-panel summary{cursor:pointer;color:#315845;font-size:14px;font-weight:650;line-height:1.7}.answer-panel[open]>div,.answer-panel[open]>p{margin-top:16px}.course-safety{font-size:13px!important;line-height:1.85;color:var(--muted);padding:14px 16px;background:#f3f4ec;border-radius:8px;margin:18px 0}.assessment-scroll{overflow-x:auto}.assessment-table{width:100%;border-collapse:collapse;font-size:13px;line-height:1.8}.assessment-table th,.assessment-table td{padding:12px;border-bottom:1px solid #dce3da;text-align:left;vertical-align:top}.assessment-table th{background:#edf3eb}.assessment-table th:first-child{width:110px}.assessment-table th:nth-child(2){width:54px}.transfer-brief{font-weight:600}.lesson-download-banner small{font-size:12px}.lesson-download-banner small a{text-decoration:underline;text-underline-offset:3px}.lesson-content,.lesson-layout>*{min-width:0}
@media(max-width:600px){.comparison,.guided-task{padding:17px}.assessment-table{font-size:12px}.assessment-table td,.assessment-table th{padding:9px 7px}.assessment-table th:first-child{width:74px}.assessment-table th:nth-child(2){width:38px}.download-actions .button{width:100%;justify-content:center}.course-safety{padding:12px}.lesson-download-banner{align-items:stretch}.lesson-download-banner small{line-height:2}}
@media print{.answer-panel>div,.answer-panel>p{display:block!important}.download-actions{display:none}.guided-task,.comparison{break-inside:avoid}}
''';css.write_text(c,encoding='utf8')
p=ROOT/'index.html';s=p.read_text(encoding='utf8')
s=re.sub(r'\s*<script defer src="data/(?:week|deep)[123]\.js[^\"]*"></script>','',s)
if 'data/edition-v3.js' not in s:s=s.replace('  <script defer src="assets/app.js','  <script defer src="data/edition-v3.js?v=20261020r3"></script>\n  <script defer src="assets/app.js')
s=re.sub(r'(assets/(?:app.js|workbook.css))\?[^\"]*',r'\1?v=20261020r3',s)
if '<noscript>' not in s:s=s.replace('  <main id="app-main"','  <noscript><p style="padding:24px"><a href="downloads/">无需JavaScript：打开全部21份PDF下载目录</a></p></noscript>\n  <main id="app-main"')
p.write_text(s,encoding='utf8')
assert 'yixw_practice_lab_2026_v1' in (ROOT/'assets/app.js').read_text()
print('Reader upgraded; original local progress key retained.')
