# 第 20 课 · 后训练全景：从答案监督到偏好优化

模板、mask、packing、LoRA/QLoRA、DPO、PPO与GRPO的目标和证据

版本：2026.10.21.2｜建议 240 分钟，可分次完成

## 学习目标

- 区分持续预训练、SFT、偏好优化与在线强化学习，并评价遗忘。
- 逐token验证聊天模板、答案mask与独立样本packing。
- 计算LoRA更新参数量，说明QLoRA的存储和计算精度。
- 推导DPO偏好margin、PPO裁剪和GRPO组内优势的作用。
- 按真实项目范围运行SFT与DPO机制实验，设计领域评价。

## 今日交付物

- 通过断言的答案mask与packing注意力矩阵。
- 全参数SFT与LoRA-SFT的报告对照。
- DPO、PPO、GRPO目标机制的数值记录。
- 覆盖领域能力、通用保留和失败类型的后训练评价卡。

## 先修准备

- 完成D8、D15、D18与D19，理解交叉熵、梯度与训练状态。
- 项目实验需已有runs/lm/model.pt；若未完成D6，先运行train-lm生成教学底座。

## 先区分数据分布、监督目标与更新方式

持续预训练通常在已有底座上继续做原始领域语料的下一token预测，让模型适应术语与写作分布；SFT用输入与目标回答示例教会任务格式和行为；偏好训练比较同一问题的多个回答；在线RL还要让当前策略产生样本，再由奖励信号更新。这些维度可以组合，不是互斥的产品名称。

全参数或LoRA描述哪些参数被更新，并不决定训练目标。相同LoRA结构可以用于领域预训练或SFT；DPO也可以配合参数高效适配。为一个实验写清“数据是什么、损失是什么、更新谁、如何评价”，比只写“做了微调”更准确。

领域训练可能损伤通用能力，即灾难性遗忘的一种表现。训练前后分别固定领域与通用验证任务，观察差异；可比较较小学习率、领域与通用混合、回放数据和较少更新。没有一种配方保证永不遗忘。文本损失下降也不能替代微生物事实准确性、证据支持或跨研究泛化评价。

## 聊天模板：角色最终仍要变成token

对话模型接收role与content结构后，模板把它转成一条token序列，包含角色标记、消息结束符和可能的回答起始标记。模型在预训练或后训练时见过哪种格式，推理就应遵循兼容约定。换一个看起来更整洁的模板，可能改变实际条件分布。

训练时完整答案已在序列中，推理时通常只给到assistant起始位置。不要让生成提示误加在训练答案之后，也不要让模板已加入的特殊符号在再次tokenize时重复添加。官方导读见https://huggingface.co/docs/transformers/chat_templating；检查渲染后的字符串与实际token ID，不能只看原始消息字典。

本项目TinyGPT使用教学字节词表和显式短提示，没有声称兼容任意现成聊天模型模板。迁移到外部底座时，保存tokenizer、chat_template与特殊token配置版本，并用一个最短对话验证角色边界、最后一个输入位置和第一个生成位置。

## 答案mask：正确的监督从第一个答案token开始

设提示有P个token，答案紧随其后。因果LM的输入为整序列[:-1]，目标为整序列[1:]；原始位置P的首个答案token，出现在移位目标的位置P−1。因此需要监督最后一个提示位置产生的logit，不能误把mask延长到P而漏掉首个答案token。

response-only SFT让提示和padding目标为ignore_index，答案及结束符参与CE。忽略提示的损失不等于提示不会影响梯度：答案预测仍通过注意力读取提示表示。下面将字节0仅用作补齐载荷，是否忽略由有效长度判定，避免因为某个合法token值等于补齐值而误删真实内容。

多轮对话还需决定监督所有assistant轮次还是仅最后一轮，并保存这项约定。截断后若只剩提示而没有有效答案，应显式处理，而不是得到除零或虚假的低loss。项目pack_sft_batch拒绝超出context的样本，避免默默把短问题改成另一个任务。

```python
import torch
prompt, response = 'Question: A?\nAnswer:', 'B\n'
sequence = list((prompt+response).encode('utf-8'))
P, valid_length = len(prompt.encode('utf-8')), len(sequence)
padded = sequence + [0,0,0]
x = torch.tensor(padded[:-1], dtype=torch.long)
labels = torch.tensor(padded[1:], dtype=torch.long)
original_target_position = torch.arange(1, len(padded))
ignored = (original_target_position < P) | (original_target_position >= valid_length)
labels[ignored] = -100
assert int(torch.nonzero(labels != -100)[0,0]) == P-1
assert bytes(labels[labels != -100].tolist()).decode() == response
assert x.shape == labels.shape
print('supervised target positions:', torch.nonzero(labels != -100).flatten().tolist())
```

## Packing：省padding需要保留任务边界

把多个短样本装入一个长序列能减少padding浪费，但必须定义它们是否允许相互读取。普通因果mask只阻止未来位置；放在后面的样本仍能看到前面的样本。EOS只是一个token，不自动改变注意力矩阵，也不会自动清除模型对前文的访问。

如果目标是独立训练样本，应使用同段且因果的block mask，配合正确的position IDs与答案标签。下面同段判定禁止第二段读取第一段。真实高效内核还需支持对应变长或分段语义，不能把一个数学上正确的布尔矩阵直接假定为所有后端都支持的参数格式。

另一种有意的训练约定允许跨文档上下文，这时应清楚记录而不是误称独立packing。检验方法是改变前一段文本，观察后一段logits是否保持不变；独立分段实现应满足相应隔离性质。不要通过打乱测试样本证明隔离，应直接检查计算可见范围。

```python
import torch
segment = torch.tensor([0,0,0,1,1,1])
causal = torch.ones(6,6,dtype=torch.bool).tril()
same_segment = segment[:,None] == segment[None,:]
allowed = causal & same_segment
assert causal[3,2] and not allowed[3,2]
assert allowed[4,3] and not allowed[3,4]
assert torch.all(allowed.diag())
print(allowed.int())
```

## SFT与LoRA：目标相同，参数更新空间不同

全参数SFT在答案CE上更新允许训练的全部底座参数。LoRA将线性权重改写为W=W0+(α/r)BA，W0冻结，A为[r,d_in]、B为[d_out,r]，新增参数r(d_in+d_out)。低秩约束作用于更新，不意味着原始W0本身低秩。

常见初始化让A随机、B为零，因此初始增量为零；首步A的梯度可能为零而B不为零，这不是必然的训练故障。本项目在两个qkv投影上用rank=2，宽度64、投影输出192，每层新增2×(64+192)=512，两层共1024个训练参数。必须检查requires_grad、optimizer参数列表与训练后冻结权重是否真的不变。

LoRA减少需要更新的状态，却不消除底座前向和相关反向计算。比较全参和LoRA时记录学习率、步数、数据与预算，不能把不同设置下的一次结果当作一般优劣结论。项目10个训练、4个固定验证的原创短对话用于检查训练链条，不能据此推断可靠科学问答能力。原始低秩适配见https://arxiv.org/abs/2106.09685。

## QLoRA：冻结低比特底座，在较高精度中适配

QLoRA把冻结底座以低比特形式存储，并通过反量化参与计算，把梯度传给低秩适配器。原始方案包含NF4、双重量化与分页优化器：NF4使用适合相关权重分布的非均匀量化码值，双重量化进一步压缩量化常数，分页策略处理内存压力。

“4bit训练”容易误导：它不是说所有激活、梯度和优化器状态都只有四位。适配器与计算路径使用更高精度，具体取决于实现与设备支持。简单的均匀取整演示不能当作NF4重现；只把模型文件变小，也没有证明峰值训练内存和任务质量达到论文结果。

应用前核对底座许可、量化后端、目标模块、dtype和适配器合并方式。比较同一数据划分的非量化LoRA与量化LoRA，记录损失、任务表现、峰值内存和延迟。本项目已经运行普通LoRA-SFT，QLoRA在本课是有原始依据的机制与设计拓展。

## 偏好数据：比较的前提比损失公式更早

一个偏好样本通常包含同一prompt、chosen和rejected。两答案应在同一信息条件下比较，评价标准需区分正确性、证据支持、相关性、格式和表达偏好。更长、更自信或更像论文的回答未必更正确；若标注主要偏爱这些表面特征，训练会强化它们。

有平局、部分正确或事实无法判定的对比，应保留标注结构或按明确规则筛选，避免制造假的强偏好。对领域任务，可让标注者先标出可核验的主张和对应来源，再做整体选择。按研究、文档家族与近重复问题划分，避免同一道题换种说法进入验证集。

偏好标签只是训练信号，不是真理标签。评价时保留与训练偏好来源不同的独立问题和人工复核；同时观察长度分布、拒答率、引用支持率等，判断分数提升来自真正任务改善还是优化了评审习惯。

## DPO：比较相对于参考模型的回答优势

对同一prompt，定义m=[logπθ(y+|x)−logπref(y+|x)]−[logπθ(y−|x)−logπref(y−|x)]。DPO最小化−logσ(βm)。回答log概率是答案及约定终止符各token条件log概率的和；提示与padding不参与。若改成长度平均，就改变了目标，不能不加说明地称为同一公式。

参考模型提供相对基准。对固定log概率的标量实验，增大chosen相对优势会降低损失；对chosen标量的导数为负，对rejected为正。真实模型共享参数，某个样本的更新可能影响其他回答，因此损失方向不等于所有任务都会改善。β来自带KL约束的推导，并影响训练尺度，需要通过独立评价选择。

下方检查公式与梯度符号，未构造偏好语料训练器。项目alignment-demo也只做固定policy/reference log概率的DPO目标实验。完整DPO还需要模型前向、参考概率、答案mask、偏好采样与验证，不能把一个标量loss变小报告为完成了人类偏好对齐。

```text
L_DPO = −log σ(β[(logπθ(y+)−logπref(y+))−(logπθ(y−)−logπref(y−))])
```

```python
import torch
import torch.nn.functional as F
policy = torch.tensor([-2.0,-3.0], dtype=torch.float64, requires_grad=True)
reference = torch.tensor([-2.3,-2.8], dtype=torch.float64)
beta = 0.2
margin = (policy[0]-reference[0])-(policy[1]-reference[1])
loss = -F.logsigmoid(beta*margin)
loss.backward()
improved_loss = -F.logsigmoid(beta*(margin.detach()+0.5))
assert policy.grad[0] < 0 and policy.grad[1] > 0
assert improved_loss < loss.detach()
print('DPO loss:', float(loss.detach()), 'grad:', policy.grad.tolist())
```

## RLHF与PPO：旧策略和参考策略不能混淆

典型RLHF流程先用比较数据学习奖励模型，再让策略生成回答，根据奖励和相对参考策略的约束更新。奖励模型可用−logσ(r_chosen−r_rejected)训练，但它只是偏好代理，过度优化可能钻评分规则的空子。InstructGPT原始流程见https://arxiv.org/abs/2203.02155。

PPO用采样时的旧策略π_old构造概率比r_t=πθ(a_t|s_t)/π_old(a_t|s_t)，并最大化min(r_t A_t,clip(r_t,1−ε,1+ε)A_t)。优势A衡量相对基线的收益，常由价值模型估计。reference策略用于偏离约束，与old策略承担不同角色；不能把两者分母混写。

裁剪目标限制继续沿有利方向改变概率所获得的收益，并不把实际概率比硬限制在区间内。例子显示优势为负时要注意乘法符号。完整PPO还有采样、奖励、价值训练、KL和停止规则；本课只验证目标机制，原始算法见https://arxiv.org/abs/1707.06347。

```python
import torch
ratio = torch.tensor([1.4,0.6,1.4,0.6], dtype=torch.float64, requires_grad=True)
advantage = torch.tensor([1.,1.,-1.,-1.], dtype=torch.float64)
clipped = ratio.clamp(0.8,1.2)
objective = torch.minimum(ratio*advantage, clipped*advantage)
assert torch.allclose(objective, torch.tensor([1.2,0.6,-1.4,-0.8], dtype=torch.float64))
(-objective.mean()).backward()
assert ratio.grad[0] == 0 and ratio.grad[3] == 0
print('surrogate:', objective.detach().tolist(), 'loss gradient:', ratio.grad.tolist())
```

## GRPO：用同题回答组构造相对优势

原始GRPO对同一问题采样一组回答，以组内奖励均值作基线、按标准差归一化，从而避免额外训练同样的价值模型。结果监督的简化优势为A_i=(r_i−mean(r))/(std(r)+ε)，通常将同一回答的结果优势用于其多个token，再进入带裁剪的策略目标及参考约束。

同一组必须对应同一问题，不能把不同难度问题的奖励随意混在一起归一化。全组奖励相等时优势为零，策略项没有组内差异信号；这可能是题目太易、太难或奖励区分度不足。加ε避免除零，不会凭空创造学习信号。代码明确使用总体标准差，其他实现的归一化细节可能不同。

奖励可来自人工偏好模型或可验证规则，但“能被程序判分”也需要正确的判分器。若只奖励回答含某个菌名，模型可以堆砌菌名得分。应保留奖励分项、采样多样性与外部正确率，观察是否出现奖励上涨而独立质量下降。完整GRPO训练与多次采样推理的成本也须计入预算。

```python
import torch
def group_advantage(rewards):
    return (rewards-rewards.mean())/(rewards.std(unbiased=False)+1e-8)
r = torch.tensor([0.,1.,1.,0.], dtype=torch.float64)
a = group_advantage(r)
flat = group_advantage(torch.ones(4, dtype=torch.float64))
assert torch.allclose(a, torch.tensor([-1.,1.,1.,-1.], dtype=torch.float64))
assert torch.equal(flat, torch.zeros_like(flat))
assert abs(float(a.mean())) < 1e-12
print('group advantage:', a.tolist(), 'equal reward group:', flat.tolist())
```

## 评价：把风格进步与领域可信度分开测量

后训练评价首先固定目标任务和输入信息：是遵循格式、总结给定论文、解释菌群特征，还是作外部研究预测？每种任务需要不同证据。response CE衡量目标文字的概率；偏好胜率衡量评审选择；二者都不能直接等同于科学结论正确率。

对有证据文本的回答，抽取可核验主张并检查来源是否真正支持；对数值任务检查单位、计算和置信区间；对知识缺失的问题观察是否明确不确定。自动评审需要防范位置、长度与措辞偏好，可交换答案顺序并抽样人工复核。报告题目数、题目来源和失败类别，而不是只给一个百分比。

持续预训练或SFT后还应复查通用任务、领域外问题和分布偏移。若目标是微生物研究辅助，外部研究留出、批次因素和可重复分析的重要性不会因为增加了聊天接口而降低。把现有模型、全参SFT与LoRA放在同一评价卡上，才看得出实际取舍。

## 项目验收：明确实现层与研究扩展层

项目finetune命令确实执行答案监督训练，支持全参数或qkv LoRA，并保存可加载的model.pt；LoRA另存adapter.pt和底座哈希。训练报告包含有效mask、验证loss、选中步数与冻结权重检查。阅读这些字段，比只看生成示例是否像自然语言更能验证实现。

alignment-demo执行DPO固定标量目标与梯度检查，课堂Python展示PPO和GRPO局部机制。完整偏好模型训练、在线采样RLHF与QLoRA没有在这个CPU项目中运行。它们的下一步应是先建立合适的标注数据和独立评价，再选择工具链，不能用演示结果填补证据空白。

最终提交一张后训练卡，说明数据来源、模板、有效监督位置、参数更新范围、目标公式、参考模型、评价与失败样例。若做领域预训练，补充通用能力保留；若做偏好优化，补充评审质量与奖励投机检查。这样项目既能展示机制，也能给后续真实研究留下清楚的接口。

## 动手实验 · 从可见监督位置到真实SFT报告

### 1. 逐token检查

独立运行第3节代码，将首个答案目标的位置与P−1对应。换一个中文提示后再次运行，解释字节数与字符数不同但索引逻辑不变。

检查什么：有效目标解码恰好等于答案及换行结束符，padding与提示目标全部被忽略。

### 2. 检验packing隔离

运行第4节矩阵，找出普通因果mask允许、独立段mask禁止的跨段位置。

检查什么：第二段首token不能读取第一段末token；本段内历史仍可见。

### 3. 运行全参数SFT

在project目录使用D6已有底座。若没有底座，先执行python -m curatemicrobiota train-lm --steps 100 --out runs/lm。

```bash
python -m curatemicrobiota finetune --checkpoint runs/lm/model.pt --out runs/sft --steps 30
```

检查什么：生成model.pt与训练报告，检查initial和selected验证response CE及选模步数；数值由实际底座决定。

### 4. 运行LoRA-SFT并核对冻结

用相同底座和固定教学pair训练，核对报告中的可训练参数量、adapter文件与frozen_base_unchanged字段。

```bash
python -m curatemicrobiota finetune --checkpoint runs/lm/model.pt --out runs/sft-lora --steps 30 --lora
```

检查什么：当前默认TinyGPT配置训练1024个适配参数；冻结底座保持不变，可通过generate加载完整模型状态。

### 5. 运行目标机制

执行第8、9、10节独立代码，再运行工程DPO标量实验。分别记录证明了什么数学性质，以及距离完整训练器还缺哪些组件。

```bash
python -m curatemicrobiota alignment-demo --out runs/alignment
```

检查什么：DPO对chosen标量导数为负、rejected为正；PPO裁剪值与手算一致；等等奖励组的GRPO优势为零。

### 6. 提交对照评价

选固定教学与新编域外问题，保存底座、全参SFT和LoRA回答；按格式、证据、正确性和不确定性记录，至少分析两个失败例。

检查什么：不把四个教学验证pair的loss变化扩展成科学可靠性的结论。

### 实验验收

- [ ] 五个独立机制代码块全部通过断言。
- [ ] 能准确定位首个答案token与padding的监督规则。
- [ ] SFT与LoRA报告可追溯至同一底座哈希。
- [ ] 能分别说清DPO参考模型、PPO旧策略和RLHF参考约束。
- [ ] 评价卡包含领域任务、通用保留、独立证据和失败类型。

## 论文导读

### QLoRA: Efficient Finetuning of Quantized LLMs (2023)

https://arxiv.org/abs/2305.14314

区分低比特存储、实际计算精度和可训练适配器。

- 读第3节NF4、Double Quantization与Paged Optimizers，把每项对应到哪份内存账。
- 读第4节比较设置，检查适配模块与超参数是否一致后再看效果。

**阅读问题：** 为什么QLoRA不能简单描述为所有训练张量都四位？

**参考思路：** 底座采用量化存储且冻结，前向和梯度传递涉及更高精度计算，适配器与优化器也有各自dtype。实际内存包含量化元数据和激活。

### Direct Preference Optimization: Your Language Model is Secretly a Reward Model (2023)

https://arxiv.org/abs/2305.18290

从参考策略与偏好概率理解一个可直接优化的目标。

- 读第4节式4到式7，观察同一prompt的归一化项怎样在奖励差中抵消。
- 对照本课margin代码，检查chosen/rejected顺序、β和log概率求和范围。

**阅读问题：** 为什么把两答案放在不同prompt下比较会破坏这个样本定义？

**参考思路：** 偏好模型假设同一条件下比较回答，条件项与任务信息不同后，差值不再表示同一问题的回答偏好；数据构造必须先满足条件一致。

### DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models (2024)

https://arxiv.org/abs/2402.03300

学习以同题回答组构造相对优势，并区分机制与整套RL系统。

- 读第4.1节图4与式1、3，标出PPO价值模型与GRPO组基线的差异。
- 读第4.1.2节结果监督，手算同一组奖励的中心化与标准化；同时检查参考KL项。

**阅读问题：** 组内优势为零是否说明模型已学会题目？

**参考思路：** 不一定，可能全答对、全答错或奖励无法区分。需要看绝对奖励与独立正确性，再决定改题目难度、采样或奖励。

## 练习与完整参考解答

### 练习 1. 提示有7个token，答案有3个token并另有1个EOS。移位后第一个和最后一个监督目标位置是多少？监督多少个位置？

提示：原始第k个零基位置成为目标的k−1位置。

参考解答：原始答案从位置7开始，到EOS位置10结束。移位目标监督位置6、7、8、9，共4个。前6个目标位置忽略；padding也忽略。最后提示token位置6的logit负责预测首个答案token。

### 练习 2. W0形状为[192,64]，LoRA rank为2，两个相同投影层共有多少适配参数？若B初始为零，为什么A首步梯度可能为零？

提示：每层参数为r(d_in+d_out)，再看BA对A的导数。

参考解答：每层2×(64+192)=512，两层1024。增量BA对A的导数含B，初始B为零时此分支对A梯度为零；对B的梯度含非零A，因此B可先更新，之后A得到信号。这不需要把底座解冻。

### 练习 3. DPO中chosen的policy/reference log概率为−4/−5，rejected为−3/−3，β=0.2。margin与loss是什么？chosen自身概率比rejected低是否就违背目标？

提示：先算相对参考的差，再取负logsigmoid。

参考解答：chosen相对增益为1，rejected为0，margin为1，loss=−logσ(0.2)≈0.5981。DPO比较相对参考优势，不要求不同长度回答的原始序列概率直接排序；实际序列概率求和和长度处理必须保持定义一致。

### 练习 4. 同题四个奖励为[0,0,0,0]，GRPO加ε后优势是什么？给出三个可能原因和下一步检查。

提示：分子也为零，ε只处理数值稳定。

参考解答：优势全为0，组内策略信号消失。可能全部回答错误、题目虽答对但奖励器失效，或奖励规则太粗无法区分。检查原始回答与独立判分，审查奖励分项，必要时调整题目难度或采样策略。不能仅增大β或训练步数期待从零优势中获得信息。

## 验收自测

### 1. response-only SFT中不计算提示loss意味着什么？

A. 提示不会进入模型
B. 提示没有任何梯度影响
C. 答案可以读取未来
D. 提示目标不监督，但答案仍可依赖提示

参考答案：D。mask控制哪些目标贡献损失，不删除提示在前向条件与梯度路径中的作用。

### 2. EOS能否自动保证packed样本互不读取？

A. 不能，需要合适的分段注意力语义
B. 能，任何模型都自动清除缓存
C. 只有中文能
D. 只要长度相同就能

参考答案：A。EOS是普通序列控制符号，不会自动修改所有实现的注意力可见范围。

### 3. PPO概率比中的分母通常是谁？

A. 奖励模型
B. 永远是最初预训练模型
C. 产生当前采样数据的旧策略
D. 验证集平均概率

参考答案：C。旧策略用于采样分布比值；参考策略用于偏离约束，两者角色不同。

### 4. QLoRA更新的主要对象是什么？

A. 所有4bit整数权重直接做Adam
B. 较高精度的低秩适配器，底座量化且冻结
C. 只有token ID
D. 冻结所有参数只改prompt

参考答案：B。量化底座参与计算和梯度传递，但其原始权重不作为普通全参数训练对象更新。

### 5. 本项目alignment-demo已经完成了什么？

A. 完整人类偏好采集与RLHF
B. 在线PPO多GPU训练
C. QLoRA科学领域对齐
D. 固定log概率下DPO损失与梯度机制

参考答案：D。它验证公式局部性质，没有训练完整偏好策略，也不能支持科学回答可靠性的结论。

## 收尾思考

- 你的领域后训练优先需要新知识分布、任务格式还是偏好反馈？有什么证据？
- 哪项评价能区分“回答更像专家”与“事实更正确”？
- 如果领域分数上升而通用能力下降，你怎样设定可接受的取舍？

下一步：D21继续把模型接入检索、工具与真实任务，通过证据链和可复现评价把学习到的机制转化为可靠应用。
