# CurateMicrobiota · 校订记录与验证范围

日期：2026-10-21。课程版：2026.10.21.3。工程版：1.1.1。

本轮校订对照课程正文、公式、可执行代码、真实实验报告和官方数据接口，重点处理会影响理解、复现或科学解释的问题。完整课程仍为 30 单元、318 个教学章节、119 道完整解析练习、150 道验收题、77 个 Python 机制实验；没有为了提高展示分数重新选择模型或测试集。

## 1. 公式与例子

| 位置 | 修正 | 如何核验 |
| --- | --- | --- |
| 第 2 课 | 区分 padding 无效上下文与 SFT 中不计损失的合法提示上下文 | 与第 8、20 课的 response-only SFT 和实际标签遮罩一致 |
| 第 7 课 | top-p 累计概率恰好达到阈值时保留最小前缀；p=1 保留完整分布 | 两项均匀分布、四项均匀分布、p=1 和非法阈值断言 |
| 第 23 课 | 配对 bootstrap 必须核验 ID、分数、来源分组的数量相同 | 顺序错位及一个 ID 对两套分数的非法输入均被拒绝 |
| 第 25 课 | ILR 的无冗余坐标与基的正交性不保证统计独立 | 正文保留线性代数含义，避免误读为概率独立 |
| 第 12、27 课 | 相同监督步数仅指从零监督与预训练后微调两臂；预训练另有额外计算 | 与实际 benchmark 的优化器、C 搜索和预算报告逐项核对 |

top-p 在本项目中是独立机制实验，核心 TinyGPT CLI 仍仅暴露已实现的 temperature/top-k 选项；本轮没有声称增加一个新的生成 CLI 参数。

## 2. 真实数据适配

官方 `returnSamples` 会把 `sample_id` 变成 `colData` 行名。旧适配器要求同名普通列，会拒绝这一正常返回形式。本轮将对齐逻辑抽为 `scripts/cmd_contract.R`，由实际导出器调用：

1. 以 assay 列名为样本 ID，要求非空且唯一。
2. 按 ID 重排返回元数据；若另有 `sample_id` 列，再核对它与行名一致。
3. 核对返回与请求的 `study_name::sample_id` 集合完全相同。资源缺失导致上游丢样本时明确报错，要求重新检查与确认选择。
4. 按相同顺序重排原始元数据，再生成标签和导出表。

`tests/test_cmd_contract.R` 使用基础 R 的构造矩阵和元数据，设有 12 组检查：正常行名 ID、反序对齐、请求遗漏、额外返回、重复 ID、可选 ID 列、ID 冲突、空 ID、元数据行名冲突、研究名冲突、请求重复及行数不一致。发布工作流中的 `real-data-sample-contract` 作业执行该文件；无需下载真实队列。

单位也按源码与维护者数值分析重新核对：**不能把 `counts=FALSE` 直接等同于数值已经在 0–1。** 已核验的 cMD 3 示例使用百分数，所以选择配置示例改为 `percent`，转换时显式除以 100。保留 `proportion` 供已确认采用比例单位的输入使用；不自动猜单位、不重新闭合组成，并记录转换前后的物种丰度行和摘要。详见 [REAL_DATA.md](REAL_DATA.md)。

这组基础 R 检查只验证样本合同。真实 Bioconductor 资源下载、具体版本的对象整合、真实队列训练与外部验证仍未完成，不能把合同测试写成真实队列实验结果。

## 3. 学习路径与复现

- 第 1 课统一介绍 14 个核心单元和 16 个进阶单元，明确全课预计 107 小时，并标出数学和组成数据可以提前补学的位置。
- 第 12 课区分核心 `evaluate` 的三方法固定划分，与进阶 `benchmark` 已实现的五方法留一研究循环；CLR/RF、协变量模型和菌群 LoRA 仍标为扩展。
- Windows 网页说明统一为 `py -3`，并要求检查实际解释器。工程 ZIP 与完整离线包的工程根目录分别写清楚。
- 单个 `.py` 下载受浏览器行为影响时，使用工程 ZIP 内的 `lesson_examples/`，在原工程根目录运行。
- 第 14 课显式以 UTF-8 读取报告和清单，避免含中文内容时依赖操作系统默认编码。
- 新运行的 pipeline 报告从包 `__version__` 读取版本。新增轻量测试真实执行命令解析、生成合成数据和报告落盘，只模拟昂贵训练组件。
- 两份 ZIP 在临时文件中完整生成并通过 CRC 检查后，再原子替换下载文件。课程验证器逐个比对压缩包成员与当前源文件，避免不完整或过期的离线包进入发布。

## 4. 检查命令与证据

```bash
# 工程根目录：Python 模型、数据隔离与报告合同
python -m unittest discover -s tests -v

# 工程根目录：基础 R 样本对齐合同
Rscript tests/test_cmd_contract.R

# llm-lab 目录：课程结构与下载内容一致性
python tools/validate_course.py
node tools/check_app_state.cjs

# llm-lab 目录：每个 Python 代码块独立进程执行
# PATH_TO_RUN 指向确实运行过 pipeline --quick 的目录
python tools/run_lesson_examples.py --fixture-run PATH_TO_RUN --report examples.json
```

Python 单元检查共 36 项。77 个教学代码块的实际运行输出见 [example-results/lesson_examples_report.json](example-results/lesson_examples_report.json)。课程级汇总在上级目录 `validation.json`；R 合同的实际结果见本次提交对应的 GitHub Actions 作业日志。

历史 quick、SFT 和六研究五方法基准报告保持原始运行记录，本轮没有改写其中的版本、损失或 AUROC。复杂模型在当前合成基准下仍未超过逻辑回归；这些数值依然只支持教学流程层面的解释。

## 原始来源

- [固定提交的 returnSamples 源码](https://github.com/waldronlab/curatedMetagenomicData/blob/afd13adf72a4cda3c60ce60e7d5f20ef04bd5f8e/R/returnSamples.R)
- [同一提交的资源读取与 counts 转换源码](https://github.com/waldronlab/curatedMetagenomicData/blob/afd13adf72a4cda3c60ce60e7d5f20ef04bd5f8e/R/curatedMetagenomicData.R)
- [维护者 cMD 3 分析中的百分数转换](https://waldronlab.io/curatedMetagenomicDataAnalyses/articles/Sex_metaanalysis_vignette.html)
