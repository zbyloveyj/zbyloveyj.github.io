# 第 24 课 · 推理与部署：把模型放进资源与延迟预算

验证 KV cache、量化误差和时间指标，建立上下文、内存、批处理与服务合同

版本：2026.10.21.2｜建议 240 分钟，可分次完成

## 学习目标

- 区分预填充、逐token解码、KV缓存与请求调度
- 能复算权重和KV缓存内存，并解释实际峰值高于理论下界的原因
- 能执行缓存等价性、对称量化与延迟指标机制实验
- 能设计上下文预留、批处理、流式输出和取消规则
- 能说明本地原型与生产服务的完成边界，建立版本、监控与回滚依据

## 今日交付物

- 三个实际运行的缓存、量化和延迟定义实验
- 一份包含权重、KV、临时张量和运行时余量的内存账本
- 固定工作负载下的基准测量计划与指标定义
- 受限本地服务的请求响应合同和停止原因表
- 包含权重、tokenizer、适配器、提示和依赖版本的部署清单

## 先修准备

- 理解第4至7单元的因果注意力、生成与上下文窗口
- 理解第23单元的质量评价与公平比较
- Python环境具有CPU版PyTorch和numpy；无需下载大型权重或购买GPU

## 部署首先是让运行行为可解释、可重复

一个模型在命令行生成了文字，只证明这条推理路径能够执行。可用服务还要定义请求大小、模型版本、并发、超时、取消、错误返回和日志；生产服务还涉及认证、网络、资源隔离与运维。课程目前有TinyGPT生成CLI、证据检索与提示材料导出，以及理论资源预算工具，不宣称已经搭建完整生成式RAG服务器或通过并发生产测试。本课把可独立执行的机制实验与尚未实现的服务设计分别交付。

先定义一个具体负载，例如提示长度、输出上限、请求并发和允许延迟，再讨论优化。不能用十个token的短提示吞吐去代表长论文问答，也不能用空闲机器上的单请求结果推断高并发稳定性。质量指标与速度指标需要共同报告；更快的量化版本若丢失关键否定或数值，部署决策必须看见这项代价。这里的预算是工程估计和可测合同，不是推荐购买某块硬件。

## 预填充与解码有不同的计算形状

预填充处理已有提示，在因果遮罩下计算各位置表示，并建立每一层的键值缓存。解码随后一次或一小组产生新token，用新查询读取缓存前缀。对普通完整注意力，预填充涉及长度乘长度的注意力关系；单token解码只需要当前查询与前缀键进行交互，但仍要读取不断增长的缓存。GPU是否忙于计算、内存访问或调度取决于模型、长度、批量、精度和实现，不能从“用了GPU”推断任何场景都快。

KV cache存储过去位置的键和值，不是把所有历史查询也存起来；每个Transformer层都有自己的缓存。查询头数与KV头数可以不同，使用分组查询注意力时，内存估算应采用KV头数。高效注意力kernel主要改变计算和中间存储方式，分页缓存主要处理缓存管理问题，两者并非同一个优化。Hugging Face官方缓存说明提供了前缀复用的机制背景；具体API随版本变化，本课只使用基础PyTorch张量实现可检查等价关系。

## 先证明缓存与完整因果计算等价

下面使用固定的Q、K、V张量，比较一次完整因果注意力与逐位置追加键值后的输出。完整计算把未来位置设为负无穷；逐位置计算只含当前及之前的列，因此不需要再遮掉不存在的未来。断言检查全部位置，而不只是最后一个结果。这个实验真实验证了单层注意力缓存机制，没有给现有TinyGPT增加完整多层缓存API，也没有测量缓存带来的速度提升。

集成真实模型时，还需保持eval模式、关闭训练随机性，并让位置编码与attention mask覆盖正确的前缀长度。前缀内容、模型权重、LoRA适配器、tokenizer或位置规则变化后，旧缓存通常不能继续复用。跨请求共享前缀还要检查数据和授权隔离。当前TinyGPT生成会在达到窗口限制时裁剪输入；若同时让绝对位置重新编号，直接保留旧缓存未必等价。必须先定义满窗策略并验证，再宣称缓存版本和原实现一致。

```python
import math, torch
torch.manual_seed(7)
torch.set_num_threads(2)
B, H, T, D = 1, 2, 6, 4
# 固定Q/K/V的单层注意力机制，不是已给TinyGPT接入完整KV cache。
q, k, v = [torch.randn(B, H, T, D) for _ in range(3)]
with torch.inference_mode():
    logits = q @ k.transpose(-2, -1) / math.sqrt(D)
    future = torch.triu(torch.ones(T, T, dtype=torch.bool), diagonal=1)
    full = logits.masked_fill(future, float('-inf')).softmax(-1) @ v
    cached_k, cached_v, outputs = None, None, []
    for t in range(T):
        next_k, next_v = k[:,:,t:t+1], v[:,:,t:t+1]
        cached_k = next_k if cached_k is None else torch.cat([cached_k, next_k], dim=2)
        cached_v = next_v if cached_v is None else torch.cat([cached_v, next_v], dim=2)
        # 当前查询只能看已缓存前缀和当前位置，不存在未来列。
        score = q[:,:,t:t+1] @ cached_k.transpose(-2, -1) / math.sqrt(D)
        outputs.append(score.softmax(-1) @ cached_v)
    incremental = torch.cat(outputs, dim=2)
torch.testing.assert_close(incremental, full, rtol=1e-5, atol=1e-6)
bytes_used = (cached_k.numel()+cached_v.numel())*cached_k.element_size()
assert bytes_used == 2*B*H*T*D*4
print({"max_absolute_error":float((incremental-full).abs().max()),
       "kv_bytes":bytes_used, "all_tokens_match":True})
```

## 上下文与输出预算要在请求开始时分配

上下文容量包含系统模板、用户输入、历史消息、检索证据、工具返回和生成输出。应该先预留输出，再决定可装入多少材料；无限增加检索块会挤掉问题或输出空间。计数必须用真实tokenizer，中文字符数、UTF-8字节数和模型token数不同。课程TinyGPT使用字节词表，默认上下文只有六十四个字节位置，不能承担一篇完整论文问答；把它接到聊天界面也不会改变训练范围与容量。

截断策略应优先保持当前问题、实体、否定、单位与来源定位，旧历史可以经可核验摘要后替换，但摘要本身可能丢信息。每次实际输入长度和预留输出都进入报告。停止条件包括结束符、max_new_tokens、上下文上限、取消和错误，不能只显示一个含糊的“完成”。本项目的SFT终止符是换行字节，不能直接写成拥有一个未实现的专用EOS token；不同模型终止规则应由实际配置说明。

## 内存账本：权重之外还有缓存与运行时开销

若所有P个参数均以每参数s字节存储，理想权重空间为P×s。七十亿参数的FP16权重约为140亿字节，即约13.04GiB；这尚未包括缓存、非量化层、比例因子、临时张量、分配器与框架开销。普通固定长度KV的理论字节数为2×层数×批量×上下文长度×KV头数×每头维度×每元素字节，系数2来自K与V。三十二层、八KV头、一百二十八维、八千一百九十二位置、批量一、FP16缓存恰为1GiB。

使用下面的项目预算命令可以保存理论报告；它同时列出不同权重精度、KV和特定AdamW混合精度假设下的训练账本。训练优化器状态与推理内存不是同一个指标。实际部署还要测进程RSS或设备峰值，并记录并发、长度、kernel、缓存布局与预热条件；CPU多进程可能复制权重，GPU分配器也会保留未立即释放的空间。估计“能放下权重”只是第一步，不等于能在目标负载下稳定服务。

```bash
python -m curatemicrobiota.advanced budget --parameters 7000000000 --layers 32 --kv-heads 8 --head-dim 128 --context 8192 --batch 1 --out runs/budget
```

## 量化：看数值范围、比例因子与任务误差

对称逐行INT8教学量化可以令s=max|w|/127，q=clip(round(w/s),−127,127)，再用w_hat=sq恢复近似值。每行需要保存比例因子，全零行要避免除零。下面先检查单个权重量化误差，再观察线性层输出误差，并统计整数权重加比例因子的真实数组字节数。乘法是在恢复后的FP32权重上执行，因此它不是整数计算kernel，没有证明推理更快，也不是LLM.int8算法的完整实现。

实际量化还涉及按张量、按通道或分组粒度，权重与激活是否都量化，以及异常值如何处理。LLM.int8原始论文采用特定的向量量化和混合精度异常值方案，不能把任意简单取整称为复现。INT4理想每参数半字节还需要真正打包与额外元数据，不能用int8数组装四位数值后声称内存已经减半。无论PTQ还是QAT，都应在固定质量集比较，并报告不支持的硬件路径与可能回退的算子。

```python
import numpy as np
rng = np.random.default_rng(7)
weights = rng.normal(size=(4,8)).astype(np.float32)
weights[-1] = 0  # 全零行不能除以零。
maximum = np.max(np.abs(weights), axis=1, keepdims=True)
scale = np.where(maximum > 0, maximum/127, 1).astype(np.float32)
quantized = np.clip(np.rint(weights/scale), -127, 127).astype(np.int8)
restored = quantized.astype(np.float32)*scale
error = np.abs(restored-weights)
assert np.all(error <= scale/2 + 1e-6)
assert np.all(quantized[-1] == 0)
x = rng.normal(size=(3,8)).astype(np.float32)
reference, approximate = x@weights.T, x@restored.T
print({"weight_fp32_bytes":weights.nbytes,
       "int8_plus_scale_bytes":quantized.nbytes+scale.nbytes,
       "max_weight_error":float(error.max()),
       "max_output_error":float(np.max(np.abs(reference-approximate)))})
# 乘法仍在反量化后的float32上进行，不是整数kernel，也不是速度基准。
```

## 批处理与缓存调度：吞吐和单用户体验有取舍

静态批处理把多个请求一起推理，短请求可能等待较长请求；填充也会产生额外计算与缓存占用。连续批处理在调度边界加入新请求并移出已完成请求，有机会提高资源利用，但调度、缓存位置、取消和公平性需要正确处理。长度分桶可减少填充，仍要记录排队延迟。每批更多token不自动意味着每个用户更快，报告吞吐时必须同时观察TTFT与尾部延迟。

PagedAttention原始论文聚焦KV缓存的碎片与共享管理，通过分块组织缓解浪费。它不是把缓存所需的信息量变成零，也不能保证当前CPU小模型获得论文硬件上的倍数提升。若以后采用vLLM等服务框架，应固定版本、模型支持范围和基准负载；只在文档中看到某优化名称不等于本工程已经启用。当前课程实验保持离线CPU小规模，分页管理、连续批处理和分布式服务属于需独立实现及验收的扩展。

## 流式输出首先明确时间事件和停止原因

流式发送让用户更早看到结果，但不会改变模型本身的事实性。TTFT从请求起点到首个输出token，通常包含排队和预填充；首个token之后的平均TPOT可定义为(最后token时间−首token时间)/(输出token数−1)。若输出只有一个token，TPOT没有分母，应报告不适用。端到端输出吞吐是输出总token除以完整请求时长，解码阶段速率使用首token之后的间隔和对应的N−1个token，二者不能混为一个数字。

下面时间戳是合成夹具，每个事件恰好一个token，用来检查计算定义，不是实测服务性能。真实网络包可能包含多个token，不能把包数当token数；字节token还需要增量UTF-8解码，避免把中文字符的部分字节提前显示为乱码。服务应有明确的结束事件、停止原因和取消传播，客户端断开后不应继续无期限占用模型。vLLM官方指标文档也区分事件间隔与按请求计算的平均输出时间，具体字段须以所用版本为准。

```python
import numpy as np
def kv_bytes(layers, kv_heads, head_dim, context, batch, element_bytes):
    values = [layers,kv_heads,head_dim,context,batch,element_bytes]
    if any(type(x) is not int or x <= 0 for x in values):
        raise ValueError("positive integer dimensions required")
    return 2*layers*batch*context*kv_heads*head_dim*element_bytes
cache = kv_bytes(32,8,128,8192,1,2)
assert cache == 1024**3
# 合成时间戳：每个事件恰好一个token，不是实测服务性能。
start = 0.0
arrivals = np.array([.120,.140,.165,.190])
if len(arrivals) < 2 or not np.all(np.diff(arrivals) > 0):
    raise ValueError("need increasing token arrival times")
ttft = float(arrivals[0]-start)
tpot = float((arrivals[-1]-arrivals[0])/(len(arrivals)-1))
e2e_rate = float(len(arrivals)/(arrivals[-1]-start))
decode_rate = float((len(arrivals)-1)/(arrivals[-1]-arrivals[0]))
print({"kv_GiB":cache/1024**3, "TTFT_seconds":ttft,
       "TPOT_seconds":tpot, "end_to_end_output_tokens_per_second":e2e_rate,
       "decode_tokens_per_second":decode_rate})
assert np.isclose(ttft,.12) and np.isclose(tpot,.07/3)
context_limit, prompt_tokens, template_tokens, reserved_output = 8192,6900,200,768
assert prompt_tokens+template_tokens+reserved_output <= context_limit
print({"remaining_context_tokens":context_limit-prompt_tokens-template_tokens-reserved_output})
```

## 基准测量：预热、同步和工作负载必须一致

实际计时应记录模型初始化是否计入、预热次数、提示与输出长度、批量、线程数、精度、设备和软件版本。用单调高分辨率计时器包围目标阶段；GPU计算常为异步，需要适当同步或使用设备事件，不能只计CPU提交工作的时间。推理使用eval与无梯度上下文，避免把训练模式开销和随机性混进比较。不要给缓存版喂完全重复的热前缀，却给非缓存版全新输入，再把差异都归给算法。

至少展示预设负载下的延迟分布和样本数，并说明是否含排队、网络和tokenization。冷启动、首请求和稳定运行分别报告。出现OOM、超时或失败请求时，保留失败率与资源记录，不能从吞吐分母中偷偷删掉慢请求。CPU与GPU数字只在相同质量与工作负载下比较；没有GPU就报告CPU条件，不推测另一台设备能达到多少速度。理想内存公式、合成时间戳与真实基准应在表中清楚区分。

## 轻量本地服务的合同与边界

如果未来把CLI包装为本地服务，请先限定监听地址、请求方法、body字节上限和并发。请求仅包含明确支持的字段，如prompt、max_new_tokens、seed和model_version，拒绝未知字段与过长输入；服务端再核验真实token长度及模型上下文。返回request_id、输出、模型版本、输入输出计数和stop_reason，错误使用稳定错误码。默认在本机回环地址实验，不因为浏览器能访问就宣称具备公网安全、认证与高可用能力。

当前工程没有因为这一节文字就自动拥有HTTP服务器；本课实际可运行的是CLI预算和三个独立机制脚本。若要实现服务，应单独增加超时、取消、队列上限与背压，验证同时请求的缓存不串扰。模型加载路径来自固定配置，不由外部请求任意指定；密钥不进入网页前端，日志按需要记录长度、哈希和错误，避免无必要保存完整输入。代码执行、任意文件读取或患者自动处置不属于这个文本推理接口。

## 发布与监控：让速度提升也能被安全回滚

发布清单应记录代码提交、权重哈希、tokenizer词表与模板、适配器、量化配置、依赖、检索索引以及关键运行参数。模型权重没有变，提示或检索索引改变也可能影响行为，版本不能只写一个模型名。监控质量回归、拒答、格式错误、工具失败、缓存命中、队列长度、TTFT、吞吐和峰值内存；设置能解释的异常阈值，并保留上一个已验证版本的回滚路径。日志证明运行发生，不自动证明科学结论正确。

本课可以拆为四十五分钟预填充与KV、六十分钟缓存和量化实验、四十五分钟预算及时间指标、四十五分钟测量与服务合同、四十五分钟阅读和报告。分别保存day24_cache.py、day24_quantization.py和day24_metrics.py执行，项目预算命令从project目录运行。交付中标出合成时间戳、理论估计与真实执行的边界，保留质量损失或速度无改善的结果。下一阶段再把这些工程约束用于微生物模型的扩大验证与研究设计，而不急于把教学原型描述为生产级基础模型。

## 动手实验 · 建立一份可复算的推理与服务预算

### 1. 执行缓存等价性

将第3节代码保存为day24_cache.py，核对全部位置的输出一致和缓存字节数；不要把它称作TinyGPT整模型缓存实现。

```bash
python day24_cache.py
```

检查什么：单层完整因果计算与逐步缓存输出在给定容差内一致，KV数组占384字节。

### 2. 执行量化误差与存储统计

将第6节代码保存为day24_quantization.py，观察权重误差与输出误差，保留全零行测试。

```bash
python day24_quantization.py
```

检查什么：FP32权重128字节，INT8加比例因子48字节；没有声称整数kernel加速。

### 3. 复算时间与上下文预算

将第8节代码保存为day24_metrics.py，明确合成事件均为一个token，手算TTFT与TPOT。

```bash
python day24_metrics.py
```

检查什么：KV理论值1GiB，TTFT0.12秒，TPOT约0.02333秒，剩余上下文324token。

### 4. 保存项目理论账本

在project目录运行预算CLI，查看report.json中的精度、KV与训练状态假设；在笔记区分理论空间和未测运行时峰值。

```bash
python -m curatemicrobiota.advanced budget --parameters 7000000000 --layers 32 --kv-heads 8 --head-dim 128 --context 8192 --batch 1 --out runs/budget
```

检查什么：生成理论预算报告，不宣称已加载七十亿参数模型或测出GPU速度。

### 5. 提交测量与服务设计

定义固定负载、质量指标、重复次数、排队和网络是否计入；写出请求合同、结束事件、失败码和回滚版本清单。

检查什么：没有把设计中的服务器、连续批处理或分页缓存标为现有工程已完成。

### 实验验收

- [ ] 三个Python机制实验真实运行并保留输出
- [ ] 缓存等价性的单层范围与满窗位置问题明确
- [ ] 内存公式使用KV头数，区分字节与GiB
- [ ] 量化存储含比例因子，误差与真实加速没有混称
- [ ] TTFT、TPOT、端到端吞吐的计数与分母一致
- [ ] 理论估计、合成时间戳和真实测量明确标注
- [ ] 服务合同限制输入、并发、版本与停止原因，未虚构已部署能力

## 论文导读

### Hugging Face Transformers — How caching works 官方说明 (2026)

https://huggingface.co/docs/transformers/main/en/cache_explanation

核对因果前缀的键值复用、逐层缓存与正确mask长度，避免把缓存当成任意上下文记忆。

- 画出新查询与过去K/V、当前K/V的关系。
- 对照本课张量形状，记录文档版本并辨认API示例与数学机制的区别。

**阅读问题：** 为什么过去token的K/V可以用于后续单token解码？

**参考思路：** 固定模型、前缀及位置规则下，因果计算不受未来token影响，因此已有位置的键值可复用；缓存仍必须对应正确层和前缀。

**阅读问题：** 裁剪窗口并重新编号位置后，旧缓存一定有效吗？

**参考思路：** 不一定。绝对位置与上下文变化可能改变表示，必须定义满窗策略并重新验证等价。

### LLM.int8(): 8-bit Matrix Multiplication for Transformers at Scale (2022)

https://arxiv.org/abs/2208.07339

理解量化为何需要处理范围和异常值，区分论文方法与本课简单对称量化。

- 找出向量量化与混合精度异常值处理各解决什么问题。
- 列出将论文方法用于新模型前必须重新测量的质量、内存和硬件条件。

**阅读问题：** 本课先反量化成FP32再矩阵乘法，能证明INT8推理加速吗？

**参考思路：** 不能。它只检验数值近似与存储账本，实际加速需要支持的整数kernel及公平基准。

**阅读问题：** 为什么理想四位权重大小不是完整服务峰值？

**参考思路：** 还包含比例因子、非量化层、KV缓存、临时激活、分配器和服务运行时开销。

### Efficient Memory Management for Large Language Model Serving with PagedAttention (2023)

https://arxiv.org/abs/2309.06180

从原始研究理解KV缓存管理与服务吞吐的联系，避免把分页、量化和注意力kernel混为一谈。

- 辨认缓存碎片、共享和请求动态长度造成的问题。
- 阅读实验工作负载与硬件条件，再说明哪些倍数不能直接迁移到本项目。

**阅读问题：** 分页管理是否消除了所有KV信息的存储需求？

**参考思路：** 没有。它改善组织和共享、减少浪费，缓存仍需要存储相应信息与管理元数据。

**阅读问题：** 服务吞吐提高就说明每个用户的首token更快吗？

**参考思路：** 不一定。批量和排队可能提高总吞吐但增加单请求延迟，需要同时报告TTFT、尾部延迟与失败率。

## 练习与完整参考解答

### 练习 1. 32层、8个KV头、每头128维、上下文8192、批量1、FP16缓存需要多少字节？若批量变4，其他不变呢？

提示：K与V各一份，FP16每元素2字节。

参考解答：2×32×1×8192×8×128×2=1073741824字节，即1GiB。批量4时理论值线性变成4GiB。该值不含权重、临时激活、分页元数据、分配器与服务开销；若各请求实际长度不同，要按缓存布局计算已分配容量。

### 练习 2. 首token在0.12秒，最后一个在0.19秒，总共4个token。TTFT、平均TPOT和端到端输出速率是什么？

提示：首token之后只有三段token间隔。

参考解答：TTFT=0.12秒；TPOT=(0.19−0.12)/(4−1)=0.02333秒；端到端输出速率=4/0.19≈21.05token/秒。解码阶段速率则为3/0.07≈42.86token/秒，不能拿它冒充含预填充和排队的端到端速率。

### 练习 3. 某脚本把INT8权重还原为FP32后执行矩阵乘法，打印“量化加速4倍”。你应要求什么证据或修改？

提示：分开检查存储表示、计算kernel与计时。

参考解答：删除未经测量的加速结论，报告已验证的量化误差和包含比例因子的存储大小。若要证明速度，需使用实际支持的量化kernel，在相同模型、负载和质量要求下预热并重复计时，正确同步设备，报告失败率与延迟分布。反量化后的FP32乘法不能证明整数执行。

### 练习 4. 一个使用绝对位置的模型裁掉最早token后，把剩余token重新从位置0开始编号，却继续复用全部旧K/V。可能出现什么问题？

提示：检查缓存对应的输入表示是否仍相同。

参考解答：旧缓存是在原位置和前缀下计算，重新编号或上下文改变后表示可能不同，增量结果不再等价于完整重算。应先定义窗口和位置策略，再按模型实际规则重新构建或维护缓存，并对跨越窗口边界的结果做等价测试，不能只验证未满窗口的短例子。

## 验收自测

### 1. 标准KV缓存主要保存什么？

A. 未来生成答案的正确性标签
B. 每层过去位置的键与值
C. 全部训练优化器状态
D. 任意用户共享的秘密数据

参考答案：B。缓存复用过去位置的K/V，仍需确保层、前缀、位置与授权范围匹配。

### 2. 模型有32个查询头、8个KV头时，KV内存公式应使用哪个？

A. 总参数量
B. 词表大小
C. 固定使用32
D. 使用实际8个KV头

参考答案：D。缓存存的是K/V，因此应采用真实KV头数，而不是查询头数。

### 3. 只生成一个token时，按N−1定义的TPOT应怎样报告？

A. 不适用，并保留TTFT和请求时长
B. 自动为零
C. 等同上下文长度
D. 强制改成一秒

参考答案：A。首token之后没有可计算平均值的token间隔，不能制造一个数值。

### 4. 把四位值放在未打包的int8数组中，是否已实现每参数半字节？

A. 一定已经实现
B. 只要打印INT4就实现
C. 没有，需要真实打包并计入元数据
D. 只取决于模型名称

参考答案：C。数组实际存储单位仍为一字节，数值范围和物理存储是不同概念。

### 5. 本课合成时间戳的用途是什么？

A. 证明某GPU达到生产吞吐
B. 验证TTFT、TPOT和吞吐的计算定义
C. 替代真实并发测量
D. 保证公网服务可靠

参考答案：B。合成夹具可检查公式和分母，不能作为实际服务器性能证据。

## 收尾思考

- 我的“每秒token数”到底包含哪些阶段，又遗漏了哪些等待？
- 模型能放进内存与目标负载能稳定服务之间，还差哪些可测条件？
- 如果换量化、适配器或位置规则，我会用哪些测试阻止旧缓存被错误复用？

下一步：继续进入微生物研究进阶：将方法、评价与资源约束共同用于更严格的跨研究验证。
