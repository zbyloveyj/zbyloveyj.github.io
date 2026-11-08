#!/usr/bin/env python3
"""Build original long reads, 14 sector briefs and the editorial homepage modules."""
from pathlib import Path
from html import escape as esc
import json
import re

ROOT=Path(__file__).resolve().parents[1]
VERSION='20261108-research3'

def main():
    data=json.loads((ROOT/'data/research.json').read_text())
    news=json.loads((ROOT/'data/latest.json').read_text())
    sources={s['id']:s for s in data['sources']}
    articles=data['articles'];briefs=data['sectorBriefs'];readings=data['readings']
    for a in articles:
        text=a['dek']+''.join(p for s in a['sections'] for p in s['paragraphs'])
        a['characterCount']=len(text)
        a['readingMinutes']=max(5,round(len(text)/380))
        a['url']='research/'+a['id']+'.html'
    for b in briefs:b['url']='research/sector-'+b['id']+'.html'
    normalized=json.dumps(data,ensure_ascii=False,indent=2)+'\n'
    if (ROOT/'data/research.json').read_text()!=normalized:(ROOT/'data/research.json').write_text(normalized)
    research=ROOT/'research';research.mkdir(exist_ok=True)
    def ext(s,label=None):
        return '<a href="'+esc(s['url'],quote=True)+'" target="_blank" rel="noopener noreferrer">'+esc(label or s['label'])+' ↗</a>'
    def citations(ids,numbers):
        return '<span class="inline-sources">'+''.join('<a href="#source-'+esc(i)+'">['+str(numbers[i])+']</a>' for i in ids)+'</span>' if ids else ''
    def table(headers,rows):
        return '<div class="research-table-wrap"><table class="research-table"><thead><tr>'+''.join('<th scope="col">'+esc(h)+'</th>' for h in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+esc(str(v))+'</td>' for v in row)+'</tr>' for row in rows)+'</tbody></table></div>'
    def original_card(a):
        return '<article class="research-card" data-research-card data-sectors="'+esc(' '.join(a['sectorIds']))+'"><p class="research-kicker">'+esc(a['category'])+' / 原创分析</p><h3><a href="'+esc(a['url'])+'">'+esc(a['title'])+'</a></h3><p>'+esc(a['dek'])+'</p><div class="research-card-foot"><span>'+str(a['characterCount'])+'字 · 约'+str(a['readingMinutes'])+'分钟</span><a href="'+esc(a['url'])+'">阅读全文 ↗</a></div></article>'
    def report_card(a):
        return original_card(a).replace('href="research/','href="')
    def library(prefix=False):
        options=''.join('<option value="'+esc(b['id'])+'">'+esc(b['title'])+'</option>' for b in briefs)
        cards=''.join((report_card if prefix else original_card)(a) for a in articles)
        return '<div class="research-library-controls"><label><span class="sr-only">搜索专题文章</span><input id="research-query" type="search" placeholder="搜索专题、商业模式或行业关键词"></label><label><span class="sr-only">筛选专题领域</span><select id="research-sector"><option value="all">全部专题领域</option>'+options+'</select></label><p id="research-result-count" role="status" aria-live="polite">'+str(len(articles))+'篇原创专题</p></div><div class="research-grid">'+cards+'</div><p id="research-empty" class="research-empty" hidden>暂无匹配专题，可调整关键词或领域。</p>'
    def related(sector_ids,current=None):
        items=[a for a in articles if a['id']!=current and set(a['sectorIds'])&set(sector_ids)][:4]
        return '<div class="related-list">'+''.join('<a href="'+esc(a['id'])+'.html"><span>'+esc(a['category'])+'</span>'+esc(a['title'])+' ↗</a>' for a in items)+'</div>'
    def page(title,dek,kind,sections,source_ids,extra='',date='2026-11-08',image=None):
        numbers={sid:n+1 for n,sid in enumerate(dict.fromkeys(source_ids))}
        toc=''.join('<a href="#section-'+str(i)+'">'+esc(s['title'])+'</a>' for i,s in enumerate(sections,1))
        body=[]
        for i,s in enumerate(sections,1):
            paragraphs=''.join('<p>'+esc(p)+(citations(s.get('sourceIds',[]),numbers) if n==0 else '')+'</p>' for n,p in enumerate(s['paragraphs']))
            t=s.get('table');rows=table(t['headers'],t['rows']) if t else ''
            body.append('<section id="section-'+str(i)+'"><h2>'+esc(s['title'])+'</h2>'+paragraphs+rows+'</section>')
        img=''
        if image:
            img='<figure class="reader-cover"><img src="../'+esc(image['path'])+'" alt="'+esc(image['alt'])+'" width="1936" height="1084"><figcaption>'+esc(image['credit'])+' · 概念图，非已建成设施 · <a href="'+esc(image['sourceUrl'])+'">原始出处 ↗</a></figcaption></figure>'
        source_html=''.join('<li id="source-'+esc(sid)+'">'+ext(sources[sid])+'<span>'+esc(sources[sid].get('date') or '公开原文')+'</span></li>' for sid in dict.fromkeys(source_ids))
        return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="'+esc(dek,quote=True)+'"><title>'+esc(title)+'｜行业规律洞察</title><link rel="stylesheet" href="../assets/insights.css?v='+VERSION+'"><link rel="stylesheet" href="../assets/research.css?v='+VERSION+'"></head><body class="reader-body"><header class="masthead"><div class="wrap header-row"><a class="brand" href="../"><span class="wordmark">行业规律洞察<span class="brand-period">.</span></span><small>INDEPENDENT RESEARCH / 一心问道</small></a><nav><a href="index.html">研究文库</a><a href="../#sectors">行业目录</a><a href="../#capital-observatory">资本配置</a><a href="../../">学术主页 ↗</a></nav></div></header><main><div class="wrap"><header class="reader-head"><p class="eyebrow">'+esc(kind)+' / 本站原创</p><h1>'+esc(title)+'</h1><p class="reader-dek">'+esc(dek)+'</p><p class="reader-meta">行业规律洞察 · 原创分析 / 更新 '+esc(date)+' / 可使用浏览器打印保存</p><p class="reader-disclosure">公开事实附来源；商业框架、条件性判断与明确标注的示例为本站分析，不代表被引用机构观点。</p></header>'+img+'<div class="reader-layout"><aside class="reader-toc"><p>本文目录</p>'+toc+'<a href="#article-sources">依据与延伸阅读</a></aside><article class="reader-article">'+extra+''.join(body)+'<section id="article-sources"><h2>依据与延伸阅读</h2><ol class="article-sources">'+source_html+'</ol><p class="reader-disclosure">引用不表示机构认可本站。外部原文可能有访问条件；本站不提供付费全文转载。</p></section></article></div></div></main><footer><div class="wrap footer-row"><a href="index.html">返回研究文库 ↗</a><a href="../">行业规律洞察首页 ↗</a></div></footer></body></html>\n'
    for a in articles:
        takeaways='<div class="takeaways"><h2>核心判断</h2><ol>'+''.join('<li>'+esc(t)+'</li>' for t in a['takeaways'])+'</ol></div>'
        text=page(a['title'],a['dek'],a['category'],a['sections'],a['sourceIds'],takeaways,date=a['publishedDate'],image=a.get('image'))
        text=text.replace('</article></div></div>', '<section class="reader-related"><h2>相关专题</h2>'+related(a['sectorIds'],a['id'])+'</section></article></div></div>')
        (research/(a['id']+'.html')).write_text(text)
    for b in briefs:
        value_rows=[[x[k] for k in ['layer','buyer','revenue','evidence']] for x in b['valueChain']]
        sections=[
            {'title':'客户需求与购买任务','paragraphs':[b['demand']]},
            {'title':'价值链与商业模式','paragraphs':['下表是用于比较商业机会的分析框架，不代表这些环节已有订单、确定收入或固定市场份额。应结合具体公司和项目核验。'],'table':{'headers':['产业环节','潜在客户','可能的收入方式','重点核查证据'],'rows':value_rows}},
            {'title':'瓶颈与验证路径','paragraphs':[b['bottleneck']]},
            {'title':'资本用途与兑现条件','paragraphs':[b['capital']]},
            {'title':'需要保留的反证','paragraphs':['；'.join(b['risks'])+'。这些情况出现时，应重新评估原先的商业判断。']},
            {'title':'持续跟踪的指标','paragraphs':['建议跨期记录：'+'；'.join(b['indicators'])+'。记录统计分母、时间范围和数据缺口，避免只在有利时更换指标。']}
        ]
        extra='<p class="sector-news-link"><a href="../?sector='+esc(b['id'])+'#sector-detail">查看该领域最新动态与原文 ↗</a></p>'
        text=page(b['title']+'：行业研究简报',b['question'],'SECTOR BRIEF',sections,b['sourceIds'],extra,date=b['updatedAt'][:10])
        text=text.replace('</article></div></div>','<section class="reader-related"><h2>相关深度研究</h2>'+related([b['id']])+'</section></article></div></div>')
        (research/('sector-'+b['id']+'.html')).write_text(text)
    catalog='<div class="wrap"><header class="reader-head"><p class="eyebrow">RESEARCH LIBRARY</p><h1>研究文库</h1><p class="reader-dek">'+str(len(articles))+'篇原创专题与'+str(len(briefs))+'个行业简报，沿技术、商业与资本逐层阅读。</p><a href="../">返回行业洞察首页 ↗</a></header><section id="research-library">'+library(True)+'</section><section class="brief-directory"><h2>行业研究简报</h2><div>'+''.join('<a href="sector-'+esc(b['id'])+'.html"><strong>'+esc(b['title'])+'</strong><span>'+esc(b['question'])+'</span>阅读全文 ↗</a>' for b in briefs)+'</div></section></div>'
    (research/'index.html').write_text('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>研究文库｜行业规律洞察</title><link rel="stylesheet" href="../assets/insights.css?v='+VERSION+'"><link rel="stylesheet" href="../assets/research.css?v='+VERSION+'"><script defer src="../assets/editorial.js?v='+VERSION+'"></script></head><body><main>'+catalog+'</main></body></html>\n')
    lead=articles[0];space=next(a for a in articles if a['id']=='space-contract-economics')
    cover='<article class="photo-story"><p class="research-kicker">封面专题 / '+esc(space['category'])+'</p><a href="'+space['url']+'"><img src="assets/moon-base-nasa.jpg" alt="NASA月球基地概念图，非已建成设施" width="1936" height="1084" fetchpriority="high"><h3>'+esc(space['title'])+'</h3></a><p class="photo-credit">NASA概念图 · 非已建成设施</p><span>'+esc(space['dek'])+'</span></article>'
    lead_story='<article class="lead-story"><p class="research-kicker">'+esc(lead['category'])+' / 本站原创</p><h3><a href="'+lead['url']+'">'+esc(lead['title'])+'</a></h3><p>'+esc(lead['dek'])+'</p><ol>'+''.join('<li>'+esc(t)+'</li>' for t in lead['takeaways'])+'</ol><a class="text-link" href="'+lead['url']+'">阅读完整分析 ↗</a></article>'
    side='<div class="editorial-side">'+''.join('<article><p class="research-kicker">'+esc(a['category'])+'</p><h3><a href="'+a['url']+'">'+esc(a['title'])+'</a></h3><p>'+esc(a['dek'])+'</p><a href="'+a['url']+'">阅读全文 ↗</a></article>' for a in [articles[1],articles[2]])+'</div>'
    recent=sorted((e for e in news['entries'] if e['window']=='week'),key=lambda e:e['publishedDate'],reverse=True)[:4]
    news_strip='<section class="journal-news" aria-labelledby="journal-news-title"><div class="journal-news-heading"><h2 id="journal-news-title">最新动态</h2><a href="#signals">全部动态 ↗</a></div><div class="journal-news-grid">'+''.join('<article><p><time datetime="'+esc(e['publishedDate'])+'">'+esc(e['publishedDate'][5:])+'</time><span>'+esc(e['organizations'][0])+'</span></p><h3><a href="'+esc(e['sources'][0]['url'],quote=True)+'" target="_blank" rel="noopener noreferrer">'+esc(e['title'])+' <span aria-hidden="true">↗</span></a></h3></article>' for e in recent)+'</div></section>'
    stats='<div class="content-stats"><a href="#research-library"><strong>'+str(len(articles))+'</strong>篇原创专题</a><a href="#sectors"><strong>'+str(len(briefs))+'</strong>个行业简报</a><a href="#signals"><strong>'+str(len(news['entries']))+'</strong>条动态与背景</a><a href="#institution-insights"><strong>'+str(len(readings))+'</strong>项原文导读</a></div>'
    features='<section class="editorial-section" id="research" aria-labelledby="research-title"><div class="section-top"><div><p class="eyebrow">FEATURED RESEARCH</p><h2 id="research-title">本期精选</h2></div><a class="text-link" href="research/">完整研究文库 ↗</a></div><div class="editorial-lead">'+cover+lead_story+side+'</div>'+stats+'</section>'+news_strip+'<section class="editorial-section" id="research-library" aria-labelledby="library-title"><div class="section-top"><div><p class="eyebrow">LONG READS</p><h2 id="library-title">深度研究</h2></div><p class="muted">商业模式、产业链、竞争与资本兑现。</p></div>'+library()+'</section>'
    groups=[('all','全部原文'),('mckinsey','麦肯锡'),('hbr','HBR'),('institutions','国际组织与公共机构'),('companies','公司研究')]
    reading_html='<section class="editorial-section" id="institution-insights" aria-labelledby="institution-title"><div class="section-top"><div><p class="eyebrow">INSTITUTIONAL PERSPECTIVES</p><h2 id="institution-title">机构观点与原文导读</h2></div><p class="muted">外部原文链接，与本站原创分析分别展示。</p></div><div class="reading-tabs" role="group" aria-label="筛选外部原文来源">'+''.join('<button type="button" data-source-filter="'+g+'" aria-pressed="'+str(g=='all').lower()+'">'+label+'</button>' for g,label in groups)+'</div><p id="reading-count" role="status" aria-live="polite">'+str(len(readings))+'项外部阅读</p><div class="reading-grid">'+''.join('<article class="reading-card" data-reading-group="'+esc(r['group'])+'"><p class="research-kicker">'+esc(r['publisher'])+' / '+esc(r['date'] or '公开原文')+'</p><h3>'+ext(sources[r['sourceId']],r['title'])+'</h3><p>'+esc(r['summary'])+'</p><p class="reading-question">带着问题读：'+esc(r['question'])+'</p></article>' for r in readings)+'</div><p class="editorial-note">HBR条目仅列题名、原文入口与本站提出的阅读问题，原文可能需要订阅；不提供付费全文转载。机构标识仅用于准确归属，无合作或认可含义。</p></section>'
    p=data['capitalPanorama'];max_value=p['total']
    chart='<figure class="capital-figure"><p class="research-kicker">年度背景 / '+esc(p['asOf'])+'</p><h3>'+esc(p['title'])+'</h3><p class="capital-total">'+str(p['total'])+'<span>万亿美元 · 年度估计</span></p><div class="capital-bars" aria-hidden="true">'+''.join('<span style="width:'+str(round(v['value']/max_value*100,4))+'%">'+str(v['value'])+'</span>' for v in p['values'])+'</div>'+table(['类别','万亿美元估计值'],[[v['label'],v['value']] for v in p['values']])+'<figcaption>'+esc(p['note'])+'<br>'+ext(sources[p['sourceId']],'数据：IEA公开投资专题')+'</figcaption></figure>'
    money=[e for e in news['entries'] if e.get('finance')]
    money_rows=[]
    for e in money:
        f=e['finance'];money_rows.append([e['organizations'][0],e['publishedDate'],f['display'],f['stage']])
    cap='<section class="editorial-section" id="capital-observatory" aria-labelledby="capital-title"><div class="section-top"><div><p class="eyebrow">CAPITAL ALLOCATION</p><h2 id="capital-title">资本配置观察</h2></div><a class="text-link" href="research/reading-capital-flows.html">如何读懂这些数字 ↗</a></div><div class="capital-overview">'+chart+'<div class="capital-questions"><p class="research-kicker">钱流向哪里，还要看钱是什么。</p><h3>把融资、订单与收入<br>放回各自的口径。</h3><p>下表为本期收录的资金与经营披露，不是完整融资数据库。不同币种与类型不相加，旧交易也不计作本周新增。</p><p>框架上限与任务订单不同；附条件资助与到账不同；季度收入不等于新融资。表内每条都可在动态列表查看原文与详细口径。</p><a href="?view=capital#signals" data-view-link="capital">查看全部资本事件及来源 ↗</a></div></div>'+table(['主体','原文日期','金额与口径','状态'],money_rows)+'</section>'
    home=ROOT/'index.html';html=home.read_text()
    marker='<!-- EDITORIAL_START -->';end='<!-- EDITORIAL_END -->'
    block=marker+'\n'+features+reading_html+cap+'\n'+end
    if marker in html:html=re.sub(re.escape(marker)+r'.*?'+re.escape(end),lambda m:block,html,flags=re.S)
    else:
        anchor='<section class="sector-section"'
        assert anchor in html;html=html.replace(anchor,block+'\n'+anchor,1)
    if 'assets/research.css?' not in html:html=html.replace('</head>','<link rel="stylesheet" href="assets/research.css?v='+VERSION+'"><script defer src="assets/editorial.js?v='+VERSION+'"></script></head>',1)
    html=html.replace('v=20261108-investor2','v='+VERSION)
    html=html.replace('<a href="#sectors">研究领域</a><a href="#signals">最新动态</a><a href="?view=capital#signals" data-view-link="capital">资本流向</a>','<a href="#research">深度研究</a><a href="#institution-insights">机构观点</a><a href="#sectors">行业目录</a><a href="#capital-observatory">资本配置</a><a href="#signals">最新动态</a>')
    html=html.replace('产业变迁，<br>资本去向<span class="title-period">。</span>','行业研究与<br>资本洞察<span class="title-period">。</span>')
    html=html.replace('跟踪技术走出实验室的过程，理解企业的下一步，也追问资金最终流向哪里。','技术前沿、商业模式、产业链与资本配置。沿着原始证据，读懂一个行业为什么变化、谁在付费，以及价值如何兑现。')
    html=html.replace('探索研究领域','探索深度研究').replace('class="text-link" href="#sectors">探索深度研究','class="text-link" href="#research">探索深度研究')
    html=html.replace('本期资本行动','本期资金与经营披露')
    home.write_text(html)
    print(f'Built {len(articles)} full articles, {len(briefs)} sector briefs, {len(readings)} reading guides; {len(money)} capital/operating disclosures.')

if __name__=='__main__':main()
