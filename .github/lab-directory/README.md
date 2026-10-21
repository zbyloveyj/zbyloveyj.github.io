# 科研候选库采集与人工补证维护

这里保存公开官方目录的采集方法和经人工核对的研究补充，供持续扩充长期导师／PI 候选库。收录不以当前招生或招聘为条件。范围、证据及隐私约定见 [LAB_DATABASE.md](../../personal-growth-lab/academy/LAB_DATABASE.md)。所有命令从**仓库根目录**运行，要求 Python 3.9 或更高版本；页面验证另需 Node.js，浏览器测试需 Playwright 与可用 Chromium。

采集脚本以自身所在目录定位文件，不依赖工作区绝对路径。缓存、来源 manifest、日志和地区候选均写入本目录，采集器不覆盖正式 `labs.json`。目录扩充器生成草稿；人工补证构建器必须使用固定版本的基线，二者职责不同。

## 当前版本与人工输入

`2026.10.21-global-v4` 有 **12,441 条候选记录**：保留 **2,663 个基线 ID**，新增 **9,778 条**，补充 **197 条已有记录**。三层证据为 `reviewed` 18 条、`research_profile` 727 条、`official_directory` 11,696 条。主机构在中国大陆的有 **3,078 条**；数量不等于独立实验室数量或排名。

| 文件／程序 | 职责 |
| --- | --- |
| `enrich_candidates.py` | 将已人工复核的研究输入合并进不可变基线，保留稳定 ID、标签、证据范围和来源元数据；这是编辑构建步骤，不是抓取器。 |
| `reviewed-additions-20261021-v4.json` | 本轮 9,995 条审阅输入；包含官方目录、个人研究简介、双语身份和已有记录补证，顺序保持身份依赖。 |
| `reviewed-provenance-20261021-v4.json` | 经整理的公共来源元数据，包括实际日期、读取方法、可用 hash 和读取限制；不含网页全文或本地缓存路径。 |
| `reviewed-expansion-report-20261021-v4.json` | 本次构建的数量、证据层级、身份合并、机构变更、国内覆盖与文件哈希报告。 |

`reviewed-identity-audit-20261021-v4.json` 保存已确认同人、已确认不同人及尚未获得同人证据的姓名碰撞；不按名字直接合并。上一版不带 `-v4` 的审阅文件继续保留为历史快照。

人工输入不会由抓取状态自动产生。资料未支持的维度留空，不凭机构声誉、共同作者关系或目录成员身份填满方法、疾病、资源和培养信息。`roleStatus`、`roleNote`、`profileScope`、`sharedGroup` 等边界说明须随条目保留。

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

亚太脚本的 `--output` 只接受本维护目录内的 JSON 路径，不能指向正式数据库或覆盖人工复核输入。

## 文件与职责

| 方法 | 默认候选输出 | 审计与缓存 |
| --- | --- | --- |
| `collect_north_america.py` | `north_america.json` | `north_america_sources.json`、`north_america_fetch_metadata.json`、同目录 HTML |
| `collect_europe.py` | `europe.json` | `europe-sources.json`、`europe-cache/` |
| `collect_asia_oceania.py` | `asia_oceania.json` | `asia_manifest.json`、`asia-source-dates.json`、`asia-sources/` |
| `enrich_asia_profiles.py` | 不直接写候选库 | `asia-profiles/`、`asia-profiles-log.json` |

`north_america_priority_additions.json` 保存六位逐人核对的补充记录；`north_america_research_evidence.json` 保存四位 PI 的研究方向证据。两份 JSON 是提交的人工输入，不是自动生成候选库。

`north_america_manual_review.py` 只重建 **2026-10-21** 的人工复核快照，不访问网络、不把日期改成运行当天。日常目录刷新无需运行它。真正复核这些人物后，应同步修改人工 JSON 和重建脚本中的事实、证据 URL、日期，避免之后重建时恢复旧内容。

## 生成目录扩充草稿

完成各地区采集后，从仓库根目录运行：

```bash
.github/lab-directory/.venv/bin/python .github/lab-directory/merge_candidates.py --baseline personal-growth-lab/academy/data/labs.json --output-dir /tmp/lab-candidates
```

合并器默认从脚本目录读取各地区候选，保留所有基线记录及 ID，并在 `--output-dir` 中生成草稿和差异报告；它拒绝将输出目录设为基线目录。**先审查 diff、来源与身份合并，再通过独立的审核／发布步骤纳入正式库；不要直接用草稿覆盖正式 `labs.json`。** 合并草稿也不默认提交。

## 重建本轮人工补证

**`enrich_candidates.py` 必须使用本轮不可变基线。绝不能反复拿已经合并的新 `labs.json` 重建同一批输入。** 否则新增／补证统计与历史可能偏移，机构变更也可能重复应用。未来新增批次应先固定新的基线版本，再记录各自输入和报告。

本轮基线 commit 为 **`11ce143583be8f9c3765c163817405e7d3f3096d`**。以下命令在能读取该 commit 的 Git checkout 根目录运行，把两份基线 JSON 提取到 `/tmp`，不会修改工作区正式数据。若本地缺少这段历史，先取得对应 commit，不能用当前线上库代替。

```bash
reviewed_base_commit=11ce143583be8f9c3765c163817405e7d3f3096d
reviewed_workdir="$(mktemp -d /tmp/lab-reviewed-20261021.XXXXXX)"
git show "${reviewed_base_commit}:personal-growth-lab/academy/data/labs.json" > "${reviewed_workdir}/base-labs.json"
git show "${reviewed_base_commit}:personal-growth-lab/academy/data/lab-sources.json" > "${reviewed_workdir}/base-sources.json"

.github/lab-directory/.venv/bin/python .github/lab-directory/enrich_candidates.py \
  --base "${reviewed_workdir}/base-labs.json" \
  --sources "${reviewed_workdir}/base-sources.json" \
  --batches .github/lab-directory/reviewed-additions-20261021-v4.json \
  --provenance .github/lab-directory/reviewed-provenance-20261021-v4.json \
  --output "${reviewed_workdir}/labs.json" \
  --manifest "${reviewed_workdir}/lab-sources.json" \
  --report "${reviewed_workdir}/reviewed-expansion-report-20261021-v4.json" \
  --edition 2026.10.21-global-v4 \
  --date 2026-10-21 \
  --compact-output \
  --compressed-output "${reviewed_workdir}/labs.json.gz"
```

生成报告应为 baseline 2,663、total 12,441、new 9,778、enriched 197。审查生成结果与正式数据的差异，确认所有基线 ID 保留，再纳入预期变更。`existingId` 或人工身份修正只用于已核实的同一人，不能凭相似姓名合并。`--date` 是版本日期，不能把旧来源或未复核内容改成新的事实核验日期。

生成器保留六轴 `facets`：研究方向、研究方法、疾病／健康问题、数据与实验模态、研究尺度、研究设计；以及七类 `assessmentEvidence`：研究问题、方法、代表成果、资源、转化、合作、培养。每项证据保留 URL 与核验日期。缺项继续为空；权重匹配只计算所选已知标签的覆盖，不是质量评分或录取预测。

生成器默认读取同目录 `institution-aliases.json`，也可通过 `--institution-aliases` 指定其他经过核对的映射。映射只统一筛选用的 `institutionKey`；具体院系、医院和共同任职的展示文字保持原样。独立研究所、医院与机构网络不因合作关系自动并入大学。国家／地区的同义写法同步规范化，避免筛选项重复。

## 日期、失败与复核边界

- 北美脚本保存抓取时间与内容 SHA256。匹配的缓存重新解析时保留原抓取日期；仅有缓存、没有匹配元数据时使用其文件修改时间，并标为 `original_cache_mtime`。这不是新的在线核验：搬移缓存时应保留元数据，不应把复制产生的文件时间当成原始抓取时间。
- 欧洲脚本使用缓存文件的 UTC 修改日期作为抓取日期。重新解析不改变该日期；复制或手改缓存会破坏这个时间依据，之后应通过 `--refresh` 重新抓取。抓取失败会记录来源错误；已有缓存可能继续使用并保留旧日期，缺失来源可能产生零条记录，必须检查 manifest。
- 亚太目录日期由成功抓取写入 `asia-source-dates.json`；缺少日期时拒绝用固定日期或当天日期代替。刷新中途失败可能留下部分较新的缓存，日期文件仅在整轮成功后提交：应修复并重跑 `--refresh`，不要将中途缓存视为完整新快照。Garvan 需要实际研究组数据载荷成功返回，单纯取得目录 HTML 不会刷新其记录日期。
- 亚太个人页核验另用 `fetchedAt` 和 SHA256；目录刷新不会更新旧个人页的核验日期。抓取日志中的错误需要复核；命令结束或退出码为零并不保证每个个人页都成功。
- 抓取日、解析日、人工内容核验日与机会核验日分开保留。重建不能把旧 cache 标成当天核验，不能用 HTTP 200 或 hash 变化代替研究事实复核。公共 provenance 保留必要来源信息；没有成功取得正文时不编造正文 hash。
- 官网 403、页面外壳、只能读取官方搜索索引或改用其他网页读取工具时，保留实际 `readMethod`／`retrievalMethod`、日期和限制。Oxford 五条 `official_individual_research_search_index` 不能改称全文复核。直接请求失败和其他方式读取成功可以同时记录，不能抹去失败历史。
- 北美源站请求或解析错误会中止运行；旧候选文件可能仍在。先检查日志和来源时间，再判断文件是否属于本次成功结果。
- 官网列入目录只支持成员／导师关联及可见研究方向，不证明排名、经费或当前招生。无招聘文字不排除长期候选；跨机构同名、双聘、转任、历史页面和共同 PI 必须按官方身份线索复核，不能靠名字或共用目录 URL 自动合并。
- 临床研究、产业、荣休、退休、访问和历史身份须明确记录，不能从目录成员资格推断独立博士指导权。共享组按人保留时标注共同组关系，不计作多个独立实验室。更新主单位需保留旧机构状态和变更依据，原单位申请／访问条款不能自动沿用。
- 分页数量及 DOM 规则反映编写时的官网结构。大幅增减、空结果、机构迁移和字段变化都应先复查；这些采集器不宣称完整覆盖全球团队。

## 个人笔记与自动巡检

个人收藏、阶段和笔记仅使用独立浏览器键 `growthlab.research-directory.notebook.v1`，不修改课程存储。专用 JSON 备份按稳定 ID 合并并保留较新的 `updatedAt`；公开分享链接与结果 CSV 不带私人笔记、收藏标记或准备阶段。维护数据、来源快照和提交不能包含用户导出的私人备份。

[每日巡检工作流](../workflows/lab-evidence-monitor.yml)在 UTC 22:17 运行。详细卡证据和目录优先检查，其余个人及研究证据来源按最早检查时间轮巡，每批额外最多 **96 个 URL**；批次日期不代表所有页面的当日核验。机器只记录读取状态、时间、hash 和变化提示，不自动推断招生，也不把 403 当成团队关闭。工作流仅提交公共 `lab-monitor.json`。

## 版本控制与本地检查

提交人工复核输入、经整理的公共 provenance 与扩充报告；早期两份北美人工 JSON 继续保留。生成候选、抓取日志、HTML 正文、缓存目录、环境目录和私人资料不作为默认提交内容。新增需发布的人工 JSON 应在 `.gitignore` 中列为明确例外，不要为发布快照取消全部缓存忽略规则。

只检查 Python 语法、不访问网络：

```bash
python3 -m py_compile .github/lab-directory/collect_north_america.py .github/lab-directory/north_america_manual_review.py .github/lab-directory/collect_europe.py .github/lab-directory/collect_asia_oceania.py .github/lab-directory/enrich_asia_profiles.py .github/lab-directory/merge_candidates.py .github/lab-directory/enrich_candidates.py
```

数据、模型、页面与原课程兼容验证：

```bash
python3 personal-growth-lab/academy/tools/test_labs.py
node --check personal-growth-lab/academy/assets/lab-model.js
node --check personal-growth-lab/academy/assets/labs.js
node personal-growth-lab/academy/tools/test_lab_model.cjs
node personal-growth-lab/academy/tools/test_labs_browser.cjs
node personal-growth-lab/academy/tools/check_workbook.cjs
```

`test_lab_model.cjs` 验证跨轴交集、缺失标签、权重覆盖、证据维度、备份格式及较新记录合并。浏览器测试验证真实筛选、比较、公开导出、私人笔记隔离、URL 状态与多尺寸布局。验证结果结合本次 diff 判断；没有重新读取来源时，不能把通过测试写成来源已重新核验。

本轮新增的 `test_enrich_candidates.py` 验证同名不同人、稳定ID校正、个人研究证据不被目录降级、同一URL同时用于研究和身份的分类、未来任职未知状态以及转任后机会重置。运行：`python .github/lab-directory/test_enrich_candidates.py`。
