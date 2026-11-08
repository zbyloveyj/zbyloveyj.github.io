#!/usr/bin/env python3
"""Publish the current JSON as an archived issue and readable, script-free HTML."""
from pathlib import Path
from datetime import date
import json
import re
from html import escape as esc

ROOT = Path(__file__).resolve().parents[1]

def render(report, prefix):
    entries = []
    for e in report['entries']:
        finance = ''
        if e.get('finance'):
            f = e['finance']
            finance = '<div class="finance"><strong>'+esc(f['display'])+'</strong><p>'+esc(f['basis'])+'</p><p>轮次 / 状态：'+esc(f['stage'])+'<br>参与方：'+esc(f['investors'])+'<br>用途：'+esc(f['use'])+'</p></div>'
        sources = ' · '.join('<a rel="noopener noreferrer" href="'+esc(s['url'], quote=True)+'">'+esc(s['label'])+' ↗</a>' for s in e['sources'])
        window = '本期新消息' if e['window'] == 'week' else '延伸背景 · 非本周新增'
        entries.append('<article class="signal-card" id="event-'+esc(e['id'])+'"><p class="card-org">'+esc(window+' / '+' · '.join(e['organizations'])+' / '+e['region'])+'</p><h3>'+esc(e['title'])+'</h3><p>'+esc(e['fact'])+'</p>'+finance+'<p class="reading"><strong>观察判断：</strong>'+esc(e['insight'])+'</p><p class="boundary"><strong>下一步核查：</strong>'+esc(e['nextCheck'])+'</p><div class="card-footer"><div>'+sources+'</div><div class="dates">原文 '+esc(e['publishedDate'])+'<br>事件 '+esc(e['eventDate'] or '未单独披露')+'<br>核验 '+esc(e['verifiedDate'])+'</div></div></article>')
    theses = ''.join('<article class="thesis"><h3>'+esc(t['title'])+'</h3><p>'+esc(t['text'])+'</p><div class="evidence-links">'+''.join('<a href="#event-'+esc(i)+'">证据 '+str(n+1)+' ↓</a>' for n,i in enumerate(t['evidenceIds']))+'</div></article>' for t in report['theses'])
    title = esc(report['issue']+'｜行业规律洞察')
    return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title><link rel="stylesheet" href="'+prefix+'assets/insights.css?v=20261108-investor2"></head><body class="report-body"><div class="wrap"><header><p class="eyebrow">一心问道 / 行业规律洞察</p><h1>'+title+'</h1><p>'+esc(report['period']['start']+' — '+report['period']['end'])+'</p><nav><a href="'+(prefix or './')+'">返回观察站 ↗</a><a href="'+prefix+'data/latest.json">最新数据 JSON ↗</a><span>可使用浏览器打印保存PDF</span></nav></header><main><p class="note">'+esc(report['coverageNote'])+'</p><section><h2>本期观察</h2>'+theses+'</section><section><h2>事件、证据与资本口径</h2>'+''.join(entries)+'</section><p class="note">观察判断是基于公开材料的分析，不代表企业承诺。原文日期、事件日期与核验日期分别保留。资本金额保留原币种，不跨口径合计。本报告发布于 '+esc(report['generatedAt'])+'。</p></main></div></body></html>\n'

def main():
    data = json.loads((ROOT/'data/latest.json').read_text())
    iso = date.fromisoformat(data['period']['end']).isocalendar()
    issue_id = f'{iso.year}-W{iso.week:02d}'
    if not data['issue'].startswith(issue_id):
        raise ValueError('Issue must match the ISO week of period.end')
    issue_dir = ROOT/'data/issues'
    issue_dir.mkdir(parents=True, exist_ok=True)
    (issue_dir/f'{issue_id}.json').write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
    archive_path = ROOT/'data/archive.json'
    archive = json.loads(archive_path.read_text()) if archive_path.exists() else {'schemaVersion':1,'issues':[]}
    archive['issues'] = [x for x in archive['issues'] if x['id'] != issue_id]
    archive['issues'].append({'id':issue_id,'label':data['issue'],'path':f'data/issues/{issue_id}.json','html':f'reports/{issue_id}.html','start':data['period']['start'],'end':data['period']['end']})
    archive['issues'].sort(key=lambda x:x['end'], reverse=True)
    archive_path.write_text(json.dumps(archive, ensure_ascii=False, indent=2)+'\n')
    (ROOT/'latest.html').write_text(render(data, ''))
    reports = ROOT/'reports'
    reports.mkdir(exist_ok=True)
    for issue in archive['issues']:
        if not re.fullmatch(r'\d{4}-W\d{2}',issue['id']):
            raise ValueError('Unsafe archive ID')
        report = json.loads((ROOT/issue['path']).read_text())
        (reports/f'{issue["id"]}.html').write_text(render(report, '../'))
    status_path = ROOT/'data/update-status.json'
    status = json.loads(status_path.read_text())
    status['lastSuccessfulIssue'] = issue_id
    status_path.write_text(json.dumps(status, ensure_ascii=False, indent=2)+'\n')
    print(f'Published {issue_id}: {len(data["entries"])} entries; {len(archive["issues"])} archived issues.')

if __name__ == '__main__':
    main()
