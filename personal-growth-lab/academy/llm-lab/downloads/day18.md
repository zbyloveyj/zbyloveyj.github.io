# 第 18 课 · 训练工程：把一次下降变成可恢复的实验

数据加载、有效token累积、AMP、调度、检查点与故障定位

版本：2026.10.21.4｜建议 240 分钟，可分次完成

## 学习目标

- 把微批次、有效batch、优化器更新与训练token数分开计量。
- 证明不同长度微批次的正确梯度累积，并识别错误平均。
- 解释autocast、梯度缩放、裁剪和调度的执行次序。
- 运行模型、优化器、调度器和随机状态的完整CPU恢复实验。
- 用样本轨迹、梯度与验证日志定位训练失控。

## 今日交付物

- 可复现的数据顺序与有效token计数例子。
- 微批次梯度与整批梯度一致的数值断言。
- runs/resume/report.json及恢复状态清单。
- 一张症状、证据、下一步实验构成的诊断表。

## 先修准备

- 完成D6、D15、D16；理解反向传播、AdamW、文档划分和随机种子。
- 能在project目录运行python -m curatemicrobiota doctor。

## 训练是一台状态机，而不仅是for循环

同一组模型权重不唯一决定下一次更新。AdamW的一阶与二阶矩、当前学习率、下一批数据、dropout随机数、累积了多少梯度都会影响下一步。训练工程的核心是把这些隐含状态显式化，让任何指标都能对应到数据版本、计算预算和执行位置。

定义microstep为一个微批次的前后向，update为一次优化器更新，epoch为一种数据遍历约定。流式重采样语料可能没有有用的“完整一轮”，此时按已消费有效token记录进度。日志同时写update、microstep、有效token、学习率与损失，避免把跑了相同步数误认为用了相同预算。

本课可以拆为两次120分钟。前半关注数据与梯度的正确性，后半关注状态恢复与诊断。先在小CPU实验中建立相等性证据，再讨论GPU的性能行为；把能复现错误的小用例保存下来，通常比堆积更多日志更有效。

## DataLoader：顺序、批处理与随机源

Dataset描述怎样取得样本，sampler描述访问索引的顺序，collate处理一个batch的拼接、补齐和标签。map-style数据通常支持索引；iterable-style数据由迭代器产生流。多进程读取流时，必须让不同worker读取不同分片，否则容易重复消费同一条数据。

先用num_workers=0验证样本ID、长度和边界，再增加worker与预取。对可复现打乱，给DataLoader传入独立Generator，避免模型初始化消耗全局随机数后改变采样顺序。worker中的NumPy或自定义随机变换也需要其自己的种子策略。固定一个初始seed无法概括所有进行中的状态。

下面在同一环境中验证相同generator初始状态产生相同顺序。它不证明跨版本、跨设备或任意worker配置都逐位相同。实际语料记录文档ID和窗口起点；这样发现损失突变时，可以回到触发问题的具体样本，而不是凭训练曲线猜测。

```python
import torch
from torch.utils.data import TensorDataset, DataLoader
def order(seed):
    dataset = TensorDataset(torch.arange(11))
    generator = torch.Generator().manual_seed(seed)
    loader = DataLoader(dataset, batch_size=4, shuffle=True,
                        num_workers=0, generator=generator)
    return [int(v) for batch in loader for v in batch[0]]
a, b = order(18), order(18)
assert a == b and sorted(a) == list(range(11))
print('sample order:', a)
```

## 变长数据的梯度累积必须按分母推导

设第j个微批次有n_j个有效目标token，损失和为S_j。目标若是所有有效token的平均损失，应使用L=ΣS_j/Σn_j。直接把各微批次平均loss相加再除微批次数，只在每批有效目标数相同时才等价。SFT的答案长度不一，提示与padding被忽略，因此尤其容易触发这个错误。

例如两批分别有2和6个有效token，平均损失是1和3。正确总平均为(2×1+6×3)/8=2.5，而简单平均给2。更关键的是梯度也被错误重加权。下面用平方损失独立验证这一代数性质；语言模型应将同样原则用于ignore_index排除后的CE有效位置。

可以先取得一个累积组的有效目标总数，再将每个微批次的sum loss除以总数后backward。最后一个不完整累积组必须用自己的实际分母。若总有效数为零，应记录并跳过更新，不要让0/0产生NaN。dropout和浮点累加顺序会使真实大模型的微批次与整批不一定逐位一致，机制验证先关闭这些干扰。

```text
L = (Σ_j S_j)/(Σ_j n_j)；∇L = Σ_j ∇S_j/(Σ_j n_j)
```

```python
import torch
x = torch.tensor([1.,2.,3.,4.,5.], dtype=torch.float64)
y = torch.tensor([0.,1.,0.,2.,1.], dtype=torch.float64)
w_full = torch.tensor(0.3, dtype=torch.float64, requires_grad=True)
((w_full*x-y).square().mean()).backward()
w_acc = w_full.detach().clone().requires_grad_()
for sl in [slice(0,2), slice(2,5)]:
    loss_sum = (w_acc*x[sl]-y[sl]).square().sum()
    (loss_sum/len(x)).backward()
assert torch.allclose(w_full.grad, w_acc.grad, atol=1e-12)
print('full / accumulated gradients:', float(w_full.grad), float(w_acc.grad))
```

## 更新次序与调度时钟

一次有效更新的基本流程是清空旧梯度、完成全部微批次前后向、得到未缩放梯度、裁剪、优化器更新，再按选定约定推进学习率调度。清空梯度放在每个微批次之前，会破坏累积；每个微批次都scheduler.step，又会把调度速度意外放大。

warmup可把学习率从较小值逐步升到峰值，之后用余弦等策略下降。要记录调度按update还是token推进，并保存总预算。恢复时改变总步数，会改变后续曲线，即使当前学习率相同也不等价。常见PyTorch逐步调度器在optimizer.step后调用scheduler.step，仍需核对具体调度器的初始化与计数约定。

梯度裁剪控制范数，而不是修复错误的数据或标签。先记录裁剪前范数及发生频率；如果每次都强烈裁剪，应检查学习率、序列长度和损失分母。AMP溢出可能跳过优化器更新，调度与全局update计数也应遵循真实发生的更新，不能把一次失败的尝试当作完成了训练。

## AMP：计算精度与梯度缩放是两件事

autocast按算子选择计算精度，模型并不是所有张量都被永久转换成半精度。FP16的动态范围比BF16窄，小梯度可能下溢；GradScaler先放大损失，使反向中的梯度进入可表示范围，再在更新前还原。BF16常不需要同样的梯度缩放，但仍需检查有限值和算子支持。

使用缩放时，整个累积组保持相同缩放因子；在所有微批次backward结束后，对该优化器unscale一次，然后裁剪未缩放梯度，接着scaler.step和scaler.update。若在累积中途还原部分梯度，再叠加仍放大的梯度，会把不同单位相加，结果没有正确意义。

本课CPU恢复实验没有启用AMP。GPU版本需要把GradScaler状态纳入检查点，并记录跳过更新次数。先在FP32建立基线，再引入autocast对比损失、有限值比例和吞吐；速度是否改善由设备与算子决定，不根据“用了半精度”推断。官方AMP示例是执行顺序的核对依据，见本课导读。

## 验证循环也必须定义统计对象

验证时切换eval并关闭梯度记录，结束后恢复train状态。eval影响dropout等模块，no_grad影响自动求导，两者作用不同。验证平均CE应把所有有效目标的损失和除以有效目标数，而不是平均不同大小batch的均值。若只抽取固定窗口，要明确它是采样估计。

不要每次改变验证随机窗口后，把波动解释为模型退步。固定评价样本或至少报告采样规则，使不同检查点可比。按验证成绩选最佳检查点是模型选择过程；反复据此调整数据与超参数，会逐渐消耗验证集的独立性，因此最终测试集应保持封存。

日志建议保留总体与数据源分层的CE、有效token数和长度分布。CurateMicrobiota的领域文本与通用中文可分别观察；如果领域损失改善而通用部分恶化，可能是迁移取舍，而非一次总体平均能解释的事情。对疾病相关终端任务，还要使用独立研究划分与适当任务指标。

## 完整检查点：保存下一步所需要的状态

用于推理的权重文件与用于继续训练的检查点有不同契约。完整训练状态至少包含模型、优化器、调度器、更新计数、随机数状态、采样器位置以及数据和tokenizer版本；使用AMP时还包括scaler。若在累积中途保存，还要保存未完成梯度与微步位置，因此教学实验选择优化器边界保存。

CPU Torch随机数控制dropout等操作，独立Generator控制抽样，Python和NumPy也可能参与数据增强或权重。仅重新manual_seed会回到序列开头，而不是中断的位置。下方代码验证“保存当前位置再恢复”的区别。对象重新初始化会消耗随机数，所以应在初始化及加载后恢复需要延续的随机状态。

多worker预取可能已经提前消费样本，光存epoch和batch编号未必足够。流式读取还可能需要分片、游标与缓存状态。恢复契约应写清固定的环境与未覆盖环节；一份能说明边界的可重复检查点，比声称支持所有环境更有工程价值。

```python
import torch
g = torch.Generator().manual_seed(1807)
_ = torch.rand(3, generator=g)
state = g.get_state().clone()
expected = torch.rand(5, generator=g)
_ = torch.rand(99, generator=g)
g.set_state(state)
resumed = torch.rand(5, generator=g)
assert torch.equal(expected, resumed)
restarted = torch.rand(5, generator=torch.Generator().manual_seed(1807))
assert not torch.equal(expected, restarted)
print('restored stream equal:', torch.equal(expected, resumed))
```

## 用连续训练与中断训练做等价实验

advanced.resume建立两条路径：一条连续完成12次更新；另一条在第5次更新边界保存，再初始化对象、加载状态并完成剩余更新。模型有dropout，每次更新累积两个微批次；采样器与Python、NumPy随机数也实际参与计算，因此缺失状态会有机会改变后续轨迹。

比较对象应包含逐步loss、最终参数与学习率，而不只是“恢复命令没报错”。本项目提供的CPU单线程固定配置实跑中，loss序列完全一致、最大参数绝对差为0。这说明该受控恢复契约成立，不覆盖GPU非确定性内核、多worker预取、分布式rank或累积中途恢复。

检查advanced.py中的corpus_sha256与total_steps一致性约束。若数据内容或调度总预算变了，系统应明确拒绝把它称为原实验的精确延续。允许有意开始一个新的训练分支，但需新建运行记录，并写明哪些状态继承、哪些被重置。

## 故障诊断：一次只改变一个可解释因素

loss为NaN时，先检查输入、标签、有效分母与前向有限值，再检查梯度和更新后的权重。若首个非有限值出现在softmax之前，可疑原因与优化器状态溢出不同。保留触发batch，尝试在FP32和小学习率下复现，而不是同时修改五个超参数后失去因果线索。

loss不下降时检查标签移位、答案mask、梯度是否None、参数是否真的在optimizer中。小数据过拟合测试可验证学习链条，但不能证明泛化。恢复后立刻跳变时优先核对学习率、optimizer动量、样本顺序与训练模式；吞吐低则分别测数据等待、前向、反向和保存耗时。

设参数范数为||θ||，更新相对量为||Δθ||/(||θ||+ε)。它帮助发现参数根本没更新或更新异常大，但没有跨模型通用的万能阈值。为每个异常写“观察到什么、至少两个解释、下一项区分实验”，比只给红色警报更便于修复。

| 症状 | 优先核对 | 区分实验 |
| --- | --- | --- |
| 恢复后loss突变 | 优化器、LR、RNG、样本游标 | 比较首个恢复batch和更新前权重 |
| SFT loss过低 | mask与目标泄漏 | 打印逐token输入/目标/有效标记 |
| GPU等待而CPU繁忙 | 读取、分词、collate | 固定内存batch对比 |
| 频繁跳过更新 | 缩放溢出与非有限值 | 同一batch用FP32重算 |

## 把训练报告写成可以审查的证据

一份可审查报告记录代码版本、配置、数据哈希、tokenizer哈希、环境、实际消费token、选模规则和输出文件。指标必须带统计口径，例如nats/有效byte、response-only CE或跨研究AUROC。把不同口径放在同一曲线上比较，会制造本不存在的进步。

训练结束后保存最终状态与最佳验证状态的关系。若只保留最佳模型用于演示，应明确它对应第几次更新，避免误认为它代表最后一步。恢复文件通常更大，因为Adam状态并非可有可无；部署时可以导出精简权重，但仍保留训练记录支持追溯。

最后用失败预演检验流程：中断一次、恢复一次、用固定输入核对结果；让数据哈希不一致的情形明确报错；检查输出目录不会把旧实验混写。这样的工程训练能直接迁移到领域模型，帮助你判断问题来自数据、目标、实现还是计算预算。

## 动手实验 · 有效梯度与完整CPU恢复实验

### 1. 建立批次轨迹

运行第2节代码，把样本ID顺序写入学习记录；解释相同初始Generator与恢复中途Generator分别解决什么问题。

检查什么：相同seed得到相同11个ID排列，每个ID恰好出现一次。

### 2. 验证变长累积

运行第3节代码，再把两批长度从2与3改为1与4。保持sum loss除以全组目标总数，比较梯度。

检查什么：两种拆分的累计梯度都与整批均值梯度一致。

### 3. 验证随机流恢复

运行第7节代码，识别get_state与manual_seed的区别。将全局Torch与独立Generator画成两条单独的状态线。

检查什么：从保存位置继续的随机数与预期完全相同，重置种子得到的起始序列不同。

### 4. 运行完整训练恢复

在project目录运行独立机制实验，读取report.json的loss_sequences_exactly_equal、parameters_exactly_equal和not_covered。无需重跑主课程100步训练。

```bash
python -m curatemicrobiota.advanced resume --out runs/resume
```

检查什么：生成checkpoint.pt和report.json。在提供的CPU固定配置中，两路径loss完全一致且最大参数差为0。

### 5. 审阅状态覆盖

对照advanced.py列出模型、AdamW、scheduler、Torch/采样器/Python/NumPy RNG、数据哈希和更新边界。另列若改成AMP、多worker、DDP需要补齐的状态。

检查什么：提交明确区分已验证恢复范围与扩展工作项的一页实验卡。

### 实验验收

- [ ] 能手算不等长度微批次的正确平均并解释梯度分母。
- [ ] 至少三个机制代码块通过断言。
- [ ] 恢复报告的逐步loss、参数与LR比较全部通过。
- [ ] 能说明原train-lm的推理检查点与advanced恢复检查点的契约不同。
- [ ] 诊断记录至少包含一次可复现错误的假设与区分实验。

## 论文导读

### PyTorch 官方：Automatic Mixed Precision examples (2026)

https://docs.pytorch.org/docs/2.14/notes/amp_examples.html

用官方示例核对缩放、累积与裁剪的顺序，避免把不同单位的梯度相加。

- 读Typical Mixed Precision Training中的autocast与GradScaler分工。
- 读Gradient clipping与Gradient accumulation；逐行标记unscale、step、update执行的边界。

**阅读问题：** 为何累积中途不能随意unscale或更新缩放因子？

**参考思路：** 已有梯度与新梯度会处于不同缩放单位，无法还原为同一个目标的梯度。整个有效batch应完成累积后再还原。

### PyTorch 官方：torch.utils.data (2026)

https://docs.pytorch.org/docs/2.14/data.html

厘清Dataset、sampler、worker和generator分别持有什么状态。

- 读Dataset Types与Data Loading Order and Sampler，区分索引访问和流式数据。
- 读Randomness in multi-process data loading及generator参数，列出你的数据管道使用的随机源。

**阅读问题：** num_workers增加后为何可能重复流式样本？

**参考思路：** 多个worker若持有相同迭代源且没有分片，会各自输出同一段内容；必须明确每个worker与rank的消费范围。

### PyTorch 官方：Saving And Loading A General Checkpoint (2026)

https://docs.pytorch.org/tutorials/recipes/recipes/saving_and_loading_a_general_checkpoint.html

理解state_dict恢复模型与优化器，再结合本课补齐采样和随机状态。

- 读Save与Load示例，找出model和optimizer分别恢复在哪里。
- 将官方通用示例与advanced.py比较，标记本项目额外保存的数据哈希、scheduler和RNG。

**阅读问题：** 只加载模型state_dict后继续AdamW，为什么不是同一次训练？

**参考思路：** 动量与二阶矩重新初始化，更新方向和尺度发生变化；再加上采样与调度位置变化，下一步通常不一致。

## 练习与完整参考解答

### 练习 1. 两微批次各有3和9个有效token，平均CE分别为2和4。正确总体CE是多少？每批平均loss在backward前乘什么权重？

提示：先把均值变回总和。

参考解答：总体CE=(3×2+9×4)/12=3.5。两批均值分别乘3/12和9/12。若都乘1/2会得到3并改变优化目标。padding与prompt被忽略后，分母必须使用真正有效的目标数。

### 练习 2. 恢复后第一个batch相同、模型初始权重相同，但更新结果不同。列出四个检查项及顺序。

提示：前向、梯度、优化器、调度各有状态。

参考解答：先比较前向loss并检查train/eval和dropout RNG；再比较未裁剪梯度及累积残留；再核对Adam一阶/二阶矩与step计数；最后核对学习率、权重衰减和裁剪设置。若使用AMP还要检查scaler与是否跳步。按首个出现差异的位置缩小范围。

### 练习 3. 累计4个微批次时，把scaler.update放在每个microstep后为什么有问题？怎样改？

提示：考虑同一个.grad缓冲区里的单位。

参考解答：不同微批次可能使用不同scale，缓冲区中梯度无法用一个缩放值还原。应在四次scaled backward全部完成后unscale一次、裁剪、scaler.step、scaler.update，再按实际更新推进计数与调度。最后不足四批时按真实有效token重新归一化。

### 练习 4. 设计一个不会把“成功加载”误当成“精确恢复”的验收。

提示：需要连续与中断两个分支。

参考解答：固定代码、数据哈希、配置与确定性范围，连续训练K步；另一路从同一初始状态训练J步，在优化器边界保存完整状态，重建对象后恢复并训练K−J步。比较恢复前后样本轨迹、逐步loss、LR、优化器计数和最终参数。记录最大误差与允许容差；CPU受控实验可要求逐位相等，GPU是否逐位相等需按内核确定性设定。

## 验收自测

### 1. 不同微批次有效目标数不同时，正确累积方式是？

A. 永远平均各batch均值
B. 只用最长batch的loss
C. 总损失和除以总有效目标数
D. 把padding也计入分母

参考答案：C。分母定义了优化目标；有效token均值需要按有效数量加权。

### 2. 仅保存初始seed为什么不足以恢复中途中断？

A. seed无法表示随机流当前消费位置
B. seed只适用于GPU
C. AdamW不使用权重
D. 所有随机操作都忽略seed

参考答案：A。重新设seed通常回到随机序列起点；需要保存当前随机状态及采样位置。

### 3. AMP梯度裁剪应该在哪个时点进行？

A. 每个token前向之前
B. 任意一个微批次结束时
C. scaler.update之后
D. 完整累积后unscale，再clip

参考答案：D。先还原梯度单位再裁剪，且unscale应在该优化器本轮完整累积之后执行。

### 4. 模型进入eval模式会自动关闭autograd吗？

A. 会，且自动删除所有梯度
B. 不会，两者是不同机制
C. 只对AdamW会
D. 只对交叉熵会

参考答案：B。eval改变部分模块的训练行为；no_grad或inference_mode才控制梯度记录。

### 5. 本课advanced恢复实验已经验证了哪一项？

A. 所有GPU环境绝对逐位一致
B. 任意DataLoader预取游标可恢复
C. 固定CPU单进程边界的完整状态恢复
D. 自动调整world size仍保持相同训练

参考答案：C。报告明确限定CPU单线程、内存语料、固定优化器边界；其他范围需要单独实现和验证。

## 收尾思考

- 你的训练进度是用step、有效token还是数据遍历次数定义？为什么？
- 哪一个隐含状态最容易在自己的代码中被忘记？
- 如果只能保留五项日志，如何让它们足以定位首个错误？

下一步：D19把已经正确的训练循环放进算力与显存账本，理解何时需要并行、分片与更高效的注意力实现。
