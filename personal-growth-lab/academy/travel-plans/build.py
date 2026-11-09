"""Build the multi-page travel journal from researched, reusable content."""
import json, html, re, shutil, zipfile
from pathlib import Path

OUT=Path(__file__).resolve().parent
source=json.loads((OUT/'data.json').read_text())
data=source if isinstance(source,list) else [json.loads((OUT/x['source']).read_text()) for x in source['regions']]
metadata=json.loads((OUT/'images.json').read_text())
photos=metadata['regions']
cityphotos=metadata['cities']
assert len(data)==34 and len(photos)==34
N=sum(len(p['places']) for p in data)
F=sum(len(c['eat']) for p in data for c in p['places'])
S=sum(p.get('inventory',{}).get('count',0) for p in data)
E=lambda x:html.escape(str(x),quote=True)
areas=['华北','东北','华东','华中','华南','西南','西北','港澳台']
byid={p['id']:p for p in data}
OUT.mkdir(parents=True,exist_ok=True)
(OUT/'regions').mkdir(exist_ok=True)
(OUT/'guides').mkdir(exist_ok=True)

def photo(id):
    return photos.get(id,dict(src='assets/huangshan.webp',alt='安徽黄山云海',caption='安徽 · 黄山',author='Carlos Adampol Galindo',license='CC BY-SA 2.0',licenseUrl='https://creativecommons.org/licenses/by-sa/2.0/',sourceUrl='https://commons.wikimedia.org/wiki/File:El_parque_nacional_de_HuangShan._Un_espectacular_paisaje_de_monta%C3%B1as_rocosas_por_encima_de_las_nubes._(15732624395).jpg'))

def image(p,base='',cls='',eager=False,caption=True):
    src=E(base+p['src'])
    return f'<figure class="photograph {cls}"><img src="{src}" alt="{E(p["alt"])}" {"fetchpriority=\"high\"" if eager else "loading=\"lazy\""} decoding="async" width="1400" height="900">'+(f'<figcaption><span>{E(p["caption"])}</span><a href="{E(p["sourceUrl"])}" target="_blank" rel="noopener noreferrer">{E(p["author"])} · {E(p["license"])} ↗</a></figcaption>' if caption else '')+'</figure>'

def head(title,description,base='',canonical=''):
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f7f5f0"><meta name="description" content="{E(description)}"><title>{E(title)}｜未来旅游规划</title><link rel="canonical" href="https://zbyloveyj.github.io/personal-growth-lab/academy/travel-plans/{canonical}"><link rel="stylesheet" href="{base}journal.css?v=4"><link rel="stylesheet" href="{base}enriched.css?v=4"><script defer src="{base}catalog.js?v=4"></script><script defer src="{base}journal.js?v=4"></script><noscript><style>.city-tools,.search-bar,.catalog-toolbar,.save-button,.plan-tools{{display:none!important}}</style></noscript></head>'''

def header(base=''):
    return f'''<a class="skip" href="#main">跳到正文</a><header class="masthead"><div class="mast-inner"><a class="wordmark" href="{base or './'}">未来旅游规划<small>THE PLACES WE WILL GO</small></a><nav aria-label="主导航"><a href="{base}#destinations">目的地</a><a href="{base}scenic.html">景区索引</a><a href="{base}#journeys">旅行灵感</a><a href="{base}#my-plan">我的清单 <span data-plan-count>0</span></a><a href="{base}sources.html">资料与图片</a></nav><a class="back-academy" href="{base}../">成长学院 ↗</a></div></header>'''

def footer(base=''):
    return f'''<footer class="footer"><div class="wrap footer-top"><div><p class="footer-brand">未来旅游规划</p><p>把地名读成故事，把想去变成出发。</p></div><div><a href="{base}#destinations">全国目的地</a><a href="{base}全国旅游攻略.zip" download>下载完整攻略</a><a href="{base}sources.html">参考资料与图片署名</a><a href="{base}../">返回成长学院</a></div></div><div class="wrap footer-bottom"><span>一心问道 · 2026 年 11 月内容版</span><span>行程与时长为规划建议 · 开放与通行请行前核验</span></div></footer><div id="status" class="toast" role="status" aria-live="polite" hidden></div>'''

def source_list(p):
    return '<ul class="source-list">'+''.join(f'<li><a href="{E(s["url"])}" target="_blank" rel="noopener noreferrer">{E(s["label"])} ↗</a></li>' for s in p['sources'])+'</ul>'

# Version 3 uses per-region source files and an uncapped city/inventory renderer.
from guide_renderer import city_body as rich_city, markdown as rich_markdown, search_text as rich_search, inventory_section
city_body=lambda p,c,i:rich_city(p,c,i,image=image,cityphotos=cityphotos)
markdown=rich_markdown
search_text=rich_search

# Small, searchable catalog is shared across pages; detailed prose stays in HTML and JSON.
catalog=[]
for p in data:
    catalog.append({**{k:p[k] for k in ['id','name','region','memory','intro','season','duration']},'places':[{**{k:c.get(k,'') for k in ['name','sights','food','history','theme','days']},'search':search_text(c)} for c in p['places']]})
(OUT/'catalog.js').write_text('window.TRAVEL_CATALOG='+json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+';\n')
# data.json is the source manifest; do not replace it with the expanded runtime content.
# Deprecated data.js is kept in history; new pages use the lightweight catalog.
allmd=f'# 全国未来旅游规划 · 完整指南\n\n34个省级地区，{N}个城市与旅行片区。城市覆盖以目录为准，部分合并相邻城市；不是全部县市乡镇和景点的穷尽清单。\n\n整理日期：2026-11-08。各项停留时间为编辑建议，不是实时开放、交通或通行承诺。\n\n'

for p in data:
    doc=markdown(p)
    (OUT/'guides'/f'{p["id"]}.md').write_text(doc)
    allmd+='\n---\n\n'+doc+'\n'
    toc=''.join(f'<a href="#city-{i}" data-city-link="{i}"><span>{i+1:02d}</span>{E(c["name"])}</a>' for i,c in enumerate(p['places']))
    routes=''.join(f'<article class="route"><div><span class="eyebrow">SUGGESTED JOURNEY / {E(r["days"])}</span><h3>{E(r["title"])}</h3></div><ol>'+''.join(f'<li><span>DAY {i+1:02d}</span><p>{E(re.sub(r"^第[0-9一二三四五六七八九十]+天[：:、，]?", "", step))}</p></li>' for i,step in enumerate(r['steps']))+'</ol></article>' for r in p.get('routes',[dict(title='第一次抵达',days=p['duration'],steps=[p['route']])]))
    nextp=data[(data.index(p)+1)%len(data)]
    directory_label='当地目的地目录' if p['region']=='港澳台' else '4A/5A名录'
    body=f'''<body data-page="region" data-region="{p['id']}" data-base="../">{header('../')}<main id="main"><div class="wrap"><nav class="breadcrumb" aria-label="面包屑"><a href="../#destinations">全国目的地</a><span>/ {p['region']}</span><span>/ {p['name']}</span></nav><div class="region-heading"><div><p class="eyebrow">THE DESTINATION GUIDE / {p['region']}</p><h1>{p['name']}</h1><p class="region-memory">{E(p['memory'])}</p></div><p class="region-deck">{E(p['intro'])}</p></div>{image(photo(p['id']),'../','region-cover',True)}<nav class="chapter-nav" aria-label="本地区章节"><a href="#understand">读懂地方</a><a href="#routes">路线建议</a><a href="#cities">城市详解 <span>{len(p['places'])}</span></a><a href="#rated-directory">{directory_label}</a><a href="#practical">行前准备</a><a href="../guides/{p['id']}.md" download>下载本地攻略 ↓</a></nav><section class="overview section" id="understand"><div class="section-label"><span>01 / UNDERSTAND</span><h2>先读懂，<br>再出发。</h2></div><div><p class="big-copy">{E(p.get('orientation',p['intro']))}</p><div class="memory-note"><h3>这样记，更清楚</h3><p>{E(p.get('reading',p['memory']))}</p></div></div></section><section class="essentials" aria-label="旅行速览"><div><h3>什么时候去</h3><p>{E(p['season'])}</p></div><div><h3>一次留多久</h3><p>{E(p['duration'])}。适合一次主题子线；完整走遍需分次安排。</p></div><div><h3>到达与转场</h3><p>{E(p.get('access',p['note']))}</p></div><div><h3>住宿怎么选</h3><p>{E(p.get('stay',p['note']))}</p></div></section><section class="section routes-section" id="routes"><div class="section-heading"><div><p class="eyebrow">02 / A JOURNEY, NOT A CHECKLIST</p><h2>挑一条线，慢慢走。</h2></div><p>路线为独立主题子线，不建议机械合并。到达日与离开日需按实际交通另留余量。</p></div>{routes}</section><section class="section cities-section" id="cities"><div class="section-heading"><div><p class="eyebrow">03 / THE CITY NOTEBOOK</p><h2>{len(p['places'])}个城市与旅行片区</h2></div><p>每站不限固定景点与食物数量；重要目的地、景区名录、地方饮食及行程分别展开。评级范围与版本逐项说明。</p></div><div class="city-tools"><label for="city-search">在{p['name']}找一座城、一处景点或一道菜<input type="search" id="city-search" placeholder="输入城市、景点、美食关键词" autocomplete="off"></label><button type="button" id="expand-cities">展开全部城市</button></div><p class="small-note" id="city-count" role="status">共 {len(p['places'])} 个城市与片区</p><div class="city-reading"><aside class="city-index"><span class="eyebrow">本地目录</span>{toc}<a class="back-top" href="#main">回到地区开篇 ↑</a></aside><div class="city-articles">{''.join(city_body(p,c,i) for i,c in enumerate(p['places']))}<p class="empty" id="no-cities" hidden>没有匹配的城市或关键词，换一个词再试。</p></div></div></section>{inventory_section(p)}<section class="section region-practical" id="practical"><div class="section-label"><span>04 / BEFORE YOU GO</span><h2>把准备，<br>留在出发前。</h2></div><div><h3>这一地区特别留意</h3><p>{E(p['note'])}</p><p>正文的参观时长不等于开放时段。博物馆预约、山地天气、交通末班和港澳台或边境通行要求，均应以实际出发时间的官方信息确认。</p><div class="region-actions"><a class="button primary" href="../guides/{p['id']}.md" download>保存{p['name']}文字攻略 ↓</a><button type="button" data-print>打印本地区</button><a class="text-link" href="../#my-plan">查看我的想去清单 ↗</a></div><details class="references"><summary>参考资料与官方查询入口</summary>{source_list(p)}<p>链接包含内容参考及行前查询入口，不能将其中任一来源视为全部正文的逐句依据。历史与风味为原创编辑概述，时长和路线为规划建议。</p></details></div></section><a class="next-region" href="{nextp['id']}.html"><span>继续认识一个地方</span><strong>{nextp['name']} ↗</strong><span>{E(nextp['memory'])}</span></a></div></main>{footer('../')}</body></html>'''
    (OUT/'regions'/f'{p["id"]}.html').write_text(head(p['name']+'旅行指南',p['intro'],'../','regions/'+p['id']+'.html')+body)
# The complete prose is downloadable as a compressed archive; regional Markdown remains plain text.
index_md='# 全国旅游攻略 · 文件目录\n\n[下载完整攻略ZIP](全国旅游攻略.zip)\n\n'+''.join(f'- [{p["name"]}](guides/{p["id"]}.md)\n' for p in data)
(OUT/'全国旅游攻略.md').write_text(index_md)
with zipfile.ZipFile(OUT/'全国旅游攻略.zip','w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
    archive.writestr('全国旅游攻略.md',allmd)
    for p in data:archive.writestr('分地区/'+p['name']+'.md',markdown(p))
    if (OUT/'data/coverage.json').exists():archive.write(OUT/'data/coverage.json','名录版本与核验范围.json')


def tile(p):
    return f'''<article class="destination" data-id="{p['id']}" data-area="{p['region']}"><a class="destination-image" href="regions/{p['id']}.html" aria-label="查看{p['name']}旅行指南">{image(photo(p['id']),'','',False,False)}<span class="image-count">{len(p['places'])} 个城市与片区 ↗</span></a><div class="destination-meta"><span>{p['region']}</span><span>{E(p['duration'])}</span></div><h3><a href="regions/{p['id']}.html">{p['name']}<span aria-hidden="true">↗</span></a></h3><p>{E(p['memory'])}</p><div class="match-links" aria-label="匹配的城市"></div></article>'''

trips=[('shanxi','沿着古建，读一遍历史','山西北中线 · 7天','大同 → 太原 → 平遥。先看石窟与辽金建筑，再读晋商古城；把路途与一顿面食留进每天。'),('guangdong','从早茶到一碗潮汕粿条','广东风味线 · 6天','广州与佛山择重点停留，再转潮州、汕头；珠三角与潮汕之间单独留出转场时间。'),('yunnan','把湖光与街巷留给慢旅行','云南滇西线 · 6天','大理 → 丽江。前半程看湖岸与白族聚落，后半程读纳西古城；山地行程按体能与天气增减。')]
triphtml=''.join(f'<article class="journey">{image(next((im for im in cityphotos if im["regionId"]==id and im["placeName"]=="广州"),photo(id)),"","",False,False)}<p class="eyebrow">{E(label)}</p><h3><a href="regions/{id}.html#routes">{E(title)} ↗</a></h3><p>{E(text)}</p></article>' for id,title,label,text in trips)
filterhtml=''.join(f'<button type="button" data-area="{a}" aria-pressed="{str(a=="全部").lower()}">{a}</button>' for a in ['全部']+areas)
cards=''.join(tile(p) for p in data)
home=f'''<body data-page="home" data-base=""><header class="edition-strip"><div class="wrap"><span>一心问道 · 旅行与地方知识</span><span>34 个地区 / {N} 个城市与旅行片区</span></div></header>{header()}<main id="main"><section class="opening wrap"><p class="eyebrow">A PERSONAL ATLAS OF PLACES & STORIES</p><div class="opening-grid"><h1>山河很大，<br><em>一站一站认识。</em></h1><div class="opening-note"><span class="issue">未来旅游规划 / VOL. 03</span><p>从一座城的来处，到巷口的一碗早餐。为每一次将来的出发，认真留下一份关于风景、人和味道的笔记。</p><a class="text-link" href="#destinations">翻开全国目的地目录 ↓</a></div></div>{image(photo('anhui'),'','opening-photo',True)}<div class="opening-foot"><p>先知道是什么、为何去，再安排旅程。</p><p>含台湾、香港、澳门 · 独立地区指南 · 可收藏与下载</p></div><nav class="edition-data" aria-label="本版内容与核验范围"><a href="scenic.html"><strong>{S:,}</strong><span>条景区目录记录 ↗</span></a><a href="#destinations"><strong>{F:,}</strong><span>项地方风味</span></a><a href="sources.html"><strong>{len(photos)+len(cityphotos)}</strong><span>幅署名实景照片 ↗</span></a><a class="edition-source" href="coverage.html">查看各地名录版本<br>与尚待补核范围 ↗</a></nav></section><section class="destinations-section wrap section" id="destinations"><div class="section-heading"><div><p class="eyebrow">01 / FIND YOUR NEXT CHAPTER</p><h2>下一站，从哪里开始？</h2></div><p>34个地区分别成篇。搜城市、一道菜或一个历史线索，直接走进详细攻略。</p></div><div class="search-bar"><label for="search"><span class="search-icon" aria-hidden="true">⌕</span><span class="visually-hidden">搜索全国城市、景点、美食与历史</span><input id="search" type="search" placeholder="试试：亳州 / 双皮奶 / 石窟 / 泉州 / 客家" autocomplete="off"></label><button type="button" id="clear-search">重置</button></div><div class="catalog-toolbar"><div class="area-filters" id="area-filters" aria-label="地理分组">{filterhtml}</div><button id="random-region" class="text-button" type="button">随意翻一站 ↗</button></div><p id="result-count" class="result-count" role="status" aria-live="polite">34 个地区 · {N} 个城市与旅行片区</p><div class="destination-grid">{cards}</div><p class="empty" id="no-results" hidden>没有找到相关结果。可以换一个景点名、美食名，或重置地区筛选。</p></section><section class="journeys-section" id="journeys"><div class="wrap section"><div class="section-heading"><div><p class="eyebrow">02 / TRAVEL BY CURIOSITY</p><h2>先有好奇，再有路线。</h2></div><p>不必一次走遍一个省。选一条主题线，给街巷、展厅和一顿饭各留一点时间。</p></div><div class="journey-grid">{triphtml}</div><div class="travel-principles"><h3>一条好走的路线，先回答这四件事。</h3><ol><li><strong>想认识什么</strong><span>山川、古建、城市生活，先确定这次的重点。</span></li><li><strong>真实有几天</strong><span>扣除往返和转场，每天留一个主要目的地。</span></li><li><strong>住在哪一带</strong><span>围绕游览片区选住宿，让行李少搬几次。</span></li><li><strong>哪些要核验</strong><span>先查开放与预约，再确认天气、交通和证件。</span></li></ol></div></div></section><section class="wrap section plan-section" id="my-plan"><div class="section-heading"><div><p class="eyebrow">03 / MY TRAVEL NOTEBOOK</p><h2>把想去，留在这里。</h2></div><p>在地区攻略中加入城市，再慢慢补上月份、天数和自己的想法。</p></div><div class="plan-summary"><p>想去 <strong id="want-count">0</strong> 站 <span>／</span> 已去 <strong id="visited-count">0</strong> 站</p><a href="全国旅游攻略.zip" download>下载全国完整文字版 ↓</a></div><p class="small-note">个人清单保存在当前浏览器。跨设备使用或清理浏览器前，请导出备份。</p><p id="storage-warning" class="warning" hidden>浏览器暂时无法持久保存，请先导出备份。</p><div class="plan-tools"><label><span class="visually-hidden">筛选清单状态</span><select id="plan-filter"><option value="all">全部状态</option><option value="want">只看想去</option><option value="visited">只看已去</option></select></label><button type="button" id="export-plan">导出备份 JSON</button><button type="button" id="import-plan">导入备份</button><button type="button" id="export-text">下载我的旅行清单</button></div><div id="plan-list"><p class="empty">还没有写下第一站。打开一个地区，在城市详解中点击“加入想去”。</p></div><input id="import-file" type="file" accept="application/json,.json" hidden></section><section class="wrap guide-note"><span class="eyebrow">ABOUT THIS GUIDE</span><div><h2>一本为未来出发准备的手册。</h2><p>这里覆盖34个省级地区，按城市、相邻城市组合与旅行片区组织；不是所有县市乡镇和景点的穷尽清单。每站写明景点看点、地方历史、美食与吃法，并提供时间、住宿和交通的安排思路。具体城市覆盖可在各地区目录中查看。</p><p>内容为原创编辑整理。摄影选用明确许可的公共资源，实景与所在地区逐一对应，作者、许可和原始来源均可查阅。路线与停留时间属于规划建议；出发前请核验官方开放、预约和通行信息。</p><a class="text-link" href="sources.html">查看内容参考与全部图片署名 ↗</a></div></section></main>{footer()}</body></html>'''
(OUT/'index.html').write_text(head('全国旅行指南',f'34个地区、{N}个城市与旅行片区的详细指南，含景点、历史人文、美食、路线、住宿与交通。台湾、香港、澳门独立成篇。')+home)

credits=''
for p in data:
    im=photo(p['id'])
    credits+=f'<article class="credit"><img src="{E(im["src"])}" alt="{E(im["alt"])}" loading="lazy" width="360" height="230"><div><h3>{p["name"]} · {E(im["caption"])}</h3><p>摄影：{E(im["author"])}</p><p>许可：<a href="{E(im["licenseUrl"])}" target="_blank" rel="noopener noreferrer">{E(im["license"])}</a> · <a href="{E(im["sourceUrl"])}" target="_blank" rel="noopener noreferrer">原始文件与许可记录 ↗</a></p><p>本站版本经缩放及WebP编码，展示时可能随版面裁切；原作权利及适用许可不变。</p></div></article>'
for im in cityphotos:
    credits+=f'<article class="credit"><img src="{E(im["src"])}" alt="{E(im["alt"])}" loading="lazy" width="360" height="230"><div><h3>{E(im["placeName"])} · {E(im["caption"])}</h3><p>摄影：{E(im["author"])}</p><p><a href="{E(im["licenseUrl"])}">{E(im["license"])}</a> · <a href="{E(im["sourceUrl"])}">原始文件与许可记录 ↗</a></p><p>缩放、WebP编码及响应式裁切。</p></div></article>'
sourcehtml=f'''<body data-page="sources" data-base="./">{header("./")}<main id="main" class="wrap sources-page"><p class="eyebrow">THE READING ROOM</p><h1>参考资料<br>与摄影署名。</h1><p class="big-copy">旅行线索来自地方历史、文旅资料与博物馆等公开信息；正文以原创中文整理。公开可见不等于可随意转载，摄影仅选取许可明确的文件。</p><h2>怎样使用资料</h2><p>官方入口用于延伸阅读与行前核验，单一来源不作为全部正文的逐句依据。路线、参观时长、住宿片区属于编辑规划建议，未固定门票、班次和通行资格。内容整理于2026年11月8日。</p><p>设计参考 <a href="https://www.cntraveler.com/destinations">Condé Nast Traveler 目的地指南</a>与 <a href="https://www.audleytravel.com/china">Audley Travel 中国旅行页</a>的摄影与编辑组织方式；页面、代码和中文内容独立制作，不复制其摄影或品牌素材。</p><details><summary>展开34地区的内容参考与官方入口</summary>{''.join('<section class="source-region"><h3>'+p['name']+'</h3>'+source_list(p)+'</section>' for p in data)}</details><h2>目的地实景与图片许可</h2><p>以下列出实际使用照片的作者、文件页与许可。CC BY-SA照片的修改版本继续适用原许可，署名与许可随图片保留。网页文本与照片的权利分别说明。</p><div class="credits">{credits}</div></main>{footer("./")}</body></html>'''
(OUT/'sources.html').write_text(head('资料与图片署名','官方资料入口与所有旅行图片的作者、出处和许可记录。')+sourcehtml)
(OUT/'assets/CREDITS.md').write_text('# 摄影署名与许可\n\n本站照片经缩放、WebP编码，版面可能响应式裁切。CC BY-SA 修改版本继续使用原许可。\n\n'+''.join(f'- {x.get("caption","")} — {x["author"]} — [{x["license"]}]({x["licenseUrl"]}) — [原始文件]({x["sourceUrl"]}) — `{x["src"]}`\n' for x in list(photos.values())+cityphotos))
(OUT/'README.md').write_text(f"""# 未来旅游规划 · 第三版

入口：https://zbyloveyj.github.io/personal-growth-lab/academy/travel-plans/

覆盖34个地区、{N}个城市与旅行片区。取消每城3景点/3美食的内容模式；重点目的地与4A/5A景区名录分别纳入，每项解释内容、历史背景、看点或地方饮食文化。等级按所列来源版本记录，公开转录待原件核对者单独标识；不代表实时开放或创建/公示已获评。

## 源文件与生成

`data.json`为版本3源清单，`data/regions/*.json`为地区完整内容，`data/inventory/*.json`为分省景区名录，`data/coverage.json`列各省来源版本、补核范围和缺口。不是把所有名录均冒称为2026-11-08即时现行的全量。

运行`python build.py`生成地区HTML、轻量目录`catalog.js`、各地Markdown及`全国旅游攻略.zip`。仅需Python标准库；`guide_renderer.py`负责详细城市内容。`scenic.html`与`scenic-index.js`用于全部入库景区检索，按省、市、等级筛选；`build_scenic.py`生成索引与版本页。

`全国旅游攻略.md`是各地文字攻略目录；完整正文位于ZIP与`guides/`。{len(photos)}张地区图与{len(cityphotos)}张城市图的作者、许可及来源见`sources.html`和`assets/CREDITS.md`。旧版`data.js/app.js/style.css/editorial.css`不被新页面加载，不应作为当前数据源。

## 个人清单与兼容

继续使用`future-travel-plan-v1`浏览器localStorage。原城市name和索引顺序保持不变，新片区追加；不把个人笔记写回GitHub。支持JSON备份、合并恢复和个人Markdown导出。

## 发布与核验

静态GitHub Pages页面，不需要外部字体、第三方脚本或登录。等级清单按各项原始来源及截止日期记录；正式认定、拟公示、摘牌和降级分别判断。台湾香港澳门不套用大陆A级体系。开放、交通、天气、边境与港澳台通行请行前核验。
""")

print(json.dumps(dict(regions=len(data),cities=N,regional_photos=len(photos),city_photos=len(cityphotos),guide_chars=len(allmd),expanded=sum('orientation' in p for p in data)),ensure_ascii=False))
