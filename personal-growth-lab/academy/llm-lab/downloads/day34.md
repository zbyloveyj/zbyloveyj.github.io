# 第 34 课 · 接上真实预训练模型：从文件快照到可复现适配

核对权重、词表、聊天模板和适配器；用离线验收连接从零模型与现成模型

版本：2026.10.21.4｜建议 240 分钟，可分次完成

## 学习目标

- 能按任务与资源选择基座、指令模型或嵌入模型，并说明它们的输入输出差异
- 能核对模型配置、权重、tokenizer与模板的共同版本，识别同词表大小但不同ID语义的错误
- 能执行无网络的快照一致性和LoRA合并机制实验
- 能使用可选脚本加载本地预训练快照，区分已执行流程与待下载权重实验
- 能将基座、适配器、量化方式、依赖与评价数据一并记录，避免只保存一个模型名字

## 今日交付物

- 两个独立运行的快照与适配器实验及断言结果
- 一份明确任务、资源上限、许可证与评价条件的模型选择表
- 一份包含完整revision与文件哈希的本地模型接入清单
- 有权重环境下的可选推理报告；无权重时明确保留未执行状态

## 先修准备

- 完成第3、8、16、20与24单元，理解embedding、LoRA、模板和资源账本
- 已有项目Python环境；两个核心机制实验只需标准库和CPU PyTorch
- 可选外部快照实验需要另建环境、安装transformers/safetensors，并自行按许可获得选定快照；核心课程不要求下载

## 先用任务合同筛选模型，而不是按参数量排队

把候选模型分为三类：基座语言模型接受文本续写，指令模型接受其训练约定的消息序列，嵌入模型输出用于比较的向量。名称相近或参数更多，不说明三者可以互换。一个文献证据检索任务首先需要合适的查询与文档编码器；把生成模型最后一层随意平均，并不能自动得到同等有效的检索器。

为CurateMicrobiota先写两项独立验收：能否稳定遵循输出合同，能否在保留问题上引用正确证据。再列CPU或GPU内存、最长输入、可接受延迟、语言、领域术语和许可条件。候选先做少量固定问题的可复现实验，再决定是否值得继续预训练或微调。模型选择是约束下的比较，不是宣称某个当前型号永远最优。

## 一个模型快照是一组相互约束的文件

接入对象通常包含架构配置、一个或多个权重分片、分片索引、分词规则、特殊token约定、聊天模板以及生成配置。每项解决不同问题：配置决定怎样建立网络，权重填充参数，tokenizer决定整数ID的语义，模板决定消息怎样进入模型。下载到了最大的权重文件，不代表已经拥有完整可运行快照。

词表大小相同只保证某些张量形状相容。若把ID0从microbe改成cohort，embedding的第0行仍是原先训练出的参数，模型不会知道词义被交换。下面故意制造这种形状完全兼容的错误，通过内容哈希检测文件变化。哈希能证明与已记录内容一致，不能单独证明来源可信、许可证适用或模型具备预期能力。

```python
import hashlib, json, tempfile
from pathlib import Path
# 原创微型文件夹具，不是假装下载了外部预训练模型。
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
with tempfile.TemporaryDirectory() as folder:
    root = Path(folder)
    (root / "config.json").write_text(json.dumps({"vocab_size": 2}), encoding="utf-8")
    (root / "tokenizer.json").write_text(json.dumps({"microbe": 0, "cohort": 1}), encoding="utf-8")
    manifest = {p.name: digest(p) for p in sorted(root.iterdir())}
    def check():
        if any(digest(root / name) != expected for name, expected in manifest.items()):
            raise ValueError("snapshot files changed")
    check()
    # 两个词表大小相同，ID语义却已互换。
    (root / "tokenizer.json").write_text(json.dumps({"microbe": 1, "cohort": 0}), encoding="utf-8")
    try:
        check()
    except ValueError:
        rejected = True
    else:
        rejected = False
    assert rejected
    print({"same_vocab_size": True, "changed_tokenizer_rejected": rejected,
           "frozen_files": sorted(manifest)})

```

## 锁定revision，再记录下载与环境

完整提交标识比可移动的main分支更适合复现实验。使用Hub下载工具时，明确仓库ID、完整revision、目标目录和需要的文件；对照官方文档的revision参数核验行为。记录模型卡、获取日期、文件清单与SHA-256，保留实际下载版本。不能在论文只写“使用某模型最新版”，半年后再用同名入口替代。

依赖也要记录。PyTorch、Transformers、PEFT和底层kernel版本会影响支持的架构、参数名、数值或缓存接口。可选实验建议独立环境安装后保存pip freeze输出，不改动已经跑通的核心CPU环境。模型文件固定与软件环境固定相辅相成；只做其中一项仍可能无法重现。平台驱动与硬件属于额外条件，不能由requirements文件完全描述。

## 读取快照时限制执行范围，离线不等于无条件可信

本课可选脚本只接收用户已准备的本地目录，使用local_files_only=True、trust_remote_code=False和safetensors权重，不自动联网、不运行仓库里的自定义Python模块。部分架构若必须依赖自定义代码，会在此路径失败；应先核验代码和所需环境，再决定另开实验，不通过关闭检查来掩盖不兼容。

序列化格式与模型可信度不是同一层判断。safetensors和受限权重加载减少某些反序列化风险，但不能验证科学事实、训练来源或模型行为，也不保证任意巨大文件都能装入内存。现有TinyGPT仍使用本项目自己生成的可信.pt检查点，并显式指定weights_only=True。文件来源、计算预算与输出评价应分别验收。

## 聊天模板要检查token边界，而不仅是肉眼文字

对话列表最终会变成一个token序列。不同指令模型对角色开头、消息结束和回答开始有不同约定，不能把另一个模型的模板原样套进来。应调用快照自己的apply_chat_template，并检查实际input_ids、特殊token和生成起点；只有user文字相同，不足以说明两种模板产生了相同输入。

可选脚本先将消息按模板渲染为文本，再分词时设置add_special_tokens=False，避免重复添加已经由模板带入的特殊标记。没有聊天模板时，脚本标为raw_text_continuation，仅执行原始文本续写，不臆造system/user标记。缺少模板不能证明它是基座；若模型卡说明它是指令模型，应回查缺失文件或模板约定后再评估。做SFT还必须检查首个回答token是否受监督，推理阶段则检查是否已添加开始回答的前缀；两个阶段不能机械共用所有模板开关。

## 设备、精度与上下文预算各自验证

模型权重的磁盘大小只是资源下界，加载时可能有临时副本，推理还需要激活、logits和缓存。可选脚本为教学固定CPU和FP32，并设权重文件体积与上下文上限；这些上限不是生产环境的容量估计。若切换GPU、低精度或device_map，应重新测量峰值和数值结果，不能沿用CPU报告当作新环境证据。

对输入先按真实tokenizer计数，再预留输出长度。项目TinyGPT的一个token是一个字节，外部模型通常不同，因此中文字符数不能直接共用作预算。超过上限应缩短资料、重新检索或明确采用分段策略，不静默裁掉问题或证据限定条件。批量推理还要检查padding方向、attention_mask与模型位置规则，不能只看单条请求恰好能运行。

## 适配器属于哪一个基座，是一项必须保存的关系

LoRA适配器通常只保存增量参数与适配配置，加载时还需要正确基座。至少记录基座revision、目标层名、rank、alpha、训练精度与tokenizer版本。若SFT扩充了特殊token或改变embedding，还要明确相关完整参数是否保存；仅拿adapter文件配另一个同尺寸模型，不能保证意义或输出正确。

PEFT官方检查点说明把adapter权重与原模型明确分开。本工程完整LoRA模型.pt可以由自己的生成入口重建适配结构；单独adapter.pt不具有这个等价地位。外部PEFT文件也不能直接交给TinyGPT加载。格式转换应先写键名与张量shape映射，再比较固定输入的logits，不能靠改扩展名或忽略missing keys完成。

## 合并LoRA要证明等价，也要保留可回退的原件

对没有额外随机操作的普通线性层，前向中的W与低秩更新可以合成W加上alpha除以rank乘BA。下面用float64检验同一输入在分支形式与合并形式的输出一致，并故意替换基座权重，观察同一个适配器不再给出原结果。它验证线性代数关系，不是实际替任意模型执行了PEFT导出。

量化基座、混合精度、某些适配变体或特殊层可能带来额外约束与舍入误差。正式导出前按对应版本文档检查是否支持合并，保存原始基座、adapter和导出目录，比较若干固定输入的最大logit误差与任务指标。合并后无法自由开关适配器的模型，与原来可切换适配器的运行对象也不同。

```text
W_merged = W_base + (alpha / rank) B A
x W_merged^T + b = x W_base^T + b + (alpha / rank) (x A^T) B^T
```

```python
import torch
from torch.nn import functional as F
torch.manual_seed(34)
torch.set_num_threads(1)
# 一个线性层的代数验收；不宣称任意量化模型都可以无损合并。
x = torch.randn(5, 4, dtype=torch.float64)
weight = torch.randn(6, 4, dtype=torch.float64)
bias = torch.randn(6, dtype=torch.float64)
a = torch.randn(2, 4, dtype=torch.float64)
b = torch.randn(6, 2, dtype=torch.float64)
scale = 4 / 2
adapted = F.linear(x, weight, bias) + scale * F.linear(F.linear(x, a), b)
merged_weight = weight + scale * (b @ a)
merged = F.linear(x, merged_weight, bias)
torch.testing.assert_close(merged, adapted, rtol=1e-12, atol=1e-12)
wrong_base = F.linear(x, weight + 0.1 + scale * (b @ a), bias)
assert not torch.allclose(wrong_base, adapted)
print({"merge_max_error": float((merged-adapted).abs().max()),
       "wrong_base_changes_output": True})

```

## 可选实践：只从你核验过的本地目录加载

工程新增scripts/run_hf_snapshot.py，要求本地目录包含config.json和safetensors权重，并使用自己的tokenizer。脚本不会选择或下载模型。准备快照时可参考命令hf download REPOSITORY_ID --revision FULL_COMMIT_SHA --local-dir models/chosen；大写部分必须替换为你核验的真实仓库与版本，不能把占位符当作已经获得的数据。

先在独立环境安装兼容的torch、transformers与safetensors，然后运行python scripts/run_hf_snapshot.py --snapshot models/chosen --prompt "Explain why an external cohort matters." --max-new-tokens 24。输出记录软件版本、文件哈希、输入类型与实际生成长度。此项在课程交付中属于需自备权重的可选实验，没有外部模型运行结果；两个无网络机制实验则不受影响。

## 接入验收与科学能力验收分开设计

第一层验收是文件与接口：指定版本可加载、输入输出形状匹配、模板明确、停止条件可解释。第二层是数值回归：相同快照与确定性设置下，保存参考logits或给定容差的输出，不把随机采样字符串必须完全相同作为跨硬件的唯一标准。第三层才是任务能力：在固定保留问题上评价证据支持、实体归一和无答案处理。

如果换了模型、量化方式、adapter或模板，沿用同一组接入检查和保留评价。报告每个组件的版本、错误类型和资源变化，不仅展示最好的一条回答。领域术语读起来更像专家，可能只意味着格式或语言适应；只有独立评价才能说明任务改善。训练集中的问答不能再次充当“外部科学能力测试”。

## 把模型接入合同带回你的微生物项目

为真实研究建立两份互相引用的清单：语言助手记录文本模型和证据库，菌群编码器记录taxonomy、丰度单位和预处理状态。两者都需要版本和输入合同，但不能共用同一个tokenizer或把生物物种ID当作文本词表ID。系统组合时明确是谁输出证据、是谁输出样本向量，以及哪项结论实际经过外部验证。

本单元完成的标志，是你能解释一次加载需要哪些文件、哪些文件变化会让旧结果失效，并能给出两个实际执行的断言实验。可选快照任务若缺少许可确认、硬件或文件，按缺失条件记录即可；不要为了勾选完成而伪造生成结果。补齐条件后沿同一合同运行，才把“会看模型名字”转变为“能接入并审查模型”。

## 动手实验 · 建立并检验一个外部模型接入合同

### 1. 验证快照文件一致性

运行第2节独立脚本，保留tokenizer大小相同而内容改变仍会被发现的输出。

```bash
python lesson_examples/unit34/d34-02.py
```

检查什么：changed_tokenizer_rejected为true；说明哈希不是许可证或事实正确性的证明。

### 2. 验证低秩合并关系

运行第8节脚本，手算矩阵形状并检查wrong_base反例。

```bash
python lesson_examples/unit34/d34-08.py
```

检查什么：合并前后满足1e-12容差，更换基座会改变结果。

### 3. 填写模型选择与快照清单

选择一个任务，写出模型类型、资源上限、完整revision、文件清单、模板、许可证来源和保留评价题；没有选定真实模型时保留待选状态。

检查什么：没有仅记录模型简称，也没有把不同tokenizer的token预算混在一起。

### 4. 按条件完成可选本地快照推理

只有已核验快照和独立依赖环境时执行；缺少条件时记录未执行与缺失项。脚本本身不下载任何模型。

```bash
python scripts/run_hf_snapshot.py --snapshot models/chosen --prompt "Explain why an external cohort matters." --max-new-tokens 24
```

检查什么：实际执行时得到文件哈希、软件版本与真实输出；不把输出流畅当作微生物知识验证。

### 实验验收

- [ ] 两个核心脚本实际运行，篡改词表反例和错误基座反例均通过
- [ ] 能够逐项解释配置、权重、tokenizer、模板、adapter和依赖的关系
- [ ] 能说明离线加载、受限加载和任务可信度分别解决什么问题
- [ ] 可选外部权重实验明确标记执行状态与实际环境
- [ ] 模型接入验收与保留科学任务评价分别保存

## 论文导读

### Hugging Face Hub — Download files from the Hub (2026)

https://huggingface.co/docs/huggingface_hub/guides/download

核对固定revision和本地快照的操作合同。

- 只阅读版本选择与snapshot_download相关部分，记录你使用的客户端版本。
- 比较可移动分支名与完整提交哈希对复现的影响。

**阅读问题：** 完整revision解决了所有复现问题吗？

**参考思路：** 没有。还需记录实际文件、依赖、硬件、输入和推理设置。

### Hugging Face Transformers — Chat templates (2026)

https://huggingface.co/docs/transformers/en/chat_templating

把消息结构与真实token序列对应起来，检查重复特殊token。

- 比较同一消息在两个模板中的控制标记。
- 解释tokenize=False后再次分词时为什么要检查add_special_tokens。

**阅读问题：** 指令模型能否直接使用任意角色标记？

**参考思路：** 不能默认可以，必须使用其训练约定并评价实际行为。

### Hugging Face PEFT — Checkpoint format (2026)

https://huggingface.co/docs/peft/en/developer_guides/checkpoint

理解adapter文件、配置与原始基座的依赖关系。

- 列出adapter_model与adapter_config分别保存什么。
- 辨认完整合并模型与适配器检查点的区别。

**阅读问题：** 只有adapter文件时能否恢复模型？

**参考思路：** 需要对应基座和配置；若另有训练过的embedding等模块也必须恢复。

### Hugging Face Transformers — Security policy (2026)

https://github.com/huggingface/transformers/security/policy

核对模型文件来源与自定义代码执行的不同风险。

- 找出safetensors和trust_remote_code的适用边界。
- 把来源核验、文件格式和资源预算分别写入加载清单。

**阅读问题：** safetensors是否保证模型回答真实？

**参考思路：** 不保证，序列化格式与科学事实评价属于不同层面。

## 练习与完整参考解答

### 练习 1. 两个模型的词表都为32000，能否互换tokenizer？

提示：分别检查维度和ID含义。

参考解答：不能仅凭大小互换。词表ID映射、规范化、特殊标记与合并规则都可能不同。即使embedding shape完全兼容，输入语义也会错位。应匹配实际快照；确需扩展或迁移词表时，明确参数映射、初始化和重新训练方案，并重新评价。

### 练习 2. 某adapter在基座A上有效，换成同尺寸基座B后输出异常。如何定位？

提示：从文件版本、目标层和参数更新的参照点逐层检查。

参考解答：先核对原始基座revision/哈希、tokenizer和adapter配置，再确认层名与权重键严格匹配。LoRA学到的是相对于A的更新，形状相同不意味着与B相容。恢复原组合进行固定输入logit对照；不能仅通过strict=False忽略缺失键，让加载成功替代正确加载。

### 练习 3. 模板已经包含BOS，渲染文本后再按默认分词添加BOS，会发生什么？

提示：检查实际input_ids而不是打印的消息列表。

参考解答：可能出现重复特殊token，改变模型看到的前缀分布。采用模型官方模板并核对其输出；若先渲染文本，通常应避免再次自动添加已存在的特殊token。正确设置依模板而定，应保留token级样例与生成起点作为回归检查。

### 练习 4. 低精度导出后首条回答很好，能否发布“无损合并”？

提示：对照数值、任务和资源三种证据。

参考解答：不能由单条随机回答推出无损。先比较固定输入的logits及容差，再用同一保留任务集检查能力变化，并报告精度、量化方式与资源差异。普通线性层的精确代数等式不保证任意量化导出在浮点计算中逐位相同。保存原始可回退文件，并准确写出误差与测量范围。

## 验收自测

### 1. 固定完整模型revision主要用于什么？

A. 固定所选仓库的具体内容版本
B. 保证每条科学结论正确
C. 自动补齐所有依赖
D. 让任意adapter通用

参考答案：A。revision定位版本，仍需依赖和输入合同。

### 2. 哪个情况说明tokenizer可能仍不匹配？

A. 字典文件校验一致
B. 同样的词表大小但ID含义改变
C. 模板来自相同快照
D. 加载时记录完整版本

参考答案：B。维度相同不表示ID语义相同。

### 3. 本课可选快照脚本会自动做什么？

A. 训练一个新基础模型
B. 下载所有热门模型
C. 只从指定本地目录加载并记录结果
D. 绕过缺失依赖

参考答案：C。脚本无自动下载，外部权重需自行准备并核验。

### 4. 普通线性层LoRA合并权重是什么？

A. W+AB且不用检查形状
B. 只保留B
C. 把W删除后保留A
D. W+(alpha/rank)BA

参考答案：D。本课按PyTorch线性层的权重布局采用BA更新。

### 5. 哪一项可以证明外部模型具备领域任务能力？

A. 文件很大
B. 能成功加载
C. 回答使用专业词汇
D. 固定保留任务上的预先定义评价

参考答案：D。接入成功与领域能力是不同验收层级。

## 收尾思考

- 如果我今天只保存模型名字，一年后会失去哪几项复现信息？
- 我能否从一条消息追踪到具体token ID，再追踪到对应参数行？
- 模型、adapter和模板分别变化时，我会先运行哪项最小回归检查？

下一步：进入第35单元，训练一个微型双塔检索器，理解检索向量为什么需要自己的目标、负例与评价。
