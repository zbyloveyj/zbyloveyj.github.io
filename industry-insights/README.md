# 行业规律洞察

公开页面：https://zbyloveyj.github.io/industry-insights/ 。现有学术主页、个人成长实验室和成长学院均提供入口。原站仍通过既有 GitHub Pages 发布，不另建站点。

## 每周观察的范围

沿“国际巨头研发、前沿技术、资本流向”三条主线研究公开材料。长期清单包括 AI 虚拟细胞、类器官/器官芯片、人源细胞与科研工具、药物发现、合成生物、智能体、机器人、交通、半导体、能源、量子、医疗器械、商业航天及农业资源技术；不局限于 AI。

每次优先研究最近结束的周一至周日，UTC+8。正文以连贯中文解释“发生了什么—为什么值得关注—下一步核查什么”。所有分析都明确标为观察判断，通过 `evidenceIds` 链接至收录事件。没有可信事件的领域允许留空，不用旧闻或融资传闻填满配额。

## 自动更新

每周一上午由用户授权的定时研究任务检索、核验并更新此仓库。实际任务 ID 和启用状态保存在 `data/update-status.json`；只有任务工具确认创建成功后才标为启用。任务不依赖访客打开网页，不需要用户在网页填写 API key。调度可能排队；页面根据数据日期对超过10天未更新的最新报告显示提示。

更新流程：

1. 读取本说明、最近数期 JSON 及 `watchlist.json`，检索上周的企业研发公告、论文、资助与资本行动。优先一手公开材料；报道可以作为发现线索，事实应尽量落至公司、投资方、交易所或政府原文。
2. 按主体、事件和原始公告日期去重。核验发布日期、事件日期、金额、币种、资金类型和状态。事件日期未知时填 `null`，月份精度仅保留 `YYYY-MM`。转载日期不替换原始事件日期。
3. 生成新的 `data/latest.json`，保留既有结构。`schemaVersion` 为1；`issue` 以报告结束日的 ISO 周号开头，例如 `2026-W45`。`generatedAt` 是实际运行的带时区时间，不能预填未来时间。
4. 执行 `python3 industry-insights/tools/build_snapshot.py`，生成周报存档 JSON、可直接阅读/打印的 `latest.html` 和 `reports/YYYY-Www.html`，并更新 `archive.json`。该步骤可重复执行；旧期存档不删除。
5. 执行 `python3 industry-insights/tools/validate.py`；确认通过后只提交本目录的必要变更至 `zbyloveyj/zbyloveyj.github.io` 的 `main`。检查最新分支，使用非强制更新/预期 SHA 防止覆盖他人提交。保留其他网页、课程和学习记录。
6. 检查 Pages 发布结果或线上 JSON 与周报内容。分别报告“已生成、已提交、已上线”的实际状态。如网络、来源、授权或发布失败，应保留上一期可用内容并报告阻塞，不能把计划写成成功。未来运行无需再次请求对已授权范围的常规更新确认。

本目录不包含网页端直接调用大模型的密钥或收费服务。

## 数据与资本口径

`data/latest.json`：报告日期、覆盖范围、3条有证据的综合观察和事件。每个事件包含 `id,title,organizations,region,tracks,sectors,kind,window,publishedDate,eventDate,verifiedDate,evidence,fact,insight,nextCheck,sources`。

- `tracks`：`giants`、`frontier`、`capital`，可同时出现。
- `window`：`week` 仅限报告期内首次发布的新消息；此前事件、重新报道的旧交易或原已启动项目放 `context` 并解释。不能把核验日当作事件日。
- `sources`：`label`、`url`，使用真实的 HTTPS 原文链接；事实描述不复制长篇原文。
- 资本事件增加 `finance`，包含展示金额、计算口径、轮次与状态、参与方、用途和 `legs`。每条资金腿包含 `type,currency,amount,status`。金额未披露使用 `null`，不得填0或估算。
- `kind`/资金类型分别使用 `equity`（公司融资）、`grant`（非稀释资助）、`program`（多方项目预算）、`fundraise`（基金募资）、`acquisition`（并购）、`capex`（资本开支）、`contract`（订单）、`earnings`（财报）。复合来源可用 `mixed`，资金腿仍逐项分开。
- 本轮和累计融资、估值和到账金额、意向与完成、授权首付款和最高里程碑、季度已支出和全年计划均分开记录。不将基金募资当作已投企业资金；不将项目总预算当作单家公司融资。
- 不跨币种、跨类型相加。不把样本收录数量称作全行业热度或资本份额。只有积累了覆盖边界明确、口径一致的历史样本后，才报告变化趋势；单期没有趋势数据就明确说明。

## 维护与质量检查

```bash
python3 industry-insights/tools/build_snapshot.py
python3 industry-insights/tools/validate.py
```

页面支持主线、领域、关键词、时间范围筛选、往期切换、来源跳转与 JSON 下载。筛选在本地浏览器执行，无追踪。`latest.html` 和每期 HTML 无需 JavaScript 即可阅读，JSON 获取失败时仍提供周报入口。

`data/watchlist.json` 是长期领域与公开信息源清单，不代表每个公司本周都有更新。AI VC 在该页面按 AI Virtual Cell（AI虚拟细胞）作为专门方向；风险投资 VC 属于资本主线。
