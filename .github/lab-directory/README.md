# 官方实验室目录采集方法

这里保存公开官方目录的采集方法及少量人工复核事实，供后续扩充长期导师／PI 候选库。所有命令从**仓库根目录**运行，要求 Python 3.9 或更高版本。

采集脚本以自身所在目录定位文件，不依赖工作区的绝对路径。缓存、来源 manifest、抓取日志和各地区候选 JSON 均写入本目录；采集脚本不会读取或覆盖正式 `labs.json`。下面的合并器会读取正式库作为比较基线，但只在指定的草稿目录生成结果。

## 安装与首次采集

```bash
python3 -m venv .github/lab-directory/.venv
.github/lab-directory/.venv/bin/python -m pip install -r .github/lab-directory/requirements.txt
.github/lab-directory/.venv/bin/python .github/lab-directory/collect_north_america.py --refresh
.github/lab-directory/.venv/bin/python .github/lab-directory/collect_europe.py --refresh
.github/lab-directory/.venv/bin/python .github/lab-directory/collect_asia_oceania.py --refresh
```

`--refresh` 会实际访问公开官方网页。首次使用不附带 HTML 正文缓存；需要网络可用。各地区可以单独运行，网站改版或访问限制可能要求修正对应解析规则。

## 后续运行

- **重新抓取目录：**重新运行相应脚本并加 `--refresh`。
- **重新解析已有缓存：**省略 `--refresh`。北美及欧洲脚本仍会下载缺失的缓存；亚太脚本要求完整的现有缓存及日期文件，缺失时停止并提示刷新。
- **补充亚太个人研究页：**先生成 `asia_oceania.json`，运行下面两条命令。第一条实际下载选定的 HKUST／A*STAR GIS 研究者个人页；第二条从目录和个人页缓存重新生成候选结果。

```bash
.github/lab-directory/.venv/bin/python .github/lab-directory/enrich_asia_profiles.py
.github/lab-directory/.venv/bin/python .github/lab-directory/collect_asia_oceania.py
```

亚太脚本的 `--output` 只接受本维护目录内的 JSON 路径，不能指向正式数据库或覆盖下面两份人工复核文件。

## 文件与职责

| 方法 | 默认候选输出 | 审计与缓存 |
| --- | --- | --- |
| `collect_north_america.py` | `north_america.json` | `north_america_sources.json`、`north_america_fetch_metadata.json`、同目录 HTML |
| `collect_europe.py` | `europe.json` | `europe-sources.json`、`europe-cache/` |
| `collect_asia_oceania.py` | `asia_oceania.json` | `asia_manifest.json`、`asia-source-dates.json`、`asia-sources/` |
| `enrich_asia_profiles.py` | 不直接写候选库 | `asia-profiles/`、`asia-profiles-log.json` |

`north_america_priority_additions.json` 保存六位逐人核对的补充记录；`north_america_research_evidence.json` 保存四位 PI 的研究方向证据。两份 JSON 是提交的人工输入，不是自动生成候选库。

`north_america_manual_review.py` 只重建 **2026-10-21** 的人工复核快照，不访问网络、不把日期改成运行当天。日常目录刷新无需运行它。真正复核这些人物后，应同步修改人工 JSON 和重建脚本中的事实、证据 URL、日期，避免之后重建时恢复旧内容。

## 生成合并草稿

完成各地区采集后，从仓库根目录运行：

```bash
.github/lab-directory/.venv/bin/python .github/lab-directory/merge_candidates.py --baseline personal-growth-lab/academy/data/labs.json --output-dir /tmp/lab-candidates
```

合并器默认从脚本目录读取各地区候选，保留所有基线记录及 ID，并在 `--output-dir` 中生成草稿和差异报告；它拒绝将输出目录设为基线目录。**先审查 diff、来源与身份合并，再通过独立的审核／发布步骤纳入正式库；不要直接用草稿覆盖正式 `labs.json`。** 合并草稿也不默认提交。

## 日期、失败与复核边界

- 北美脚本保存抓取时间与内容 SHA256。匹配的缓存重新解析时保留原抓取日期；仅有缓存、没有匹配元数据时使用其文件修改时间，并标为 `original_cache_mtime`。这不是新的在线核验：搬移缓存时应保留元数据，不应把复制产生的文件时间当成原始抓取时间。
- 欧洲脚本使用缓存文件的 UTC 修改日期作为抓取日期。重新解析不改变该日期；复制或手改缓存会破坏这个时间依据，之后应通过 `--refresh` 重新抓取。抓取失败会记录来源错误；已有缓存可能继续使用并保留旧日期，缺失来源可能产生零条记录，必须检查 manifest。
- 亚太目录日期由成功抓取写入 `asia-source-dates.json`；缺少日期时拒绝用固定日期或当天日期代替。刷新中途失败可能留下部分较新的缓存，日期文件仅在整轮成功后提交：应修复并重跑 `--refresh`，不要将中途缓存视为完整新快照。Garvan 需要实际研究组数据载荷成功返回，单纯取得目录 HTML 不会刷新其记录日期。
- 亚太个人页核验另用 `fetchedAt` 和 SHA256；目录刷新不会更新旧个人页的核验日期。抓取日志中的错误需要复核；命令结束或退出码为零并不保证每个个人页都成功。
- 北美源站请求或解析错误会中止运行；旧候选文件可能仍在。先检查日志和来源时间，再判断文件是否属于本次成功结果。
- 官网列入目录只支持成员／导师关联及可见研究方向，不证明排名、经费或当前招生。无招聘文字不排除长期候选；跨机构同名、双聘、转任、历史页面和共同 PI 必须按官方身份线索复核，不能靠名字或共用目录 URL 自动合并。
- 分页数量及 DOM 规则反映编写时的官网结构。大幅增减、空结果、机构迁移和字段变化都应先复查；这些采集器不宣称完整覆盖全球团队。

## 版本控制与本地检查

`.gitignore` 默认忽略 HTML、缓存目录、候选 JSON、来源元数据和日志，仅保留两份人工复核 JSON。不要默认提交网页正文缓存、环境目录或任何私密资料。需要保存某次审计快照时，另行选择合适的归档位置。

只检查 Python 语法、不访问网络：

```bash
python3 -m py_compile .github/lab-directory/collect_north_america.py .github/lab-directory/north_america_manual_review.py .github/lab-directory/collect_europe.py .github/lab-directory/collect_asia_oceania.py .github/lab-directory/enrich_asia_profiles.py
```
