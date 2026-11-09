# 未来旅游规划 · 第三版

入口：https://zbyloveyj.github.io/personal-growth-lab/academy/travel-plans/

覆盖34个地区、396个城市与旅行片区。取消每城3景点/3美食的内容模式；重点目的地与4A/5A景区名录分别纳入，每项解释内容、历史背景、看点或地方饮食文化。等级按所列来源版本记录，公开转录待原件核对者单独标识；不代表实时开放或创建/公示已获评。

## 源文件与生成

`data.json`为版本3源清单，`data/regions/*.json`为地区完整内容，`data/inventory/*.json`为分省景区名录，`data/coverage.json`列各省来源版本、补核范围和缺口。不是把所有名录均冒称为2026-11-08即时现行的全量。

运行`python build.py`生成地区HTML、轻量目录`catalog.js`、各地Markdown及`全国旅游攻略.zip`。仅需Python标准库；`guide_renderer.py`负责详细城市内容。`scenic.html`与`scenic-index.js`用于全部入库景区检索，按省、市、等级筛选；`build_scenic.py`生成索引与版本页。

`全国旅游攻略.md`是各地文字攻略目录；完整正文位于ZIP与`guides/`。34张地区图与26张城市图的作者、许可及来源见`sources.html`和`assets/CREDITS.md`。旧版`data.js/app.js/style.css/editorial.css`不被新页面加载，不应作为当前数据源。

## 个人清单与兼容

继续使用`future-travel-plan-v1`浏览器localStorage。原城市name和索引顺序保持不变，新片区追加；不把个人笔记写回GitHub。支持JSON备份、合并恢复和个人Markdown导出。

## 发布与核验

静态GitHub Pages页面，不需要外部字体、第三方脚本或登录。等级清单按各项原始来源及截止日期记录；正式认定、拟公示、摘牌和降级分别判断。台湾香港澳门不套用大陆A级体系。开放、交通、天气、边境与港澳台通行请行前核验。
