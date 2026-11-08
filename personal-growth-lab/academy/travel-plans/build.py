"""Build the multi-page travel journal from researched, reusable content."""
import json, html, re, shutil
from pathlib import Path

OUT=Path(__file__).resolve().parent
data=json.loads((OUT/'data.json').read_text())
metadata=json.loads((OUT/'images.json').read_text())
photos=metadata['regions']
cityphotos=metadata['cities']
assert len(data)==34 and len(photos)==34
N=sum(len(p['places']) for p in data)
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
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f7f5f0"><meta name="description" content="{E(description)}"><title>{E(title)}｜未来旅游规划</title><link rel="canonical" href="https://zbyloveyj.github.io/personal-growth-lab/academy/travel-plans/{canonical}"><link rel="stylesheet" href="{base}journal.css?v=3"><script defer src="{base}catalog.js?v=3"></script><script defer src="{base}journal.js?v=3"></script><noscript><style>.city-tools,.search-bar,.catalog-toolbar,.save-button,.plan-tools{{display:none!important}}</style></noscript></head>'''

def header(base=''):
    return f'''<a class="skip" href="#main">跳到正文</a><header class="masthead"><div class="mast-inner"><a class="wordmark" href="{base or './'}">未来旅游规划<small>THE PLACES WE WILL GO</small></a><nav aria-label="主导航"><a href="{base}#destinations">目的地</a><a href="{base}#journeys">旅行灵感</a><a href="{base}#my-plan">我的清单 <span data-plan-count>0</span></a><a href="{base}sources.html">资料与图片</a></nav><a class="back-academy" href="{base}../">成长学院 ↗</a></div></header>'''

def footer(base=''):
    return f'''<footer class="footer"><div class="wrap footer-top"><div><p class="footer-brand">未来旅游规划</p><p>把地名读成故事，把想去变成出发。</p></div><div><a href="{base}#destinations">全国目的地</a><a href="{base}全国旅游攻略.md" download>下载完整攻略</a><a href="{base}sources.html">参考资料与图片署名</a><a href="{base}../">返回成长学院</a></div></div><div class="wrap footer-bottom"><span>一心问道 · 2026 年 11 月内容版</span><span>行程与时长为规划建议 · 开放与通行请行前核验</span></div></footer><div id="status" class="toast" role="status" aria-live="polite" hidden></div>'''

def source_list(p):
    return '<ul class="source-list">'+''.join(f'<li><a href="{E(s["url"])}" target="_blank" rel="noopener noreferrer">{E(s["label"])} ↗</a></li>' for s in p['sources'])+'</ul>'

def search_text(c):
    return ' '.join([c.get('story','')]+[x['name']+' '+x['detail'] for x in c.get('see',[])]+[x['name']+' '+x['detail'] for x in c.get('eat',[])])

def city_body(p,c,i):
    ident=f'{p["id"]}:{i}'
    sights=c.get('see',[])
    food=c.get('eat',[])
    ph=next((x for x in cityphotos if x['regionId']==p['id'] and x['placeName']==c['name']),None)
    img=image(ph,'../','city-photo') if ph else ''
    return f'''<details class="city-guide place" id="city-{i}" data-city="{i}" data-search="{E(' '.join([c['name'],c['sights'],c['food'],c['history'],c['theme'],search_text(c)]))}" {'open' if i==0 else ''}><summary><span class="city-number">{i+1:02d}</span><span class="city-title"><span class="eyebrow">{E(c['theme'])}</span><strong>{E(c['name'])}</strong><span class="city-teaser">{E(c['sights'])}</span></span><span class="city-days">{E(c.get('days','2—3天'))}</span><span class="expand-mark" aria-hidden="true">＋</span></summary><div class="city-body"><div class="city-intro"><p>{E(c.get('story',c['history']))}</p><button type="button" class="save-button" data-save="{ident}" aria-pressed="false" aria-label="将{E(c['name'])}加入想去">＋ 加入想去</button></div>{img}<div class="city-section"><div class="section-label"><span>01 / SEE</span><h3>值得留时间的地方</h3><p>时长为游览建议，未含全部转场。</p></div><ol class="sight-list">{''.join(f'<li><div><h4>{E(s["name"])}</h4><span>{E(s["time"])}</span></div><p>{E(s["detail"])}</p></li>' for s in sights) or f'<li><p>{E(c["sights"])}</p></li>'}</ol></div><div class="city-section food-section"><div class="section-label"><span>02 / TASTE</span><h3>从一顿饭认识当地</h3><p>认识风味与吃法，再选择餐馆。</p></div><ul class="food-list">{''.join(f'<li><h4>{E(s["name"])}</h4><p>{E(s["detail"])}</p></li>' for s in food) or f'<li><p>{E(c["food"])}</p></li>'}</ul></div><div class="city-section"><div class="section-label"><span>03 / GO SLOW</span><h3>行程与实用安排</h3></div><div class="practical"><p class="walk">{E(c.get('walk',p['route']))}</p><dl><div><dt>住在哪一带</dt><dd>{E(c.get('stay',p.get('stay','围绕主要游览片区选择住宿，减少重复转场。')))}</dd></div><div><dt>怎样衔接交通</dt><dd>{E(c.get('move',p.get('access',p['note'])))}</dd></div><div><dt>出发前多留意</dt><dd>{E(c.get('tip',p['note']))}</dd></div></dl></div></div></div></details>'''

def markdown(p):
    s=f'# {p["name"]}｜未来旅游规划\n\n{p["memory"]}\n\n{p["intro"]}\n\n'
    for label,key in [('认识这个地区','orientation'),('记忆线索','reading'),('什么时候去','season'),('到达与转场','access'),('住宿区域选择','stay')]:
        s+=f'## {label}\n\n{p.get(key,"")}\n\n'
    s+=f'建议停留：{p["duration"]}。指一次子线旅行，不代表走遍全区。\n\n'
    for r in p.get('routes',[]):
        s+=f'## {r["title"]} · {r["days"]}\n\n'+''.join(f'{j+1}. {t}\n' for j,t in enumerate(r['steps']))+'\n'
    for c in p['places']:
        s+=f'## {c["name"]} · {c.get("days","")}\n\n{c.get("story",c["history"])}\n\n### 景点看点\n\n'
        for x in c.get('see',[]):s+=f'- **{x["name"]}**（建议{x["time"]}）：{x["detail"]}\n'
        s+='\n### 美食与吃法\n\n'
        for x in c.get('eat',[]):s+=f'- **{x["name"]}**：{x["detail"]}\n'
        for label,key in [('行程顺序','walk'),('住在哪里','stay'),('交通衔接','move'),('特别提醒','tip')]:s+=f'\n{label}：{c.get(key,"")}\n'
        s+='\n'
    s+='## 来源与行前核验\n\n'+''.join(f'- [{x["label"]}]({x["url"]})\n' for x in p['sources'])
    return s+'\n内容为原创编辑概述；路线、时长为规划建议。开放、预约、天气、交通与通行资格，以主管部门及场馆最新公告为准。\n'

# Small, searchable catalog is shared across pages; detailed prose stays in HTML and JSON.
catalog=[]
for p in data:
    catalog.append({**{k:p[k] for k in ['id','name','region','memory','intro','season','duration']},'places':[{**{k:c.get(k,'') for k in ['name','sights','food','history','theme','days']},'search':search_text(c)} for c in p['places']]})
(OUT/'catalog.js').write_text('window.TRAVEL_CATALOG='+json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+';\n')
(OUT/'data.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
(OUT/'data.js').write_text('window.TRAVEL_DATA='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n')
allmd=f'# 全国未来旅游规划 · 完整指南\n\n34个省级地区，{N}个城市与旅行片区。城市覆盖以目录为准，部分合并相邻城市；不是全部县市乡镇和景点的穷尽清单。\n\n整理日期：2026-11-08。各项停留时间为编辑建议，不是实时开放、交通或通行承诺。\n\n'

for p in data:
    doc=markdown(p)
    (OUT/'guides'/f'{p["id"]}.md').write_text(doc)
    allmd+='\n---\n\n'+doc+'\n'
    toc=''.join(f'<a href="#city-{i}" data-city-link="{i}"><span>{i+1:02d}</span>{E(c["name"])}</a>' for i,c in enumerate(p['places']))
    routes=''.join(f'<article class="route"><div><span class="eyebrow">SUGGESTED JOURNEY / {E(r["days"])}</span><h3>{E(r["title"])}</h3></div><ol>'+''.join(f'<li><span>DAY {i+1:02d}</span><p>{E(re.sub(r"^第[0-9一二三四五六七八九十]+天[：:、，]?", "", step))}</p></li>' for i,step in enumerate(r['steps']))+'</ol></article>' for r in p.get('routes',[dict(title='第一次抵达',days=p['duration'],steps=[p['route']])]))
    nextp=data[(data.index(p)+1)%len(data)]
    body=f'''<body data-page="region" data-region="{p['id']}" data-base="../">{header('../')}<main id="main"><div class="wrap"><nav class="breadcrumb" aria-label="面包屑"><a href="../#destinations">全国目的地</a><span>/ {p['region']}</span><span>/ {p['name']}</span></nav><div class="region-heading"><div><p class="eyebrow">THE DESTINATION GUIDE / {p['region']}</p><h1>{p['name']}</h1><p class="region-memory">{E(p['memory'])}</p></div><p class="region-deck">{E(p['intro'])}</p></div>{image(photo(p['id']),'../','region-cover',True)}<nav class="chapter-nav" aria-label="本地区章节"><a href="#understand">读懂地方</a><a href="#routes">路线建议</a><a href="#cities">城市详解 <span>{len(p['places'])}</span></a><a href="#practical">行前准备</a><a href="../guides/{p['id']}.md" download>下载本地攻略 ↓</a></nav><section class="overview section" id="understand"><div class="section-label"><span>01 / UNDERSTAND</span><h2>先读懂，<br>再出发。</h2></div><div><p class="big-copy">{E(p.get('orientation',p['intro']))}</p><div class="memory-note"><h3>这样记，更清楚</h3><p>{E(p.get('reading',p['memory']))}</p></div></div></section><section class="essentials" aria-label="旅行速览"><div><h3>什么时候去</h3><p>{E(p['season'])}</p></div><div><h3>一次留多久</h3><p>{E(p['duration'])}。适合一次主题子线；完整走遍需分次安排。</p></div><div><h3>到达与转场</h3><p>{E(p.get('access',p['note']))}</p></div><div><h3>住宿怎么选</h3><p>{E(p.get('stay',p['note']))}</p></div></section><section class="section routes-section" id="routes"><div class="section-heading"><div><p class="eyebrow">02 / A JOURNEY, NOT A CHECKLIST</p><h2>挑一条线，慢慢走。</h2></div><p>路线为独立主题子线，不建议机械合并。到达日与离开日需按实际交通另留余量。</p></div>{routes}</section><section class="section cities-section" id="cities"><div class="section-heading"><div><p class="eyebrow">03 / THE CITY NOTEBOOK</p><h2>{len(p['places'])}个城市与旅行片区</h2></div><p>每站展开后可看景点细节、地方味道、行程和实用安排。也可以一口气展开，按自己的节奏读。</p></div><div class="city-tools"><label for="city-search">在{p['name']}找一座城、一处景点或一道菜<input type="search" id="city-search" placeholder="输入城市、景点、美食关键词" autocomplete="off"></label><button type="button" id="expand-cities">展开全部城市</button></div><p class="small-note" id="city-count" role="status">共 {len(p['places'])} 个城市与片区</p><div class="city-reading"><aside class="city-index"><span class="eyebrow">本地目录</span>{toc}<a class="back-top" href="#main">回到地区开篇 ↑</a></aside><div class="city-articles">{''.join(city_body(p,c,i) for i,c in enumerate(p['places']))}<p class="empty" id="no-cities" hidden>没有匹配的城市或关键词，换一个词再试。</p></div></div></section><section class="section region-practical" id="practical"><div class="section-label"><span>04 / BEFORE YOU GO</span><h2>把准备，<br>留在出发前。</h2></div><div><h3>这一地区特别留意</h3><p>{E(p['note'])}</p><p>正文的参观时长不等于开放时段。博物馆预约、山地天气、交通末班和港澳台或边境通行要求，均应以实际出发时间的官方信息确认。</p><div class="region-actions"><a class="button primary" href="../guides/{p['id']}.md" download>保存{p['name']}文字攻略 ↓</a><button type="button" data-print>打印本地区</button><a class="text-link" href="../#my-plan">查看我的想去清单 ↗</a></div><details class="references"><summary>参考资料与官方查询入口</summary>{source_list(p)}<p>链接包含内容参考及行前查询入口，不能将其中任一来源视为全部正文的逐句依据。历史与风味为原创编辑概述，时长和路线为规划建议。</p></details></div></section><a class="next-region" href="{nextp['id']}.html"><span>继续认识一个地方</span><strong>{nextp['name']} ↗</strong><span>{E(nextp['memory'])}</span></a></div></main>{footer('../')}</body></html>'''
    (OUT/'regions'/f'{p["id"]}.html').write_text(head(p['name']+'旅行指南',p['intro'],'../','regions/'+p['id']+'.html')+body)
(OUT/'全国旅游攻略.md').write_text(allmd)

def tile(p):
    return f'''<article class="destination" data-id="{p['id']}" data-area="{p['region']}"><a class="destination-image" href="regions/{p['id']}.html" aria-label="查看{p['name']}旅行指南">{image(photo(p['id']),'','',False,False)}<span class="image-count">{len(p['places'])} 个城市与片区 ↗</span></a><div class="destination-meta"><span>{p['region']}</span><span>{E(p['duration'])}</span></div><h3><a href="regions/{p['id']}.html">{p['name']}<span aria-hidden="true">↗</span></a></h3><p>{E(p['memory'])}</p><div class="match-links" aria-label="匹配的城市"></div></article>'''

trips=[('shanxi','沿着古建，读一遍历史','山西北中线 · 7天','大同 → 太原 → 平遥。先看石窟与辽金建筑，再读晋商古城；把路途与一顿面食留进每天。'),('guangdong','从早茶到一碗潮汕粿条','广东风味线 · 6天','广州与佛山择重点停留，再转潮州、汕头；珠三角与潮汕之间单独留出转场时间。'),('yunnan','把湖光与街巷留给慢旅行','云南滇西线 · 6天','大理 → 丽江。前半程看湖岸与白族聚落，后半程读纳西古城；山地行程按体能与天气增减。')]
triphtml=''.join(f'<article class="journey">{image(next((im for im in cityphotos if im["regionId"]==id and im["placeName"]=="广州"),photo(id)),"","",False,False)}<p class="eyebrow">{E(label)}</p><h3><a href="regions/{id}.html#routes">{E(title)} ↗</a></h3><p>{E(text)}</p></article>' for id,title,label,text in trips)
filterhtml=''.join(f'<button type="button" data-area="{a}" aria-pressed="{str(a=="全部").lower()}">{a}</button>' for a in ['全部']+areas)
cards=''.join(tile(p) for p in data)
home=f'''<body data-page="home" data-base=""><header class="edition-strip"><div class="wrap"><span>一心问道 · 旅行与地方知识</span><span>34 个地区 / {N} 个城市与旅行片区</span></div></header>{header()}<main id="main"><section class="opening wrap"><p class="eyebrow">A PERSONAL ATLAS OF PLACES & STORIES</p><div class="opening-grid"><h1>山河很大，<br><em>一站一站认识。</em></h1><div class="opening-note"><span class="issue">未来旅游规划 / VOL. 02</span><p>从一座城的来处，到巷口的一碗早餐。为每一次将来的出发，认真留下一份关于风景、人和味道的笔记。</p><a class="text-link" href="#destinations">翻开全国目的地目录 ↓</a></div></div>{image(photo('anhui'),'','opening-photo',True)}<div class="opening-foot"><p>先认识地方，再安排旅程。</p><p>含台湾、香港、澳门 · 独立地区指南 · 可收藏与下载</p></div></section><section class="destinations-section wrap section" id="destinations"><div class="section-heading"><div><p class="eyebrow">01 / FIND YOUR NEXT CHAPTER</p><h2>下一站，从哪里开始？</h2></div><p>34个地区分别成篇。搜城市、一道菜或一个历史线索，直接走进详细攻略。</p></div><div class="search-bar"><label for="search"><span class="search-icon" aria-hidden="true">⌕</span><span class="visually-hidden">搜索全国城市、景点、美食与历史</span><input id="search" type="search" placeholder="试试：亳州 / 双皮奶 / 石窟 / 泉州 / 客家" autocomplete="off"></label><button type="button" id="clear-search">重置</button></div><div class="catalog-toolbar"><div class="area-filters" id="area-filters" aria-label="地理分组">{filterhtml}</div><button id="random-region" class="text-button" type="button">随意翻一站 ↗</button></div><p id="result-count" class="result-count" role="status" aria-live="polite">34 个地区 · {N} 个城市与旅行片区</p><div class="destination-grid">{cards}</div><p class="empty" id="no-results" hidden>没有找到相关结果。可以换一个景点名、美食名，或重置地区筛选。</p></section><section class="journeys-section" id="journeys"><div class="wrap section"><div class="section-heading"><div><p class="eyebrow">02 / TRAVEL BY CURIOSITY</p><h2>先有好奇，再有路线。</h2></div><p>不必一次走遍一个省。选一条主题线，给街巷、展厅和一顿饭各留一点时间。</p></div><div class="journey-grid">{triphtml}</div><div class="travel-principles"><h3>一条好走的路线，先回答这四件事。</h3><ol><li><strong>想认识什么</strong><span>山川、古建、城市生活，先确定这次的重点。</span></li><li><strong>真实有几天</strong><span>扣除往返和转场，每天留一个主要目的地。</span></li><li><strong>住在哪一带</strong><span>围绕游览片区选住宿，让行李少搬几次。</span></li><li><strong>哪些要核验</strong><span>先查开放与预约，再确认天气、交通和证件。</span></li></ol></div></div></section><section class="wrap section plan-section" id="my-plan"><div class="section-heading"><div><p class="eyebrow">03 / MY TRAVEL NOTEBOOK</p><h2>把想去，留在这里。</h2></div><p>在地区攻略中加入城市，再慢慢补上月份、天数和自己的想法。</p></div><div class="plan-summary"><p>想去 <strong id="want-count">0</strong> 站 <span>／</span> 已去 <strong id="visited-count">0</strong> 站</p><a href="全国旅游攻略.md" download>下载全国完整文字版 ↓</a></div><p class="small-note">个人清单保存在当前浏览器。跨设备使用或清理浏览器前，请导出备份。</p><p id="storage-warning" class="warning" hidden>浏览器暂时无法持久保存，请先导出备份。</p><div class="plan-tools"><label><span class="visually-hidden">筛选清单状态</span><select id="plan-filter"><option value="all">全部状态</option><option value="want">只看想去</option><option value="visited">只看已去</option></select></label><button type="button" id="export-plan">导出备份 JSON</button><button type="button" id="import-plan">导入备份</button><button type="button" id="export-text">下载我的旅行清单</button></div><div id="plan-list"><p class="empty">还没有写下第一站。打开一个地区，在城市详解中点击“加入想去”。</p></div><input id="import-file" type="file" accept="application/json,.json" hidden></section><section class="wrap guide-note"><span class="eyebrow">ABOUT THIS GUIDE</span><div><h2>一本为未来出发准备的手册。</h2><p>这里覆盖34个省级地区，按城市、相邻城市组合与旅行片区组织；不是所有县市乡镇和景点的穷尽清单。每站写明景点看点、地方历史、美食与吃法，并提供时间、住宿和交通的安排思路。具体城市覆盖可在各地区目录中查看。</p><p>内容为原创编辑整理。摄影选用明确许可的公共资源，实景与所在地区逐一对应，作者、许可和原始来源均可查阅。路线与停留时间属于规划建议；出发前请核验官方开放、预约和通行信息。</p><a class="text-link" href="sources.html">查看内容参考与全部图片署名 ↗</a></div></section></main>{footer()}</body></html>'''
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
(OUT/'README.md').write_text(f'''# 未来旅游规划 · 第二版\n\n入口：https://zbyloveyj.github.io/personal-growth-lab/academy/travel-plans/\n\n34个省级地区，{N}个城市与旅行片区。各地区独立HTML指南位于`regions/`，包含景点看点、地方历史、食物与吃法、游览顺序、住宿片区、交通及行前提醒。部分相邻城市合并成一篇，具体覆盖以目录为准，不声称穷尽每个县市乡镇。\n\n## 内容与生成\n\n`data.json`为完整结构化内容；`catalog.js`为检索与清单使用的轻量目录；`data.js`保留旧接口兼容。`全国旅游攻略.md`为全文，`guides/`为分地区文字版。页面静态生成，禁用JS仍可通过目录和details阅读全部内容。\n\n修改`data.json`与`images.json`后，在本目录运行`python build.py`可重新生成全部页面与文字攻略；仅需Python标准库。原城市name与顺序应保留，新增城市追加在末尾，以兼容已有清单。\n\n`journal.css`和`journal.js`负责第二版视觉与交互。旧style.css/app.js/editorial.css留存兼容，但新页面不加载它们。旧#region-xx书签会导向新地区页。\n\n## 个人计划\n\n沿用`future-travel-plan-v1` localStorage键，旧城市条目的名称与索引顺序保留，可继续读取旧收藏。仅保存于浏览器，无跨设备自动同步。JSON导出、合并导入和个人Markdown下载均由浏览器完成。\n\n## 摄影与参考\n\n34张地区照片，另有{len(cityphotos)}张城市细节照片。全部许可与原始来源在`sources.html`、`assets/CREDITS.md`。不含未经许可复制的商业旅行网站图片。编写日期2026-11-08，开放、预约、天气、交通、通行要求须行前核验。\n''')
print(json.dumps(dict(regions=len(data),cities=N,regional_photos=len(photos),city_photos=len(cityphotos),guide_chars=len(allmd),expanded=sum('orientation' in p for p in data)),ensure_ascii=False))
