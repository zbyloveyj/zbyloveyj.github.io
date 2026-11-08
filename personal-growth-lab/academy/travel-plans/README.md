# 未来旅游规划 · 第二版

入口：https://zbyloveyj.github.io/personal-growth-lab/academy/travel-plans/

34个省级地区，378个城市与旅行片区。各地区独立HTML指南位于`regions/`，包含景点看点、地方历史、食物与吃法、游览顺序、住宿片区、交通及行前提醒。部分相邻城市合并成一篇，具体覆盖以目录为准，不声称穷尽每个县市乡镇。

## 内容与生成

`data.json`为完整结构化内容；`catalog.js`为检索与清单使用的轻量目录；`data.js`保留旧接口兼容。`全国旅游攻略.md`为全文，`guides/`为分地区文字版。页面静态生成，禁用JS仍可通过目录和details阅读全部内容。

修改`data.json`与`images.json`后，在本目录运行`python build.py`可重新生成全部页面与文字攻略；仅需Python标准库。原城市name与顺序应保留，新增城市追加在末尾，以兼容已有清单。

`journal.css`和`journal.js`负责第二版视觉与交互。旧style.css/app.js/editorial.css留存兼容，但新页面不加载它们。旧#region-xx书签会导向新地区页。

## 个人计划

沿用`future-travel-plan-v1` localStorage键，旧城市条目的名称与索引顺序保留，可继续读取旧收藏。仅保存于浏览器，无跨设备自动同步。JSON导出、合并导入和个人Markdown下载均由浏览器完成。

## 摄影与参考

34张地区照片，另有25张城市细节照片。全部许可与原始来源在`sources.html`、`assets/CREDITS.md`。不含未经许可复制的商业旅行网站图片。编写日期2026-11-08，开放、预约、天气、交通、通行要求须行前核验。
