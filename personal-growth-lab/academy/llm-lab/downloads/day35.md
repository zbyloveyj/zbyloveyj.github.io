# 第 35 课 · 把检索向量训练出来：双塔、负例与索引验收

从手工相似度走向可训练检索，分别检查表征质量、候选召回和证据覆盖

版本：2026.10.21.4｜建议 240 分钟，可分次完成

## 学习目标

- 能从查询—文档匹配目标推导双塔对比损失并完成一次CPU训练
- 能识别批内假负例、同源重复和过难负例，设计多正例与人工复核
- 能区分相似度、相关性、证据支持与事实正确性
- 能将精确近邻、近似候选与重排的误差分别验收
- 能设计按问题来源隔离的检索评价并冻结模型、索引和语料版本

## 今日交付物

- 一个真实优化了参数的微型双塔实验与训练前后损失
- 多正例梯度检查与假负例处理规则
- 一份精确检索、候选漏召回和任务标签的对照结果
- 一张查询—证据标注表及模型/索引/文档版本关系图

## 先修准备

- 完成第9和21单元，理解BM25、余弦、RRF与分块来源
- 完成第15和18单元，理解交叉熵、梯度和验证集用途
- 已有CPU PyTorch与numpy；核心实验无需下载语义模型、Faiss或论文全文

## 第21课的相似度夹具，现在变成可学习对象

第21课通过手工向量说明排序与融合，本课回答另一个问题：哪些训练信号使查询与有关证据接近？双塔分别把查询q和文档d映射为向量，检索阶段通常先离线编码文档，再为新查询计算向量并寻找相似项。训练、文档编码和在线检索是三项不同工作，不能把下载一个嵌入模型视作全部完成。

双塔可以共享或不共享参数，取决于任务与模型设计。简短问题与较长证据段的分布不同，某些模型约定专门的query/document前缀；这些前缀属于输入合同，应以所选模型文档为准。CurateMicrobiota需要检索的“有关”不是出现相同菌名就足够，还包括疾病、研究设计、样本类型、结论方向和限制条件。

## 从一对正例到一个可微的排序目标

设一批包含N个查询，每个查询有一个核验正例，其他文档暂作为候选负例。计算s_ij为归一化向量点积，按温度tau缩放后对整行做交叉熵，使正确文档索引获得更大概率。分母包含正例和全部负例，这个归一化概率是当前候选集合中的训练量，不是某条医学结论成立的概率。

温度改变分数差异和梯度尺度。减小tau会让当前困难对更占主导，但不会自动改善相关性，也可能放大错误负例的损害。批次增加时负例来源也改变，不能只把它当作吞吐变化。双向目标可同时计算查询到文档和文档到查询，但当一个文档对应多个合法查询时，必须重新定义正例集合，而不能强迫所有关系一一对应。

```text
q_i = normalize(f_query(text_i)); d_j = normalize(f_doc(passage_j))
L = -(1/N) sum_i log {exp(q_i^T d_i / tau) / sum_j exp(q_i^T d_j / tau)}
```

## 实际训练一个微型双塔，再主动限制结论

下面使用六组原创英文教学配对，分别学习查询和文档的词嵌入平均值，用CPU执行80次更新。代码的确优化了模型参数，并且在固定训练配对上检查损失下降和正确top1；它不是手工填写一个相似度矩阵。三个没有参与词表构造或优化的查询只作微型诊断，打印其结果而不预设一定成功。

这些文本非常少，词袋平均模型也忽略词序，训练命中不能证明语义泛化。保留查询虽然没有直接参与训练，仍与六个主题高度相关；它们不能代替来源外、时间外或真实文献检索评价。实验的价值是把目标、编码、负例和梯度接通，之后再用同样审查方式评价更强的预训练编码器。

```python
import json, re, torch
from torch import nn
from torch.nn import functional as F
torch.manual_seed(35)
torch.set_num_threads(1)
# 原创六组教学匹配，目标是验证训练机制，不是外部检索基准。
queries = ["avoid person leakage", "relative values", "cite evidence", "freeze evaluation", "record checkpoint", "mask species"]
docs = ["split visits by subject", "abundance ratios sum constraint", "source identifier and passage", "keep test cohort separate", "save model optimizer state", "hidden taxa reconstruction target"]
heldout = ["subject leakage", "abundance values", "source evidence"]
tokens = lambda text: re.findall(r"[a-z]+", text.lower())
vocab = {"<unk>": 0}
for text in queries + docs:  # 保留问题不参与词表构造或优化。
    for word in tokens(text):
        if word not in vocab:
            vocab[word] = len(vocab)
def ids(text):
    return torch.tensor([vocab.get(w, 0) for w in tokens(text)] or [0])
class Tower(nn.Module):
    def __init__(self):
        super().__init__()
        self.embedding = nn.Embedding(len(vocab), 12)
    def forward(self, texts):
        vectors = torch.stack([self.embedding(ids(text)).mean(0) for text in texts])
        return F.normalize(vectors, p=2, dim=-1)
query_tower, doc_tower = Tower(), Tower()
parameters = list(query_tower.parameters()) + list(doc_tower.parameters())
optimizer = torch.optim.Adam(parameters, lr=0.04)
labels, temperature = torch.arange(len(docs)), 0.2
def scores(texts):
    return query_tower(texts) @ doc_tower(docs).T
with torch.no_grad():
    initial_loss = float(F.cross_entropy(scores(queries) / temperature, labels))
for step in range(80):
    loss = F.cross_entropy(scores(queries) / temperature, labels)
    optimizer.zero_grad(set_to_none=True)
    loss.backward()
    optimizer.step()
with torch.no_grad():
    final_loss = float(F.cross_entropy(scores(queries) / temperature, labels))
    train_top1 = scores(queries).argmax(1)
    heldout_top1 = scores(heldout).argmax(1)
assert final_loss < initial_loss
assert torch.equal(train_top1, labels)
print(json.dumps({"initial_train_loss": initial_loss, "final_train_loss": final_loss,
    "training_top1": train_top1.tolist(), "unoptimized_query_top1": heldout_top1.tolist(),
    "scope": "six synthetic training pairs; heldout examples are a tiny diagnostic, not generalization evidence"}))

```

## 批内负例可能实际上是正确答案

假设同一队列的一篇原文和一篇更正都支持“受试者需分组划分”。如果它们分别作为批内两条配对，朴素一对一交叉熵会把另一篇正确材料推远。这是标签设计制造的假负例，不能靠更长训练解决。同义问题、同篇不同块和多个独立支持来源，都可能破坏“其他列全部错误”的假设。

先记录source_id与语义相关性关系，再选择去重、避免同源样本同批、掩去已知假负例或采用多正例目标。以下目标最大化核验正例集合的总概率质量，与逐个正例交叉熵再平均不同；前者可能把更多质量放在容易正例上，因此若任务要求每个来源都可检索，还需来源覆盖指标或另一种目标。不要把没有标注的材料一概当作已确认负例。

```text
L_i = log sum_j exp(s_ij) - log sum_{j in P_i} exp(s_ij)
P_i是已核验正例集合；未标注不等于已证伪负例。
```

```python
import torch
# 两个问题，每行两个文档是已核验的正例；其余才可作负例。
scores = torch.tensor([[2.0, 1.0, -0.5, 0.0], [0.0, -0.5, 1.0, 2.0]], requires_grad=True)
positive = torch.tensor([[True, True, False, False], [False, False, True, True]])
assert positive.any(dim=1).all()
log_denominator = torch.logsumexp(scores, dim=1)
log_positive_mass = torch.logsumexp(scores.masked_fill(~positive, float("-inf")), dim=1)
loss = (log_denominator - log_positive_mass).mean()
loss.backward()
# 此目标推动总正例概率质量上升；这里每个正例的梯度非正，负例非负。
assert (scores.grad[positive] <= 0).all()
assert (scores.grad[~positive] >= 0).all()
with torch.no_grad():
    naive = torch.nn.functional.cross_entropy(scores, torch.tensor([0, 3]))
print({"multi_positive_loss": float(loss.detach()), "single_positive_loss": float(naive),
       "positive_gradient_nonpositive": True, "negative_gradient_nonnegative": True})
# 这是正例集合质量目标，区别于逐个正例CE再平均；不能把两者混称同一损失。

```

## 难负例要难在任务相关处，也要确保真的不满足任务

随机负例可能很容易：DNA分词问题面对饮食新闻，一眼就能分开。难负例可以来自BM25或旧检索器的高排名材料，例如同一疾病但只做内部验证、同一菌属但不同物种、同一指标但不同测量层级。它们促使模型注意区分条件，前提是这些条件确实属于问题定义而不是随意扣分。

检索器越强，排名靠前的未标注材料越可能也是合法正例。应抽样人工复核，记录假负例率，允许多正例或暂时不计分；不要利用测试问题及其答案挖训练负例。迭代挖掘要锁定轮次、候选生成模型和语料版本，否则训练后无法说明性能来自更好编码器还是改换了问题和标签。

## 精确检索提供参照，近似索引提供资源取舍

文档向量固定后，精确内积检索可作为候选排序参照。向量均已L2归一化时，内积与余弦排序一致，欧氏距离平方等于2减去2倍内积；如果没有归一化，这些排名关系不能默认成立。相似度方向也要检查：某些接口返回距离越小越好，另一些返回分数越大越好，弄反会让索引看似完全失效。

Faiss提供精确与近似索引选择，实际方案取决于数据量、维数、内存、构建时间与查询负载。HNSW或IVF等方法的调参会改变召回与时延；应先以同一组向量和查询建立精确top-k，再测近似结果的近邻召回。下面人为删掉最优候选，只演示候选漏召回的后果，没有声称实现或运行了Faiss、HNSW。

```python
import numpy as np
rng = np.random.default_rng(35)
vectors = rng.normal(size=(12, 5))
vectors /= np.linalg.norm(vectors, axis=1, keepdims=True)
query = vectors[0].copy()
exact = np.argsort(-(vectors @ query), kind="stable")[:3]
assert exact[0] == 0
# 人为省略最优项，模拟候选阶段漏召回；不是实现HNSW或Faiss。
candidates = np.array([i for i in range(12) if i != 0])
reranked = candidates[np.argsort(-(vectors[candidates] @ query), kind="stable")[:3]]
index_recall = len(set(exact) & set(reranked)) / len(exact)
assert np.isclose(index_recall, 2/3)
# 人工相关性标签是另一个对象，不能以向量近邻当作真实证据标签。
relevant = {int(exact[2]), int(exact[1])}
task_recall = len(relevant & set(reranked)) / len(relevant)
assert task_recall == 1.0
print({"exact_top3": exact.tolist(), "candidate_top3": reranked.tolist(),
       "index_recall_at_3": index_recall, "task_recall_at_3": task_recall})

```

## 索引召回率与任务证据召回率不是一个分母

索引recall@k比较近似结果与精确向量top-k，回答加速检索损失了多少向量近邻。任务recall@k则比较结果与人工相关证据，回答问题所需材料找到了多少。精确搜索可以做到索引意义上的满分，却因为编码器表示不合适而遗漏全部真实证据；反过来，漏掉一个无关的向量近邻不一定损坏任务指标。

上面的夹具让候选阶段漏掉精确第一名，但人工标签把另外两项视作相关，因此索引召回为三分之二、任务召回为一。这个数字来自明确构造的教学标签，不是实际系统表现。评价表要同时保存查询ID、返回文档ID、人工标签、向量分数与候选来源，避免用一种指标替另一种失败开脱。

## 重排能纠正候选顺序，不能召回不存在的候选

交叉编码器把问题与候选段落放进同一次编码，可以直接建模词项间的交互；双塔把文档预先压成一个固定向量，在线成本较小。常见组合是双塔或BM25召回较多候选，再用交叉编码器重排少量候选。两者都需要相应任务的数据与评价，不能把生成式模型给出的任意分数自动称为校准相关性。

重排之前先核对候选覆盖。如果真实证据从未被召回，后续排名再精确也不能恢复它。对科学任务还应保留冲突和限制材料，不能把“与问题假设一致”作为唯一相关性定义。请求要判断是否有外部验证时，一篇明确报告没有外测的论文同样可能是有价值的相关证据；相关并不等于支持肯定答案。

## 索引是一份由模型与语料共同生成的派生物

只要文档编码器权重、tokenizer、输入前缀、池化、归一化或分块内容改变，旧向量索引都可能失效。查询编码器与文档编码器来自配对训练时，只更新一侧也需要明确兼容性实验。为每个索引保存文档版本、编码器哈希、向量维数、距离定义、归一化状态、构建参数与文档ID顺序。

更新文献时要处理新增、替换、更正和删除，不应一直追加却保留过期重复条目。文档ID不能依赖数组位置作为永久身份；重新排序向量后仍要找回正确来源。若索引和来源表版本不一致，应拒绝输出引用而不是随机拼上一个看似有效的DOI。回滚时应成套恢复编码器、索引与来源元数据。

## 用固定问题和来源划分检验真正的改善

开发集用于选模型、温度、负例、索引参数与候选数，保留集用于最终评价。按主题族、作品和来源关系隔离，避免相同问题的改写分布在两侧。可报告Recall@k、MRR、nDCG和来源覆盖，但每项都必须写清相关性分级、未标注材料处理以及没有相关文档的问题如何计分。

公平比较保持语料版本、问题、标签和候选预算一致；同时记录索引大小、构建成本、查询与重排时延。若新模型只增加候选数便提升召回，应把预算变化说清楚。最后将检索结果交给独立证据审查：是否覆盖关键条件，是否错误地把相关材料解释为支持结论。检索训练完成不等于RAG答案已经可靠。

## 把课程检索器升级为研究证据系统的条件

当前课程工程的八张来源卡适合检验ID、引用与缺证处理，不足以评价语义检索能力。真实项目先整理一小批有许可的证据段，按问题目的建立人工标注，再比较BM25、冻结预训练嵌入与必要的轻量适配。只有基线显示明确错误模式、训练数据足够并且保留评价支持，才有理由训练专用编码器。

交付时把实验分层记录：本课已运行微型双塔与梯度、候选机制；真实预训练嵌入、ANN索引和交叉编码器属于后续接入条件；全文证据问答还需要生成与逐句核验。这样读者可以直接复现已有结果，又能知道下一步具体补什么，不会把几条教学短句的训练命中率包装成微生物文献检索排行榜。

## 动手实验 · 训练、破坏并评价一个微型检索链

### 1. 运行真正的参数优化

保存训练前后损失、训练top1及未优化查询结果，逐项指出训练证据与泛化证据的区别。

```bash
python lesson_examples/unit35/d35-03.py
```

检查什么：80步后训练loss下降、六个训练配对命中；保留查询只作诊断，不要求全对。

### 2. 检查多正例梯度

运行第4节实验，核对正负例集合和梯度方向，再手工加入同源重复文档，解释为什么单正例标签会产生冲突。

```bash
python lesson_examples/unit35/d35-04.py
```

检查什么：正例集合目标的正例梯度非正、负例非负；没有将它混称为逐正例CE平均。

### 3. 检查索引与任务两种召回

运行第6节实验，核对被删掉的近邻、剩余候选和人工相关标签。

```bash
python lesson_examples/unit35/d35-06.py
```

检查什么：索引recall@3为2/3，构造标签下的任务recall@3为1；没有声称运行真实ANN。

### 4. 写真实证据标注与升级合同

整理至少12个固定问题，包含支持、反证、缺证和条件不匹配；记录来源簇并分开发/保留集。模型选择和索引调参仅使用开发集。

检查什么：每个问题有来源定位、相关性标签和标注规则；写清实际运行组件与待接入组件。

### 实验验收

- [ ] 双塔训练真实执行，未把训练top1当成外部检索能力
- [ ] 能写出候选分母和温度作用，说明假负例的来源
- [ ] 多正例目标、单正例目标与覆盖要求没有混称
- [ ] 精确近邻召回与人工任务召回分别定义并复算
- [ ] 索引清单记录模型、词表、分块、归一化、距离与来源版本
- [ ] 真实证据任务保留独立评价，并单独检查冲突与无答案问题

## 论文导读

### Dense Passage Retrieval for Open-Domain Question Answering (2020)

https://arxiv.org/abs/2004.04906

阅读双塔编码、负例与检索评价的原始设计。

- 找出查询和段落各自如何编码。
- 比较批内负例与难负例，记录论文评价语料及任务边界。

**阅读问题：** 论文在开放域QA上的成绩是否自动适用于微生物文献？

**参考思路：** 不适用，语料、问题、标签和领域差异需要重新评价。

### Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks (2019)

https://arxiv.org/abs/1908.10084

理解独立句向量与成对交互模型的效率取舍。

- 画出独立编码与逐对交互的计算流程。
- 分清语义相似度训练与科研证据相关性评价。

**阅读问题：** 句子语义相近能否直接证明某科学主张？

**参考思路：** 不能，相似性不等于支持关系，还需核验条件与方向。

### Sentence Transformers — Losses 官方文档 (2026)

https://sbert.net/docs/package_reference/losses.html

核对MultipleNegativesRankingLoss对配对和批内负例的假设。

- 阅读输入样本形式和重复样本注意事项。
- 对照本课指出同义问题与多正例会破坏哪项假设。

**阅读问题：** 越多批内文档一定越好吗？

**参考思路：** 不一定，若包含假负例或重复来源，增加批次会扩大标签错误。

### Faiss — Guidelines to choose an index (2026)

https://github.com/facebookresearch/faiss/wiki/Guidelines-to-choose-an-index

从官方说明理解精确与近似检索的资源选择。

- 先识别精确索引作为参照的用途。
- 把内存、构建时间、查询速度与召回列为分开的比较维度。

**阅读问题：** ANN更快是否足够证明系统改进？

**参考思路：** 还需同向量下的近邻召回、实际任务证据召回与质量成本对照。

## 练习与完整参考解答

### 练习 1. 批内两篇文档都能回答同一个问题，单正例交叉熵会做什么？

提示：观察分母中另一篇合法正例被赋予的角色。

参考解答：它把未指定的合法答案当作负例，试图降低其相对得分。应先核验相关性，再用去重、同源批次约束、负例mask或明确的多正例目标处理。多正例质量目标只保证总正例概率，不保证每篇都获得同等覆盖，还需任务指标检查。

### 练习 2. 精确向量检索的recall@10为1，人工证据召回仍很低，主要应查什么？

提示：先明确“精确”针对哪个排序。

参考解答：这里的满分只说明索引复现了该向量空间的精确top10，不说明这些近邻是正确证据。优先检查分块、标签、编码器任务匹配、输入前缀和相似度定义，再比较BM25或混合检索；只增加ANN搜索深度通常不能修复表示本身的问题。

### 练习 3. 重排器把所有候选排序正确，为什么最终答案仍可能漏掉重要反证？

提示：查看候选集合是否包含该材料。

参考解答：重排只能处理已经召回的候选；反证没有进入集合，就无法由排序恢复。还要检查标注是否把反对问题假设的材料错当无关，是否被来源去重或时间过滤删除。记录候选召回和最终引用支持两层失败，不能只报告重排准确率。

### 练习 4. 替换文档编码器后沿用旧索引可以吗？

提示：考虑向量坐标系和输入处理是否改变。

参考解答：通常需要重新编码并重建索引，除非有明确的兼容设计和验证。旧向量来自原权重、词表、池化和归一化，不能因维数相同就默认可比。升级时成套记录查询/文档编码器、索引与来源版本，并保留可回滚的旧组合。

## 验收自测

### 1. 本课微型双塔训练实际证明什么？

A. 已达到真实文献检索最优
B. 预先构造分数就是训练
C. 参数按目标更新并拟合六组教学配对
D. 无需保留评价

参考答案：C。参数训练真实发生，但训练命中不等于真实泛化。

### 2. 批内其他文档何时不能直接当负例？

A. 它也是该问题的合法证据
B. 文档有ID
C. 使用CPU
D. 向量已经归一化

参考答案：A。一对一标签并不自动适合多正例关系。

### 3. 归一化向量下，平方欧氏距离与内积是什么关系？

A. 恒等于内积
B. 2减去2倍内积
C. 与内积完全无关
D. 等于文档长度

参考答案：B。单位向量满足||q-d||²=2−2q·d。

### 4. 重排无法修复哪类错误？

A. 候选中相关项排得稍低
B. 候选之间分数接近
C. 候选顺序不理想
D. 相关证据从未进入候选集

参考答案：D。缺少候选需要回到召回、分块或语料层解决。

### 5. 论文撤回或更正后，索引更新应怎样做？

A. 只不断追加
B. 永久按旧数组下标引用
C. 维护来源状态并同步索引与元数据版本
D. 把变化藏在备注里

参考答案：C。索引与证据来源必须一致更新和可追溯。

## 收尾思考

- 我究竟训练的是语义相似、任务相关性，还是证据支持关系？
- 哪些“负例”只是没有被标注，而不是已经确认无关？
- 索引近邻、人工相关证据和最终引用之间，各有哪一种独立失败？

下一步：进入第36单元，把项目已经训练出的TinyGPT权重装进可实际调用的本地接口，检查请求、流式输出与停止条件。
