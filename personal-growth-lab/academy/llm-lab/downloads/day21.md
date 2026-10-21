# 第 21 课 · 深入 RAG：从找到材料到可核验的证据系统

实现 BM25 与排序融合，设计分块、重排、查询改写、冲突处理和结构化核验

版本：2026.10.21.2｜建议 240 分钟，可分次完成

## 学习目标

- 能为科研语料制定分块、版本、许可与证据定位合同
- 能手算并运行BM25、余弦检索与RRF，解释它们不等于事实概率
- 能设计查询改写、候选召回和重排的可比较实验
- 能分别评价检索、引用支持、冲突呈现和无答案处理
- 能把已有证据检索接口接入受控实验，而不虚构生成模型能力

## 今日交付物

- 一份带来源、版本和定位字段的十块语料清单
- 三个独立可运行Python机制脚本及原始输出
- 固定开发/保留测试问题集与逐题相关性标签
- BM25、向量机制、混合排序和重排方案的对照表
- 包含支持、冲突、缺证三类情况的逐句证据审查记录

## 先修准备

- 完成第9单元的来源卡片与基础检索评价
- 理解向量点积、归一化和训练/验证/测试划分
- Python环境具有numpy；本课不需要下载嵌入或生成模型

## 先画出系统边界，再决定增加什么

一个完整的证据问答系统至少包括语料接入、解析与分块、索引、候选召回、重排、上下文装配、生成和核验。只要其中一层更换，最终表现都可能变化。因此今天把每个环节的输入、输出、版本和失败条件写下来。研究问题可以是“当前微生物模型的外部验证证据是什么”，但输入材料必须来自实际来源，不能让模型自己写出论文，再把自写内容当作证据检索回来。

CurateMicrobiota原有工程提供八张课程来源卡的本地检索与提示材料导出。卡片不是论文全文，提示材料导出也没有执行一个生成器。本课新增的是三个可直接保存并运行的机制实验；其中向量为明确标识的手工数值夹具，未下载语义模型，也未训练交叉编码器。把这些实验接入正式项目时，应在功能清单记录“已运行”“设计待实现”和“尚未评价”，让技术展示与实际完成范围一致。

## 语料分块要保存能恢复原意的上下文

先为每个原始文件分配document_id，再为每块保存chunk_id、文档哈希、版本日期、章节或页码、起止字符、标题、正文和来源类型。分块粒度可以按段落与标题组织，超过长度上限时再拆分；表格尽量把行名、列名、单位、分母和图注一起保留。把“未在独立研究验证”切掉，只留下“表现良好”，会制造一个语法完整、事实方向错误的检索单元。每次改变解析器或分块参数，都要重建并标识对应索引。

重叠可以缓解边界截断，也会把同一证据重复多次。评价时同时保留块级命中和来源级覆盖，避免一篇文章切成十块就占满前十名。去重包括相同文本、近重复版本和同一队列的多篇报告，但同源不意味着内容完全相同，不能丢掉有价值的更正。论文全文的可访问性与再分发许可需要分别确认；撤回、更正和更新要进入来源状态。开发问题与保留问题按原始文档或主题族隔离，避免把同一问题换几个词后分到两侧。

## BM25：词频饱和、长度归一与逆文档频率

设语料有N个文档，df(t)是包含词t的文档数，f(t,d)是它在文档d中的次数，|d|是分词后长度，avgdl是平均长度。本课使用IDF(t)=ln[1+(N−df(t)+0.5)/(df(t)+0.5)]，分数为对查询中不同词求和：IDF(t)×f(t,d)(k1+1)/[f(t,d)+k1(1−b+b|d|/avgdl)]。k1控制词频饱和，b控制长度归一程度；b=0取消长度项。查询重复词在这个教学版本只算一次，不声称复刻所有搜索引擎的字段权重、位置和词项处理细节。

Apache Lucene官方BM25Similarity文档明确给出上述IDF、k1与b的作用；其默认值可作为起点，不能当作任何语料的最优值。下面只有英文小写字母、数字和下划线的分析器，适用于观察公式，不适用于直接处理全部中文或复杂物种命名。科学检索还应测试连字符、版本号、同物异名和属种缩写。运行后观察B排第一，再把subject改成不存在的词，验证零命中不会被程序改写成高置信答案。

```python
import math, re
from collections import Counter
# 原创合成短句，只用于检索机制；不代表真实论文结论。
docs = {
    "A": "relative abundance taxon sample species",
    "B": "external validation study subject split",
    "C": "dna sequence base token model",
    "D": "study study internal validation no external cohort",
}
tokenize = lambda text: re.findall(r"[a-z0-9_]+", text.lower())
counts = {key: Counter(tokenize(text)) for key, text in docs.items()}
lengths = {key: sum(row.values()) for key, row in counts.items()}
avg_length = sum(lengths.values()) / len(lengths)
def bm25(query, k1=1.2, b=0.75):
    if k1 <= 0 or not 0 <= b <= 1:
        raise ValueError("invalid BM25 parameters")
    scores = dict.fromkeys(docs, 0.0)
    for term in sorted(set(tokenize(query))):
        df = sum(term in row for row in counts.values())
        idf = math.log1p((len(docs) - df + 0.5) / (df + 0.5))
        for key, row in counts.items():
            f = row[term]
            norm = k1 * (1 - b + b * lengths[key] / avg_length)
            scores[key] += idf * f * (k1 + 1) / (f + norm)
    return sorted(scores.items(), key=lambda pair: (-pair[1], pair[0]))
ranked = bm25("subject external validation")
print(ranked)
assert ranked[0][0] == "B"
assert bm25("subject subject") == bm25("subject")
assert all(score == 0 for _, score in bm25("unseenword"))
```

## 向量检索：相似性依赖表示与任务

双编码器分别把查询和文档编码为向量，因此文档向量可以预先计算。余弦相似度是q·d/(||q||||d||)，两端都做L2归一后等于点积；零向量必须单独处理。输入前缀、tokenizer、截断长度、池化方式、嵌入版本和相似度函数共同构成索引合同。更换其中关键部分后，旧向量与新查询向量不应未经验证直接混用。模型能把语义近似内容拉近，也可能混淆否定句、数值范围和近缘物种名称。

小语料先用精确矩阵乘法作为参照，之后才考虑近似最近邻索引，并单独测量近似检索相对精确搜索的召回损失。不能只以搜索速度宣布系统更好。后面的三维向量由作者手工指定，目的只是检验归一化、排名及融合代码；它不提供“语义检索胜过BM25”的实验依据。真正换成预训练嵌入时，需保存模型标识、版本和任务评价，并验证用于微生物术语的表现，而不是从通用榜单直接推断专业可靠性。

## 混合检索用排名融合，避免直接相加不同尺度

BM25分数与余弦分数的数值范围和含义不同，未经校准直接相加，会让某一尺度主导结果。RRF把每个排序列表中的名次转成1/(c+rank)，再对同一文档累加；rank从1开始，未进入某列表的文档在该列表贡献为0。常数c缓和首位优势，原始RRF论文使用60，但这不是普适定律。需要调参时只用开发集，同时固定每个检索器的候选深度；否则候选数量变化也会改变融合行为。

下面代码完整执行余弦排序和RRF，稳定的ID用于打破并列。重复ID应报错，否则同一系统可能重复给同一证据加分。两个检索器都把B放在第一时，B的融合分数为2/61。这个数是排序规则的输出，不是“证据有3.28%的概率为真”。融合应与各单检索器比较召回、无答案误召回和延迟，保留没有改善的查询。权重融合、多个查询改写和更多检索器都应以新增复杂度带来的可测收益为依据。

```python
import numpy as np
# 三维向量为手工教学夹具，不是下载或训练出的语义 embedding。
ids = ["A", "B", "C", "D"]
vectors = np.array([[.8,.2,0], [.1,.9,.1], [0,.1,.9], [.2,.75,.1]])
query = np.array([0., 1., 0.])
norms = np.linalg.norm(vectors, axis=1)
if np.any(norms == 0) or np.linalg.norm(query) == 0:
    raise ValueError("cosine similarity needs nonzero vectors")
cosine = (vectors / norms[:, None]) @ (query / np.linalg.norm(query))
dense = sorted(ids, key=lambda key: (-cosine[ids.index(key)], key))[:3]
lexical = ["B", "A", "D"]
def rrf(rankings, constant=60):
    if constant < 0:
        raise ValueError("constant must be nonnegative")
    result = {}
    for ranking in rankings:
        if len(ranking) != len(set(ranking)):
            raise ValueError("one ranking must not repeat an ID")
        for rank, key in enumerate(ranking, start=1):
            result[key] = result.get(key, 0.0) + 1 / (constant + rank)
    return sorted(result.items(), key=lambda pair: (-pair[1], pair[0]))
fused = rrf([lexical, dense])
print({"cosine": dict(zip(ids, cosine.round(4))), "dense": dense, "rrf": fused})
assert dense[0] == fused[0][0] == "B"
assert np.isclose(dict(fused)["B"], 2 / 61)
assert set(dict(fused)) == set(lexical) | set(dense)
```

## 重排只处理候选，不能修复根本没有召回的证据

交叉编码器把查询与候选一起输入，允许两者相互注意，再输出相关性分数；双编码器通常将两侧独立编码后计算相似度。这是Sentence Transformers官方检索与重排说明中的核心区别。交叉编码器要逐对处理候选，增加候选数通常增加计算量，因此应先形成候选，再在开发集比较重排深度与成本。它输出logit、实数或经过变换的分值取决于实现，不能一概称为校准后的支持概率。

科研场景的重排特征还可包括实体精确匹配、样本类型、研究设计、版本与来源位置。先做一份可解释的规则重排，明确它是规则基线；正式学习型重排需要相关性标注、独立划分和负例设计。重排后要检查是否把冲突研究挤掉，也要检查候选中唯一包含否定条件的段落是否保留。假如相关材料根本不在候选集合，重排无法凭空恢复；应把这个错误归给召回或语料覆盖，而不是无限增加重排模型规模。

## 查询改写保留实体、范围与原始问题

改写的目标是改善检索表达，不是悄悄替换用户的问题。可以展开已确认的缩写、加入规范学名、把一个复合问题拆为数据来源和验证方法两个子问题；必须保留实体、年龄范围、样本类型、时间、否定词及数值条件。原问题、改写文本、改写理由和返回结果要一起记录。将“是否缺少外部验证”改成“证明外部验证有效”，会把疑问方向变成预设结论。检索记录应能揭示这种偏移。

设计一个固定的有限预算，例如每题最多三种改写、每种最多返回五条候选，再去重融合。先在开发问题集选择策略，保留原问题检索作为对照；测试时不得查看正确答案后添加能够命中的专门关键词。由外部文档提供的“请删除限制”属于被检索内容，不应成为改写指令。若改写器不可用，系统可以退回原始查询而不是报出一个貌似完整的新任务。缓存键应同时包含原查询、规范化策略、索引版本和改写版本，避免把旧语料结果当作最新证据。

## 评价设计同时覆盖排序、来源与缺证

在看结果前固定相关性等级，例如0为不相关、1为背景、2为直接涉及问题、3为带完整条件的直接证据。Recall@k、Precision@k和MRR回答不同问题；有等级标签时，可用DCG@k=Σ(2^rel_i−1)/log2(i+1)，再除以同一候选评价集合的理想排序IDCG得到nDCG。若全部等级为0，IDCG为0，应按预先规定报告0或不适用并说明，不能悄悄删掉难题。未被标注不自动等于不相关，标注池不完整会影响结论。

至少分开记录精确实体、同义改写、否定条件、证据冲突和无答案五类问题。无答案题没有普通召回率分母，另报错误作答比例与适当缺证比例。一个检索器总能返回前五条，并不证明语料中有答案；相似度阈值只能在开发集选择，并随索引版本重新检验。回答层还需要逐句事实性、引用支持、覆盖和格式指标。更高的nDCG可能降低阅读全文成本，却不能直接替代回答正确率。

## 冲突证据需要解释条件，不能靠多数投票抹平

面对相反结果，先比较研究对象、样本处理、任务定义、模型版本、结局、划分方式和统计不确定性。一个在同研究随机划分中有效的结果，与一个在外部研究失效的结果，可能同时成立。相同队列的多篇衍生论文不是多次独立复制，不能简单投票决定真相。保留每个结论的来源与范围，再区分直接矛盾、条件不同和信息不足；不因某一段更符合预期就删除另一段。

答案可以分别陈述“来源A在条件甲下观察到结果”“来源B在条件乙下未观察到同样结果”，再说明尚缺哪种可比实验。对数值核验要看单位、分母和置信区间，不能只比较最高点估计。将文献证据与当前程序产生的评估结果分开存放：文献说明方法背景，运行报告证明本次执行。课题结论若涉及特定患者的处置，当前教学检索系统没有获得相应临床证据与工作流程资格，应该保持研究说明边界。

## 结构化输出通过语法后，还要过引用与语义核验

建议把答案设计成状态、断言、证据ID、核验状态和待补信息的集合。JSON解析只验证基本语法；schema还检查字段类型、枚举、额外字段和长度；引用校验检查ID是否属于本次候选；最终语义校验才判断段落是否支持具体断言。下面代码故意只实现其中可确定执行的合同，并要求明确的人工支持状态。字段中写了human_supported并不会自动创造核验行为，正式系统必须由有记录的独立审查环节赋值。

运行正确例子后，把证据ID换成invented-id，应被明确拒绝。再设计一个“引用ID存在但结论错误”的反例：程序仍可能通过结构检查，这就是验收边界。不能让校验器在报错后偷偷补一个不存在的来源，也不能把冲突状态无条件转成支持状态。若接入生成模型，应限制输出到允许的字段，保存原始生成与核验结果，并把修复次数设上限；达到上限时返回可诊断错误，而不是继续生成直到表面合法。

```python
import copy, json
# 验证结构、引用成员关系及人工核验状态；不自动判断自然语言蕴含。
retrieved_ids = {"B", "D"}
def validate_answer(row):
    if type(row) is not dict or set(row) != {"status", "claims"}:
        raise ValueError("unexpected answer fields")
    if row["status"] not in {"supported", "conflicting", "insufficient"}:
        raise ValueError("unknown status")
    if type(row["claims"]) is not list:
        raise ValueError("claims must be a list")
    if row["status"] != "insufficient" and not row["claims"]:
        raise ValueError("nonempty claims required")
    for claim in row["claims"]:
        if type(claim) is not dict or set(claim) != {"text", "evidence_ids", "review"}:
            raise ValueError("invalid claim fields")
        refs = claim["evidence_ids"]
        if not isinstance(claim["text"], str) or not claim["text"].strip():
            raise ValueError("empty claim")
        if type(refs) is not list or any(type(x) is not str for x in refs):
            raise ValueError("reference IDs must be strings")
        if len(set(refs)) != len(refs) or not set(refs) <= retrieved_ids:
            raise ValueError("unknown or repeated evidence ID")
        if claim["review"] not in {"human_supported", "needs_review", "conflicting"}:
            raise ValueError("unknown review state")
        if row["status"] == "supported" and (not refs or claim["review"] != "human_supported"):
            raise ValueError("supported claims need references and review")
    return row
good = {"status":"supported", "claims":[{
    "text":"教学片段B涉及按研究和受试者划分。",
    "evidence_ids":["B"], "review":"human_supported"}]}
print(json.dumps(validate_answer(good), ensure_ascii=False))
bad = copy.deepcopy(good); bad["claims"][0]["evidence_ids"] = ["invented-id"]
try:
    validate_answer(bad)
except ValueError as error:
    print("rejected:", error)
else:
    raise AssertionError("unknown ID was accepted")
```

## 把实验接回 CurateMicrobiota，形成一次可审计比较

本课建议拆成四段：四十五分钟语料与分块合同，六十分钟BM25和RRF实验，六十分钟标注与冲突核验，七十五分钟阅读、练习和报告。三个Python代码块彼此独立，分别保存为day21_bm25.py、day21_fusion.py和day21_contract.py，然后用当前虚拟环境执行。保存标准输出、解释器和依赖版本、语料版本及参数；不要只截取一次排名最好的输出。全部片段均可在CPU运行，无外部模型下载。

最终报告先描述当前八卡接口实际做了什么，再列出本课已执行的机制实验。对正式RAG的下一步，只选择一个明确改动，例如加入经过许可的全文片段，并在固定问题集比较；暂未实现的向量模型、重排模型和生成器保留为计划。交付时能复原一个问题的来源、候选、排序、断言与失败原因，比把全部模块名称放在架构图上更有价值。下一单元将把这些受限功能放入有状态、可终止的科研工作流。

## 动手实验 · 交付一份检索升级实验，而不是只演示一次正确回答

### 1. 建立来源与问题清单

选十个可核验片段，保存来源ID、版本、定位和许可状态；准备开发与保留问题，并包含无答案和冲突题。

检查什么：问题分组与相关性标签在调参前固定，相同来源的近重复问题不跨组。

### 2. 执行BM25机制

将第3节代码单独保存为day21_bm25.py，先运行全部断言，再改一个参数或查询词记录差异。

```bash
python day21_bm25.py
```

检查什么：B排名第一，重复查询词不重复加权，未知词得分全零。

### 3. 执行余弦与融合机制

将第5节代码保存为day21_fusion.py，逐项手算B的RRF；明确向量为手工夹具。

```bash
python day21_fusion.py
```

检查什么：归一化与RRF断言通过，输出不被解释为真实专业检索性能。

### 4. 验证结构与引用成员关系

将第10节代码保存为day21_contract.py，运行正常输出和未知ID反例，另写一个引用存在但命题错误的反例。

```bash
python day21_contract.py
```

检查什么：未知ID被拒绝，语义错误仍需人工核验的边界被明确记录。

### 5. 形成四层结果表

分别报告语料覆盖、检索排序、逐句支持和无答案处理；为一个失败案例提出单变量修复，保留测试问题不参与选择。

检查什么：报告至少包含一项未解决问题，未将演示当作完整生成RAG验收。

### 实验验收

- [ ] 三个独立Python机制实验均真实执行并保留输出
- [ ] BM25分析器范围、参数和IDF版本明确
- [ ] 余弦与RRF分数没有被写成事实概率
- [ ] 存在开发/保留划分、无答案题和冲突题
- [ ] 引用成员检查与自然语言支持检查分开记录
- [ ] 当前八卡检索、提示导出和未来生成扩展的完成状态准确

## 论文导读

### Apache Lucene 9.12.3 — BM25Similarity 官方API说明 (2025)

https://lucene.apache.org/core/9_12_3/core/org/apache/lucene/search/similarities/BM25Similarity.html

核对IDF、词频饱和与长度归一参数，并区分公式教学版与实际搜索引擎细节。

- 定位idf、getK1和getB，逐项对照本课公式。
- 检查默认参数和字段长度的定义，记录版本而不直接称其最优。

**阅读问题：** 为什么要保存分词器版本？

**参考思路：** 词项、文档长度和df都受分析器影响，变化会改变BM25分数与排名；只保存k1与b不足以复现。

**阅读问题：** 词重复很多次会让单词贡献无限线性增长吗？

**参考思路：** 固定文档长度项时，f/(f+常量)随f增加逐渐饱和；长度本身变化也会影响结果，应分别分析。

### Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods (2009)

https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf

从原始公式理解排名融合，避免把不同检索器的原始分数任意相加。

- 手算两个列表中的同一文档如何得到累积分数。
- 阅读常数60的选择背景，区分论文验证范围和本项目的待验证效果。

**阅读问题：** 某文档没进入第二个候选列表，第二个列表贡献多少？

**参考思路：** 本课截断列表实现中贡献为0；不能补成末名后再额外加分。

**阅读问题：** 为什么RRF不能证明引用支持？

**参考思路：** 公式只利用名次，没有验证段落是否蕴含答案，也没有检验研究设计的适用范围。

### Sentence Transformers — Retrieve & Re-Rank 官方教程 (2026)

https://sbert.net/examples/sentence_transformer/applications/retrieve_rerank/README.html

厘清双编码器候选召回与交叉编码器重排的计算和作用范围。

- 画出独立编码与查询文档联合编码的差异。
- 列出候选深度、重排成本和漏召回之间的取舍。

**阅读问题：** 为什么通常不对全部文档直接做交叉编码器打分？

**参考思路：** 每个查询文档对都要联合推理，文档很多时成本较高；先召回候选可以限制计算预算。

**阅读问题：** 本课的三维向量实验是否复现了该教程的预训练模型？

**参考思路：** 没有。它只执行相似度与融合机制；真正嵌入及重排模型需要另行加载、记录版本并评价。

## 练习与完整参考解答

### 练习 1. 两个排序为[A,B,C]与[B,D,A]，c=60。分别计算A与B的RRF分数，判断谁在前。

提示：名次从1开始，同一ID跨列表相加。

参考解答：A=1/61+1/63，约0.032266；B=1/62+1/61，约0.032522，因此B在前。D和C只在一个列表出现，各贡献一次。若两个系统返回不同深度，还要说明截断规则；该分数不是支持结论的概率。

### 练习 2. 一份结果表把“检索Recall@5为0.9”写成“答案90%正确”，请改写评价方案。

提示：追踪从相关材料到最终断言之间缺少的核验。

参考解答：保留Recall@5作为检索层结果，同时记录测试题数、相关性定义和来源分组。另对生成或人工整理答案逐句标注事实正确、证据支持和引用覆盖，并单列无答案题错误作答率。固定检索库后再比较生成器，避免把检索改善误归因给语言模型。

### 练习 3. 查询改写把“成年粪便队列是否存在外部验证”改成“微生物模型在儿童血液样本中的临床效果”。怎样修复并验证？

提示：列出被更改的实体、范围和目标。

参考解答：改写改变了年龄、样本类型和研究问题，应判语义漂移。保留原查询，设置实体与范围约束，只有已核验同义表达可替换。构造包含这些条件的固定改写测试，检查检索覆盖和语义保真；失败时退回原查询，不用更多结果掩盖问题改变。

### 练习 4. 来源A报告同研究验证良好，来源B报告外部研究失败；结构化答案应怎样组织？

提示：先判断是否同一条件下的直接矛盾。

参考解答：为两个断言分别保存来源与验证条件，说明它们可以同时成立，不能多数投票宣布泛化成功。结论应指出已有内部表现与外部失效证据，以及尚缺的可比外测。结构字段标为存在条件差异或需进一步核验，并要求引用ID属于本次检索结果；程序校验不能替代研究设计审查。

## 验收自测

### 1. RRF主要融合的是哪一种信息？

A. 所有文档的真实因果效应
B. 不同检索列表中的名次
C. 已经校准的疾病概率
D. 模型参数数量

参考答案：B。RRF按名次累加倒数贡献，不需要不同系统原始分数处于同一尺度。

### 2. 关于本课手工三维向量，正确的是？

A. 证明专业语义检索最优
B. 等同下载的预训练嵌入
C. 可以直接诊断患者
D. 只用于验证相似度与融合计算

参考答案：D。数值夹具让机制可复算；真实语义质量需要真实编码器与独立问题集。

### 3. 交叉编码器重排最直接受哪项限制？

A. 相关证据必须先进入候选集合
B. 不允许读取查询
C. 所有分数都必须为负
D. 能够自动补出缺失原始论文

参考答案：A。重排只能重排已有候选，不能凭空找回未召回的材料。

### 4. 一个JSON答案引用了存在的证据ID，接下来仍需什么？

A. 把任何结论都标成支持
B. 省略样本条件
C. 核验来源是否支持具体命题及其范围
D. 把链接数量当成准确率

参考答案：C。引用成员关系与命题支持是两种不同的检查。

### 5. 无答案题应该怎样进入评价？

A. 从所有结果中删除
B. 单独评价错误作答与适当缺证，不伪造召回率分母
C. 不断改写直到有高分
D. 把主题相近段落设为金标准

参考答案：B。语料没有直接答案时，正确行为包括保持缺证；强行安排相关证据会污染评价。

## 收尾思考

- 我能否解释一次排序变化究竟来自分析器、语料、索引还是生成器？
- 我的证据标签是在看系统结果前确定，还是在替结果找理由？
- 我能否展示一个结构合法但语义不被支持的真实反例？

下一步：下一单元把检索与指标计算放入有状态、受限、可审计的工具工作流。
