# CurateMicrobiota · 从小型 GPT 到微生物表征模型

这是「成长学院 · 大模型全景实战」39 单元课程的完整本地工程（14 课核心＋16 课进阶＋9 课专题补全）。你会亲手运行两个不同的模型：一个预测下一个 UTF-8 字节的小型 GPT，以及一个重建被遮蔽菌群丰度、学习样本表示的 Transformer。还可以从 GPT 检查点执行全参数 SFT、LoRA-SFT，以及独立的 LoRA 回归和 DPO 公式梯度实验。

**默认实验完全使用明确标注的合成菌群数据和原创教学文本。安装依赖之后，核心命令无需联网、API Key、云服务、预训练模型或显卡。** 将流程接到真实研究数据，需要完成数据溯源、标签定义、分类词表统一和研究级验证。这里的 CurateMicrobiota 是本课程项目名；官方数据资源名为 **curatedMetagenomicData**。

2026-10-21 校订记录、已修复的边界问题与验证范围，见 [REVIEW_NOTES.md](REVIEW_NOTES.md)。

新增进阶实验、五方法留一队列基准、实际负结果及严格的解释边界，见 [ADVANCED_LABS.md](ADVANCED_LABS.md)。新入口包括真正的 BPE、完整状态恢复、资源账本、从零监督训练、预训练后微调和按受试者抽样的标签效率实验。

## 1. 在 VS Code 中启动

使用 Python 3.10 或更新版本；本次交付的实测版本记录在实验报告的 `environment` 字段。解压后，在 VS Code 用「文件 → 打开文件夹」打开同时包含本 README、`pyproject.toml` 和 `curatemicrobiota/` 的工程根目录：工程 ZIP 中名为 `curatemicrobiota-project/`，完整离线包中则为 `curatemicrobiota-learning/project/`。打开集成终端，先执行 `python --version`，确认不是其他软件携带的 Python。

### Windows PowerShell

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install torch --index-url https://download.pytorch.org/whl/cpu
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m curatemicrobiota doctor
.\.venv\Scripts\python.exe -m curatemicrobiota pipeline --quick --out runs/demo
```

直接调用虚拟环境的解释器即可，不需要更改系统的 PowerShell 执行策略。在 VS Code 中执行 `Python: Select Interpreter`，选择 `.venv\Scripts\python.exe`。后文中的 `python` 都应指向该环境；未激活环境时，用上述完整相对路径替换。

### macOS / Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
# Linux 若只需 CPU，可先安装 CPU wheel；macOS 直接执行下一行 requirements 安装。
# python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r requirements.txt
python -m curatemicrobiota doctor
python -m curatemicrobiota pipeline --quick --out runs/demo
```

核心流水线默认在 CPU 上运行，使用两个 CPU 计算线程；进阶恢复实验及监督对照采用单线程 CPU 以便检查可复现性。`doctor` 显示 CUDA/MPS 是否可用用于环境检查，并不自动切换训练设备。首次安装 PyTorch 需要下载依赖；`--quick` 是少量训练步骤的通路验证，运行时长取决于设备。

### 一次成功运行应产生什么

终端依次显示五个阶段，并最终输出 JSON。打开 `runs/demo/report.json`，确认 `status` 为 `completed`。检查以下产物，而不是凭生成文本是否流畅判断成功：

交付时的真实快速运行结果保存在 `example-results/quick_report.json`，可用于对照字段和学习曲线。这个示例中，TinyGPT 的验证损失下降，而预训练菌群表示的测试分类表现没有超过简单基线；课程保留这一结果，用来讨论“优化目标改善”与“下游迁移有效”为什么是两项不同的证据。

| 产物 | 意义 |
| --- | --- |
| `data/abundance.csv`、`metadata.csv`、`split.json` | 240 个合成样本、120 个受试者、6 个研究、48 个特征；按研究隔离 |
| `language/model.pt`、`language/report.json` | TinyGPT 权重、配置、验证损失、按字节计算的困惑度及生成示例 |
| `microbiome/encoder.pt`、`preprocessor.json` | 掩码编码器及仅在训练研究拟合的词表、均值和尺度 |
| `microbiome/random_encoder.pt` | 预训练前的同结构编码器，用于随机表示对照 |
| `microbiome/manifest.json` | 数据文件校验值、切分、随机种子和预处理校验值 |
| `microbiome/pretrain_report.json` | 训练曲线、验证重建误差、训练均值插补对照 |
| `microbiome/evaluation_report.json` | 三种表示在验证/测试研究的预测和校准指标 |
| `microbiome/test_subject_predictions.csv` | 每个受试者的平均预测概率，用于复核指标和作图 |
| `lora/adapter.pt`、`lora/report.json` | 低秩更新参数、冻结权重不变的检查及独立输入上的误差 |

## 2. 按课程逐步运行

每次从 `project` 目录启动。以下命令相互衔接，路径保持一致。

```bash
# 环境与数据合同
python -m curatemicrobiota doctor
python -m curatemicrobiota make-demo --out data/demo
python -m curatemicrobiota inspect-data --data data/demo

# 第一条主线：语言模型
python -m curatemicrobiota train-lm --steps 100 --out runs/lm
python -m curatemicrobiota generate --checkpoint runs/lm/model.pt --prompt "Microbes " --tokens 80
python -m curatemicrobiota generate --checkpoint runs/lm/model.pt --prompt "A model " --tokens 80 --temperature 0.6 --top-k 20

# 参数高效适配的独立机制实验
python -m curatemicrobiota lora-demo --out runs/lora --steps 100

# 在已有 TinyGPT 上执行真正的 response-only SFT
python -m curatemicrobiota finetune --checkpoint runs/lm/model.pt --out runs/sft --steps 30
python -m curatemicrobiota finetune --checkpoint runs/lm/model.pt --out runs/sft-lora --steps 30 --lora
python -m curatemicrobiota generate --checkpoint runs/sft-lora/model.pt --prompt "Q: Need a simple baseline?" --tokens 24

# DPO 的公式与梯度演示，独立于 SFT，不训练偏好模型
python -m curatemicrobiota alignment-demo --out runs/alignment

# 第二条主线：微生物丰度表模型
python -m curatemicrobiota pretrain --data data/demo --out runs/microbiome --steps 100
python -m curatemicrobiota evaluate --data data/demo --run runs/microbiome

# 结构与数据隔离检查
python -m unittest discover -s tests -v
```

全流程快速档分别执行 **40 步语言训练、60 步菌群预训练、100 步 LoRA 实验**。去掉 `--quick` 会执行 400、500、200 步。增加步数只增加优化预算，不能替代真实数据、良好实验设计或独立验证。对比实验请使用不同输出目录，避免覆盖已完成的结果。

### 2.1 单独完成 SFT 与偏好目标实验

`pipeline` 保持五阶段快速通路；SFT 与 DPO 使用上面的独立命令。`finetune` 必须接收真实存在的 TinyGPT 检查点，不会在缺少基座时偷偷从随机模型开始。内置 `curatemicrobiota/sft_pairs.jsonl` 含 **10 个训练对和 4 个固定验证对**，均为原创、合成的短任务示例，没有随机窗口切分或自动跨分区复用。

每对数据由 `prompt` 和 `response` 构成。模型输入是整段字节序列右移前的部分；监督标签右移一次，将 prompt 和右侧 padding 对应的标签全部设为 `-100`，只计算 response 及一个换行终止符的交叉熵。prompt 最后一个字节所在位置的 logit 预测 response 的第一个字节；把这一位置也遮掉会漏掉首个回答 token。每对数据必须完整放进 context=64，过长时明确报错，不静默截断。

全参数 SFT 更新基座所有可训练参数；`--lora` 冻结基座，只在两层注意力 `qkv` 中注入 rank=2、alpha=4 的 A/B 参数。两者都只按固定验证回答损失选择检查点，并报告监督字节数量与遮罩范围。四个微型验证例无法衡量通用指令能力，生成内容仍可能不通顺或不正确。

两个模式均保存 `model.pt` 和 `report.json`。LoRA 模式额外保存 `adapter.pt`，记录 A/B、适配配置及基座文件 SHA-256。**直接用 `generate --checkpoint runs/sft-lora/model.pt` 可加载完整 LoRA 状态**：代码先建立相同基座结构，再插入同配置适配器并读取权重。单独的 `adapter.pt` 不包含基座，不能作为 `generate` 的完整模型；迁移它时必须保留并核对原始基座检查点。

交付时两种 SFT 和 DPO 的实跑结果见 `example-results/finetuning_report.json`。其中 LoRA-SFT 仅训练 1,024 个参数，报告确认所有被冻结的基座参数保持逐值不变。语料很小，验证损失改善只是这个监督目标的结果，不代表回答的科学事实已获验证。

`alignment-demo` 计算固定 chosen/rejected 与参考模型 log probability 上的 DPO loss，并输出偏导数。标准形式为 `-logsigmoid(beta * [(logπ_chosen-logπ_rejected) - (logπ_ref_chosen-logπ_ref_rejected)])`。参考值冻结；对 chosen log probability 的偏导应为负，对 rejected 的偏导应为正；增加相对 chosen 优势应降低损失。输入是回答序列 log probability **之和**，随意改成 token 均值会改变目标。这个命令验证公式、符号和梯度，不训练真实偏好模型、不拟合奖励模型，也不执行 RLHF。

所有 Python 教学代码另外以脚本形式收录在 `lesson_examples/`，入口索引见 [lesson_examples/README.md](lesson_examples/README.md)。网页每个 Python 代码框提供对应脚本链接；如果浏览器取消单个 `.py` 下载，请使用已包含全部脚本的工程 ZIP，在原目录运行。不要把脚本移动到其他目录。有数据或检查点前置的例子在脚本头注明命令。

## 2.2 调用自己的本地模型服务（第36课）

先运行上面的 `train-lm`，确认 `runs/lm/model.pt` 已生成。第一个终端保持运行：

```bash
python -m curatemicrobiota.local_service serve --checkpoint runs/lm/model.pt --port 8765
```

另开一个终端，使用同一个 Python 环境发送请求：

```bash
python -m curatemicrobiota.local_service client --prompt "Microbes " --max-new-tokens 16 --port 8765
python -m curatemicrobiota.local_service client --prompt "Microbes " --max-new-tokens 16 --port 8765 --stream
```

服务固定监听 `127.0.0.1`。`GET /health` 提供检查点摘要与上下文上限；`POST /generate` 返回 JSON，`stream=true` 时按 NDJSON 发送 `start`、`token`、`done`。流式文字需拼接各 `text_delta` 和最终 `final_text_delta`。实际输出来自已加载的 TinyGPT，不预置问答，不调用远端服务。

默认64字节上下文；提示UTF-8字节数加预留输出额度不能超过模型上限。支持 `prompt,max_new_tokens,temperature,top_k,seed,timeout_seconds,stream`，其他字段拒绝。截止时间在token边界检查，不能硬中断正在运行的CPU算子；当前没有KV缓存、生产并发、认证或公网部署。请用Python客户端，浏览器Origin请求不受支持。完整LoRA检查点可加载，adapter-only文件不包含底座。

Windows未激活环境时，把 `python` 换成 `.\.venv\Scripts\python.exe`。运行后以 Ctrl+C 结束本机服务。本地服务合同测试见 `tests/test_local_service.py`；HTTP测试需要环境允许本地socket。

## 2.3 九个补全专题与独立验收

新课31–39覆盖提示与上下文、推理时计算、持续学习/蒸馏、外部模型适配、学习型检索、本地服务、原始宏基因组测量、图/潜变量目标和外推可靠性。全部机制脚本仍由课程唯一源码生成，索引在 `lesson_examples/README.md`，每段注明前置。

第34课还提供 `scripts/run_hf_snapshot.py`：只读用户已准备的本地模型快照，禁用远程代码并要求safetensors。它需要额外的兼容Transformers依赖和对应模型权重，属于可选实操；默认CPU教学检查不下载或声称已经跑过外部大权重。不要把模型配置、分词器或适配器的文件单独拷贝后当作完整模型。

在线课程「查漏验收」提供12项独立任务、0–3分标准与证据要求，可以下载Markdown表或导出个人JSON模板。课程完成记录和独立能力自评分各有含义；选择题全部正确不能代替在新目录重现代码和解释失败。

## 3. 代码阅读顺序

| 文件 | 建议先看哪些对象 | 你应该解释清楚的问题 |
| --- | --- | --- |
| `curatemicrobiota/language.py` | `ByteTokenizer`、`sample_batch` | 为什么目标右移一个位置？为什么 byte vocabulary 固定为 256？ |
| 同上 | `CausalSelfAttention`、`DecoderBlock`、`TinyGPT` | Q/K/V 的维度、因果遮罩、残差、Pre-LN、输出 logits 与 CE 如何相接？ |
| 同上 | `train_language`、`generate_from_checkpoint` | 训练与验证模式有什么区别？温度和 top-k 改变了什么？ |
| `curatemicrobiota/lora.py` | `LoRALinear`、`inject_lora` | 为什么初始低秩更新为零？哪些参数冻结，哪些参数接收梯度？ |
| `curatemicrobiota/finetuning.py` | `pack_sft_batch`、`response_loss`、`train_sft` | 哪些字节接受监督？prompt、回答和 padding 的标签位置分别是什么？ |
| 同上 | `response_log_probabilities`、`dpo_loss`、`alignment_demo` | 如何从回答 token 的条件概率得到偏好目标？参考模型为什么固定？ |
| `curatemicrobiota/local_service.py` | `LocalEngine`、`validate_request`、`make_server` | 如何从真实检查点生成JSON/NDJSON，并明确停止原因？ |
| `curatemicrobiota/data.py` | `validate_split`、`Preprocessor.fit` | 为什么先隔离研究/受试者，再学习词表、过滤阈值和标准化参数？ |
| `curatemicrobiota/microbiome.py` | `MaskedMicrobiomeEncoder`、`make_mask` | 为什么菌群表不用因果遮罩或句子位置？缺失、零和人工掩码为何不同？ |
| 同上 | `masked_mse`、`pretrain_microbiome` | 为何损失只作用在被掩码的位置？训练均值插补对照有什么作用？ |
| `curatemicrobiota/evaluation.py` | `fit_probe`、`aggregate_subjects` | 验证集选择什么？测试集何时使用？重复随访如何避免冒充独立受试者？ |
| `tests/test_core.py` | 全部测试 | 哪些错误即使 loss 正常下降，也会使研究结论失效？ |

TinyGPT 的张量主线是 `[batch, time] → [batch, time, width] → [batch, time, 256]`。菌群模型主线是 `[batch, taxa] → [batch, taxa, width]`，每个菌的重建输出为 `[batch, taxa]`，平均池化后样本表示为 `[batch, width]`。两个模型分别训练，不共享权重。

## 4. 真实数据接口

将一个真实数据版本整理到例如 `data/real/`。需要四类信息：

**abundance.csv：**第一列必须为 `sample_id`，其余列是唯一、稳定的分类特征名；行是样本，列是分类特征；数值为 0–1 的相对丰度比例。允许只保留一个一致定义的分类层级，因此行和可以小于 1，但必须为正且不能超过 1.01。不要混合 species、strain 与 higher-rank 汇总行，不要重复计数。百分数必须显式除以 100；原始 read counts 必须先根据你的分析目标和预处理方案转换，不能仅修改文件名。

**metadata.csv：**至少包含 `sample_id,study,subject_id,label`，与丰度表样本一一对应。`label` 只能是 `0`、`1` 或空白；空白表示无标签，在训练研究内仍可用于自监督学习，但不进入监督探针。0/1 的科学含义由你的预注册任务明确给出，不能把标签缺失视为健康。`subject_id` 必须是经过原研究信息核验的跨研究稳定标识，不能用每次随访的样本编号替代。重复受试者不能跨分区。若同一人不同时间的疾病标签变化，本教学基准会拒绝按受试者简单聚合；请先定义适合纵向问题的结局与评价方案。

**split.json：**显式指定每个研究属于哪个分区，例如：

```json
{
  "train": ["Study_A", "Study_B", "Study_C"],
  "val": ["Study_D"],
  "test": ["Study_E"]
}
```

所有研究必须被分配且只能出现一次。训练和验证分区需要有两个类别的有标签受试者；若研究与疾病完全混杂，任何分类器都无法仅靠这一数据设计区分疾病效应与研究效应，需要重新设计队列对照。

**data_provenance.json：**强烈建议记录数据包/数据库版本、查询日期、study 列表、原研究 DOI/访问号、原始和转换后单位、分类工具与数据库版本、下载与再分发许可、纳排规则及文件 SHA-256。没有溯源文件时，报告会标为 `user_provided_unverified_provenance`。本工程附带的合成数据许可只适用于合成示例，curatedMetagenomicData 软件许可也不能自动代替底层每个队列的数据使用条件。

```bash
python -m curatemicrobiota inspect-data --data data/real
python -m curatemicrobiota pretrain --data data/real --out runs/real --steps 500 --max-taxa 64
python -m curatemicrobiota evaluate --data data/real --run runs/real
```

`--max-taxa 64` 是为笔记本教学控制注意力矩阵规模的限制。特征按训练集 prevalence ≥0.10 过滤，再按训练集均值排序保留至上限；未知分类特征被排除，报告输出保留的丰度质量比例。实际研究应把特征词表和分辨率视为需要验证的设计，不能将前 64 个特征代表全部微生物组。若一个新队列缺少已训练的分类列，默认报错，要求先确认这是生物学未检出还是技术未测量；代码不会悄悄把技术缺失当零。

## 5. 本工程如何防止常见信息泄漏

1. **先切分后拟合。** 研究与受试者划分先于 prevalence 过滤、特征排序、均值和标准差拟合。
2. **不从待预测目标计算样本中心。** 输入是给定比例，变换为 `log1p(proportion × 1e6)`，再用训练研究的每个分类特征统计量标准化；不先对完整样本做 CLR 再遮住目标。
3. **掩码替换完整数值嵌入。** 人工掩码使用独立的可学习向量；数值编码不会通过偏置或其他通道泄露被隐藏值。
4. **至少隐藏两个分类特征。** 这减少“仅由总和为 1 推出唯一缺失部分”的退化任务，但并不能消除组成数据的天然依赖。代码保留输入比例的闭合关系，不在隐藏后重新归一可见部分；后者会改变任务，应作为单独方法比较。
5. **验证集选择，测试集报告。** 编码器检查点按验证重建损失选择；每个探针的 `C∈{0.1,1,10}` 按验证受试者 AUROC 选择；阈值固定为 0.5。测试研究不参与选择。
6. **文件冻结。** `evaluate` 核对预训练时的数据文件、切分及预处理校验值。文件改变时必须重新明确数据版本并训练，避免无意切换样本或词表。

## 6. 如何理解输出指标

- **掩码 MSE** 在标准化后的 log 相对丰度空间计算。它不是原始比例误差，也不是绝对菌量误差。先看模型能否超过“每个菌都预测为训练集均值”的插补基线。
- **AUROC** 衡量病例相对对照的排序；**average precision / AP** 是这里采用的 AUPRC 定义，并不是对 PR 曲线作梯形积分的面积。类别患病率改变会影响 AP，因此报告同时给出 prevalence。
- **macro-F1 和 balanced accuracy** 使用固定 0.5 阈值；**Brier、log loss、5 分箱 ECE**检查概率质量。测试受试者少时分箱结果非常不稳定，应同时查看各箱的样本数。
- 主要指标以**受试者**为单位。同一受试者的多次采样先求预测概率均值；报告附上样本级指标作为次要信息。
- AUROC 的 95% 区间是测试研究内部 400 次受试者 bootstrap 的演示。它没有估计不同外部研究之间的不确定性，不能凭一个测试队列宣称广泛泛化。
- 比较**log 丰度 + 逻辑回归**、**随机编码器 + 线性探针**、**预训练编码器 + 线性探针**。后者没有更好时，应如实报告；检查任务、数据规模、掩码设计和批次因素，而不是把测试集加入训练来“改善分数”。

## 7. 预期限制与下一步研究

14 个核心学习单元帮助你解释并执行从 token、注意力、训练、适配到菌群表示与评价的完整流程。训练一个具有多任务迁移能力的研究级微生物基础模型，还需要更多异质研究、明确的跨研究分类词表、多随机种子、嵌套研究级交叉验证、年龄/药物等协变量检查、独立疾病与人群任务及充分消融。本工程提供这些工作的可审计起点。

默认语言语料很小；输出不流畅或出现 UTF-8 替代符 `�` 是小模型尚未学好有效字节组合的可能结果。LoRA 回归演示的目标特意具有低秩结构，只验证低秩参数更新机制；独立的 `finetune` 才执行回答监督的全参数或 LoRA-SFT。DPO 部分仅是公式与梯度实验。本工程没有完成真实生物医学指令模型验证、完整偏好训练或 RLHF。

## 8. 常见故障

| 现象 | 检查与处理 |
| --- | --- |
| `No module named curatemicrobiota` | 确认当前目录就是含本 README 的 `project`；或执行 `python -m pip install -e .` 后再使用命令 |
| `No module named torch` | 查看 `doctor` 中的解释器路径，使用同一个解释器安装依赖 |
| Windows 的 `python` 打开商店或指向旧环境 | 使用 `py -3` 建环境，并直接执行 `.\.venv\Scripts\python.exe` |
| `Expected proportions...` | 检查原始单位，不能将百分数、counts 或混合分类层级直接输入 |
| `Subject leakage...` | 核对重复采样和跨研究重复受试者；将其放在同一分区，不能删除检查代码 |
| `Missing trained taxon columns...` | 核对 profiling 工具和 taxonomy 版本，区别未检出与未测量后再统一词表 |
| 验证损失不降，或最佳步骤为 0 | 这是有效实验结果；记录它，并只用训练/验证资料调试数据与优化设置 |
| `...changed after pretraining` | 数据或预处理已修改；明确新的实验目录和数据版本后重新训练 |
| 测试 AUC 为 `null` | 测试标签只有一个类别，无法定义 AUROC；需要重新设计有有效对照的评价队列 |

## 9. 参考来源

- Vaswani et al. *Attention Is All You Need*：https://arxiv.org/abs/1706.03762
- Hu et al. *LoRA: Low-Rank Adaptation of Large Language Models*：https://arxiv.org/abs/2106.09685
- Rafailov et al. *Direct Preference Optimization: Your Language Model is Secretly a Reward Model*：https://arxiv.org/abs/2305.18290
- PyTorch `CrossEntropyLoss`：https://docs.pytorch.org/docs/stable/generated/torch.nn.CrossEntropyLoss.html
- scikit-learn 指标定义：https://scikit-learn.org/stable/modules/model_evaluation.html
- curatedMetagenomicData 官方资源：https://waldronlab.io/curatedMetagenomicData/
- 官方 `returnSamples` 接口：https://waldronlab.io/curatedMetagenomicData/reference/returnSamples.html

本项目的教学代码独立编写；没有复制教材整章或再分发付费书籍。

本轮 39 单元补全、12 项独立验收与验证范围见 [COMPLETENESS_REVIEW.md](COMPLETENESS_REVIEW.md)。
