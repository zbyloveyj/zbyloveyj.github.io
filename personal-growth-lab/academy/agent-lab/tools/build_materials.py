#!/usr/bin/env python3
"""Build website data, complete teaching notes, embedded-font PDFs and reproducible ZIPs."""
import argparse, hashlib, json, os, re, shutil, zipfile
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
VERSION = '2026.10.22.1'
PHASES = [
 {'id':1,'name':'基础与工具调用','start':1,'end':7,'summary':'明确任务、输入输出和行动边界，完成第一次可检查的工具调用。','deliverable':'带来源与局限的证据卡'},
 {'id':2,'name':'检索、证据与记忆','start':8,'end':14,'summary':'接入材料、检查检索质量，管理上下文和记忆，让回答有出处。','deliverable':'带引用、可拒答的证据问答助手'},
 {'id':3,'name':'规划、协作与可靠执行','start':15,'end':21,'summary':'建立依赖计划、错误恢复、人工批准与质量门禁，接触MCP和图式编排。','deliverable':'能够复核和安全交付的研究工作流'},
 {'id':4,'name':'评价、应用与交付','start':22,'end':28,'summary':'用数值工具处理教学数据，检查攻击样例、成本、界面和可复现性。','deliverable':'附评价集和运行说明的本地应用'},
 {'id':5,'name':'毕业挑战','start':29,'end':30,'summary':'检查未知问题与冲突材料，展示完整作品并整理下一阶段计划。','deliverable':'科研证据助手与能力说明卡'}
]

def md_lesson(d):
    out=[f"# 第{d['day']:02d}天 · {d['title']}", d['subtitle'],
         '**标准路线：60分钟；忙碌日：20分钟；扩展练习另计。**',
         '## 今天的目标', *['- '+x for x in d['outcomes']],
         '## 开始之前', *['- '+x for x in d['prerequisites']],
         '## 一小时安排', *[f"- {a['minutes']}分钟 · {a['label']}：{a['task']}" for a in d['agenda']],
         '## 01 · 理解概念']
    for c in d['concepts']: out += ['### '+c['title'], *c['paragraphs']]
    out += ['## 02 · 一步一步做', '命令在解压后的 practice 文件夹执行。Windows可使用 .\\.venv\\Scripts\\python.exe；macOS/Linux可使用 .venv/bin/python 替代 python。']
    for i,s in enumerate(d['walkthrough'],1):
        out += [f"### {i}. {s['title']}", '**为什么做：**'+s['why'], s['action']]
        if s.get('command'): out += ['```text\n'+s['command']+'\n```']
        out += ['**预期结果：**'+s['expected']]
    x=d['experiment']; out += ['### 改一改 · '+x['title'], *['- '+s for s in x['instructions']], '**观察什么：**'+x['expected'], '**机制解释：**'+x['explanation']]
    out += ['## 常见问题']
    for x in d['troubleshooting']: out += ['### '+x['symptom'], '原因：'+x['cause'], '处理：'+x['fix']]
    out += ['## 03 · 验收', d['deliverable']['description'], '成果文件：`'+d['deliverable']['file']+'`', *['- [ ] '+s for s in d['deliverable']['checks']], '## 自测与解析']
    for i,q in enumerate(d['quiz'],1):
        out += [f"### {i}. {q['question']}", *[f"- {chr(65+j)}. {s}" for j,s in enumerate(q['options'])], f"**答案：{chr(65+q['answer'])}。** {q['explanation']}"]
    out += ['## 小词典', *[f"- **{g['term']}**：{g['meaning']}" for g in d['glossary']], '## 04 · 我的记录', *['- '+x for x in d['reflection']], '## 忙碌日：20分钟', *['- '+x for x in d['lite']['steps']], d['lite']['done'], '## 有余力再做：20分钟选学 · '+d['stretch']['title'], *['- '+x for x in d['stretch']['steps']], '## 参考资料与阅读范围']
    for r in d['references']: out += [f"- [{r['title']}]({r['url']})：{r['scope']}"]
    out += ['## 下一步', d['next']]
    return '\n\n'.join(out)+'\n'

def pdf_files(lessons, font):
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.lib import colors
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.enums import TA_LEFT
    from reportlab.lib.pagesizes import A4
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Preformatted, KeepTogether
    pdfmetrics.registerFont(TTFont('NotoSC', str(font)))
    styles={
       'title':ParagraphStyle('title',fontName='NotoSC',fontSize=20,leading=29,textColor=colors.HexColor('#173d75'),spaceAfter=14,wordWrap='CJK'),
       'h2':ParagraphStyle('h2',fontName='NotoSC',fontSize=13,leading=20,textColor=colors.HexColor('#173d75'),spaceBefore=14,spaceAfter=7,keepWithNext=True,wordWrap='CJK'),
       'h3':ParagraphStyle('h3',fontName='NotoSC',fontSize=10.5,leading=17,textColor=colors.HexColor('#176c68'),spaceBefore=9,spaceAfter=5,keepWithNext=True,wordWrap='CJK'),
       'body':ParagraphStyle('body',fontName='NotoSC',fontSize=9.4,leading=16.3,spaceAfter=6,wordWrap='CJK'),
       'code':ParagraphStyle('code',fontName='NotoSC',fontSize=8,leading=12.5,spaceBefore=5,spaceAfter=8,backColor=colors.HexColor('#edf3f8'),borderPadding=7,wordWrap='CJK'),
       'small':ParagraphStyle('small',fontName='NotoSC',fontSize=8,leading=12.5,spaceAfter=4,wordWrap='CJK')
    }
    def inline(t):
        # Standard text only; source URLs are printed explicitly in the references.
        return escape(t.replace('**','').replace('`',''))
    def story_for(d):
        result=[]; codeblock=False; code=[]
        for block in md_lesson(d).strip().split('\n\n'):
            if block.startswith('```'):
                lines=block.splitlines()[1:-1]
                result.append(Paragraph('<br/>'.join(escape(line).replace(' ','&#160;') for line in lines),styles['code']));continue
            if block.startswith('# '):
                result.append(Paragraph(f'<a name="day{d["day"]}"/>'+inline(block[2:]),styles['title']));continue
            if block.startswith('### '): key='h3';block=block[4:]
            elif block.startswith('## '): key='h2';block=block[3:]
            else:key='body'
            # URLs remain readable and clickable; paragraphs can wrap at CJK boundaries.
            m=re.match(r'^- \[(.*?)\]\((https://.*?)\)：(.*)$',block,flags=re.S)
            if m:
                title,url,scope=m.groups()
                result.append(Paragraph(f'<link href="{escape(url)}" color="#176c68">{inline(title)}</link>：{inline(scope)}<br/><font size="7.5">{escape(url)}</font>',styles['body']))
            else:result.append(Paragraph(inline(block).replace('\n','<br/>').replace('- [ ] ','□ '),styles[key]))
        return result
    def footer(canvas, doc):
        canvas.setTitle('30天 AI Agent 实战｜一心问道 · 成长学院');canvas.setAuthor('一心问道 · 成长学院')
        canvas.setFont('NotoSC',7.5);canvas.setFillColor(colors.HexColor('#5c6c81'))
        canvas.drawString(43,24,'AI Agent 30天实战 · 每天约1小时 · '+VERSION)
        canvas.drawRightString(A4[0]-43,24,str(doc.page))
    def make(path,story):
        SimpleDocTemplate(str(path),pagesize=A4,rightMargin=43,leftMargin=43,topMargin=40,bottomMargin=42,title='30天 AI Agent 实战',author='一心问道 · 成长学院').build(story,onFirstPage=footer,onLaterPages=footer)
    out=ROOT/'downloads'
    for d in lessons:make(out/f"day{d['day']:02d}.pdf",story_for(d))
    story=[Paragraph('30天 AI Agent 实战',styles['title']),Paragraph('每天一小时，从可运行的小例子，到可核验的科研证据助手。',styles['h2']),Paragraph('先下载实践包并打开practice目录。每课按15分钟理解、30分钟操作、10分钟验收、5分钟记录推进。忙碌日可用20分钟精简路线；安装与模型下载时间可以单独安排。中断不清零，完成前以实际结果勾选验收。',styles['body']),Paragraph('离线主线是明确标注的规则教学工作流；可选接入真实模型。语料和CSV为教学材料，不承担真实科学结论。课程覆盖原型构建、验证与交付，模型训练和生产规模运维需另行深入。',styles['body']),Paragraph('课程目录',styles['h2'])]
    for d in lessons:story.append(Paragraph(f'<link href="#day{d["day"]}" color="#173d75">{d["day"]:02d} · {inline(d["title"])}</link>',styles['small']))
    for d in lessons:story += [PageBreak(),*story_for(d)]
    make(out/'agent-course-complete.pdf',story)

def zip_write(path, entries):
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for source,name in sorted(entries,key=lambda x:x[1]):
            info=zipfile.ZipInfo(name,(2026,10,22,0,0,0)); info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16
            z.writestr(info,source.read_bytes())

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--font',default=os.getenv('AGENT_PDF_FONT',''));ap.add_argument('--skip-pdf',action='store_true');a=ap.parse_args()
    lessons=[json.loads(p.read_text()) for p in sorted((ROOT/'course').glob('day*.json'))]
    assert [x['day'] for x in lessons]==list(range(1,31)), 'Need all 30 lessons'
    sources=json.loads((ROOT/'sources.json').read_text())
    if isinstance(sources,dict):sources=sources['sources']
    data={'version':VERSION,'title':'30天 AI Agent 实战','lessons':lessons,'sources':sources,'phases':PHASES}
    (ROOT/'assets/course-data.js').write_text("'use strict';\nwindow.AGENT_COURSE="+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n')
    out=ROOT/'downloads';out.mkdir(exist_ok=True)
    for d in lessons:(out/f"day{d['day']:02d}.md").write_text(md_lesson(d))
    intro='# 30天 AI Agent 实战\n\n每天约1小时：15分钟理解 + 30分钟操作 + 10分钟验收 + 5分钟记录。忙碌日20分钟精简练习单独记录。\n\n实践代码在 practice 目录；安装和模型下载时间可以另计。\n\n'
    (out/'agent-course-complete.md').write_text(intro+'\n\n---\n\n'.join(md_lesson(d) for d in lessons))
    if not a.skip_pdf:
        if not a.font or not Path(a.font).is_file():raise SystemExit('Pass --font /path/to/NotoSansSC-Regular.ttf (OFL licensed)')
        pdf_files(lessons,Path(a.font))
    practice=[(p,'practice/'+p.relative_to(ROOT/'practice').as_posix()) for p in (ROOT/'practice').rglob('*') if p.is_file() and not any(s in ('__pycache__','.venv','outputs','.git') for s in p.parts) and p.name!='.env' and p.suffix!='.pyc']
    zip_write(out/'agent-practice.zip',practice)
    complete=practice+[(p,'course/'+p.name) for p in (ROOT/'course').glob('*.json')]+[(ROOT/'sources.json','sources.json')]+[(p,'materials/'+p.name) for p in out.glob('*.md')]
    if (out/'agent-course-complete.pdf').exists():complete.append((out/'agent-course-complete.pdf','materials/agent-course-complete.pdf'))
    if (out/'FONT-LICENSE.txt').exists():complete.append((out/'FONT-LICENSE.txt','materials/FONT-LICENSE.txt'))
    zip_write(out/'agent-complete.zip',complete)
    report={'version':VERSION,'lessons':len(lessons),'files':{}}
    from pypdf import PdfReader
    for p in sorted(out.iterdir()):
        if not p.is_file() or p.name=='build-report.json':continue
        item={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
        if p.suffix=='.pdf':item['pages']=len(PdfReader(p).pages)
        report['files'][p.name]=item
    (out/'build-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'lessons':30,'sources':len(sources),'pdfs':len(list(out.glob('*.pdf'))),'complete_pdf_pages':report['files'].get('agent-course-complete.pdf',{}).get('pages'),'downloads':len(report['files'])},ensure_ascii=False))

if __name__=='__main__':main()
