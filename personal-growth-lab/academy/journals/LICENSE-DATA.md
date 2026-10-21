# 数据来源与分组件许可说明

核验日期：2026-10-21。

本模块组合了不同来源的数据。**OpenAlex 和 DOAJ 的元数据许可不延伸为其他指标组件的统一许可。** `catalog`、详情分片及证据文件即使组合或压缩为一个文件，也需要按其来源字段区分组件。程序代码的许可与本说明分开，以仓库自身声明为准。

## OpenAlex 基础元数据

- 提供方：OpenAlex / OurResearch。
- 使用内容：期刊来源身份、ISSN、出版方、国家代码、主题分类、开放获取标记、年度收录文献量等基础元数据。
- 官方许可说明：[How it's built — Share](https://help.openalex.org/data/how-its-built/)。该说明将 OpenAlex 数据作为 CC0 提供。
- 许可链接：[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)。
- 快照来源：[OpenAlex public sources manifest](https://openalex.s3.amazonaws.com/data/jsonl/sources/manifest.json)。

项目保留 OpenAlex 来源链接、来源编号、快照日期和核验日期，并标明字段规范化与共享 ISSN 的身份去重。显示的年度数量是索引记录数；身份去重不把别名来源的文献数量相加。

建议保留的来源署名：

> 基础期刊元数据来自 OpenAlex / OurResearch（CC0）；快照及核验日期见当前目录元数据。本项目进行了字段规范化和期刊身份去重。

## DOAJ 期刊级元数据

- 提供方：Directory of Open Access Journals（DOAJ）。
- 使用内容：公开 journal CSV 中的费用、语言、评审模式、申报平均投稿至出版时间、作者指南及范围链接、文章许可类型等期刊级元数据。
- 官方许可说明：[DOAJ Terms and conditions — Metadata](https://doaj.org/terms/)，本次核验的条款版本为 1.6（2025-12-08）。该部分明确将 journal-level metadata 作为 CC0 提供，并列出 journal CSV 作为获取方式。
- 许可链接：[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)。
- 获取方式：[公开 CSV](https://doaj.org/csv)及[导出说明](https://doaj.org/docs/journal-csv)。

2020 年历史公告曾描述不同的期刊元数据许可。本项目按上述当前 Metadata 条款记录为 CC0，并单独保留 `licenseReviewedAt`。DOAJ 网站页脚的网页内容许可、博客许可与期刊元数据许可分别适用，不据页脚替换专门的元数据条款。

各期刊记录中的 `licenses`、`licenseTermsUrl` 描述期刊文章或内容的许可。这些字段不表示整份元数据集采用某一期刊文章的 CC BY、CC BY-NC 等许可，也不表示本项目获得了期刊文章全文的对应使用范围。

建议保留的来源署名：

> 期刊扩展元数据来自 Directory of Open Access Journals（DOAJ，CC0）；公开 CSV 快照及下载核验日期见元数据。记录经过规范化，DOAJ 链接和逐条更新时间已保留。

规范化保留原币种和原始费用表述，将多值字段拆成数组。用于页面显示的天数如来自 DOAJ 周数，会保留原周数和“投稿至出版的申报平均值”口径。源记录冲突与未知值不据此变为已核验的当前事实。

## JIF、JCR、CAS 及官方页面指标

这些组件按逐项来源记录，本项目**没有为它们声明 CC0、CC BY 或其他统一开放数据许可**。这里记录的是来源和项目处理方式，不对原始附件、网页正文或整个第三方数据库另作授权声明。

| 组件 | 来源及项目记录 |
| --- | --- |
| JIF 机构汇编 | [NIIC 公开表](https://www.niic.nsc.ru/phocadownload/publications/2025/JCR_JournalImpactFactor_2026.pdf)；保留来源、发布列与统计年度的对应、页码和原始值。 |
| JCR 学科分区及版本内收录 | [UEFISCDI 来源页面](https://uefiscdi.gov.ro/scientometrie-reviste-0)及其公开附件；逐条保留学科、JIF 分区、索引、年份和来源。 |
| CAS 2025 历史参考 | [西北农林科技大学来源通知](https://ylxy.nwafu.edu.cn/tzgg/8192f9eaa0af46fe9015a5050ccc0fdc.htm)及附件；保留刊名匹配方法、原始分区、TOP 标记与“学科层级未注明”的限制。 |
| 出版社和官方数据库核验 | `publisher-evidence.json` 或其 `.gz` 版本的逐项链接，包括出版社作者页面、期刊年报、NLM 等；保留数值、口径、来源日期和核验日期。 |

当前目录的组合许可标记为 `Component-specific; see data sources`。需要复用某一组件时，应同时查看其来源页面说明、对应指标年份和本项目的转换记录；公开可访问这一事实不被写成统一许可证。

本项目整理的中文范围摘要、指标说明和冲突注记与原始网页正文有区别。来源链接用于核对事实；本说明不为第三方期刊标识、网页全文、原始 PDF 或 Excel 附件增加授权。

## 个人导入及备份

个人 CSV 中的 JCR、CAS、SJR 或其他允许字段由使用者在本浏览器导入，带“个人导入”标记，不上传至公共目录。它们不因与公共数据一同显示或导出个人备份而取得 OpenAlex／DOAJ 的 CC0 许可。

个人笔记、稿件名称、收藏和投稿状态属于个人本地数据，不纳入本项目公开数据的组件许可说明。来源署名、数据许可和存储方式是不同信息；相关操作说明见 [README.md](README.md)。
