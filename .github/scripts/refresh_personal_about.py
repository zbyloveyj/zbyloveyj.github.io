"""Build the personal introduction from the existing site shell; retain all book/research data."""
from pathlib import Path
import copy
import json
import re
import sys
from bs4 import BeautifulSoup

ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[2]
VERSION = '20261019-bio1'
def bi(zh, en):
    return f'<span class="zh-only">{zh}</span><span class="en-only">{en}</span>'
def fragment(text):
    return BeautifulSoup(text, 'html.parser')
def put_css(page):
    if not page.select_one('link[href^="assets/about-page.css"]'):
        page.head.append(page.new_tag('link', rel='stylesheet', href=f'assets/about-page.css?v={VERSION}'))

def identity_card(compact=False):
    return f'''<aside class="personal-card" aria-label="{ '个人名片' }">
    <div class="personal-card-top"><span>BAOYUAN ZHU</span><span aria-hidden="true">01 / BIO</span></div>
    <div class="personal-monogram" aria-hidden="true">B<span>·</span>Z</div>
    <div class="personal-card-name">{bi('朱宝圆','Baoyuan Zhu')}<small>{bi('一心问道 · 写作笔名','一心问道 · Writing name')}</small></div>
    <dl class="personal-facts"><div><dt>{bi('现在','Present')}</dt><dd>{bi('华南理工大学 · 博士在读','PhD candidate<br>South China University of Technology')}</dd></div>
    <div><dt>{bi('研究','Research')}</dt><dd>{bi('智能生物解析','Computational biology &amp; AI')}</dd></div>
    <div><dt>{bi('写作','Writing')}</dt><dd>{bi('科学历史小说 · 开放教材','Science-history novels &amp; open education')}</dd></div></dl>
    <a class="personal-card-link" href="https://orcid.org/0009-0006-6213-214X" rel="noopener noreferrer" target="_blank">{bi('查看学术记录','Academic record')} <span>ORCID ↗</span></a>
    </aside>'''

teaser = f'''<section class="personal-teaser" id="about" aria-labelledby="about-title"><div class="container personal-teaser-grid">
    <div><p class="personal-label">ABOUT / {bi('认识我','A LITTLE ABOUT ME')}</p><h2 id="about-title">{bi('在研究中追问，<br><em>在写作中理解。</em>','Questions in research.<br><em>Perspective in writing.</em>')}</h2>
    <p class="personal-teaser-lead">{bi('我是朱宝圆，华南理工大学博士在读。我关注微生物生态、脑肠关联与智能生物解析，也以「一心问道」写作科学历史小说和开放教材。','I’m Baoyuan Zhu, a PhD candidate at South China University of Technology. I study microbial ecology and brain–gut associations, and write science-history novels and educational books as 一心问道.')}</p>
    <a class="personal-link" href="about.html">{bi('阅读完整个人介绍','Meet the researcher &amp; writer')} <span aria-hidden="true">↗</span></a></div>
    <div class="personal-teaser-notes"><div><span>01 / RESEARCH</span><h3>{bi('把问题变成研究','From questions to research')}</h3><p>{bi('从微生物群落到脑功能，寻找能被数据检验、也能被解释的联系。','Connecting microbial communities and brain function through interpretable, testable research.')}</p></div>
    <div><span>02 / WRITING</span><h3>{bi('把科学写进生活','Science, in everyday life')}</h3><p>{bi('四本作品，记录科学发现背后的人，也整理做研究的经验。','Four books about the people behind discoveries and the practice of doing research.')}</p></div></div>
    </div></section>'''

research_items = [
    ('01','微生物生态','Microbial ecology','从单个微生物走向群落，理解人群与疾病之间的生态差异。','Looking beyond individual microbes to community patterns across people and diseases.'),
    ('02','脑肠关联','Brain–gut associations','连接微生物组、临床认知与脑影像，研究精神疾病中的个体差异。','Relating microbiome profiles, cognition and neuroimaging to individual variation in psychiatric disorders.'),
    ('03','遗传与功能','Genetics & function','关注微生物遗传变异、水平基因转移，以及它们对应的功能变化。','Studying microbial genetic variation, horizontal gene transfer and their functional implications.'),
    ('04','计算与方法','Computation & methods','用多模态整合、可解释学习和规范建模，让复杂数据更容易被理解。','Making sense of complex data through multimodal integration, interpretable learning and normative modeling.')
]
research_cards = ''.join(f'<article><span class="personal-topic-no">{n}</span><h3>{bi(z,e)}</h3><p>{bi(zp,ep)}</p></article>' for n,z,e,zp,ep in research_items)
book_items = [
    ('microbes.svg','看不见的文明','The Invisible Civilization','科学历史小说','Science-history novel','https://zbyloveyj.github.io/invisible-civilization/'),
    ('brain.webp','在我们理解大脑之前','Before We Understood the Brain','神经科学小说','Neuroscience novel','https://zbyloveyj.github.io/brain-novel/'),
    ('agent.svg','BioAgentLab','BioAgentLab','生物学智能体教材','AI-agent textbook','https://github.com/zbyloveyj/BioAgentLab'),
    ('handbook.svg','从读研到做研究','From Graduate Study to Research','科研实践指南','Research field guide','https://zbyloveyj.github.io/graduate-research-handbook/')
]
books = ''.join(f'<a class="personal-book" href="{url}"><img src="assets/books/{img}" width="84" height="126" loading="lazy" decoding="async" alt="《{zh}》"><div><span>{bi(kind,ke)}</span><h3>{bi(zh,en)}</h3></div><b aria-hidden="true">↗</b></a>' for img,zh,en,kind,ke,url in book_items)
main_html = f'''
<section class="personal-hero" aria-labelledby="personal-title"><div class="container personal-hero-grid">
<div class="personal-hero-copy"><p class="personal-label">ABOUT / {bi('个人介绍','A PERSONAL INTRODUCTION')}</p>
<h1 id="personal-title">{bi('你好，我是<br><em>朱宝圆。</em>','Hello,<br><em>I’m Baoyuan.</em>')}</h1>
<p class="personal-name-line">{bi('Baoyuan Zhu <span aria-hidden="true">/</span> 一心问道','朱宝圆 <span aria-hidden="true">/</span> Writing as 一心问道')}</p>
<p class="personal-intro">{bi('在华南理工大学读博，研究微生物与人类健康之间的联系。做研究时，我用数据追问；写作时，我试着走近科学背后的人。','I’m a PhD candidate at South China University of Technology, studying the connections between microbial ecosystems and human health. In research, I work with data. In writing, I look for the people behind the science.')}</p>
<ul class="personal-tags" aria-label="研究关键词"><li>{bi('微生物生态','Microbial ecology')}</li><li>{bi('脑肠关联','Brain–gut associations')}</li><li>{bi('智能生物解析','AI for biology')}</li></ul>
<div class="personal-actions"><a class="personal-button" href="research.html">{bi('了解我的研究','Explore my research')} <span aria-hidden="true">↗</span></a><a class="personal-link" href="#personal-contact">{bi('联系交流','Get in touch')} <span aria-hidden="true">↓</span></a></div>
</div>{identity_card()}</div>
<div class="container"><nav class="personal-section-nav" aria-label="个人介绍页导航"><a href="#personal-story">{bi('认识我','My perspective')}</a><a href="#personal-research">{bi('我关注的问题','Research interests')}</a><a href="#personal-writing">{bi('写作与生活','Writing &amp; life')}</a><a href="#personal-contact">{bi('联系交流','Contact')}</a><span aria-hidden="true">RESEARCH · CODE · WRITING</span></nav></div></section>

<section class="personal-section" id="personal-story" aria-labelledby="personal-story-title"><div class="container personal-story-grid"><div><p class="personal-label">01 / PERSPECTIVE</p><h2 id="personal-story-title">{bi('从微小的生命，<br>理解更大的世界。','Small organisms.<br>A larger perspective.')}</h2></div>
<div class="personal-prose"><p>{bi('我的研究处在微生物生态、脑科学与计算生物学的交叉处。我关注的不只是某种微生物增加或减少，更想知道：群落结构如何变化，这些变化与人的临床表现、认知和脑功能有什么联系。','My work sits at the intersection of microbial ecology, brain science and computational biology. Beyond whether a particular microbe increases or decreases, I ask how communities change and how those changes relate to clinical traits, cognition and brain function.')}</p>
<p>{bi('为此，我将宏基因组、多组学和脑影像放在一起分析，也关注方法的可解释性与跨队列可重复性。一个有吸引力的结果，还需要经得起不同数据、不同分析条件的检验。','I bring metagenomics, multi-omics and neuroimaging into a shared analysis, with an emphasis on interpretability and reproducibility across cohorts. A compelling result still needs to hold up under different data and analytical choices.')}</p>
<div class="personal-principles"><div><strong>{bi('从问题出发','Question first')}</strong><span>{bi('先想清楚要回答什么。','Be clear about what the study asks.')}</span></div><div><strong>{bi('让证据说话','Evidence matters')}</strong><span>{bi('区分观察、解释与推测。','Distinguish observation from interpretation.')}</span></div><div><strong>{bi('把方法讲清楚','Make it reproducible')}</strong><span>{bi('让分析能够被理解与复查。','Make analysis understandable and checkable.')}</span></div></div></div></div></section>

<section class="personal-section personal-research-section" id="personal-research" aria-labelledby="personal-research-title"><div class="container"><div class="personal-section-heading"><div><p class="personal-label">02 / RESEARCH INTERESTS</p><h2 id="personal-research-title">{bi('几个持续追问的问题。','Questions I keep returning to.')}</h2></div><a class="personal-link" href="research.html">{bi('研究详情','Research in detail')} ↗</a></div><div class="personal-topics">{research_cards}</div><div class="personal-research-links"><a href="publications.html">{bi('代表论文','Selected publications')} ↗</a><a href="projects.html">{bi('开源项目','Open-source projects')} ↗</a><a href="cv.html">{bi('学术简历','Academic CV')} ↗</a></div></div></section>

<section class="personal-section personal-writing-section" id="personal-writing" aria-labelledby="personal-writing-title"><div class="container personal-writing-grid"><div class="personal-writing-copy"><p class="personal-label">03 / WRITING &amp; LIFE</p><h2 id="personal-writing-title">{bi('写科学，<br><em>也写科学里的人。</em>','Writing science.<br><em>Remembering its people.</em>')}</h2><p>{bi('我以「一心问道」为笔名写作。小说让我走近发现发生时的普通人；教材和手册，则把复杂知识与科研经验整理成可以分享的内容。','I write as 一心问道. Fiction lets me explore ordinary lives at the moment of discovery; textbooks and guides turn complex knowledge and research experience into something that can be shared.')}</p><a class="personal-link" href="books.html">{bi('浏览四本著作','Explore all four books')} ↗</a>
<div class="personal-life-note"><span>{bi('科研之外','Beyond the lab')}</span><p>{bi('喜欢科学史、写作与知识分享，也珍惜与对象一起的日常生活。认真做研究，也认真生活。','I enjoy science history, writing and sharing knowledge. I’m happily in a relationship and value our everyday life together, beyond the lab.')}</p></div></div><div class="personal-books" aria-label="四本作品">{books}</div></div></section>

<section class="personal-contact-section" id="personal-contact" aria-labelledby="personal-contact-title"><div class="container personal-contact-grid"><div><p class="personal-label">04 / GET IN TOUCH</p><h2 id="personal-contact-title">{bi('交流，从一个<br>好问题开始。','A conversation starts<br>with a good question.')}</h2><p>{bi('欢迎就微生物生态、脑肠关联、生物信息学方法与科学写作交流。','I welcome conversations about microbial ecology, brain–gut research, bioinformatics methods and science writing.')}</p></div><div class="personal-contact-card"><a class="personal-contact-email" href="mailto:18851970329@163.com"><span><small>{bi('学术交流与合作','Academic inquiries')}</small><strong>{bi('给我写封邮件','Write me an email')}</strong></span><span aria-hidden="true">↗</span></a><div class="personal-contact-social"><a href="https://orcid.org/0009-0006-6213-214X" rel="noopener noreferrer" target="_blank">ORCID ↗</a><a href="https://github.com/zbyloveyj" rel="noopener noreferrer" target="_blank">GitHub ↗</a><button type="button" data-copy-contact="18851970329@163.com">{bi('复制邮箱','Copy email')}</button></div><p class="personal-copy-status" role="status" aria-live="polite"></p></div></div></section>
'''

# Build a real native page from the same header/footer as the current books page.
page = BeautifulSoup((ROOT/'books.html').read_text(encoding='utf-8'), 'html.parser')
page.body['class'] = ['inner-page','page-about']
page.title.string = '关于我 · 朱宝圆 / 一心问道'
page.html['lang'] = 'zh-CN'
page.html['data-lang'] = 'zh'
for tag in page.select('script[type="application/ld+json"]'):
    try:
        if json.loads(tag.string or '{}').get('@type') == 'ItemList': tag.decompose()
    except ValueError: pass
for tag in page.select('link[href^="assets/site-edition.css"],script[src^="assets/site-edition.js"]'): tag.decompose()
put_css(page)
page.head.append(page.new_tag('script', attrs={'src': f'assets/about-page.js?v={VERSION}', 'defer': ''}))
desc = '朱宝圆，华南理工大学博士在读，研究微生物生态、脑肠关联与智能生物解析；以一心问道写作科学历史小说和开放教材。'
for selector,text in [('meta[name=description]',desc),('meta[property="og:description"]',desc),('meta[property="og:title"]','关于我 · 朱宝圆 / 一心问道'),('meta[property="og:url"]','https://zbyloveyj.github.io/about.html')]:
    page.select_one(selector)['content'] = text
page.select_one('link[rel=canonical]')['href'] = 'https://zbyloveyj.github.io/about.html'
main = page.select_one('#main');main.clear();main.append(fragment(main_html))
(ROOT/'about.html').write_text(str(page), encoding='utf-8')
# The homepage gets a concise introduction, not a second full biography.
home = BeautifulSoup((ROOT/'index.html').read_text(encoding='utf-8'), 'html.parser')
assert home.select_one('#about'), 'Expected homepage about section not found'
home.select_one('#about').replace_with(fragment(teaser))
put_css(home)
(ROOT/'index.html').write_text(str(home), encoding='utf-8')
# Keep static navigation and the no-JavaScript version consistent across all existing root pages.
for path in ROOT.glob('*.html'):
    text=path.read_text(encoding='utf-8')
    if 'id="main-nav"' not in text: continue
    p=BeautifulSoup(text,'html.parser')
    for a in p.select('#main-nav a'):
        if a.get('href') in ('index.html#about','#about'): a['href']='about.html'
        if path.name=='about.html':
            a.attrs.pop('aria-current',None)
            a.attrs.pop('class',None)
            if a.get('href')=='about.html': a['class']=['active'];a['aria-current']='page'
    for script in p.select('script[src^="assets/site.js"],script[src^="assets/v3.js"]'):
        script['src']=script['src'].split('?')[0]+f'?v={VERSION}'
    path.write_text(str(p),encoding='utf-8')
# Add page identity without changing publication behavior.
v3=ROOT/'assets/v3.js';js=v3.read_text(encoding='utf-8')
js=js.replace('page-(research|publications|projects)', 'page-(about|research|publications|projects)')
if "'about':{" not in js:
    js=js.replace('const labels={',"const labels={\n 'about':{en:'About | Baoyuan Zhu',zh:'关于我 · 朱宝圆 / 一心问道',href:'about.html'},")
v3.write_text(js,encoding='utf-8')
sj=ROOT/'assets/site.js';js=sj.read_text(encoding='utf-8')
if "a.getAttribute('href')==='about.html'" not in js:
    js=js.replace("a.hash==='#'+visible.target.id", "(a.hash==='#'+visible.target.id || (a.getAttribute('href')==='about.html' && visible.target.id==='about'))")
sj.write_text(js,encoding='utf-8')
sitemap=ROOT/'sitemap.xml'
if 'https://zbyloveyj.github.io/about.html' not in sitemap.read_text(encoding='utf-8'):
    sitemap.write_text(sitemap.read_text(encoding='utf-8').replace('</urlset>', '  <url><loc>https://zbyloveyj.github.io/about.html</loc></url>\n</urlset>'),encoding='utf-8')
# Publication and book records must remain present and private facts must not be introduced.
for file in ['about.html','index.html']:
    p=BeautifulSoup((ROOT/file).read_text(),'html.parser')
    ids=[x['id'] for x in p.select('[id]')]
    assert len(ids)==len(set(ids)),f'Duplicate ids in {file}'
    for a in p.select('a[href^="#"]'):
        target=a['href'][1:]
        assert not target or p.find(id=target),f'Broken anchor: {file} {target}'
    assert '生日' not in p.get_text()
assert len(BeautifulSoup((ROOT/'index.html').read_text(),'html.parser').select('.edition-book'))==4
assert len(BeautifulSoup((ROOT/'about.html').read_text(),'html.parser').select('.personal-book'))==4
assert (ROOT/'assets/about-page.css').is_file() and (ROOT/'assets/about-page.js').is_file()
print('Personal introduction page, homepage preview and navigation built and validated.')
