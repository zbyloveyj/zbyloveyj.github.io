"""Build offline-friendly course data, handbook, lesson downloads and archives.

Run from any working directory. JSON lessons are the sole content source; this
builder preserves their full text in the reading app and downloadable handbook.
"""
from __future__ import annotations
import argparse
import html
import json
import re
from pathlib import Path
from tempfile import NamedTemporaryFile
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
VERSION = "2026.10.21.3"


def esc(value):
    return html.escape(str(value), quote=True)


def rich(value):
    text = esc(value)
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    return re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)


def code_html(text, language="python"):
    return '<div class="code-wrap"><div class="code-head">' + esc(language) + '</div><pre><code>' + esc(text) + '</code></pre></div>'


def make_markdown(lesson):
    l = lesson
    lines = [f'# 第 {l["day"]:02d} 课 · {l["title"]}', '', l['subtitle'], '',
             f'版本：{VERSION}｜建议 {l["minutes"]} 分钟，可分次完成', '',
             '## 学习目标', '', *['- '+s for s in l['objectives']], '',
             '## 今日交付物', '', *['- '+s for s in l['deliverables']], '',
             '## 先修准备', '', *['- '+s for s in l['prerequisites']], '']
    for s in l['sections']:
        lines += ['## '+s['title'], '', *sum(([p, ''] for p in s['paragraphs']), [])]
        if s.get('equation'):
            lines += ['```text', s['equation'], '```', '']
        if s.get('table'):
            t = s['table']
            clean = lambda x: str(x).replace('|', '\\|').replace('\n', ' ')
            lines += ['| '+' | '.join(map(clean,t['headers']))+' |', '| '+' | '.join(['---']*len(t['headers']))+' |']
            lines += ['| '+' | '.join(map(clean,row))+' |' for row in t['rows']]
            lines += ['']
        if s.get('code'):
            lines += ['```'+s['code']['language'], s['code']['text'], '```', '']
        if s.get('callout'):
            lines += ['> '+s['callout']['text'], '']
    lines += ['## 动手实验 · '+l['lab']['title'], '']
    for i, step in enumerate(l['lab']['steps'],1):
        lines += [f'### {i}. '+step['title'], '', step['detail'], '']
        if step.get('command'):
            lines += ['```bash', step['command'], '```', '']
        if step.get('expected'):
            lines += ['检查什么：'+step['expected'], '']
    lines += ['### 实验验收', '', *['- [ ] '+a for a in l['lab']['acceptance']], '', '## 论文导读', '']
    for p in l['papers']:
        lines += [f'### {p["title"]} ({p["year"]})', '', p['url'], '', p['why'], '', *['- '+r for r in p['read']], '']
        for q in p['questions']:
            lines += ['**阅读问题：** '+q['question'], '', '**参考思路：** '+q['answer'], '']
    lines += ['## 练习与完整参考解答', '']
    for i, ex in enumerate(l['exercises'],1):
        lines += [f'### 练习 {i}. '+ex['question'], '', '提示：'+ex['hint'], '', '参考解答：'+ex['answer'], '']
    lines += ['## 验收自测', '']
    for i,q in enumerate(l['quiz'],1):
        lines += [f'### {i}. '+q['question'], '', *[f'{chr(65+j)}. {o}' for j,o in enumerate(q['options'])], '', f'参考答案：{chr(65+q["correct"])}。'+q['explanation'], '']
    lines += ['## 收尾思考', '', *['- '+r for r in l['reflection']], '', '下一步：'+l['next'], '']
    return '\n'.join(lines)


def make_coverage_markdown(coverage):
    lines=[coverage['scope'], '']
    for v in coverage['levels'].values():
        lines += ['**'+v['label']+'：** '+v['description'], '']
    for g in coverage['groups']:
        lines += ['### '+g['title'], '', '| 能力 | 对应课 | 实现层级 | 验收与边界 |', '| --- | --- | --- | --- |']
        for t in g['topics']:
            lines.append('| '+t['title']+' | '+', '.join(map(str,t['lessons']))+' | '+coverage['levels'][t['level']]['label']+' | '+t['outcome']+' '+t['artifact']+' |')
        lines += ['']
    return '\n'.join(lines)


def make_coverage_html(coverage):
    out=['<section class="book-chapter" id="knowledge-coverage"><article class="reader"><h1>知识覆盖与实现边界</h1>']
    for level in coverage['levels'].values():
        out.append('<p><strong>'+esc(level['label'])+'：</strong>'+esc(level['description'])+'</p>')
    for group in coverage['groups']:
        out.append('<h2>'+esc(group['title'])+'</h2><p>'+esc(group['description'])+'</p><table><thead><tr><th>能力</th><th>课程</th><th>层级与验收</th></tr></thead><tbody>')
        for topic in group['topics']:
            out.append('<tr><td>'+esc(topic['title'])+'</td><td>'+esc(', '.join(map(str,topic['lessons'])))+'</td><td><strong>'+esc(coverage['levels'][topic['level']]['label'])+'</strong><br>'+esc(topic['outcome'])+'<br>'+esc(topic['artifact'])+'</td></tr>')
        out.append('</tbody></table>')
    out.append('</article></section>')
    return ''.join(out)


def make_html(l):
    out = [f'<section class="book-chapter" id="day-{l["day"]}"><article class="reader">',
           f'<p class="eyebrow">UNIT {l["day"]:02d} / {esc(l["phase"])}</p>',
           '<h1>'+esc(l['title'])+'</h1><p class="subtitle">'+esc(l['subtitle'])+'</p>',
           f'<p class="subtle">建议 {l["minutes"]} 分钟，可分次完成。</p>',
           '<h2>学习目标</h2><ul>'+''.join('<li>'+rich(s)+'</li>' for s in l['objectives'])+'</ul>',
           '<div class="notice mint"><strong>今日作品：</strong>'+rich('；'.join(l['deliverables']))+'</div>',
           '<h3>先修准备</h3><ul>'+''.join('<li>'+rich(s)+'</li>' for s in l['prerequisites'])+'</ul>']
    for s in l['sections']:
        out += ['<h2>'+esc(s['title'])+'</h2>', *['<p>'+rich(p)+'</p>' for p in s['paragraphs']]]
        if s.get('equation'):
            out += ['<pre class="equation">'+esc(s['equation'])+'</pre>']
        if s.get('table'):
            t = s['table']
            out += ['<div class="table-scroll"><table><thead><tr>'+''.join('<th>'+esc(h)+'</th>' for h in t['headers'])+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+rich(v)+'</td>' for v in r)+'</tr>' for r in t['rows'])+'</tbody></table></div>']
        if s.get('code'):
            out += [code_html(s['code']['text'],s['code']['language'])]
        if s.get('callout'):
            out += ['<div class="notice">'+rich(s['callout']['text'])+'</div>']
    out += ['<h2>动手实验 · '+esc(l['lab']['title'])+'</h2>']
    for i,step in enumerate(l['lab']['steps'],1):
        out += [f'<h3>{i}. '+esc(step['title'])+'</h3><p>'+rich(step['detail'])+'</p>']
        if step.get('command'):
            out += [code_html(step['command'],'terminal')]
        if step.get('expected'):
            out += ['<div class="expected">检查什么：'+rich(step['expected'])+'</div>']
    out += ['<h3>实验验收</h3><ul>'+''.join('<li>□ '+rich(a)+'</li>' for a in l['lab']['acceptance'])+'</ul>', '<h2>论文导读</h2>']
    for p in l['papers']:
        out += ['<h3>'+esc(p['title'])+f' ({p["year"]})</h3><p><a href="'+esc(p['url'])+'">'+esc(p['url'])+'</a></p>', '<p>'+rich(p['why'])+'</p><ul>'+''.join('<li>'+rich(r)+'</li>' for r in p['read'])+'</ul>']
        for q in p['questions']:
            out += ['<p><strong>阅读问题：</strong>'+rich(q['question'])+'</p><p><strong>参考思路：</strong>'+rich(q['answer'])+'</p>']
    out += ['<h2>练习与完整参考解答</h2>']
    for i,ex in enumerate(l['exercises'],1):
        out += [f'<h3>{i}. '+esc(ex['question'])+'</h3><p><strong>提示：</strong>'+rich(ex['hint'])+'</p><p><strong>参考解答：</strong>'+rich(ex['answer'])+'</p>']
    out += ['<h2>验收自测与解析</h2>']
    for i,q in enumerate(l['quiz'],1):
        out += [f'<h3>{i}. '+esc(q['question'])+'</h3><ol type="A">'+''.join('<li>'+rich(o)+'</li>' for o in q['options'])+'</ol>', '<p><strong>参考答案：'+chr(65+q['correct'])+'。</strong>'+rich(q['explanation'])+'</p>']
    out += ['<h2>收尾思考</h2><ul>'+''.join('<li>'+rich(r)+'</li>' for r in l['reflection'])+'</ul>', '<p><strong>下一步：</strong>'+rich(l['next'])+'</p>', '</article></section>']
    return '\n'.join(out)


def write_example_scripts(lessons):
    """Make every Python teaching block available as a real downloadable file."""
    directory = ROOT/'project/lesson_examples'
    directory.mkdir(parents=True, exist_ok=True)
    lines = ['# 可运行的课程机制实验', '',
             '本目录由 course/dayNN.json 自动生成。建议从 project 根目录运行以下命令；不要将代码文件移动到未知位置。', '',
             '这些脚本与网页代码一致。第10/13/14课有明确的演示数据或训练产物前置；它们会检查真实生成文件，不使用伪造结果。', '',
             '| 单元 | 实验 | 从 project 目录运行 | 前置 |', '| --- | --- | --- | --- |']
    prerequisites = {
        'demo_data': '先运行 python -m curatemicrobiota make-demo --out data/demo',
        'microbiome_preprocessor': '先 make-demo，再运行 python -m curatemicrobiota pretrain --data data/demo --out runs/microbiome --steps 40',
        'quick_pipeline': '先运行 python -m curatemicrobiota pipeline --quick --out runs/demo'
    }
    for lesson in lessons:
        unit = directory/f'unit{lesson["day"]:02d}'
        unit.mkdir(exist_ok=True)
        for section in lesson['sections']:
            snippet = section.get('code', {})
            if snippet.get('language', '').lower() != 'python':
                continue
            assert re.fullmatch(r'[a-zA-Z0-9_-]+',section['id']), 'Unsafe example filename'
            path = unit/(section['id']+'.py')
            requirements = '；'.join(prerequisites[r] for r in snippet.get('requires',[])) or '安装项目依赖'
            header = '# '+lesson['title']+' / '+section['title']+'\n# 前置：'+requirements+'\n'
            setup = 'from pathlib import Path as _CMPath\nimport sys as _cm_sys\n_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))\n\n'
            path.write_text(header+setup+snippet['text']+'\n',encoding='utf-8')
            command = 'python '+path.relative_to(ROOT/'project').as_posix()
            lines.append('| '+str(lesson['day'])+' | '+section['title']+' | `'+command+'` | '+requirements+' |')
    (directory/'README.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')


def write_verified_archive(destination, entries):
    """Publish a complete CRC-checked archive with one atomic replacement."""
    with NamedTemporaryFile(dir=destination.parent, prefix='.cm-archive-', suffix='.tmp', delete=False) as handle:
        temporary = Path(handle.name)
    try:
        with ZipFile(temporary, 'w', ZIP_DEFLATED) as archive:
            for source, member in entries:
                archive.write(source, member)
        with ZipFile(temporary) as archive:
            invalid = archive.testzip()
            if invalid is not None:
                raise ValueError('Archive CRC failed: '+invalid)
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)


def write_archives():
    downloads = ROOT/'downloads'
    excluded = {'.venv', '__pycache__', 'runs', 'build', 'dist'}
    project_entries = []
    for p in sorted((ROOT/'project').rglob('*')):
        rel = p.relative_to(ROOT/'project')
        if p.is_file() and not any(x in excluded or x.endswith('.egg-info') for x in rel.parts) and p.suffix != '.pyc':
            project_entries.append((p, Path('curatemicrobiota-project')/rel))
    write_verified_archive(downloads/'curatemicrobiota-project.zip', project_entries)
    complete_entries = []
    for p in sorted(ROOT.rglob('*')):
        rel = p.relative_to(ROOT)
        if not p.is_file() or any(x in excluded or x.endswith('.egg-info') for x in rel.parts) or p.suffix=='.pyc':
            continue
        if p.name=='curatemicrobiota-complete.zip' or p.name.startswith('.cm-archive-'):
            continue
        complete_entries.append((p, Path('curatemicrobiota-learning')/rel))
    write_verified_archive(downloads/'curatemicrobiota-complete.zip', complete_entries)


def build(archives=True):
    lessons = [json.loads(p.read_text(encoding='utf-8')) for p in sorted((ROOT/'course').glob('day[0-9][0-9].json'))]
    assert len(lessons)==30, 'The complete edition requires all 30 units.'
    coverage = json.loads((ROOT/'coverage.json').read_text(encoding='utf-8'))
    benchmark = json.loads((ROOT/'project/example-results/loso_report.json').read_text(encoding='utf-8'))
    for i,l in enumerate(lessons,1):
        assert l['day']==i
        assert len(l['sections'])>=8 and len(l['exercises'])>=3 and len(l['quiz'])>=5
        assert len(l['lab']['acceptance'])>=3
        for q in l['quiz']:
            assert len(q['options'])==4 and 0<=q['correct']<4
    write_example_scripts(lessons)
    package = {'version':VERSION,'project':'CurateMicrobiota','source_name':'curatedMetagenomicData','lessons':lessons,'coverage':coverage,'benchmark':{'summaries':benchmark['summaries'],'folds':benchmark['folds'],'seeds':benchmark['seeds'],'source_kind':benchmark['source_kind'],'pretrain_steps':benchmark['pretrain_steps'],'supervised_steps':benchmark['supervised_steps']}}
    (ROOT/'assets/course-data.js').write_text('window.CM_COURSE = '+json.dumps(package,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    downloads = ROOT/'downloads'
    downloads.mkdir(exist_ok=True)
    front = '# CurateMicrobiota · 大模型全景实战\n\n30个学习单元：14课核心实战＋16课进阶专题。从数学、语料、架构与训练，到后训练、检索、工具、评价、部署，再到菌群、序列与多模态研究。\n\n建议8–10周、每周10–14小时，真实科研实验另计。完成标准是能独立推导、实现、运行、诊断和评价原型；不会把完成阅读等同于已掌握所有前沿研究。默认工程使用合成数据与原创教学文本，真实多队列生物学结论需另行验证。\n\n## 知识覆盖与实现层级\n\n'+make_coverage_markdown(coverage)+'\n\n'
    full = [front]
    for l in lessons:
        md = make_markdown(l)
        (downloads/f'day{l["day"]:02d}.md').write_text(md,encoding='utf-8')
        full.append(md)
    (downloads/'knowledge-coverage.md').write_text('# CurateMicrobiota 知识覆盖与实现边界\n\n'+make_coverage_markdown(coverage),encoding='utf-8')
    (downloads/'curatemicrobiota-course.md').write_text('\n\n---\n\n'.join(full),encoding='utf-8')
    toc = ''.join(f'<p><a href="#day-{l["day"]}">UNIT {l["day"]:02d} · {esc(l["title"])}</a></p>' for l in lessons)
    book = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CurateMicrobiota · 完整教材</title><link rel="stylesheet" href="assets/lab.css"></head><body><div class="shell"><header class="book-head"><p class="eyebrow">CURATEMICROBIOTA / COMPLETE HANDBOOK</p><h1>从零写 GPT，<br>到微生物表征模型。</h1><p>一心问道 · 成长学院</p><p>30 个学习单元｜14核心＋16进阶｜讲义、论文、机制实验、完整解答与科研验收</p><div class="notice">默认代码运行使用合成教学数据。真实数据适配 curatedMetagenomicData；完成教学原型不等于完成经过验证的微生物基础模型。</div><p class="no-print"><button onclick="window.print()">打印完整教材 / 另存 PDF</button> <a href="index.html">返回交互课程</a></p>'+'<p><a href="index.html#/coverage">打开知识覆盖表与学习路线</a></p>'+toc+'</header>'+make_coverage_html(coverage)+''.join(make_html(l) for l in lessons)+'</div></body></html>'
    (ROOT/'handbook.html').write_text(book,encoding='utf-8')
    bridge={'id':'llm','number':'11','name':'大模型全景实战 · CurateMicrobiota','en':'LANGUAGE TO MICROBIOME','unit':'课','priority':False,'pace':'30个学习单元 · 14核心＋16进阶 · 可分次完成','external':'llm-lab/','intro':'从数学、架构与训练到RAG、Agent、评估部署，以微生物建模贯通30课；附五模型跨队列实战。','outcome':'完整原理教材、可运行CPU工程、模型训练日志、研究外测报告与学习档案。','note':'默认运行使用合成教学数据；真实数据通过curatedMetagenomicData接口接入。','lessons':[]}
    for l in lessons:
        bridge['lessons'].append({'id':l['day'],'title':l['title'],'stage':l['phase'],'minutes':l['minutes'],'concept':l['subtitle'],'tasks':['完成本课实验并检查全部验收项','完成全部概念自测并理解参考解析','在专属学习页确认本课完成'],'output':'；'.join(l['deliverables']),'criteria':l['lab']['acceptance'],'refs':[]})
    (ROOT.parent/'assets/curatemicrobiota-bridge.js').write_text("'use strict';\nwindow.ACADEMY.externalCourses = "+json.dumps([bridge],ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    stats={'version':VERSION,'lessons':len(lessons),'core_lessons':14,'advanced_lessons':len(lessons)-14,'coverage_topics':sum(len(g['topics']) for g in coverage['groups']),'planned_minutes':sum(l['minutes'] for l in lessons),'sections':sum(len(l['sections']) for l in lessons),'exercises':sum(len(l['exercises']) for l in lessons),'quiz_questions':sum(len(l['quiz']) for l in lessons),'paper_readings':sum(len(l['papers']) for l in lessons),'unique_sources':len({p['url'] for l in lessons for p in l['papers']}),'chinese_characters':sum(len(re.findall(r'[\u4e00-\u9fff]',json.dumps(l,ensure_ascii=False))) for l in lessons)}
    (ROOT/'course-manifest.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    if archives:
        write_archives()
    print(json.dumps(stats,ensure_ascii=False))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--no-archives',action='store_true')
    build(archives=not parser.parse_args().no_archives)
