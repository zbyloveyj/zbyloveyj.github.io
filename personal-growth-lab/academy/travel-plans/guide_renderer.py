"""Long-form city guides, with an uncapped official scenic inventory."""
import html,re
E=lambda value:html.escape(str(value),quote=True)

def key(s):
    return re.sub(r'[\s\-—·（）()、，,：:]','',s).replace('旅游景区','').replace('风景名胜区','').replace('旅游区','').replace('景区','')

def search_text(c):
    # Search all names and local history; long descriptions remain in their destination guide.
    return ' '.join([c.get('story','')]+[x['name'] for x in c.get('see',[])]+[x['name'] for x in c.get('eat',[])]+[x['name']+' '+x.get('city','')+' '+x.get('district','') for x in c.get('ratedScenic',[])])

def source_box(x):
    sources=x.get('sources',[])
    if not isinstance(sources,list):sources=[]
    if x.get('sourceUrl'):sources=[{'label':'原始名录与资料','url':x['sourceUrl']}]+sources
    for field,label in [('officialSourceUrl','所述公告原件入口'),('detailSourceUrl','景点内容资料'),('locationSourceUrl','行政位置核对资料'),('statusSourceUrl','开放与复核状态资料'),('sharedSourceUrl','联合景区范围依据')]:
        if x.get(field):sources=sources+[{'label':label,'url':x[field]}]
    sources=sources+[{'label':'景点内容延伸阅读','url':url} for url in x.get('contentSourceUrls',[]) if isinstance(url,str)]
    unique={}
    for source in sources:
        if isinstance(source,dict) and source.get('url'):unique.setdefault(source['url'],source)
    sources=list(unique.values())
    if not sources:return ''
    links=''.join(f'<li><a href="{E(s["url"])}" target="_blank" rel="noopener noreferrer">{E(s.get("label","资料入口"))} ↗</a></li>' for s in sources if isinstance(s,dict) and s.get('url'))
    verification='<p>该项名称与等级来自公开名录转录，原始总表尚待取得核对；请按本项版本阅读。</p>' if x.get('verification')=='transcription' else ''
    return f'<details class="entry-source"><summary>资料与名录依据</summary><ul>{links}</ul>{verification}{"<p>名录版本："+E(x["sourceAsOf"])+"</p>" if x.get("sourceAsOf") else ""}</details>'

def spot(x):
    ident=x.get('registryId') or x.get('id','')
    anchor_id=x.get('anchorId') or ('spot-'+ident if ident else '')
    anchor=f' id="{E(anchor_id)}"' if anchor_id else ''
    level=x.get('level','')
    badge=f'<span class="rating">{E(level)}'+(' · 转录待核' if x.get('verification')=='transcription' else '')+'</span>' if level else ''
    time=x.get('time') or '按游览主题预留时间'
    location=' · '.join(dict.fromkeys(str(x.get(k,'')) for k in ['kind','area','city','district'] if x.get(k)))
    detail=x.get('detail','').strip()
    if not detail:detail='本条已收录对应版本官方名录中的名称、等级与行政位置。景区内容与历史介绍尚待进一步核对，可先查阅原始资料；这里不以推测补写景观或历史。'
    address=f'<p class="spot-address">名录地址：{E(x["address"])}</p>' if x.get('address') else ''
    status=x.get('status') or x.get('operationNote','')
    status_line='<p class="spot-status">记录提示'+(' · '+E(x['statusAsOf']) if x.get('statusAsOf') else '')+'：'+E(status)+'</p>' if status and status not in detail else ''
    return f'<li{anchor}><div><h4>{E(x["name"])} {badge}</h4><span>{E(time)}</span></div>{"<p class=\"entry-meta\">"+E(location)+"</p>" if location else ""}<p>{E(detail)}</p>{status_line}{address}{source_box(x)}</li>'

def city_body(p,c,i,image=None,cityphotos=None):
    curated=[{**x,'anchorId':('spot-'+x['registryId'] if x.get('registryId') else f'point-{p["id"]}-{i}-{j}')} for j,x in enumerate(c.get('see',[]))]
    used={s.get('registryId') for s in curated if s.get('registryId')}
    remaining=[s for s in c.get('ratedScenic',[]) if s['id'] not in used]
    food=c.get('eat',[])
    directory='<details class="city-directory"><summary>本城景点目录 · '+str(len(curated)+len(remaining))+'条</summary><nav aria-label="'+E(c['name'])+'景点目录">'+''.join('<a href="#'+E(x.get('anchorId') or 'spot-'+x['id'])+'">'+E(x['name'])+'</a>' for x in curated+remaining)+'</nav></details>'
    ph=next((x for x in (cityphotos or []) if x['regionId']==p['id'] and x['placeName']==c['name']),None)
    img=image(ph,'../','city-photo') if ph and image else ''
    query=' '.join([c['name'],c.get('sights',''),c.get('food',''),c.get('history',''),c.get('theme',''),search_text(c)]+[s.get('detail','') for s in curated+remaining]+[x.get('detail','') for x in food])
    totals=f'{len(curated)+len(remaining)}条景点指南 · {len(food)}项风味'
    badge=f'<span>{c.get("ratedCount",0)}处名录景区</span>' if c.get('ratedCount') else ''
    part=''
    if remaining:
        heading='继续查阅：当地目的地目录' if p['region']=='港澳台' else '继续查阅：本地4A / 5A景区'
        scope='以下补充当地旅游机构目录中的目的地，不套用大陆A级。' if p['region']=='港澳台' else '以下按所列来源版本补充名录，不限固定数量；转录待核者单独提示。评级属于完整景区，不自动授予每一处内部建筑。'
        part=f'<div class="inventory-subhead"><h4>{heading}</h4><p>{scope}</p></div><ol class="sight-list registry-extra">'+''.join(spot(s) for s in remaining)+'</ol>'
    itineraries=''
    for r in c.get('itineraries',[]):
        itineraries+=f'<article class="city-route"><h4>{E(r["title"])} <small>{E(r.get("days",""))}</small></h4><ol>'+''.join(f'<li>{E(s)}</li>' for s in r.get('steps',[]))+'</ol></article>'
    references=''
    if c.get('sources'):
        references='<details class="city-references"><summary>本城市延伸阅读与官方入口</summary><ul>'+''.join(f'<li><a href="{E(s["url"])}" target="_blank" rel="noopener noreferrer">{E(s.get("label","资料"))} ↗</a></li>' for s in c['sources'])+'</ul></details>'
    return f'''<details class="city-guide place" id="city-{i}" data-city="{i}" data-search="{E(query)}" {'open' if i==0 else ''}><summary><span class="city-number">{i+1:02d}</span><span class="city-title"><span class="eyebrow">{E(c.get('theme','地方旅行'))}</span><strong>{E(c['name'])}</strong><span class="city-teaser">{E(c.get('sights',''))}</span><span class="city-counts">{totals}{badge}</span></span><span class="city-days">{E(c.get('days','按主题安排'))}</span><span class="expand-mark" aria-hidden="true">＋</span></summary><div class="city-body"><div class="city-intro"><p>{E(c.get('story',c.get('history','')))}</p><button type="button" class="save-button" data-save="{p['id']}:{i}" aria-pressed="false" aria-label="将{E(c['name'])}加入想去">＋ 加入想去</button></div><nav class="city-chapters" aria-label="{E(c['name'])}内容跳转"><a href="#city-{i}-see">景点与历史 {len(curated)+len(remaining)}</a><a href="#city-{i}-taste">美食与地方文化 {len(food)}</a><a href="#city-{i}-plan">行程与交通</a></nav>{img}{directory}<div class="city-section" id="city-{i}-see"><div class="section-label"><span>01 / WHAT IT IS & WHY GO</span><h3>看什么，<br>为什么去。</h3><p>景观、历史和看点分别细读。时间为游览建议；评级按各项名录版本标注。</p></div><div><ol class="sight-list">{''.join(spot(s) for s in curated)}</ol>{part}</div></div><div class="city-section food-section" id="city-{i}-taste"><div class="section-label"><span>02 / THE LOCAL TABLE</span><h3>从一顿饭，<br>读懂地方。</h3><p>从早餐、主食到家常菜、甜点与茶饮，了解做法、吃法和地方背景，再按自己的胃口搭配。</p></div><ul class="food-list">{''.join('<li>'+('<span class="food-category">'+E(x['category'])+'</span>' if x.get('category') else '')+'<h4>'+E(x['name'])+'</h4><p>'+E(x['detail'])+'</p>'+source_box(x)+'</li>' for x in food)}</ul></div><div class="city-section" id="city-{i}-plan"><div class="section-label"><span>03 / PLAN YOUR TIME</span><h3>行程与实用安排</h3><p>收录全面，不代表一次全去。先选主题，再决定天数。</p></div><div class="practical">{itineraries}<p class="walk">{E(c.get('walk',p['route']))}</p><dl><div><dt>住在哪一带</dt><dd>{E(c.get('stay',p.get('stay','')))}</dd></div><div><dt>怎样衔接交通</dt><dd>{E(c.get('move',p.get('access','')))}</dd></div><div><dt>出发前多留意</dt><dd>{E(c.get('tip',p['note']))}</dd></div></dl>{references}</div></div></div></details>'''

def markdown(p):
    s=f'# {p["name"]}｜未来旅游规划\n\n{p["memory"]}\n\n{p["intro"]}\n\n'
    for label,k in [('认识这个地区','orientation'),('记忆线索','reading'),('什么时候去','season'),('到达与转场','access'),('住宿区域选择','stay')]:s+=f'## {label}\n\n{p.get(k,"")}\n\n'
    inv=p.get('inventory',{})
    s+=f'## 景区名录版本\n\n收录{inv.get("count",0)}条名录，基期：{inv.get("asOf","")}。{inv.get("coverage","")}\n\n后续核验说明：{inv.get("missing","")}\n\n'
    for r in p.get('routes',[]):s+=f'## {r["title"]} · {r["days"]}\n\n'+''.join(f'{i+1}. {t}\n' for i,t in enumerate(r['steps']))+'\n'
    def mspot(x):
        text=f'### {x["name"]}'+(f' · {x["level"]}' if x.get('level') else '')+(' · 转录待原件核对' if x.get('verification')=='transcription' else '')+'\n\n'
        text+=x.get('detail') or '官方名称、等级及行政位置已收录，进一步历史与景观介绍仍待核对。'
        text+='\n\n'
        if x.get('time'):text+='建议时间：'+x['time']+'\n\n'
        if x.get('city') or x.get('district'):text+='名录所在地：'+' · '.join(dict.fromkeys(x.get(k,'') for k in ['city','district'] if x.get(k)))+'\n\n'
        if x.get('address'):text+='名录地址：'+x['address']+'\n\n'
        if x.get('sourceUrl'):text+=f'资料：[所列来源]({x["sourceUrl"]})；版本：{x.get("sourceAsOf","")}\n\n'
        if x.get('verification')=='transcription':text+='原件核验：名称与等级来自公开名录转录，原始总表尚待取得核对。\n\n'
        for source in x.get('sources',[]):
            if isinstance(source,dict) and source.get('url'):text+=f'延伸阅读：[{source.get("label","资料")}]({source["url"]})\n\n'
        if x.get('locationSourceUrl'):text+=f'位置核对：[官方单项资料]({x["locationSourceUrl"]})\n\n'
        if x.get('status') or x.get('operationNote'):text+='记录提示：'+(x.get('status') or x['operationNote'])+'\n\n'
        for field,label in [('officialSourceUrl','所述公告原件入口'),('detailSourceUrl','景点内容资料'),('statusSourceUrl','状态资料'),('sharedSourceUrl','联合景区范围依据')]:
            if x.get(field):text+=f'{label}：[{label}]({x[field]})\n\n'
        for url in x.get('contentSourceUrls',[]):
            if isinstance(url,str):text+=f'延伸阅读：[景点内容资料]({url})\n\n'
        return text
    for c in p['places']:
        s+=f'## {c["name"]} · {c.get("days","")}\n\n{c.get("story",c.get("history",""))}\n\n'
        used={x.get('registryId') for x in c.get('see',[]) if x.get('registryId')}
        for x in c.get('see',[]):s+=mspot(x)
        for x in c.get('ratedScenic',[]):
            if x['id'] not in used:s+=mspot(x)
        s+='### 美食与地方文化\n\n'
        for x in c.get('eat',[]):s+=f'#### {x["name"]}'+(' · '+x['category'] if x.get('category') else '')+'\n\n'+x['detail']+'\n\n'
        for title,k in [('游览顺序','walk'),('住在哪里','stay'),('交通衔接','move'),('特别提醒','tip')]:s+=f'{title}：{c.get(k,"")}\n\n'
    if p.get('unmappedScenic'):
        s+='## 更多区县的名录景区\n\n以下条目按官方行政标签保留，可按所在地另外安排行程。\n\n'
        for x in p['unmappedScenic']:s+=mspot(x)
    s+='## 参考与核验入口\n\n'+''.join(f'- [{x["label"]}]({x["url"]})\n' for x in p['sources'])
    return s+'\n等级按所列来源与版本记录；转录待核者已单独标出，不等于实时开放、预约和通行承诺。公示不作为正式获评。\n'

def inventory_section(p):
    inv=p.get('inventory',{})
    n=inv.get('count',0)
    entries=p.get('unmappedScenic',[])
    note=inv.get('missing','')
    cards=''
    if entries:
        cards='<h3>其他区县与独立管理区域</h3><p>以下保留官方名录中的行政标签，避免因城市旅行片区划分而漏掉景区。</p><ol class="sight-list unmatched-spots">'+''.join(spot(x) for x in entries)+'</ol>'
    return f'''<section class="section regional-inventory" id="rated-directory"><div class="section-heading"><div><p class="eyebrow">THE SCENIC SOURCE LEDGER</p><h2>{E(p['name'])}景区名录与核验范围</h2></div><p>本地区已收录 {n} 项。名录基期：{E(inv.get('asOf','待核对'))}。</p></div><div class="coverage-note"><p>{E(inv.get('coverage',''))}</p><p>{E(note) if note else '已按所列来源版本整理。名单更新、等级调整与实时开放为不同信息，仍需出发前确认。'}</p><a class="text-link" href="../scenic.html?province={p['id']}">在全国景区索引中筛选{E(p['name'])} ↗</a></div>{cards}</section>'''
