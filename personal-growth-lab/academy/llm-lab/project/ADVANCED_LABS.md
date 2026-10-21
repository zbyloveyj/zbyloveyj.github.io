# CurateMicrobiota：进阶实验与结果解释

本页对应 30 单元课程的第 15–30 课。第 1–14 课提供核心闭环；进阶单元补齐数学、语料、架构、训练系统、后训练、RAG、工具、评价、部署及菌群科研。完整知识与实现层级见课程的「知识覆盖」页面。阅读一遍不能替代独立实现、诊断和研究复现；每个单元都应留下可检查的产物。

以下命令在已安装依赖的 `project` 目录运行，不要求 GPU、API Key 或下载大型权重。每次新基准实验使用一个新的输出目录。

## 一、训练真正的 BPE 分词器

```bash
python -m curatemicrobiota.advanced bpe --out runs/bpe
```

打开 `runs/bpe/tokenizer.json` 和 `report.json`。训练从 256 个 UTF-8 字节开始，在训练文档中统计相邻 token 对，按频次选择合并；频次相同时采用确定性排序。每个文档独立处理，不跨文档边界统计相邻对。编码验证文本时只应用已经冻结的合并规则。

交付环境实跑得到 64 次合并、320 个词元。训练文本 2,165 字节编码为 1,374 个词元；未参与分词训练的验证文本 592 字节编码为 423 个词元。中文、英文和包含未见字符的输入均能经保存与重新加载后往返恢复。词元更短或更少不是任务质量的充分证据；不同 tokenizer 下的 token-level perplexity 也不能直接等同。

这份 BPE 独立于原始 TinyGPT 的 256 字节词表。将新 tokenizer 塞进旧检查点会改变 token ID 的含义，不能这样接入。真正替换时，应同步更改 embedding、输出层、数据编码和配置，再重新训练。这份教学实现没有生产预切分器、special-token 协议、优先队列加速或流式 Unicode 解码器。

**独立验收：**解释为什么不能在完整语料（含测试文档）上训练合并表；构造 `aaaaa` 检查非重叠替换；编码含中文与表情的未见文本；保存前后逐个比较 token ID；用另一个固定训练语料解释分词差异。

## 二、证明完整断点恢复确实继续同一条训练轨迹

```bash
python -m curatemicrobiota.advanced resume --out runs/resume
```

实验用一层 TinyGPT、带 dropout 的训练和两次 microbatch 梯度累积。一路连续执行 12 个 optimizer step；另一路在第 5 步保存，重新构造对象后加载，再完成剩余 7 步。保存内容包括模型、AdamW 动量状态、余弦学习率调度器、已完成步数、数据校验值、Torch dropout RNG、独立采样器 RNG、Python 与 NumPy RNG。保存点固定在优化器更新边界，未完成的累计梯度不在本例范围内。

交付实跑的 `max_parameter_absolute_difference` 为 **0.0**，逐步损失序列与学习率也完全一致。这个结论只覆盖本实验的单进程 CPU 条件。GPU 内核、分布式 rank、DataLoader worker/prefetch、AMP GradScaler 和在累积中途恢复，都需要进一步保存状态和验证。更换设备或库版本也不自动保证逐位相同。

**独立验收：**指出仅有 `model.state_dict()` 时丢失什么；分别在实验副本中省略 optimizer、sampler 或 dropout RNG 的恢复，观察差异来自哪个环节；说明为何应先构造模型再恢复 RNG；分清「恢复出合理结果」与「恢复同一条轨迹」。

## 三、把显存预算写成明确账本

```bash
python -m curatemicrobiota.advanced budget --parameters 7000000000 --layers 32 --kv-heads 8 --head-dim 128 --context 8192 --batch 1 --out runs/budget
```

权重 payload 的基本估计是参数个数乘每参数字节数。KV cache 使用 `2 × layers × batch × context × kv_heads × head_dim × kv_bytes`，其中 2 表示 K 与 V；GQA 的 KV heads 可以少于 query heads。context 应包含实际缓存的输入与生成 token。默认假设没有滑窗、缓存分片或共享前缀。

示例 70 亿参数、BF16/FP16 权重约 **13.04 GiB**；上述 GQA 设置的 KV cache 为 **1 GiB**。这些是理论 payload，不是「某显卡一定可装下」的承诺。量化还需要 scale、zero point、padding 和临时反量化空间；训练还包含激活、通信缓存与框架开销。

AdamW 参数状态采用明确的一种约定：2 字节权重、2 字节梯度、4 字节 master weights、两个 4 字节动量，共 16 字节/参数。不同 AMP、优化器或分片实现可能采用不同布局。必须核对自己的实现，而不是机械套用单一倍率。脚本同时输出排除项和 GiB 定义。

**独立验收：**将 batch 翻倍；将 KV heads 从 8 改成 32；对比上下文翻倍对权重与缓存的不同影响；解释 int4 权重 payload 与整个服务峰值显存的区别；分别列出训练和推理的主要内存项。

## 四、完成五方法留一队列基准

```bash
python -m curatemicrobiota make-demo --out data/demo
python -m curatemicrobiota.benchmark --data data/demo --out runs/loso --pretrain-steps 40 --supervised-steps 40 --seeds 42 43
```

合成数据含 6 个研究、120 个受试者、240 次采样和 48 个没有真实物种含义的特征。每个外层 fold 留一个研究作 test，按研究名确定下一个研究作 validation，其余研究为 train。研究中同一人的所有随访都留在一个分区。若一个人跨研究出现，应先定义连通研究组；程序会拒绝让这个人跨 fold 分区。

每个 fold 与 seed 从头拟合预处理和自监督编码器，测试研究从未进入自监督或词表、尺度拟合。监督阶段比较五种方法：

| 方法 | 参数怎样得到 | 选择规则 |
| --- | --- | --- |
| log 丰度＋逻辑回归 | 训练研究的特征与标签 | 仅 validation 选择 C |
| 随机编码器＋冻结探针 | 未经预训练的同结构编码器 | 仅 validation 选择探针 C |
| 预训练编码器＋冻结探针 | 训练研究掩码预训练后冻结 | validation 重建损失选择编码器，再选择探针 C |
| 从零监督训练 | 同一随机编码器初始化，训练分类头与编码器 | validation 受试者 AUROC；并列时更低 log loss |
| 预训练后全参数微调 | 预训练编码器初始化，训练分类头与编码器 | 与从零监督相同的监督预算、优化器和选择规则 |

分类时不使用的 reconstruction head 被冻结。两类端到端监督模型使用相同分类头种子、采样序列和监督步数。预训练分支有额外的无监督计算，因此该比较不是等总 FLOPs 的比较。当前 LR 固定、探针 C 网格很小；真实研究应预先扩大基线和内层调参范围，而不是看到 test 后调整以获得更好分数。

每个人在监督目标中具有相等的总样本权重。测试时先将该人的随访预测概率求均值，再计算受试者级 AUROC、AP、Brier、log loss、固定阈值分类指标和校准分箱。这个聚合只适用于已经明确的稳定二分类结局；疾病标签随时间改变的任务需另行定义，不能机械平均。

输出包含：

- `report.json`：所有 split、seed、模型、选择历史、逐队列指标与设定限制。
- `predictions.csv`：五方法在相同受试者上的配对预测；完整默认实验为 1,200 行预测。
- `foldNN/seedNN/data/`：该次运行的划分与标签可见范围。
- `label_subset.json`：监督训练可见的训练受试者清单。
- `pretrain/`：词表、尺度、自监督最佳权重和初始随机权重。
- `supervised_scratch/`、`pretrained_finetuned/`：分类检查点和验证选择记录。

### 如何解释实际结果

交付环境的完整运行（6 fold、2 seed、自监督与监督各 40 步）得到以下跨队列宏平均 AUROC。先在每个研究内对种子平均，再跨研究平均，不能把 2 个种子解释成 2 倍受试者。

| 方法 | 宏平均 AUROC |
| --- | ---: |
| log 丰度＋逻辑回归 | 0.8283 |
| 随机编码器＋冻结探针 | 0.7458 |
| 预训练编码器＋冻结探针 | 0.7275 |
| 从零监督训练 | 0.5542 |
| 预训练后全参数微调 | 0.5667 |

这是一个有价值的负结果：预训练在此设定下没有证明优于强简单基线。微调比从零监督的平均 AUROC 高 0.0125，既不构成显著性结论，也不证明真实生物学收益。冻结表征也低于随机表征。应检查目标与下游任务是否匹配、数据与优化预算是否足够、池化是否保留特征身份，而不能把实验定义为「预训练必须赢」。

每次比较使用同一组测试受试者进行配对 bootstrap，报告的是条件于当前研究和已拟合模型的区间，不包含重新训练或研究间不确定性。不同外层 fold 的训练集重叠，不能把 fold × seed 当相互独立样本做简单 t 检验。单个轮转验证研究也不等于完整 nested CV；进阶第 27 课给出更严格的研究设计。

### 标签效率与快速检查

```bash
# 仅改变训练标签预算，其余输入仍可用于训练内自监督和预处理。
python -m curatemicrobiota.benchmark --data data/demo --out runs/loso-half-label --pretrain-steps 40 --supervised-steps 40 --seeds 42 43 --label-fraction 0.5

# 两个fold、一个seed只检查通路，不是完整LOSO结论。
python -m curatemicrobiota.benchmark --data data/demo --out runs/loso-smoke --pretrain-steps 8 --supervised-steps 8 --seeds 42 --max-folds 2
```

标签按训练受试者、按类别分层选择；同一人的所有随访一起保留或隐藏标签。少量样本时每类向上取整且至少保留一人，因此实际比例以清单为准。验证和测试标签不受该比例影响。该设置属于训练内半监督标签效率比较；不能称为严格只接触有标签数据的监督学习。实际只运行过哪些设定，应在报告中明确记录，不把命令示例算作已完成的研究结果。

## 五、从课程作品到科研课题

完成核心后，建议按三个检查点推进：

1. **实现检查点：**从空白解释张量流、损失和反向传播；独立运行 BPE、TinyGPT、SFT/LoRA 和完整恢复；能对坏样例定位问题。
2. **方法检查点：**冻结数据合同与划分，运行五方法、多队列、多种子；保留负结果；对标签效率、目标函数和表示方式提出可区分的假设。
3. **科研检查点：**接入经过许可核验的真实研究，严格处理 taxonomy、单位、受试者、协变量与时间；外部队列不参与调试；形成数据卡、模型卡、消融矩阵、配对预测和复现说明。

DNA/蛋白基础模型、全功能 RAG 服务、在线 RL、多卡训练及精神疾病影像融合，在本版是有完整教材和机制实验支持的研究拓展。项目没有下载大型生物模型权重，没有训练真实临床多模态模型，也没有实际执行 R/Bioconductor 导出。这些工作要在适合的环境与数据条件下继续完成；教学结果不能替代它们。

## 六、原始方法与官方说明

- BPE 原始方法：https://aclanthology.org/P16-1162/
- PyTorch 完整检查点：https://docs.pytorch.org/tutorials/beginner/saving_loading_models.html
- GQA：https://arxiv.org/abs/2305.13245
- SIAMCAT 与跨研究评价：https://doi.org/10.1186/s13059-021-02306-1
- curatedMetagenomicData：https://waldronlab.io/curatedMetagenomicData/

课程每个相关单元另附原始论文、指定阅读位置、问题与参考解析。命令和具体实跑指标以本工程附带报告为准。
