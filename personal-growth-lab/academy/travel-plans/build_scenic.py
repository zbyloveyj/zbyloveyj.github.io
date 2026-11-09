"""Generate the scenic inventory browser and its version audit from public data."""
import csv,html,json,io,re
from pathlib import Path
ROOT=Path(__file__).resolve().parent
E=lambda s:html.escape(str(s),quote=True)
manifest=json.loads((ROOT/'data.json').read_text())
regions=[json.loads((ROOT/x['source']).read_text()) for x in manifest['regions']]
coverage=json.loads((ROOT/'data/coverage.json').read_text())
rows=[]
for p in regions:
    inv=json.loads((ROOT/'data/inventory'/f'{p["id"]}.json').read_text())
    rows+=inv['items']
catalog=[{k:x.get(k,'') for k in ['id','name','regionId','regionName','city','district','level','address','kind','sourceUrl','sourceAsOf','guideIndex','verification']} for x in rows]
(ROOT/'scenic-index.js').write_text('window.SCENIC_INDEX='+json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+';\n')
out=io.StringIO(newline='');writer=csv.writer(out)
writer.writerow(['地区','官方景区名称','所在地市','区县','来源所列等级','名录地址','来源版本','原始资料','介绍是否已补充','原件核验状态'])
for x in rows:writer.writerow([x.get(k,'') for k in ['regionName','name','city','district','level','address','sourceAsOf','sourceUrl']]+['是' if x.get('detail') else '仅名录待补解说','转录待原件核对' if x.get('verification')=='transcription' else '见来源与版本'])
(ROOT/'全国景区名录.csv').write_text('\ufeff'+out.getvalue())

def common_head(title):
 return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f7f5f0"><title>{title}｜未来旅游规划</title><link rel="stylesheet" href="journal.css?v=4"><link rel="stylesheet" href="enriched.css?v=4"><script defer src="catalog.js?v=4"></script><script defer src="journal.js?v=4"></script>'''
header='''<a class="skip" href="#main">跳到正文</a><header class="masthead"><div class="mast-inner"><a class="wordmark" href="./">未来旅游规划<small>THE PLACES WE WILL GO</small></a><nav aria-label="主导航"><a href="./#destinations">目的地</a><a href="scenic.html">景区索引</a><a href="./#journeys">旅行灵感</a><a href="./#my-plan">我的清单 <span data-plan-count>0</span></a><a href="sources.html">资料与图片</a></nav><a class="back-academy" href="../">成长学院 ↗</a></div></header>'''
foot='''<footer class="footer"><div class="wrap footer-top"><div><p class="footer-brand">未来旅游规划</p><p>看景点，也认识它的来处。</p></div><div><a href="./">返回全国指南</a><a href="coverage.html">名录版本与核验范围</a><a href="全国旅游攻略.zip" download>下载完整文字攻略</a><a href="全国景区名录.csv" download>下载全部已收录景区</a></div></div><div class="wrap footer-bottom"><span>2026.11.08 内容整理</span><span>评级、开放与通行分别核验</span></div></footer><div id="status" class="toast" role="status" aria-live="polite" hidden></div>'''
options=''.join(f'<option value="{p["id"]}">{p["name"]}</option>' for p in regions)
with_detail=sum(bool(x.get('detail')) for x in rows)
page=common_head('全国景区索引')+'''<script defer src="scenic-index.js?v=4"></script><script defer src="scenic.js?v=4"></script></head><body data-page="scenic" data-base="">'''+header+f'''<main id="main" class="wrap scenic-page"><p class="eyebrow">THE SCENIC INDEX / SOURCE BY SOURCE</p><div class="section-heading"><div><h1>把目的地，<br>一处处查清。</h1></div><p>按所在地区、城市与等级检索已收录名录，再进入具体解说。博物馆、历史街区与地方生活线索，也可在城市指南中继续阅读。</p></div><div class="registry-intro"><strong>{len(rows):,}</strong><span>条已入库名录记录</span><strong>{with_detail:,}</strong><span>条已附实质解说</span><a href="coverage.html">逐地区查看来源版本与缺口 ↗</a></div><p class="small-note">4A/5A按所列来源及版本标注；转录待原件核对者单独提示，公示、创建不等于获评。港澳台使用当地官方目的地目录，不套用大陆A级。联合景区或分片展示可能产生多条记录，不能把条目数当成全国认证景区的官方统计。</p><section class="registry-controls" aria-label="景区筛选"><label>地区<select id="registry-province"><option value="all">全部地区</option>{options}</select></label><label>所在城市或管理区域<select id="registry-city"><option value="all">全部城市</option></select></label><label>评级/目录类型<select id="registry-level"><option value="all">全部类型</option><option value="4A">4A</option><option value="5A">5A</option><option value="local">当地官方目录（非A级）</option></select></label><label class="registry-search">景区、地名、地址<input type="search" id="registry-query" placeholder="如：牛首山 / 江宁 / 博物馆" autocomplete="off"></label><button type="button" id="registry-reset">重置</button></section><div class="registry-results"><p id="registry-count" role="status" aria-live="polite"></p><a href="全国景区名录.csv" download>下载全部已收录名录 CSV ↓</a></div><div class="registry-table-wrap"><table class="registry-table"><thead><tr><th scope="col">景区与资料</th><th scope="col">所在城市 / 区县</th><th scope="col">来源等级</th><th scope="col">名录版本</th><th scope="col">攻略</th></tr></thead><tbody id="registry-rows"></tbody></table></div><div class="registry-pagination"><button type="button" id="registry-prev">上一页</button><span id="registry-page"></span><button type="button" id="registry-next">下一页</button><label>每页<select id="registry-size"><option value="50">50条</option><option value="100">100条</option><option value="200">200条</option></select></label></div><noscript><p>当前浏览器未运行脚本。可<a href="全国景区名录.csv" download>下载完整名录CSV</a>，或回到<a href="./#destinations">各地区静态指南</a>查阅全部已收录内容。</p></noscript><aside class="coverage-note"><h2>名录和攻略，各自回答什么？</h2><p>名录回答“哪些地方被正式列入、位于哪里、依据哪份文件”；解说回答“这是什么、有什么历史与看点、适合为什么去”。只核对到名称和等级的条目会明确标示，不用通用空话冒充历史介绍。各地区有来源基期与后续核验说明，尚未闭合的增量不会被称为实时完整。</p><a class="text-link" href="coverage.html">查看34地区核验范围与原始文件 ↗</a></aside></main>'''+foot+'</body></html>'
(ROOT/'scenic.html').write_text(page)
cells=''
for c in coverage:
 items=[x for x in rows if x['regionId']==c['regionId']]
 sources=''.join(f'<li><a href="{E(s["url"])}" target="_blank" rel="noopener noreferrer">{E(s.get("label","原始资料"))} ↗</a></li>' for s in c.get('sources',[]) if s.get('url'))
 cells+=f'''<article class="coverage-region" id="coverage-{c['regionId']}"><header><h2>{E(c['name'])}</h2><a href="scenic.html?province={c['regionId']}">查看{len(items)}条 ↗</a></header><dl><div><dt>所列版本</dt><dd>{E(c.get('asOf',''))}</dd></div><div><dt>收录与解说</dt><dd>{sum(x.get('level')=='4A' for x in items)}条4A · {sum(x.get('level')=='5A' for x in items)}条5A · {sum(not x.get('level') for x in items)}条当地目录；{sum(bool(x.get('detail')) for x in items)}条有解说；{sum(x.get('verification')=='transcription' for x in items)}条转录待原件核对。</dd></div><div><dt>核验范围</dt><dd>{E(c.get('coverage',''))}</dd></div><div><dt>仍需补核</dt><dd>{E(c.get('missing','')) or '按本版所列来源完成；此后的运营与正式公告仍应行前查询。'}</dd></div></dl><details><summary>原始来源与更新依据</summary><ul class="source-list">{sources}</ul></details></article>'''
cov=common_head('名录版本与核验范围')+'</head><body data-page="coverage" data-base="">'+header+f'''<main id="main" class="wrap coverage-page"><p class="eyebrow">THE SOURCE LEDGER</p><h1>名录有版本，<br>内容有来处。</h1><p class="big-copy">把完整总表、正式增补和后续缺口分清，才知道“已收录”到底覆盖到哪里。</p><p>以下按34个地区列出实际依据。总表之后的拟公示不直接改变等级；等级取消也不自动等于景区关闭。这里只报告已核对的范围，不能以页面更新时间替代原始名录截止日期。</p><div class="coverage-regions">{cells}</div></main>'''+foot+'</body></html>'
(ROOT/'coverage.html').write_text(cov)
print(json.dumps({'registry':len(rows),'withDetail':with_detail,'coverageRegions':len(coverage)},ensure_ascii=False))
