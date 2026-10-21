# 投稿期刊导航

一个放在成长学院内的中文静态选刊网站，用于跨学科发现期刊、比较可核验指标，并管理个人投稿清单。入口为 `academy/journals/index.html`，不需要运行应用后端。

首次构建以 **70,419 个去重期刊候选**为基础，另有 **49 本重点期刊的人工核验资料**。基础候选、已匹配的指标、费用、周期等覆盖范围各不相同；当前数量、快照日期和覆盖情况以页面及 `data/catalog-meta.json` 的实际内容为准。

## 可以做什么

- 按刊名、ISSN、研究主题、学科、出版社和国家发现期刊，并结合已有的分区、影响因子、开放获取、费用与周期数据缩小范围。
- 查看 JIF 年度变化、OpenAlex 年度收录文献量、学科分区、数据库收录、投稿指南、费用、评审阶段和公开投稿统计。
- 并列比较期刊，将目标刊加入个人清单，记录投稿状态、稿件名称和笔记。
- 导出检索结果或投稿清单，复制检索链接，保存和恢复个人 JSON 备份。
- 在本浏览器导入个人有权使用的 JCR、CAS 或 SJR 记录；个人记录带独立标记，不写入共享目录。

候选目录的作用是帮助发现和核对期刊。期刊是否仍在征稿、是否接受特定文章类型，以及具体研究是否符合范围，仍需查看对应出版社的最新作者指南。

## 数据来源

| 组件 | 来源 | 本项目的处理 |
| --- | --- | --- |
| 基础期刊身份、ISSN、主题、年度文献记录 | [OpenAlex](https://help.openalex.org/data/how-its-built/)、[公开 sources 快照清单](https://openalex.s3.amazonaws.com/data/jsonl/sources/manifest.json) | 选择有 ISSN、近期有索引出版记录、达到最低累计记录量的 journal 来源；共享 ISSN 的来源身份去重，文献数量不相加。 |
| OA 期刊的费用、语言、评审模式、平均投稿至出版时间及作者指南 | [DOAJ 公开 CSV](https://doaj.org/csv)、[导出说明](https://doaj.org/docs/journal-csv) | 规范化出版社在 DOAJ 中申报的资料，保留 DOAJ 记录链接、快照日期和逐条更新时间。 |
| JIF 年度值 | [NIIC 公开机构汇编](https://www.niic.nsc.ru/phocadownload/publications/2025/JCR_JournalImpactFactor_2026.pdf)，以及各期刊出版社页面 | 机构表是转录来源；重点期刊另与出版社核验，保留年份转换、数值差异和来源。 |
| JCR 学科分区、对应版本的 WoS 收录 | [UEFISCDI 期刊评价页面](https://uefiscdi.gov.ro/scientometrie-reviste-0)、[JCR 2025 指标年／2026 年发布表](https://uefiscdi.gov.ro/resource-832709-JCR-2025.iunie-2026.site.pdf) | 按期刊、学科和年份保存 JIF Quartile；不把同表的 AIS Quartile 当作 JIF 分区。 |
| CAS 历史参考分区 | [西北农林科技大学公开附件所在通知](https://ylxy.nwafu.edu.cn/tzgg/8192f9eaa0af46fe9015a5050ccc0fdc.htm) | 保存 2025 版参考表的刊名、分区和 TOP 标记。源表没有 ISSN，也未注明大类／小类，仅采用唯一规范化刊名匹配。 |
| 重点期刊的范围、周期、录用率和真实稿件量 | `data/publisher-evidence.json` 或其 `.gz` 版本中的逐项官方链接 | 使用出版社页面、出版社年报、NLM 等明确证据；每项保留统计口径和核验日期。 |

`data/metric-evidence.json` 或其 `.gz` 版本保留机构来源和导入证据。`data/enrichment-audit.json` 记录匹配、未匹配、身份歧义和出版社与机构值的差异。数据许可按组件说明，见 [LICENSE-DATA.md](LICENSE-DATA.md)。

### 基础目录的覆盖范围

`refresh_catalog.py` 的默认条件为：OpenAlex 来源类型为 `journal`，有 ISSN，最近出版年不早于 2023，累计收录记录不少于 100。参数可以调整，实际条件写入元数据。

这一条件会遗漏部分新刊、小刊、缺少 ISSN 或近期记录的刊物。近期存在索引记录也不能证明期刊当前接受投稿。OpenAlex 的学科和主题来自文献分类，用于发现研究方向，不能替代 JCR 学科或出版社的 aims & scope。

## 指标要连同口径一起读

### 年份和缺失值

JIF 的**统计年度**、JCR 的**发布年度**、年报所属年度、网页发布日期以及本项目核验日期分别保存。例如本批机构表中，发布列 `JIF 2026` 对应 2025 统计年度，`JIF 2025` 对应 2024 统计年度。年度转换需要来源交叉核对，不能仅凭 PDF 文件名、年报标题或页面访问日期决定。

出版社年报有时使用发布年份称呼 JIF。已核验的特殊记录保留原文标签及年度解释；数值存在来源差异时保留差异说明，不编造差值原因。出版社当前页面没有写出统计年份的数值，也不能只凭“当前页面”就自动赋年。

未公开、未核验、未匹配、未知和零是不同状态。缺失数据保持为空；`<0.1` 一类区间表述保留原文，不转成精确数值参与排序或绘图。JIF 曲线只连接相邻且有数值的年份，不插补缺失年份，也不使用其他被引指标代替 JIF。

### 年发文量、投稿量和录用率

| 字段 | 含义 | 比较时需要保留的区别 |
| --- | --- | --- |
| OpenAlex 年度文献量 | 数据库按出版年收录的文献记录数 | 受索引覆盖、文献类型和记录归并影响；不是出版社统计的研究论文篇数。当前年度未结束时，不能视为全年产出。 |
| 出版社年度发文量 | 出版社明确披露的全年发表数量 | 保留“全部文章”“研究稿件”等文章类型定义。 |
| 收到稿件数 | 出版社披露的投稿稿件量 | 同一作者可能多次投稿，因此不等于独立投稿人数。 |
| 录用率 | 出版社披露的特定统计范围的比例 | 总体录用率和研究稿件录用率可能有不同分母；不倒推未公开的投稿量。 |
| 独立投稿人数 | 去重后的投稿者人数 | 只有明确披露该定义时才采用，不从稿件量、访问量或作者数量推算。 |

DOAJ 的 `Number of Article Records` 是该目录中的文章元数据记录数量。本项目没有将它用作年度发文量。

### 周期不是一个统一的数字

初审后决定、经过外审的首次决定、审稿人周转、投稿至接受、接受至出版、投稿至出版是不同阶段。首次决定可能包含编辑直接退稿；最终决定也可能是拒稿，不能解释为录用。每项周期同时保存阶段、天／周、平均值或中位数，以及来源给出的统计期间。

DOAJ 字段是 **Average number of weeks between article submission and publication**，表示出版社申报的平均投稿至出版周数。它没有在 CSV 中统一提供统计年度或计算方法，所以保存为 `publisher_reported_average`、`period: null`。展示时即使换算为天，也只是周乘以七的单位转换，不能用于“首次决定”筛选。较新的出版社年报与较旧的 DOAJ 记录可同时保留各自口径。

### 分区与收录

JCR 按统计年度和 WoS 学科分别记录，同一本刊可能同时有多个学科分区。选学科和选分区时需要命中同一条学科记录。JCR、CAS 和 SJR 是不同体系，不互相换算。

本库的 **CAS 为 2025 历史参考版，学科层级未注明**。详情保留 `level: unspecified`，不会补写“大类一区”或“小类一区”。没有 ISSN 的历史源表采用唯一刊名匹配，无法唯一匹配的条目保留在审计记录中。[中国科学院文献情报中心 2026 年声明](https://www.las.cas.cn/news/tzgg/202603/t20260327_8178738.html)说明自 2026 年起不再更新与发布原期刊分区表；其他机构的评价体系需使用各自名称。

**公共目录未提供 SJR 全库分区。** SJR 仅作为个人 CSV 导入的体系选项，在当前浏览器保存和标注。

SCIE、SSCI、ESCI、AHCI 分开显示。有 JIF 不能直接推出 SCIE 收录；PubMed、MEDLINE、PubMed Central 也分别核验。机构表中的收录状态属于对应版本快照，需要实时确认时可查 [Clarivate Master Journal List](https://mjl.clarivate.com/) 或 [NLM Catalog](https://www.ncbi.nlm.nih.gov/nlmcatalog/)。

### 费用和开放获取

APC 保留原金额、币种、信息页面及记录日期；多币种价格不相加，也不自动兑换。价格记录不保证所有文章类型、税项、减免条件或机构协议下的最终应付金额相同。

“无 APC”与“无其他费用”分别保存，只有两项都明确为 No 才标为申报无作者费用。费用未知不当作免费；OA 标记也不等于免费投稿。DOAJ 的逐条更新时间可能早于整体快照日期，费用和周期详情需同时显示这些日期。

## 个人数据和分享

收藏、稿件名称、笔记、投稿状态、筛选方案及个人导入指标写入当前浏览器的 `localStorage`。本模块没有上传这些个人字段的服务端接口，也不会把个人导入写回公共数据文件。不同设备、浏览器或站点域名不会自动同步；清理站点数据会影响本地记录，可以使用页面内的 JSON 备份与恢复功能。

页面仍会请求公开静态目录资源，打开出版社或数据库链接时也会访问相应网站。复制检索链接会将检索条件放入 URL，分享该链接即分享这些条件；个人笔记和稿件清单通过专门的导出／备份文件保存。

个人指标 CSV 表头如下：

```csv
ISSN,year,system,category,quartile,impact_factor,source
```

`system` 使用 `JCR`、`CAS` 或 `SJR`，`year` 必填，按 ISSN 匹配。CAS 的大类／小类需要在个人数据的 `category` 中明确注明。`impact_factor` 仅用于 JCR，未知留空。页面提供空白模板和导入结果提示。

## 本地运行与发布文件

从仓库根目录启动本地静态服务：

```bash
python -m http.server 8000 --bind 127.0.0.1
```

然后打开 `http://127.0.0.1:8000/academy/journals/`。使用 HTTP 服务可让浏览器正常请求目录文件；不以双击 `file://` 页面的方式验证数据加载。

发布版先加载轻量 `data/featured.json`，随后在后台读取 `data/catalog.json.gz`；打开期刊详情时按需读取 `data/details/*.json.gz`。精选预览是加载阶段的代表性样本，不代表全库筛选结果，也不是质量排名。

**发布包仅提供 gzip 格式的完整目录和详情分片。** `featured.json`、轻量元数据与清单保留明文，证据数据可使用 `.json.gz`。浏览器需支持 `fetch`、Streams 和 `DecompressionStream('gzip')`；不支持该能力时不能依赖未发布的完整原始 JSON 回退。构建目录里可能仍有未压缩的中间文件，它们不属于要发布的完整数据副本。

`index-manifest.json` 记录压缩路径、字节数和校验值。gzip 使用固定时间戳及空存储文件名，便于对同一输入进行可重复打包。部署应同时更新目录、详情、元数据、清单和证据版本，避免旧新分片混用。

## 可复现的手动更新流程

工具使用 Python 3 标准库，本次构建环境为 Python 3.12。以下命令从 `academy/journals/` 目录运行。建议在独立工作副本完成生成和验证，再发布结果。

### 1. 准备已核验的指标证据

流水线使用当前项目保留的 `metric-evidence` 和 `publisher-evidence`。如果 checkout 只保留它们的压缩版本，可以先恢复构建用的 JSON：

```bash
python - <<'PY'
import gzip
from pathlib import Path

for name in ("metric-evidence.json", "publisher-evidence.json"):
    target = Path("data") / name
    packed = target.with_suffix(target.suffix + ".gz")
    if not target.exists() and packed.exists():
        target.write_bytes(gzip.decompress(packed.read_bytes()))
PY
```

这一步恢复本地构建输入，不要求将未压缩证据或完整目录发布。已有明文文件不会被覆盖；要切换证据版本时先确认明文与压缩件来自同一版本。

### 2. 刷新目录、规范化 DOAJ、合并、打包、验证

```bash
JOURNAL_CACHE="${TMPDIR:-/tmp}/growth-journal-cache"
JOURNAL_CHECKED_AT="$(date -u +%F)"
mkdir -p "$JOURNAL_CACHE"

python tools/refresh_catalog.py \
  --cache-dir "$JOURNAL_CACHE/openalex" \
  --checked-at "$JOURNAL_CHECKED_AT"

python tools/normalize_doaj.py \
  --download \
  --csv "$JOURNAL_CACHE/doaj.csv" \
  --output "$JOURNAL_CACHE/doaj-enrichment.json" \
  --checked-at "$JOURNAL_CHECKED_AT"

python tools/apply_enrichment.py \
  --doaj "$JOURNAL_CACHE/doaj-enrichment.json"

python tools/pack_catalog.py
python tools/validate_catalog.py
```

默认的 OpenAlex 刷新使用匿名公开 sources 快照，不下载完整 works 数据库。缓存可用于断点续取；缓存完整时可给 `refresh_catalog.py` 添加 `--offline` 重建。API 游标模式是可选项，使用者自行提供 `OPENALEX_API_KEY`；默认快照流程不需要设置该密钥。

DOAJ 下载只使用公开 CSV 入口，不登录、不使用 Premium API。下载器会记录源文件 SHA256、字节数和 HTTP `Last-Modified`，并将无签名下载信息保存为 CSV 旁的 `.download.json`。公开入口可能重定向到短期下载地址，脚本不会把带签名的重定向 URL 写进输出或日志。

下载日期、导出快照日期和逐条更新时间分别保存。离线规范化可直接使用已有 CSV：

```bash
python tools/normalize_doaj.py \
  --csv "$JOURNAL_CACHE/doaj.csv" \
  --output "$JOURNAL_CACHE/doaj-enrichment.json" \
  --checked-at "$JOURNAL_CHECKED_AT"
```

脚本仅在旁车的 SHA256 与输入 CSV 相符时恢复快照日期。已从官方页面核实导出日期时，也可传入 `--snapshot-at YYYY-MM-DD` 或带时区的 ISO 时间戳；没有证据时保留 `null`，不使用本地文件修改时间替代。输出在整份 CSV 验证通过后原子替换，解析失败不会写出部分规范化结果。

### 3. 审查后发布

这条流水线刷新 OpenAlex 和 DOAJ，并重新应用**已有的核验指标证据**。它不会自动重新审核全部出版社页面，也不会自动获取新的 JCR、CAS 或 SJR 版本。需要新指标版本时，先更新证据及来源、统计年度、发布年度和匹配说明，再重新合并、打包和验证。

发布前查看 `enrichment-audit.json` 和校验工具结果，处理身份冲突及来源差异，并确认页面显示的覆盖数量来自最新元数据。保留缺失与未匹配状态，不以模糊刊名或近似数值强行补齐。原始 DOAJ 整表只作为构建缓存，网站使用规范化后匹配到具体期刊的字段。

本模块没有建立定时刷新任务；上述更新由维护者手动执行。数据更新时间与许可条款核验时间分别记录，刷新 CSV 不会自动重新核验未来变更的来源条款。
