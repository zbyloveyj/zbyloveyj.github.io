from pathlib import Path
from bs4 import BeautifulSoup
import copy,json,re
from urllib.request import Request, urlopen
ROOT=Path(__file__).resolve().parents[2]
asset_dir=ROOT/'assets/books'
asset_dir.mkdir(parents=True,exist_ok=True)
assets={
 'microbes.svg':'https://raw.githubusercontent.com/zbyloveyj/zbyloveyj/d19e79ab72403a407411012020b4db54c11540d8/assets/catalog-microbes.svg',
 'agent.svg':'https://raw.githubusercontent.com/zbyloveyj/zbyloveyj/d19e79ab72403a407411012020b4db54c11540d8/assets/catalog-agent.svg',
 'handbook.svg':'https://raw.githubusercontent.com/zbyloveyj/zbyloveyj/d19e79ab72403a407411012020b4db54c11540d8/assets/catalog-handbook.svg',
 'brain.webp':'https://raw.githubusercontent.com/zbyloveyj/brain-novel/578bf8b86cdf0b5f066f76214a4ad2534446e89f/docs/assets/cover.webp',
}
for name,url in assets.items():
 with urlopen(Request(url,headers={'User-Agent':'AcademicWebsiteAssetSync'}),timeout=40) as response:
  content=response.read()
  assert content and len(content)<5000000,name
  if name.endswith('.webp'): assert content[:4]==b'RIFF',name
  else: assert b'<svg' in content,name
  (asset_dir/name).write_bytes(content)
VERSION='20261019'
def bi(zh,en): return f'<span class="zh-only">{zh}</span><span class="en-only">{en}</span>'
def fragment(s): return BeautifulSoup(s,'html.parser')
books=[dict(id='microbes',type='novel',n='01',zh='看不见的文明',en='The Invisible Civilization',kindzh='科学历史小说',kinden='Science-history novel',subzh='微生物与人类的三百年',suben='Microorganisms and three centuries of humanity',metazh='六卷 · 48章',metaen='6 volumes · 48 chapters',desczh='从显微镜下的霉菌，到城市、病房与实验室。书写微生物科学史，也书写普通人的生活。',descen='Three centuries of microbiology through ordinary lives, from early microscopy to cities, hospitals and laboratories.',url='https://zbyloveyj.github.io/invisible-civilization/',img='assets/books/microbes.svg',extra=[('全书目录','Contents','https://zbyloveyj.github.io/invisible-civilization/contents.html')]),
 dict(id='brain',type='novel',n='02',zh='在我们理解大脑之前',en='Before We Understood the Brain',kindzh='神经科学小说',kinden='Neuroscience novel',subzh='一个博士生，走进百年神经科学的现场',suben='A journey through the history of neuroscience',metazh='六部 · 24章 · 81幅插图',metaen='6 parts · 24 chapters · 81 illustrations',desczh='沿着神经科学的重要发现，走近实验台旁的人，也重新理解科研道路上的成长、选择与牵挂。',descen='A doctoral student meets the people behind a century of discoveries, and reconsiders research, choices and everyday life.',url='https://zbyloveyj.github.io/brain-novel/',img='assets/books/brain.webp',extra=[('图文 PDF','Illustrated PDF','https://zbyloveyj.github.io/brain-novel/downloads/brain-novel-complete.pdf')]),
 dict(id='agent',type='learning',n='03',zh='BioAgentLab',en='BioAgentLab',kindzh='生物学智能体教材',kinden='AI for biology',subzh='面向生物学发现的证据型 AI Agent',suben='Evidence-grounded agents for biological discovery',metazh='开放教材 · 可复现代码',metaen='Open textbook · Reproducible code',desczh='从提出问题到检验证据，讨论科研智能体、假设评价与可复现的生物学计算实践。',descen='Evidence-grounded agents, hypothesis evaluation and reproducible computational practice for biological discovery.',url='https://github.com/zbyloveyj/BioAgentLab',img='assets/books/agent.svg',extra=[('代码示例','Examples','https://github.com/zbyloveyj/BioAgentLab/tree/main/examples')]),
 dict(id='handbook',type='learning',n='04',zh='从读研到做研究',en='From Graduate Study to Research',kindzh='科研成长指南',kinden='Research field guide',subzh='研究生学术入门与科研实践',suben='A practical handbook for graduate research',metazh='九编 · 50章 · 完整书稿',metaen='9 parts · 50 chapters · Complete manuscript',desczh='从读研选择、文献阅读与研究设计，到数据分析、论文写作和职业发展。把科研判断落实到日常实践。',descen='From graduate study and literature reading to research design, data analysis, academic writing and professional development.',url='https://zbyloveyj.github.io/graduate-research-handbook/',img='assets/books/handbook.svg',extra=[('全书 PDF','Complete PDF','https://zbyloveyj.github.io/graduate-research-handbook/downloads/complete-book.pdf'),('Word 书稿','Word manuscript','https://zbyloveyj.github.io/graduate-research-handbook/downloads/complete-book.docx')])]

def card(b, detailed=False):
 title=bi(b['zh'],b['en'])
 extras=''.join(f'<a href="{u}">{bi(z,e)}</a>' for z,e,u in (b['extra'] if detailed else b['extra'][:1]))
 alt=b['zh']+('，书站正式封面' if b['id']=='brain' else '，书目展示图')
 return f'''<article class="edition-book edition-book--{b['id']}" data-book-kind="{b['type']}" id="book-{b['id']}">
 <a class="edition-cover" href="{b['url']}" aria-label="阅读《{b['zh']}》"><span class="cover-fallback" aria-hidden="true">{b['zh']}<small>一心问道 著</small></span><img src="{b['img']}" alt="{alt}" width="420" height="630" loading="lazy" decoding="async"></a>
 <div class="edition-book-copy"><p class="edition-book-kicker"><span>{b['n']}</span>{bi(b['kindzh'],b['kinden'])}</p>
 <h3>{title}</h3><p class="edition-book-subtitle">{bi(b['subzh'],b['suben'])}</p>
 <p class="edition-book-desc">{bi(b['desczh'],b['descen'])}</p><p class="edition-book-meta">{bi(b['metazh'],b['metaen'])}</p>
 <div class="edition-book-links"><a class="edition-book-primary" href="{b['url']}">{bi('教材与代码' if b['id']=='agent' else '在线阅读','Textbook &amp; code' if b['id']=='agent' else 'Read online')} <span aria-hidden="true">↗</span></a>{extras}</div></div></article>'''

def shelf(detailed=False): return '<div class="edition-books-grid">'+''.join(card(b,detailed) for b in books)+'</div>'
credit=bi('《在我们理解大脑之前》沿用书站封面；其余为书目展示图。文学与教学作品独立于同行评议论文。','The neuroscience novel uses its website cover; other thumbnails are catalog designs. Creative and educational work is separate from peer-reviewed publications.')
navitems=[('index.html#about','关于','About'),('research.html','研究','Research'),('publications.html','论文','Publications'),('books.html','著作','Books'),('projects.html','开源','Open Science'),('cv.html','简历','CV')]
nav=''.join(f'<a href="{u}">{bi(z,e)}</a>' for u,z,e in navitems)

def common(s):
 s.html['data-lang']='zh';s.html['lang']='zh-CN'
 for l in s.select('link[href="assets/books-2026.css"]'):l.decompose()
 if not s.select_one('link[href^="assets/site-edition.css"]'):
  s.head.append(s.new_tag('link',rel='stylesheet',href='assets/site-edition.css?v='+VERSION))
 for x in s.select('script[src="assets/site.js"]'):x['src']='assets/site.js?v='+VERSION
 if not s.select_one('script[src^="assets/site-edition.js"]'):
  s.head.append(s.new_tag('script',attrs={'src':'assets/site-edition.js?v='+VERSION,'defer':''}))
 n=s.select_one('#main-nav');n.clear();n.append(fragment(nav))
 for x in s.select('svg[viewbox]'): x['viewBox']=x['viewbox'];del x['viewbox']

s=BeautifulSoup((ROOT/'index.html').read_text(),'html.parser'); common(s);s.body['class']=['home-edition']
s.select_one('#books').decompose()
booksection=fragment(f'''<section class="section edition-books-section" id="books" aria-labelledby="books-title"><div class="container"><div class="edition-section-head"><div><p class="section-index">01 / BOOKS &amp; WRITING</p><h2 class="section-title" id="books-title">{bi('在研究之外，<em>把科学写进书里。</em>','Beyond research,<br><em>science in stories.</em>')}</h2></div><div class="edition-section-aside"><p>{bi('一心问道 著 · 四本作品','Four books by 一心问道')}<br>{bi('两部科学历史小说，一部智能体教材，一本科研实践指南。','Two science-history novels, an AI-agent textbook and a research field guide.')}</p><a href="books.html">{bi('进入全部著作','Explore all books')} <span aria-hidden="true">↗</span></a></div></div>{shelf()}<p class="edition-book-credit">{credit}</p></div></section>''')
s.select_one('.metrics-section').insert_after(booksection)
for x in s.select('.section-index'):
 if not x.find_parent(id='books'): x.string=re.sub(r'^\d{2}\s*/\s*','',x.get_text())
action=s.select_one('.hero-actions')
if not action.select_one('.hero-book-link'): action.append(fragment(f'<a class="button button-text hero-book-link" href="#books">{bi("四本著作","Four books")} <span aria-hidden="true">↓</span></a>'))
old=s.select_one('#beyond');old.replace_with(fragment(f'''<section class="edition-life" id="beyond" aria-labelledby="beyond-title"><div class="container"><p class="section-index">BEYOND THE LAB</p><h2 id="beyond-title">{bi('认真做研究，也认真生活。','Curiosity, beyond the lab.')}</h2><p>{bi('我喜欢科学史、写作和知识分享，也珍惜与对象一起的日常生活。把复杂的问题讲清楚，是科研之外同样重要的事。','I enjoy science history, writing and sharing knowledge. I am happily in a relationship and value our everyday life together, beyond the lab.')}</p></div></section>'''))
if not s.select_one('meta[name=site-edition]'): s.head.append(s.new_tag('meta',attrs={'name':'site-edition','content':VERSION+'-four-books'}))
(ROOT/'index.html').write_text(str(s))

p=BeautifulSoup((ROOT/'projects.html').read_text().replace('<a <a ','<a '),'html.parser');common(p)
x=p.select_one('.writing-project-section'); x.clear(); x.append(fragment(f'''<div class="container"><div class="edition-section-head"><div><p class="section-index">BOOKS &amp; OPEN LEARNING</p><h2 class="section-title">{bi('四本书，四种探索。','Four books. Four perspectives.')}</h2></div><a class="edition-text-link" href="books.html">{bi('全部著作与下载','Books &amp; downloads')} ↗</a></div><div class="edition-book-index">'''+''.join(f'<a href="books.html#book-{b["id"]}"><span>{b["n"]}</span><div><h3>{bi(b["zh"],b["en"])}</h3><p>{bi(b["metazh"],b["metaen"])}</p></div><b aria-hidden="true">↗</b></a>' for b in books)+'</div></div>'))
(ROOT/'projects.html').write_text(str(p))

b=copy.deepcopy(p);b.body['class']=['inner-page','page-books'];b.title.string='著作与写作 · 一心问道 | 朱宝圆'
for selector,value in [('meta[name=description]','一心问道的四本作品：看不见的文明、在我们理解大脑之前、BioAgentLab、从读研到做研究。在线阅读、全书目录与电子书入口。'),('meta[property="og:title"]','著作与写作 · 一心问道'),('meta[property="og:url"]','https://zbyloveyj.github.io/books.html')]:
 b.select_one(selector)['content']=value
b.select_one('meta[property="og:description"]')['content']=b.select_one('meta[name=description]')['content']
b.select_one('link[rel=canonical]')['href']='https://zbyloveyj.github.io/books.html'
main=b.select_one('#main');main.clear()
main.append(fragment(f'''<section class="edition-library-hero"><div class="container"><p class="section-index">一心问道 / BOOKS &amp; WRITING</p><h1>{bi('把科学写进故事，<br><em>把经验留给后来的人。</em>','Science in stories.<br><em>Experience, shared.</em>')}</h1><p>{bi('两部科学历史小说，一部生物学智能体教材，一本科研实践指南。<br>四本中文作品，四条走近科学的路径。','Two science-history novels, an AI-agent textbook and a practical research handbook.<br>Four Chinese-language books, four ways into science.')}</p><div class="edition-library-meta"><span>{bi('一心问道 著','Written by 一心问道')}</span><span>{bi('在线阅读与学习','Read &amp; learn online')}</span></div></div></section>
<section class="edition-library-content" aria-label="四本著作"><div class="container"><div class="edition-book-filters" role="group" aria-label="筛选作品" hidden><button type="button" data-book-filter="all" aria-pressed="true">{bi('全部作品','All books')}</button><button type="button" data-book-filter="novel" aria-pressed="false">{bi('科学历史小说','Science-history novels')}</button><button type="button" data-book-filter="learning" aria-pressed="false">{bi('教材与指南','Textbooks &amp; guides')}</button><p class="edition-filter-count" role="status" aria-live="polite">{bi('共4本','4 books')}</p></div>{shelf(True)}<p class="edition-book-credit">{credit}</p></div></section>
<section class="edition-reading-note"><div class="container"><h2>{bi('翻开之前','Before you begin')}</h2><div><p>{bi('小说中的历史事实、虚构情节与图版来源，请参照各书的章节说明。教材用于学习与研究训练，模拟案例不代表真实科学发现。','See each book for historical sources, fictional elements and illustration credits. Textbooks support learning and research practice; simulated examples are not empirical findings.')}</p><p>{bi('《从读研到做研究》为作者校订的完整教学书稿，尚未经过出版社正式出版终审。公开阅读不等于作品进入公共领域，转载与使用请遵守各书的版权说明。','From Graduate Study to Research is a complete author-revised teaching manuscript, not a publisher-finalized edition. Open reading does not place these works in the public domain; please respect each book’s rights notice.')}</p><a class="edition-text-link" href="index.html">{bi('返回学术主页','Back to academic homepage')} ↗</a></div></div></section>'''))
meta={'@context':'https://schema.org','@type':'ItemList','name':'一心问道 · 著作与写作','numberOfItems':4,'itemListElement':[{'@type':'ListItem','position':int(x['n']),'item':{'@type':'Book','name':x['zh'],'url':x['url'],'inLanguage':'zh-CN','author':{'@type':'Person','name':'一心问道'}}}for x in books]}
j=b.new_tag('script',type='application/ld+json');j.string=json.dumps(meta,ensure_ascii=False);b.head.append(j)
(ROOT/'books.html').write_text(str(b))

p=ROOT/'assets/site.js';js=p.read_text();js=js.replace("let lang = safeGet('academic-site:lang') === 'zh' ? 'zh' : 'en';","let lang = safeGet('academic-site:lang') === 'en' ? 'en' : 'zh';")
js=js.replace("lang === 'en' ? '中' : 'EN'","lang === 'en' ? 'EN' : '中文'")
js=js.replace("b.querySelector('.language-other').textContent = lang === 'en' ? 'EN' : '中文';","b.querySelector('.language-other').textContent = lang === 'en' ? '中文' : 'EN';")
js=js.replace("if('IntersectionObserver' in window){","if('IntersectionObserver' in window && !document.body.classList.contains('inner-page')){")
if "['index.html#beyond','index.html#books']" not in js: js=js.replace("  const data = window.ACADEMIC_DATA", "  qsa('#main-nav a').forEach(a => { if(['index.html#beyond','index.html#books'].includes(a.getAttribute('href'))){ a.setAttribute('href','books.html'); a.innerHTML=bi('Books','著作'); } });\n  const data = window.ACADEMIC_DATA")
p.write_text(js)
p=ROOT/'sitemap.xml'
if 'https://zbyloveyj.github.io/books.html' not in p.read_text(): p.write_text(p.read_text().replace('</urlset>','  <url><loc>https://zbyloveyj.github.io/books.html</loc></url>\n</urlset>'))
shared_css=ROOT/'assets/editorial-v4.css'
if 'Shared narrow-screen fixes, 2026-10-19' not in shared_css.read_text():
 shared_css.write_text(shared_css.read_text()+'''
/* Shared narrow-screen fixes, 2026-10-19. No clipped navigation or diagrams. */
@media(max-width:390px){
 .site-header .nav-shell{gap:6px}
 .brand{gap:7px}.brand-text{letter-spacing:.07em}.brand-text small{display:none}
 .nav-actions{gap:0;flex-shrink:0}.nav-actions button{padding-inline:6px;min-width:36px}
 .nav-actions .language-switch{font-size:10px;gap:4px}
 .bighi-diagram{max-width:100%;gap:5px}
 .bighi-diagram div{width:clamp(57px,18vw,70px);height:clamp(57px,18vw,70px);flex-shrink:0;font-size:8px}
 .bighi-diagram>span{width:7px;flex-shrink:0}
}
@media(max-width:350px){.site-header .brand-mark{display:none}}
@media(max-width:680px){
 .journey-grid{grid-template-columns:minmax(0,1fr)}
 .journey-grid>div,.timeline article>div,.honor p{min-width:0}
 .timeline article{grid-template-columns:90px minmax(0,1fr);gap:14px}
 .timeline h3,.cv-actions a{overflow-wrap:anywhere}
 .cv-actions{flex-wrap:wrap}
}
''')
for name in ['index.html','books.html']:
 page=BeautifulSoup((ROOT/name).read_text(),'html.parser')
 assert len(page.select('.edition-book')) == 4, name
 assert '九编' in page.select_one('#book-handbook').get_text(), name
 ids=[x['id'] for x in page.select('[id]')]
 assert len(ids)==len(set(ids)),name
assert '<a <a' not in (ROOT/'projects.html').read_text()
assert len(BeautifulSoup((ROOT/'projects.html').read_text(),'html.parser').select('.edition-book-index>a')) == 4
print('Four-book academic website generated and validated.')
