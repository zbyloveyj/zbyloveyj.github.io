#!/usr/bin/env python3
"""Generate shared navigation and the static site directory; do not edit user records."""
from pathlib import Path
from html.parser import HTMLParser
from html import escape
import re, json

ROOT=Path(__file__).resolve().parents[1]
class Spans(HTMLParser):
    void={'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
    def __init__(self,text):
        super().__init__(convert_charrefs=False);self.text=text;self.lines=[0];self.nodes=[];self.stack=[]
        for match in re.finditer('\n',text):self.lines.append(match.end())
        self.feed(text)
    def _pos(self):
        line,column=self.getpos();return self.lines[line-1]+column
    def handle_starttag(self,tag,attrs):
        start=self._pos();node={'tag':tag,'attrs':dict(attrs),'start':start,'open_end':start+len(self.get_starttag_text())}
        self.nodes.append(node)
        if tag in self.void:node['end']=node['open_end'];node['close_start']=node['open_end']
        else:self.stack.append(node)
    def handle_startendtag(self,tag,attrs):
        self.handle_starttag(tag,attrs)
        if tag not in self.void:
            node=self.stack.pop();node['end']=node['open_end'];node['close_start']=node['open_end']
    def handle_endtag(self,tag):
        for i in range(len(self.stack)-1,-1,-1):
            if self.stack[i]['tag']==tag:
                node=self.stack[i];del self.stack[i:];node['close_start']=self._pos();node['end']=self.text.index('>',self._pos())+1;break
    def find(self,tag=None,id=None,cls=None):
        return next(n for n in self.nodes if (not tag or n['tag']==tag) and (not id or n['attrs'].get('id')==id) and (not cls or cls in n['attrs'].get('class','').split()))
    def source(self,node):return self.text[node['start']:node['end']]

def bi(zh,en):return f'<span class="zh-only">{zh}</span><span class="en-only">{en}</span>'
def heading(zh,en,href=None,labelzh='',labelen=''):
    return '<div class="section-heading"><h2>'+bi(zh,en)+'</h2>'+('' if not href else f'<a class="text-link" href="{href}">'+bi(labelzh,labelen)+' →</a>')+'</div>'

VERSION='20261116-structure'
NAV=[('research.html','研究','Research'),('publications.html','论文','Papers'),('projects.html','代码','Code'),('books.html','著作','Books'),('personal-growth-lab/academy/','学习','Learning'),('industry-insights/','洞察','Insights'),('about.html','关于','About')]
CORE={'index.html':('首页','Home'),'research.html':('研究介绍','Research overview'),'publications.html':('精选论文','Selected publications'),'projects.html':('开源代码','Open code'),'books.html':('著作与教材','Books & guides'),'about.html':('个人介绍','About'),'directory.html':('全站导航','Site directory')}

def header(page):
    links=''.join(f'<a href="{url}"'+(' class="active" aria-current="page"' if page==url else '')+'>'+bi(zh,en)+'</a>' for url,zh,en in NAV)
    return '<header class="site-header" id="top"><div class="container nav-shell"><a class="brand" href="index.html" aria-label="朱宝圆 · 首页" data-label-zh="朱宝圆 · 首页" data-label-en="Baoyuan Zhu · Home"><span class="brand-mark">B<span>·</span>Z</span><span class="brand-text">'+bi('朱宝圆<small>BAOYUAN ZHU</small>','Baoyuan Zhu<small>朱宝圆 · SCUT</small>')+'</span></a><nav class="main-nav" id="main-nav" aria-label="主导航" data-label-zh="主导航" data-label-en="Main navigation">'+links+'</nav><div class="nav-actions"><a class="nav-directory" href="directory.html" aria-label="检索全站内容" data-label-zh="检索全站内容" data-label-en="Find content across the site"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg></a><div class="language-switch" id="lang-toggle" role="group" aria-label="Language / 语言"><button type="button" data-site-lang="zh" aria-label="中文版本" aria-pressed="true">中文</button><button type="button" data-site-lang="en" aria-label="English version" aria-pressed="false">EN</button></div><button type="button" class="theme-switch" id="theme-toggle" aria-label="切换深色主题">◐</button><button type="button" class="menu-toggle" id="menu-toggle" aria-controls="main-nav" aria-expanded="false" aria-label="展开导航" data-label-zh="展开导航" data-label-en="Open navigation">☰</button></div></div></header>'

def footer():
    groups=[('研究与成果','Research',NAV[:3]),('阅读与学习','Reading & learning',[NAV[3],NAV[4],('directory.html#tools','工具与资料','Tools & resources')]),('更多内容','More',[NAV[5],NAV[6],('directory.html','全站导航','Site directory')])]
    top='<div class="container site-footer-links">'
    for zh,en,links in groups:
        top+='<div><h2>'+bi(zh,en)+'</h2><nav>'+''.join(f'<a href="{u}">{bi(z,e)}</a>' for u,z,e in links)+'</nav></div>'
    top+='</div>'
    return '<footer class="footer">'+top+'<div class="container footer-grid"><p><strong>朱宝圆 <span>BAOYUAN ZHU</span></strong><small>'+bi('科研、写作与持续学习。','Research, writing &amp; lifelong learning.')+'</small></p><p>© <span id="current-year">2026</span><small>'+bi('独立个人网站 · 无用户追踪','Independent personal website · No tracking')+'</small></p><a href="#top">'+bi('回到顶部','Back to top')+' ↑</a></div></footer>'

def replace_node(text,node,value):return text[:node['start']]+value+text[node['end']:]

def directory_body():
    data=json.loads((ROOT/'assets/site-directory.json').read_text());groups=data['groups']
    intro='<section class="inner-hero directory-intro"><div class="container"><p class="section-index">SITE DIRECTORY</p><h1>'+bi('找到你需要的内容。','Find your way around.')+'</h1><p class="inner-intro">'+bi('研究、作品、课程与工具，按用途归到同一份目录。可搜索标题、主题或用途；课程正文以原有语言提供。','Research, books, courses and tools organized by purpose. Search titles, topics or uses; course content remains in its original language.')+'</p></div></section>'
    toolbar='<div class="directory-toolbar"><form action="directory.html" method="get" role="search"><label for="directory-search">'+bi('搜索全站入口','Search the site directory')+'</label><div><input id="directory-search" name="q" type="search" autocomplete="off" data-label-zh="搜索全站入口" data-label-en="Search the site directory" data-placeholder-zh="例如：脑肠、Agent、英语、期刊、简历" data-placeholder-en="Try: brain–gut, agent, English, journals, CV" placeholder="例如：脑肠、Agent、英语、期刊、简历"><button type="reset" id="directory-clear">'+bi('清空','Clear')+'</button></div></form><div class="directory-filters" role="group" aria-label="内容分类 / Categories" hidden><button type="button" data-directory-filter="all" aria-pressed="true">'+bi('全部','All')+'</button>'+''.join(f'<button type="button" data-directory-filter="{g["id"]}" aria-pressed="false">{bi(escape(g["title"]),escape(g["titleEn"]))}</button>' for g in groups)+'</div><p class="directory-count" id="directory-count" role="status" aria-live="polite">'+bi(f'共 {sum(len(g["entries"]) for g in groups)} 个内容入口',f'{sum(len(g["entries"]) for g in groups)} destinations')+'</p></div>'
    content='<div class="directory-layout">'
    for g in groups:
        content+=f'<section class="directory-section" id="{g["id"]}" data-directory-group="{g["id"]}"><div class="section-heading"><h2>{bi(escape(g["title"]),escape(g["titleEn"]))}</h2><span class="directory-group-count">{len(g["entries"])}</span></div><div class="directory-items">'
        for x in g['entries']:
            key=' '.join([x['title'],x['titleEn'],x['description'],x['descriptionEn'],x['keywords'],g['title'],g['titleEn']])
            content+=f'<article class="directory-entry" data-directory-entry data-directory-search="{escape(key,quote=True)}"><p class="directory-kind">{bi(escape(x["kind"]),escape(x["kindEn"]))}</p><h3><a href="{escape(x["href"],quote=True)}">{bi(escape(x["title"]),escape(x["titleEn"]))} <span aria-hidden="true">→</span></a></h3><p>{bi(escape(x["description"]),escape(x["descriptionEn"]))}</p></article>'
        content+='</div></section>'
    content+='</div><p class="directory-empty" hidden>'+bi('没有找到匹配入口。请尝试更短的关键词，或切换到“全部”。','No matching destinations. Try a shorter keyword or choose All.')+'</p><noscript><p>'+bi('下方完整目录可直接使用；启用JavaScript后可搜索与筛选。','The complete directory is available below. Enable JavaScript for search and filters.')+'</p></noscript>'
    return '<main id="main">'+intro+'<div class="container">'+toolbar+content+'</div></main>'

def make_directory():
    home=(ROOT/'index.html').read_text();doc=Spans(home)
    head=doc.source(doc.find(tag='head'))
    head=re.sub(r'<title>.*?</title>','<title>全站导航 | 朱宝圆 · Baoyuan Zhu</title>',head,flags=re.S)
    head=re.sub(r'<script[^>]+src="assets/(?:paper-figures|home-experience)\.js[^\"]*"[^>]*></script>','',head)
    head=head.replace('https://zbyloveyj.github.io/" rel="canonical"','https://zbyloveyj.github.io/directory.html" rel="canonical"')
    head=re.sub(r'<script type="application/ld\+json">.*?</script>','',head,flags=re.S)
    head=re.sub(r'<meta[^>]+(?:property="og:(?:title|description|url)"|name="description")[^>]*>','',head)
    head=head.replace('</head>','<meta name="description" content="朱宝圆个人网站的研究、作品、课程与工具导航。"><script defer src="assets/site-directory.js?v='+VERSION+'"></script></head>')
    return '<!doctype html><html lang="zh-CN" data-lang="zh" data-theme="light">'+head+'<body class="inner-page page-directory redesign"><a class="skip-link" href="#main">'+bi('跳转正文','Skip to content')+'</a>'+header('directory.html')+directory_body()+footer()+'</body></html>'

def core_shell(page,text):
    d=Spans(text);text=replace_node(text,d.find(tag='header',cls='site-header'),header(page))
    d=Spans(text);text=replace_node(text,d.find(tag='footer',cls='footer'),footer())
    # A clear parent route supplements the brand's home link on every inner page.
    d=Spans(text)
    existing=[n for n in d.nodes if 'page-breadcrumb' in n['attrs'].get('class','').split()]
    if existing:text=replace_node(text,existing[0],'')
    if page!='index.html':
        zh,en=CORE[page];crumb='<div class="container page-breadcrumb"><nav aria-label="位置 / Breadcrumb"><a href="index.html">'+bi('首页','Home')+'</a><span aria-hidden="true">/</span><span aria-current="page">'+bi(zh,en)+'</span></nav><a href="'+('index.html' if page=='directory.html' else 'directory.html')+'">'+(bi('返回首页','Back to home') if page=='directory.html' else bi('全站导航','Site directory'))+' →</a></div>'
        d=Spans(text);main=d.find(tag='main');text=text[:main['open_end']]+crumb+text[main['open_end']:]
    text=re.sub(r'assets/(site-design\.css|site\.js|home-experience\.js|v3\.js|site-edition\.js)(?:\?[^"\s]*)?',lambda m:'assets/'+m[1]+'?v='+VERSION,text)
    text=re.sub(r'<script[^>]+src="assets/site-preferences\.js[^\"]*"[^>]*></script>','',text)
    text=text.replace('</title>','</title><script src="assets/site-preferences.js?v='+VERSION+'"></script>',1)
    # Defaults match the Chinese-first entry before saved preferences are applied.
    text=re.sub(r'<html[^>]*>', '<html lang="zh-CN" data-lang="zh" data-theme="light">',text,count=1)
    if page in ['projects.html','about.html']:text=re.sub(r'<script[^>]+src="assets/site-edition\.js[^\"]*"[^>]*></script>','',text)
    return text

def contexts():
    selected=[]
    for folder in ['graduate-research-handbook','industry-insights','industry-insights/research']:
        selected.extend((ROOT/folder).glob('*.html'))
    selected.extend(ROOT/x for x in ['personal-growth-lab/index.html','personal-growth-lab/100-days/index.html','personal-growth-lab/downloads/index.html','personal-growth-lab/academy/index.html','personal-growth-lab/academy/labs.html','personal-growth-lab/academy/journals/index.html','personal-growth-lab/academy/travel-plans/index.html','personal-growth-lab/academy/generalist-lab/index.html','personal-growth-lab/academy/agent-lab/index.html','personal-growth-lab/academy/agent-lab/jupyter/index.html','personal-growth-lab/academy/llm-lab/index.html','personal-growth-lab/academy/ukulele-lab/index.html'])
    import os
    changed=0
    for p in selected:
        if not p.exists():continue
        text=p.read_text();rel=p.relative_to(ROOT).as_posix();prefix=os.path.relpath(ROOT,p.parent).replace(os.sep,'/')+'/'
        if rel.startswith('graduate-research-handbook/'):
            local=[('books.html','著作与教材'),('graduate-research-handbook/','全书目录')]
        elif rel.startswith('industry-insights/'):
            local=[('industry-insights/','行业总览'),('industry-insights/research/','研究文库')]
        else:
            local=[('personal-growth-lab/academy/','成长学院'),('personal-growth-lab/academy/#/projects','全部课程')]
        links=local+[('directory.html','全站导航')]
        context='<div class="site-context"><div><a class="context-brand" href="'+prefix+'index.html">朱宝圆 <small>个人网站</small></a><nav aria-label="返回上级与全站导航">'+''.join('<a href="'+prefix+u+'">'+label+'</a>' for u,label in links)+'</nav></div></div>'
        d=Spans(text);nodes=[n for n in d.nodes if 'site-context' in n['attrs'].get('class','').split()]
        if nodes:text=replace_node(text,nodes[0],context)
        else:
            body=d.find(tag='body');text=text[:body['open_end']]+context+text[body['open_end']:]
        pattern=r'<link[^>]+href="[^\"]*assets/site-context\.css[^\"]*"[^>]*>'
        text=re.sub(pattern,'',text)
        text=text.replace('</head>','<link rel="stylesheet" href="'+prefix+'assets/site-context.css?v='+VERSION+'"></head>',1)
        text=text.replace('>研究与生活</a>','>工具与资料</a>').replace('>全部项目</a>','>全部课程</a>')
        for asset in ['assets/app.js','assets/desk.css','curriculum.js','app.js']:
            if rel=='personal-growth-lab/academy/index.html' and asset in ['assets/app.js','assets/desk.css']:
                text=re.sub(r'(?<=")'+re.escape(asset)+r'\?[^"\s]+',asset+'?v='+VERSION,text)
            if rel=='personal-growth-lab/academy/generalist-lab/index.html' and asset in ['curriculum.js','app.js']:
                text=re.sub(r'(?<=")'+re.escape(asset)+r'\?[^"\s]+',asset+'?v='+VERSION,text)
        if text!=p.read_text():p.write_text(text);changed+=1
    return changed

if __name__=='__main__':
    (ROOT/'directory.html').write_text(make_directory())
    for page in CORE:
        p=ROOT/page;p.write_text(core_shell(page,p.read_text()))
    n=contexts()
    print('Shared navigation synchronized:',len(CORE),'core pages;',n,'reader/course entry pages.')

