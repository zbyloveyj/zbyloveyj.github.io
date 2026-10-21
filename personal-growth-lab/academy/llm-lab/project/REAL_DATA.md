# 从合成教学数据转到真实微生物组

CurateMicrobiota 是这套教学工程的名称；真实数据适配器使用 **curatedMetagenomicData**。默认 `pipeline --quick` 始终运行合成教学数据，不会在后台下载真实队列。

## 1. 安装并检查 R 数据接口

在 R 控制台执行：

```r
if (!requireNamespace("BiocManager", quietly = TRUE)) {
  install.packages("BiocManager")
}
BiocManager::install(c("curatedMetagenomicData", "SummarizedExperiment"))
install.packages("jsonlite")
```

R 与 Bioconductor 版本需要彼此兼容，以 BiocManager 的检查结果为准。Python 教学环境与 R 数据导出是两个步骤，不必把 R 安装作为前七课的先决条件。

本适配器按 2026-10-21 核验的官方 `returnSamples(sampleMetadata, dataType, counts, rownames)` 源码与维护者分析例子编写。新增的基础 R 合同检查使用构造的矩阵与元数据，验证样本对齐和错误输入，不下载队列。真实 Bioconductor 导出、资源可用性及真实队列训练仍未实际执行；Python 的合成数据、训练与评估已实际执行。首次真实导出必须检查返回对象、物种名、丰度单位和来源版本。

## 2. 先看元数据，再定义任务

在工程根目录执行：

```bash
Rscript scripts/export_cmd.R list data/cmd_catalog
```

该命令仅读取已安装包的样本元数据，输出 `catalog_studies.csv`、`metadata_fields.txt` 和 `sessionInfo.txt`。先回答：哪些研究包含目标表型？每个研究的两类样本数是多少？年龄、采样部位、测序方法、疾病标签、受试者信息是否可比？不同研究是否重复使用了同一批样本或受试者？

复制 `configs/cmd_selection.example.json` 为 `configs/cmd_selection.json`，按目录中的**准确字符串**填写研究名和条件映射。示例中的 `REPLACE` 是必须替换的选择项，导出脚本会拒绝未完成配置。控制组不应包含其它疾病；未知表型不能默认映射成健康。

每个研究必须只属于 `train`、`val`、`test` 之一。二分类教学评估要求三个划分均有两类可用标签。模型训练时，未标注样本只能来自训练研究；当前适配器默认不导出缺失表型样本。

## 3. 导出版本化的数据目录

```bash
Rscript scripts/export_cmd.R export configs/cmd_selection.json data/real_v1
python -m curatemicrobiota inspect-data --data data/real_v1
```

`returnSamples` 使用 `counts=FALSE`，保留长物种名，选择 `|s__` 且不含 `|t__` 的层级。**`counts=FALSE` 不足以保证矩阵的数值单位是 0–1。** 已核验的 cMD 3 源码与维护者分析采用百分数相对丰度，官方分析先除以 100 转成比例，因此示例配置写为 `"abundance_unit": "percent"`。必须按实际安装版本、来源说明和原始矩阵核对；只有确认输入已为 0–1 比例时才写 `proportion`。脚本按显式配置转换，不根据行和自动猜单位。来源见本页末尾的维护者分析和固定提交源码。

导出只对声明为百分数的输入作固定除以 100，不重新闭合组成，不对全体研究拟合 prevalence、缩放或 CLR。溯源记录同时保存转换前后的物种丰度行和摘要；超过允许范围会停止。行和较小可以来自保留的物种质量较少，不能单凭它推断单位正确。

样本 ID 以返回对象的丰度矩阵列名为准。官方 `returnSamples` 通常把 ID 放在 `colData` 行名中，并不保留 `sample_id` 列；适配器按 ID 对齐元数据。若该列存在，还要核对它与行名一致。返回样本必须与预先选择的样本集合完全相同；如资源缺失导致上游丢样本，导出会明确报错，要求检查资源并重新确认选择，不静默改变队列。

输出包括：

| 文件 | 用途 |
| --- | --- |
| `abundance.csv` | 第一列 `sample_id`，其后各列为物种，数值为 0–1 相对丰度 |
| `metadata.csv` | `sample_id, study, subject_id, label`，标签仅 0、1 或空 |
| `split.json` | 明确的训练、验证、测试研究列表 |
| `metadata_original.csv` | 返回样本对应的完整来源元数据 |
| `data_provenance.json` | 来源、包版本、单位转换、ID处理及限制 |
| `resource_metadata.txt` | 返回资源的对象元数据，供核对资源版本 |
| `export_config.json` | 本次采用的完整选择配置 |
| `sessionInfo.txt` | R 与包环境 |
| `export_checksums_md5.csv` | 导出文件完整性检查；Python 训练另保存 SHA-256 |

研究内主键使用 `study_name::sample_id`；受试者键使用 `study_name::subject_id`。命名空间避免不同研究的“subject_01”误碰撞，但**不能证明跨研究没有重复受试者**，仍须审查队列来源。缺失受试者 ID 默认阻断导出。显式接受该限制时可以使用 unresolved 标识，报告也会保留数量，不能据此宣称独立性已经得到验证。

资源按整个研究提供。即使选择少数样本，下载量仍可能较大。先选择少量有清楚来源的研究，避免第一步就合并所有 `gene_families`。

## 4. 训练与评价

```bash
python -m curatemicrobiota pretrain --data data/real_v1 --out runs/real_v1 --steps 100
python -m curatemicrobiota evaluate --data data/real_v1 --run runs/real_v1
```

100 步用于接口与流程检查，不是科研训练充分性的判据。先固定预处理、超参数搜索范围和评价协议，再增加计算预算。查看验证曲线、训练均值插补基线、传统逻辑回归、随机编码器探针和预训练编码器探针。外测结果看过之后，对方案的任何调整都应使用新的外测研究验证。

核心 `evaluate` 保持三种固定划分比较。新增 `python -m curatemicrobiota.benchmark` 实现五方法留一研究循环，加入从零监督训练与预训练后全参数微调；详细协议见 `ADVANCED_LABS.md` 及第26–27课。真实输入至少需要4个研究，且每次训练/验证都要有两类有标签受试者；不满足时应重新定义科学划分，不能删除检查。该命令仍是研究教学基准，不提供临床部署。受试者级聚合要求重复采样的标签一致；存在治疗或疾病状态改变时，应先定义纵向目标，不能直接平均不同结局。

## 5. 单独验证样本对齐合同

```bash
Rscript tests/test_cmd_contract.R
```

该检查只需要基础 R，覆盖 ID 在行名而无同名列、矩阵与元数据顺序不同、缺失/额外/重复样本、ID 列冲突、研究名冲突及行数不匹配。它检验导出器实际调用的对齐函数；不等同于真实队列下载或完整 Bioconductor 集成测试。

## 官方来源

- [curatedMetagenomicData 官方教程](https://waldronlab.io/curatedMetagenomicData/articles/curatedMetagenomicData.html)
- [returnSamples API](https://waldronlab.io/curatedMetagenomicData/reference/returnSamples.html)
- [已核验的 returnSamples 源码](https://github.com/waldronlab/curatedMetagenomicData/blob/afd13adf72a4cda3c60ce60e7d5f20ef04bd5f8e/R/returnSamples.R)
- [已核验的相对丰度与 counts 转换源码](https://github.com/waldronlab/curatedMetagenomicData/blob/afd13adf72a4cda3c60ce60e7d5f20ef04bd5f8e/R/curatedMetagenomicData.R)
- [维护者 cMD 3 分析：相对丰度除以 100 转为比例](https://waldronlab.io/curatedMetagenomicDataAnalyses/articles/Sex_metaanalysis_vignette.html)
- [Bioconductor 包信息与软件许可](https://bioconductor.org/packages/curatedMetagenomicData)
- [SIAMCAT 原始论文](https://doi.org/10.1186/s13059-021-02306-1)

软件许可不能自动覆盖所有来源队列的数据权利；真实研究数据由学习者按原始来源条件获取，工程不附带重新分发的真实队列。
