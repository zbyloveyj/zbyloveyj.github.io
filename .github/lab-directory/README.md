# 科研候选库采集与人工补证维护

这里保存公开官方目录的采集方法和经人工核对的研究补充，供持续扩充长期导师／PI 候选库。收录不以当前招生或招聘为条件。范围、证据及隐私约定见 [LAB_DATABASE.md](../../personal-growth-lab/academy/LAB_DATABASE.md)。所有命令从**仓库根目录**运行，要求 Python 3.9 或更高版本；页面验证另需 Node.js，浏览器测试需 Playwright 与可用 Chromium。

地区采集脚本以自身所在目录定位文件，不依赖工作区绝对路径；缓存、来源 manifest、日志和地区候选默认写入本目录。NIH 采集器使用显式指定的缓存与候选路径。采集器不覆盖正式数据，目录扩充器生成草稿；人工补证构建器必须使用固定版本的完整基线，二者职责不同。

## 当前版本：v7 与复核输入

`2026.10.21-mentor-v7` 有 **41,446 条候选记录**，为基线的 **3.32 倍**：保留全部 **12,491 个基线稳定 ID**，净增 **28,955 条**，补充 **1,160 条已有记录**。主机构／项目依托单位在中国大陆的有 **3,322 条**，记录涉及 **53 个国家／地区**。这些是候选条目和来源关联的统计，不等于已逐人确认的博士导师数、独立实验室数量或排名。

| `evidenceLevel` | 数量 | 支持的判断与边界 |
| --- | ---: | --- |
| `reviewed` | 18 | 保留原代表作、研究问题及适配卡；不能将原卡的能力衔接分组当作导师实力排名。 |
| `research_profile` | 932 | 已整理明确归属个人的研究资料，保留具体来源、读取方式和范围；不代表每人全部论文或培养资格均已复核。 |
| `official_directory` | 11,761 | 官方目录中的具名导师／研究人员及可见研究说明；目录身份不证明现任主聘、独立指导权或当前名额。 |
| `project_record` | 28,735 | 官方相关科研项目中的具名 PI、具体项目题目和来源；标签由项目标题与研究目标句自动提取，不等于逐人核验个人研究和导师资格。 |

除原详细卡外的记录仍使用 `tier: D`，表示未完成详细适配分析。四类证据与任职、研究方向、接收机会分开记录，不按资料条数推断科研质量。

| 文件／程序 | 职责 |
| --- | --- |
| `../../personal-growth-lab/academy/tools/integrate_mentor_expansion.py` | 将本轮个人资料、国科大选题目录及 NIH 项目候选合并进完整不可变基线，生成分片、来源清单与差异报告；这是编辑构建步骤，不是抓取器。支持 `.json.gz` 项目输入。 |
| `reviewed-profiles-20261021-v7.json` | 154 份个人研究补证及其来源、别名、六轴标签和证据范围。 |
| `reviewed-ucas-20261021-v7.json` | 已核对的国科大交叉学院导师选题库输入；培养项目关联不当作个人方法已逐项核验。 |
| `reviewed-project-input-20261021-v7.json.gz` | 相关 NIH 项目 PI 的可重建输入。保留集成器使用的身份、项目、标签及来源字段，去除不需公开的摘要正文。文件名中的 `reviewed` 表示本轮规则及抽样经过复核，不表示 29,569 人均已逐人精研。 |
| `reviewed-project-provenance-20261021-v7.json` | 113 个 API 分页的请求范围、实际读取日期及响应 hash；是来源核验附件，不是研究者任职证明，也不由集成器重新抓取。 |
| `reviewed-data-audit-20261021-v7.json` | 项目抽样、已确认身份合并、禁止跨来源自动合并的疑点及官方现任职务修正；通过 `--identity-review` 参与构建。 |
| `reviewed-expansion-report-20261021-v7.json` | 本次构建的数量、证据类型、身份处理、国家／地区、分片及体积报告。 |

文件名相同的输入、报告和脚本须以同一发布 commit 为准。`v4` 及更早的审阅文件保留为历史快照，不能作为本轮输入混用。人工输入不会由抓取状态自动产生；资料未支持的维度留空，不凭机构声誉、共同作者关系或目录成员身份填满方法、疾病、资源和培养信息。`roleStatus`、`roleNote`、`profileScope`、`sharedGroup` 等边界说明须随条目保留。

### 合并导航与完整分片

主导航合并为 **6 个主领域、42 个方向组**：微生物与微生态、组学与计算生物、脑科学与精神健康、脑机接口与生物医学工程、人工智能与数字医学、基础与转化生命科学。原始细分标签仍保留在搜索和详情中；跨学科候选可以同时属于多个主类，人数不能相加。方向组用于导航，不能反向生成未经来源支持的个人研究标签。

正式 `data/labs.json` 现为主清单，只内含原 18 张详细卡；其 `dataParts` 中的 **21 个版本分片**才补齐全库。主清单与分片的 gzip 数据合计约 **8.08 MB**。页面最多 4 个请求并行，每个文件支持 gzip → JSON 回退，并显示加载进度。全部分片的版本、数量、稳定 ID 和总数通过校验后才显示完整统计；任何分片失败均提示重试，不能把部分结果当作全库。

维护程序通过 `lab_data.py` 另校验 SHA256 和压缩前后的字节一致性。维护者读取、导出、比较或重建时必须载入全部分片，不能对主清单的 `labs` 数组直接计数，也不能把主清单单文件交给只支持完整库的旧合并器。

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

## NIH 项目候选采集与证据边界

[`expand_mentor_directories.py`](../../personal-growth-lab/academy/tools/expand_mentor_directories.py) 使用 [NIH RePORTER 官方 API](https://api.reporter.nih.gov/)；本轮查询 23 个研究院所、113 个分页，取得 51,741 条活跃科研项目记录，筛选后产生 **29,569 条 PI 候选**，再与原库合并。该数不是本轮净增数。新增来源明显偏向美国科研项目，不能据此宣称全球覆盖齐全、国家间覆盖均衡或未收录者不值得关注。

采集遵循以下规则：

- 只查询脚本白名单中的独立研究支持项目，要求官方 `is_active` 为真，项目结束日未早于快照日；排除 F/K/T 等培训、职业发展和奖学金项目，以及建设、设备、会议类项目。题目明确为行政或训练支持的记录继续排除。
- 具名 PI 还须在项目标题或实际研究目标句中明确命中相关主题。来源研究院名称、普通生命科学项目身份、共同作者和宽泛索引词不构成自动纳入依据；背景句、既往研究或假设的远期应用不能代替本项目研究目标。
- 明确的学生、博士后和支持人员身份不作为导师新增。项目申报职务可能过时；当前官网教授身份、独立 PI 身份及冠名／荣誉 Fellow 不能因模糊词匹配误删。缺少另行核验时保留 `roleStatus: unknown`，不推断博士指导权或招生资格。
- `institution` 和 `country` 来自项目依托单位。**项目依托单位不等于个人当前主聘单位或所在国家。** 联合 PI 尤其可能在其他机构任职；已有个人官网任职不能被项目单位覆盖。另有官方任职证据时单独保存来源和日期。
- 六轴标签来自自动规则，并以 `facetBasis`／`projectFacetBasis` 明示来源。规则区分双极细胞与双相障碍、病毒载体与微生物学、免疫荧光与免疫学、神经网络与脑科学、分子 AI 与临床医学 AI，以及单细胞基础模型与 AI 虚拟细胞。55 个不同完整项目摘要的独立抽样用于修正规则，不等于全库逐人复核或总体错误率估计。
- NIH 内部先以 `profile_id` 去重，再对有额外官方身份依据的 8 组多 ID 同人合并，全部原 ID 保存在 `nihProfileIds`。跨来源合并要求完整姓名与机构证据对应、无冲突，并应用复核名单；缺失中间名、共享项目或 first/last name 相同不能自动认定同一人。
- 每人最多展示 2 项代表项目，保留题目、项目 ID、年份、来源 URL 及读取信息。`projectsObserved` 只表示本轮匹配到的不同核心项目数，不表示该人的全部项目、经费或成果。项目关键词也不能单独当作个人专长核验。

采集器只使用 Python 标准库，请求启动间隔至少 1.1 秒，按院所分页并保存 gzip 原始响应及独立元数据。缺失缓存会请求官方 API；`--refresh` 会重新取得数据。下面的命令生成新的待复核候选，不能复刻已经过去的 API 状态：

```bash
nih_review_workdir="$(mktemp -d /tmp/lab-nih-review.XXXXXX)"
python3 personal-growth-lab/academy/tools/expand_mentor_directories.py \
  --cache "${nih_review_workdir}/cache" \
  --output "${nih_review_workdir}/candidates.json" \
  --as-of "$(date -u +%F)" \
  --refresh
```

重解析同一批完整缓存时省略 `--refresh`，使用对应快照日期，保留元数据中的真实读取时间。`--as-of` 用于快照和结束日筛选，不能把旧缓存改记为新的核验。输出的 `.sources.json` 记录真实请求及响应 hash；原始摘要和缓存留在本地审查，发布输入只保留集成器需要的字段。采集器拒绝将候选、缓存或紧凑输出写入正式 `academy/data/`。

## 生成目录扩充草稿

完成各地区采集后，先将当前已发布版本完整导出，再从仓库根目录生成独立草稿：

```bash
directory_review_workdir="$(mktemp -d /tmp/lab-directory-review.XXXXXX)"
python3 personal-growth-lab/academy/tools/lab_data.py \
  --input personal-growth-lab/academy/data/labs.json \
  --output "${directory_review_workdir}/baseline-complete.json"
.github/lab-directory/.venv/bin/python .github/lab-directory/merge_candidates.py \
  --baseline "${directory_review_workdir}/baseline-complete.json" \
  --output-dir "${directory_review_workdir}/draft"
```

合并器默认从脚本目录读取各地区候选，保留所有基线记录及 ID，并在 `--output-dir` 中生成草稿和差异报告；它拒绝将输出目录设为基线目录。**先审查 diff、来源与身份合并，再通过独立的审核／发布步骤纳入正式库；不要直接用草稿覆盖正式 `labs.json`。** 合并草稿也不默认提交。

## 从不可变基线重建 v7

**本轮基线 commit 为 `7d927ef44bc2558f468a60445d04f42fc38f2487`。** 不能反复用已经合并的 v7 重跑同一批输入，否则身份合并、新增／补证统计与历史会偏移。未来批次须先固定新的基线版本，再记录对应输入和报告。

以下命令从仓库根目录运行。先从指定 commit 提取**整个数据目录**，再使用 `lab_data.py` 生成完整独立基线，以兼容主清单／分片格式。临时构建目录保留 `data/` 层级，供加载器按清单解析相对路径。命令不会覆盖工作区正式数据；本地缺少该 commit 时应先取得对应 Git 历史，不能使用当前线上库代替。

```bash
reviewed_v7_base_commit=7d927ef44bc2558f468a60445d04f42fc38f2487
reviewed_v7_workdir="$(mktemp -d /tmp/lab-reviewed-v7.XXXXXX)"
git archive "${reviewed_v7_base_commit}" personal-growth-lab/academy/data \
  | tar -x -C "${reviewed_v7_workdir}"
python3 personal-growth-lab/academy/tools/lab_data.py \
  --input "${reviewed_v7_workdir}/personal-growth-lab/academy/data/labs.json" \
  --output "${reviewed_v7_workdir}/baseline-complete.json"

python3 personal-growth-lab/academy/tools/integrate_mentor_expansion.py \
  --baseline "${reviewed_v7_workdir}/baseline-complete.json" \
  --sources "${reviewed_v7_workdir}/personal-growth-lab/academy/data/lab-sources.json" \
  --profiles .github/lab-directory/reviewed-profiles-20261021-v7.json \
  --ucas .github/lab-directory/reviewed-ucas-20261021-v7.json \
  --nih .github/lab-directory/reviewed-project-input-20261021-v7.json.gz \
  --identity-review .github/lab-directory/reviewed-data-audit-20261021-v7.json \
  --output-dir "${reviewed_v7_workdir}/build/data" \
  --report "${reviewed_v7_workdir}/reviewed-expansion-report-20261021-v7.json"

python3 personal-growth-lab/academy/tools/lab_data.py \
  --input "${reviewed_v7_workdir}/build/data/labs.json" \
  --output "${reviewed_v7_workdir}/v7-complete.json"
```

重建预期为 baseline **12,491**、total **41,446**、new **28,955**、enriched **1,160**，以同一发布版本的 `reviewed-expansion-report-20261021-v7.json` 为准。比较新生成报告、全部稳定 ID、来源清单和分片，而不是只比较主清单中 18 条卡片。`reviewed-project-provenance-20261021-v7.json` 与审查报告提供核验依据，重建过程不重新联网，也不刷新来源核验日期。

## 历史版本：v4 人工补证重建

以下仅为 **`2026.10.21-global-v4` 历史快照**的复现方法，不是当前版本或 v7 基线。该版有 12,441 条候选：保留 2,663 个基线 ID，新增 9,778 条，补充 197 条已有记录；三类证据为 `reviewed` 18 条、`research_profile` 727 条、`official_directory` 11,696 条，中国大陆主机构记录 3,078 条。

历史 `enrich_candidates.py` 将 `reviewed-additions-20261021-v4.json` 中 9,995 条输入与固定基线合并，使用 `reviewed-provenance-20261021-v4.json` 的公共来源元数据，输出 `reviewed-expansion-report-20261021-v4.json`。`reviewed-identity-audit-20261021-v4.json` 保留已确认同人、已确认不同人及未解决的姓名碰撞。它们不因当前 v7 更新而自动成为新来源核验。

**v4 的历史基线 commit 是 `11ce143583be8f9c3765c163817405e7d3f3096d`，不是 v7 的基线。** 该历史 commit 中的数据为完整单文件，所以这里可以提取两份 JSON；当前分片格式不适用此简化方式。绝不能拿当前 `labs.json` 主清单或完整 v7 数据代替 v4 基线。

```bash
reviewed_v4_base_commit=11ce143583be8f9c3765c163817405e7d3f3096d
reviewed_v4_workdir="$(mktemp -d /tmp/lab-reviewed-v4.XXXXXX)"
git show "${reviewed_v4_base_commit}:personal-growth-lab/academy/data/labs.json" > "${reviewed_v4_workdir}/base-labs.json"
git show "${reviewed_v4_base_commit}:personal-growth-lab/academy/data/lab-sources.json" > "${reviewed_v4_workdir}/base-sources.json"

.github/lab-directory/.venv/bin/python .github/lab-directory/enrich_candidates.py \
  --base "${reviewed_v4_workdir}/base-labs.json" \
  --sources "${reviewed_v4_workdir}/base-sources.json" \
  --batches .github/lab-directory/reviewed-additions-20261021-v4.json \
  --provenance .github/lab-directory/reviewed-provenance-20261021-v4.json \
  --output "${reviewed_v4_workdir}/labs.json" \
  --manifest "${reviewed_v4_workdir}/lab-sources.json" \
  --report "${reviewed_v4_workdir}/reviewed-expansion-report-20261021-v4.json" \
  --edition 2026.10.21-global-v4 \
  --date 2026-10-21 \
  --compact-output \
  --compressed-output "${reviewed_v4_workdir}/labs.json.gz"
```

历史报告应为 baseline 2,663、total 12,441、new 9,778、enriched 197；只与对应 v4 快照比较，不与当前正式库的条数混用。`existingId` 或人工身份修正只用于已核实的同一人，不能凭相似姓名合并。`--date` 是版本日期，不能把旧来源或未复核内容改成新的事实核验日期。

## 结构化证据与机构规范

生成器保留六轴 `facets`：研究方向、研究方法、疾病／健康问题、数据与实验模态、研究尺度、研究设计；以及七类 `assessmentEvidence`：研究问题、方法、代表成果、资源、转化、合作、培养。每项证据保留 URL 与核验日期。缺项继续为空；权重匹配只计算所选已知标签的覆盖，不是质量评分或录取预测。

历史 `enrich_candidates.py` 默认读取同目录 `institution-aliases.json`，也可通过 `--institution-aliases` 指定其他经过核对的映射。映射只统一筛选用的 `institutionKey`；具体院系、医院和共同任职的展示文字保持原样。独立研究所、医院与机构网络不因合作关系自动并入大学。国家／地区的同义写法同步规范化，避免筛选项重复。v7 集成器保留这些既有身份与稳定 ID，新增项目机构规范化只用于严格的身份候选匹配，不替代官方任职证据。

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

个人收藏、阶段和笔记仅使用独立浏览器键 `growthlab.research-directory.notebook.v1`，不修改课程存储。专用 JSON 备份支持最多 **100,000 条**记录及 **64 MiB** 导入文件；按稳定 ID 合并并保留较新的 `updatedAt`，相同时间采用导入项。导入后的合并总数同样不能超过 100,000 条。旧稳定 ID、收藏和笔记保持兼容，浏览器存储不可用时提示导出。公开分享链接与结果 CSV 不带私人笔记、收藏标记或准备阶段。维护数据、来源快照和提交不能包含用户导出的私人备份。

[每日巡检工作流](../workflows/lab-evidence-monitor.yml)在 UTC 22:17 运行。巡检器通过完整库加载器读取主清单与所有分片。详细卡证据和目录优先检查，其余个人及科研项目证据来源按最早检查时间轮巡，每批额外最多 **96 个 URL**；批次日期不代表所有页面的当日核验。

NIH RePORTER 项目页是动态页面，巡检器从 URL 提取项目 ID，调用官方 `https://api.reporter.nih.gov/v2/projects/search` 核对对应记录，并以至少 1.1 秒的请求启动间隔读取。只有返回的具体项目 ID 与请求一致才记录成功；不能把 JavaScript 页面空壳当作有效研究内容基线。项目内容 hash 用于发现变化，不自动确认现任职务、博士指导资格或接收机会。

机器只记录读取状态、时间、hash 和有界错误；不公开网页或摘要缓存，不自动推断招生，也不把 403 当成团队关闭。首次成功建立机器基线，内容变化在人工复核前保留提示。工作流仅提交公共 `lab-monitor.json`；浏览器在站点副本和公开 GitHub raw feed 间选择最新批次，避免监测 commit 未触发 Pages 时展示过期巡检状态。它不会更新候选库或自动发布抓取草稿。

## 版本控制与本地检查

提交人工复核输入、经整理的公共 provenance 与扩充报告；早期两份北美人工 JSON 继续保留。生成候选、抓取日志、HTML／摘要正文、缓存目录、环境目录和私人资料不作为默认提交内容。新增需发布的 JSON 或 `.json.gz` 审阅输入应在 `.gitignore` 中列为明确例外，不要为发布快照取消全部缓存忽略规则。正式发布必须包含匹配版本的主清单、所有分片及其 gzip 副本、来源清单；不能只更新主清单或保留不一致的压缩副本。

只检查 Python 语法、不访问网络：

```bash
python3 -m py_compile .github/lab-directory/collect_north_america.py .github/lab-directory/north_america_manual_review.py .github/lab-directory/collect_europe.py .github/lab-directory/collect_asia_oceania.py .github/lab-directory/enrich_asia_profiles.py .github/lab-directory/merge_candidates.py .github/lab-directory/enrich_candidates.py personal-growth-lab/academy/tools/expand_mentor_directories.py personal-growth-lab/academy/tools/integrate_mentor_expansion.py personal-growth-lab/academy/tools/lab_data.py personal-growth-lab/academy/tools/monitor_labs.py
```

数据、模型、页面与原课程兼容验证：

```bash
python3 personal-growth-lab/academy/tools/lab_data.py
python3 personal-growth-lab/academy/tools/test_labs.py
node --check personal-growth-lab/academy/assets/lab-model.js
node --check personal-growth-lab/academy/assets/lab-discovery.js
node --check personal-growth-lab/academy/assets/labs.js
node personal-growth-lab/academy/tools/test_lab_model.cjs
node personal-growth-lab/academy/tools/test_lab_discovery.cjs
node personal-growth-lab/academy/tools/test_labs_browser.cjs
node personal-growth-lab/academy/tools/test_labs_workspace.cjs
node personal-growth-lab/academy/tools/check_workbook.cjs
```

`lab_data.py` 检查完整分片库和压缩副本。`test_lab_model.cjs` 验证跨轴交集、缺失标签、权重覆盖、证据维度、备份格式及较新记录合并。`test_lab_discovery.cjs` 检查合并导航、来源类型和研究说明；浏览器测试验证完整数据加载、真实筛选、比较、公开导出、私人笔记隔离、URL 状态与多尺寸布局。验证结果结合本次 diff 判断；没有重新读取来源时，不能把通过测试写成来源已重新核验。

保留的 `test_enrich_candidates.py` 验证同名不同人、稳定 ID 校正、个人研究证据不被目录降级、同一 URL 同时用于研究和身份的分类、未来任职未知状态以及转任后机会重置。运行：`python3 .github/lab-directory/test_enrich_candidates.py`。
