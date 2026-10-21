# 第 31 课 · 提示与上下文工程：让每一次输入成为可比较的实验

从零样本、少样本与示例选择，到上下文预算、约束输出和提示消融

版本：2026.10.21.4｜建议 210 分钟，可分次完成

## 学习目标

- 区分上下文内学习、检索补充、参数微调与外部记忆的状态变化。
- 把一个科研任务写成可核验的输入、输出、证据与失败约定。
- 构造不泄漏测试答案的零样本和少样本提示对照。
- 用真实编码器分配上下文，保存最终输入及版本摘要。
- 解释约束解码、JSON解析、模式校验与科学语义核验的不同作用。

## 今日交付物

- 一份版本化的科研证据抽取提示，含字段定义和缺证示例。
- 四种提示条件的预注册比较表，记录样例来源、顺序与预算。
- 可执行上下文编排器及其保留、丢弃、超限拒绝记录。
- 结构合法但科学结论错误的反例与独立核验说明。

## 先修准备

- 完成 D2、D7、D9 与 D23；理解编码器、生成概率、来源留出与评价指标。
- 完成 D20 的聊天模板部分和 D21 的证据字段部分更容易衔接。
- 本课两个脚本仅需项目已有依赖，不需要模型下载、API 密钥或 GPU。

## 01｜任务合同先于提示措辞

提示的作用，是把模型的条件输入组织成能够支持目标任务的信息。先把任务写成“输入是什么、需要决定什么、输出如何核验、哪些信息缺少时停止”，再决定语气或角色。以微生物论文抽取为例，输入是一段已定位的原文，输出是样本来源、测量方法、表型、比较方向、效应量及出处；如果原文没有效应量，空值和缺失原因本身就是正确结果。

把“你是世界顶级专家，请全面深入分析”改成具体要求：每项结论必须绑定证据 ID；相对丰度与绝对负荷分别记录；观察性关联使用关联表述；找不到信息就标为 missing。这些规则能形成独立评分表。长提示不自动更好，重复的礼貌、身份和形容词消耗预算，却没有增加任务约束。

本课使用的证据卡与回答都是原创教学材料，不把模拟句子当作真实研究结果。真正接入文献时，保留文章、版本、段落位置和可用许可。任务描述、输入材料与评价答案分开保存：评价答案应只进入评分环节，否则所谓提示改进可能只是把答案复制到了上下文。

## 02｜上下文内学习没有更新模型权重

零样本提示只描述任务；少样本提示再提供输入—输出例子。模型在当前条件序列上预测新答案，这就是上下文内学习的一种操作定义。常规推理没有反向传播或 optimizer.step，所以权重不随这些例子更新；对话历史和缓存可以变化，但不等于写入了长期参数知识。Brown 等人的原始工作把不同示例数量作为评价条件，见文末阅读。

这也解释了三种适配的区别：提示改变本次条件，RAG把可追溯外部材料放进条件，SFT通过损失更新参数。它们可以组合。若模型不能按给定字段输出，少量正确示例可能有帮助；若需要最新文献事实，应补充可核验证据；若大量重复任务需要稳定行为，可以在独立评价后考虑微调。不要用一个技术名替代问题诊断。

ICL 并不意味着任意小模型都能学会任意规则。当前 TinyGPT 的规模、上下文和训练文本只支持机制学习，不能拿它的失败证明少样本方法无效，也不能把随机输出称为领域推理。需要真实模型能力实验时，选定可支持任务的模型、固定版本、保存实际提示，并与零样本结果在同一题集比较。

## 03｜示例选择、标签空间与顺序都属于实验因素

一个好的示例不仅给答案，还明确格式和边界：什么是缺证、何时保留冲突、哪些字段不能推断。先覆盖正常、否定、缺失与相互矛盾的案例，再考虑例子数量。样例应来自开发资料，与最终测试文献按研究或文档家族隔离；同一摘要换一种问法仍可能泄漏。

Min 等人的研究发现，在其考察的分类和选择题任务中，示例的标签空间、输入分布与格式可以产生重要影响，不能据此推断所有任务的标签可以随意写错。科研抽取的示例应保持正确。可将标签打乱作为研究对照，用来分辨格式提示与输入—标签映射分别贡献多少，但必须清楚标为实验扰动。

改变示例顺序时保留同一组例子，才是在比较顺序；换成更相关的例子后再改变顺序，会同时改变两个因素。固定几种事先规定的排列，报告均值与范围。不要在最终测试集上反复试排列再挑最高分。类别不平衡时还需检查模型是否只是沿用了示例中最常见的标签。

## 04｜写一份能直接使用的科研提示

建议把模板分成任务、字段、证据、例子、当前问题与输出约定。任务写“只根据本次材料抽取研究信息”；字段明确 host、assay、design、association、effect、uncertainty 与 evidence_ids；缺失允许 null；冲突保留双方来源。信息来源与指令层由应用明确分开，但文字分隔符不是执行权限边界，工具权限仍由 D22 的执行层控制。

示范任务可以这样写：“读取 E1 与 E2，给出二者是否研究同一测量对象；输出 comparability 为 comparable、partly_comparable 或 insufficient，并附最多两条理由。理由只能引用给定证据，不能补写原文没有的样本数。”然后给一个 16S 与 shotgun 测量差异的示例，再给一个方法缺失的反例。示例说明判断尺度，不能代替真正方法学核对。

模型输出用于继续计算时，把可机器读取的字段与面向人的简短说明分开；不要要求评分器解析一篇随意散文。多轮编辑应保存模板版本、所用示例和最终实际输入，而不只保存最初手写的提示。模型名称相同但模板或证据不同，仍然是不同实验条件。

## 05｜先分配上下文，再装入材料

可用输入预算等于模型上下文容量减去预留输出及真实模板开销。容量应来自实际模型配置，计数应来自对应 tokenizer。中文字符、字节、子词 token 不能混用。消息序列还可能被聊天模板加入角色标记和终止符，因此最后必须编码完整渲染结果，而不能只把各段字符数相加。

下面用项目的 UTF-8 字节编码器做可重复编排：任务与问题是必需部分，证据按已给定顺序尝试放入，过长证据整块丢弃并记录 ID。它没有按字符截断原文，也没有偷偷改变问题。这是一个贪心可复核规则，不保证取得所有组合中信息量最大的集合。信息价值与长度需要独立评估。

代码中的 360 是编排演示预算，未加载任何模型，也没有把默认上下文 64 的 TinyGPT 扩成 360。实际接入模型时必须以它的真实上限重新运行。观察中文三字符占九个字节，以及过长 B 被跳过后更短 C 仍可进入；如果必需内容本身放不下，应报错并重新设计任务。

```text
L_input + L_reserved_output ≤ L_context；L_input = len(tokenizer(final_rendered_input))
```

```python
import hashlib
import json
from curatemicrobiota.language import ByteTokenizer

def render(question, cards):
    # This is an explicit teaching template, not an external model's chat template.
    return ('TASK: use only the supplied evidence; preserve uncertainty.\n'
            + '\n'.join('EVIDENCE '+c['id']+': '+c['text'] for c in cards)
            + '\nQUESTION: '+question+'\nANSWER:')

def assemble(question, ranked_cards, context_limit, output_reserve):
    if context_limit <= 0 or not 0 <= output_reserve < context_limit:
        raise ValueError('invalid context/output budget')
    selected, dropped = [], []
    if len(ByteTokenizer.encode(render(question, []))) + output_reserve > context_limit:
        raise ValueError('mandatory task and question do not fit')
    if len({c['id'] for c in ranked_cards}) != len(ranked_cards):
        raise ValueError('duplicate evidence ID')
    for card in ranked_cards:
        candidate = render(question, selected+[card])
        if len(ByteTokenizer.encode(candidate)) + output_reserve <= context_limit:
            selected.append(card)
        else:
            dropped.append(card['id'])
    prompt = render(question, selected)
    manifest = {'template': 'evidence-v1', 'tokenizer': 'utf8-byte-v1',
                'context_limit': context_limit, 'output_reserve': output_reserve,
                'input_tokens': len(ByteTokenizer.encode(prompt)),
                'kept': [c['id'] for c in selected], 'dropped': dropped,
                'sha256': hashlib.sha256(prompt.encode('utf-8')).hexdigest()}
    return prompt, manifest

cards = [{'id': 'A', 'text': '关联不等于因果。'},
         {'id': 'B', 'text': 'Repeated explanatory background. '*30},
         {'id': 'C', 'text': 'A held-out study was not used in training.'}]
prompt, report = assemble('What can the study establish?', cards, 360, 40)
assert report['kept'] == ['A', 'C'] and report['dropped'] == ['B']
assert report['input_tokens'] + report['output_reserve'] <= 360
assert len(ByteTokenizer.encode('微生物')) == 9 and len('微生物') == 3
assert report == assemble('What can the study establish?', cards, 360, 40)[1]
try:
    assemble('x'*400, cards, 360, 40)
except ValueError:
    pass
else:
    raise AssertionError('mandatory content must not be silently truncated')
print(json.dumps(report, ensure_ascii=False, indent=2))
print('Assembly only: no model was loaded; 360 is not TinyGPT default capacity.')
```

## 06｜长上下文、摘要与记忆有不同失效方式

能放入长材料不等于能可靠使用所有材料。Lost in the Middle 在特定模型与任务中观察到答案位置改变会影响表现；它给出的是应当检查的位置敏感性，不是对所有新模型的恒定规律。对自己的任务，将关键证据移到开头、中间、结尾，保持其余内容不变，分别测正确性与引用定位。

对话摘要会压缩上下文，但也可能丢失否定、单位、时间和来源。可以把“已确认事实、未决问题、当前约束、证据定位”分成字段，对摘要后的一项关键结论回查原文。摘要不应成为一个失去出处的新权威。模型说“之前已核实”时，系统仍需要能找到原始核验记录。

外部记忆还涉及写入规则与过期：旧方法版本、撤回文献或被用户更正的条件必须能更新。短期工作状态可以只保存本次任务，长期知识库需要来源、时间和版本。课程中的学习记录、RAG索引和模型权重属于不同状态，清空聊天历史不会重新训练模型，更新索引也不会改变权重。

## 07｜约束解码保证可接受形式，仍要检查意义

提示“请输出 JSON”只是一个生成要求；JSON 解析检查语法；模式校验检查字段类型、枚举和必填项；约束解码在生成时限制下一 token 的可选集合。PICARD通过增量解析约束特定形式语言的生成，是理解这一层次的原始研究。真正的子词语法约束还要处理 token 片段跨越语法边界，不能把下面的枚举掩码当作完整 JSON 引擎。

在有限枚举例子中，给非法标签的 logit 设为负无穷，使其归一化概率为零。所有候选都被禁止时必须显式失败，不能继续对全负无穷做 softmax。即使最终状态是合法的 supported，也没有证明一句科学断言得到支持。下方故意构造“引文存在、结构正确、因果结论不成立”的例子。

示例的设计字段检查只拒绝一个明显越界推断，不能承担一般科学事实判定；即使研究标注为随机干预，也要核对干预对象、终点、偏差与主张范围。项目应保存结构校验结果和证据支持核验结果两个字段，不能让模型自己填 human_verified 就绕过独立审查。

```python
import json
import torch

# A one-token enum is a small constraint example, not a complete JSON grammar.
vocabulary = ['supported', 'insufficient', 'invented']
logits = torch.tensor([1., 0., 8.], dtype=torch.float64)
allowed = torch.tensor([True, True, False])
masked = logits.masked_fill(~allowed, float('-inf'))
probability = torch.softmax(masked, dim=0)
assert float(probability[2]) == 0.0
chosen = vocabulary[int(probability.argmax())]
assert chosen == 'supported'

def validate_shape(raw):
    obj = json.loads(raw)
    if not isinstance(obj, dict) or set(obj) != {'status', 'claim', 'evidence_ids'}:
        raise ValueError('unexpected fields')
    if obj['status'] not in {'supported', 'insufficient'}:
        raise ValueError('invalid status')
    if not isinstance(obj['claim'], str) or not obj['claim']:
        raise ValueError('claim must be nonempty text')
    if not isinstance(obj['evidence_ids'], list) or not all(type(x) is str for x in obj['evidence_ids']):
        raise ValueError('evidence_ids must be a string list')
    return obj

catalog = {'E1': {'design': 'observational', 'measured': ['relative_abundance']}}
bad = validate_shape(json.dumps({'status': 'supported',
    'claim': 'The microbe causes the phenotype.', 'evidence_ids': ['E1']}))
assert set(bad['evidence_ids']) <= set(catalog)
# The ID exists and JSON is valid, but these checks have not proved the claim.
verified_causal_claim = any(catalog[i]['design'] == 'randomized_intervention'
                            for i in bad['evidence_ids'])
assert not verified_causal_claim
try:
    validate_shape('{"status":"supported","claim":"x","evidence_ids":42}')
except ValueError:
    pass
else:
    raise AssertionError('wrong field type accepted')
print('enum:', chosen, '| schema: valid | citation ID: valid | causal support: absent')
print('A randomized label would still require detailed scientific review.')
```

## 08｜提示消融要比较同一件事

为 CurateMicrobiota 设计四个条件：A 任务＋字段；B 在 A 上加固定正确示例；C 在 B 上加入同一检索证据；D 在 C 上加入形式约束和独立核验。A→B主要问示例是否有帮助；B→C问证据是否有帮助；C→D问输出合同是否改善可用率。最后一个条件包含两项组件时，必要时再拆开为约束、核验两组。

固定模型、问题来源、允许证据与输出预算；分别报告字段准确率、格式通过率、引用支持率、缺证识别率及耗时。示例长度不同导致输入 token 不同，既可报告实际方案比较，也可增加预算匹配的比较。若模型生成有随机性，使用相同题目、多次重复及预定汇总规则，不把每次重复当成独立文献。

开发集负责选择提示，测试集负责最终评价。若没有可用大模型，本课可先交付提示、评分规则与脚本通过的机制结果，模型表现一栏明确写未执行。填写真实的零分或失败比虚构一个“90%准确率”更有价值；用户能据此决定下一步应改善材料、提示还是模型。

| 条件 | 主要改变 | 独立观察 |
| --- | --- | --- |
| A：任务＋字段 | 建立最小合同 | 字段正确性与缺证处理 |
| B：增加示例 | 固定来源与排列 | 相对A的逐题变化 |
| C：增加证据 | 保存证据版本和ID | 支持率、冲突与来源归属 |
| D：约束＋核验 | 区分格式与意义 | 合法率、核验拒绝率与最终可用率 |

## 09｜以反例检查提示是否真正清楚

至少准备四类反例：原文没有样本数、结论含否定、两个来源方向冲突、相同菌名来自不同测量或人群。对每个反例先写正确行为，再让系统运行。如果只是把提示写得更长却仍在缺少样本数时猜数字，任务约定还没有成为稳定行为。

另设一次输入置换：把研究A的效应量与研究B的出处交换，评分器应该发现绑定关系错误。仅检查“输出中有 DOI”会遗漏此类失效。还要比较含义等价的提问改写，区分语义稳健性与格式脆弱性；改变问题真正范围时，则不能期待答案保持相同。

最终把失败归到可行动原因：未提供所需证据、证据被预算删除、模板不兼容、生成违约、校验不足或任务本身无法从材料回答。这样下一轮修改有明确目标，不会把所有失败都归结为“提示还不够专业”。

## 10｜把提示当作研究配置交付

一份可复现提示包至少包含任务定义、模板文本、样例来源与顺序、证据版本、编码器与模型版本、生成参数、输入摘要、评分规则和错误清单。摘要用于发现变动，不能替代可合法保存的原始材料。含敏感信息的输入应按数据授权处理，公开仓库只放教学案例。

将本课接回 D21：检索器输出候选证据，编排器记录实际装入的子集，模型在该子集上生成，核验器只认可本次允许的来源。评价时分析检索、装入、生成与核验四个阶段，才能知道正确材料在哪一步丢失。一个漂亮回答不应掩盖这条可追踪链条。

完成本课后，你应能解释为什么同样模型在不同输入条件下结果不同，如何建立公平比较，以及哪些错误不能靠提示解决。下一课把“多生成几次、让模型多想一会”拆成可测的候选生成、选择和预算问题。

## 动手实验 · 建立可追溯的证据提示与预算合同

### 1. 写最小任务合同

选择“抽取测量对象与结论强度”作为任务。写两条正常例子、一条缺证例子和一条冲突例子；每条先写期望字段，再决定表达。

检查什么：四种输入都有明确可判定的正确行为，未把缺证改成猜测。

### 2. 运行上下文编排器

从 project 根目录执行脚本。将预算由360改成较小值，先观察丢弃列表，再使必需问题超限；恢复原始脚本后再提交。

```bash
python lesson_examples/unit31/context_budget.py
```

检查什么：原始示例保留A、C并跳过B；超限任务明确抛错；最终输入字节数和摘要可复查。

### 3. 运行约束与语义反例

对照非法枚举概率、JSON字段校验、存在的引用ID与缺少因果支持四层结果。把 evidence_ids 改成数值，确认被拒绝。

```bash
python lesson_examples/unit31/constraints.py
```

检查什么：格式合法不被解释为科学结论成立。

### 4. 冻结提示比较表

建立A/B/C/D四种配置，按研究或文档家族准备开发/测试资料。能接入合适模型时再实跑；本课默认不调用外部模型。

检查什么：保留未执行标记，不填写假想准确率；所有条件共享题目和评分规则。

### 实验验收

- [ ] 能说明 ICL 不更新权重，区分提示、RAG、微调与外部记忆。
- [ ] 预算代码实际运行通过，输入计数来自实际渲染和对应编码器。
- [ ] 交付至少一个模式合法但科学语义错误的反例。
- [ ] 提示版本、例子顺序、证据清单和最终测试隔离规则全部明确。

## 论文导读

### Language Models are Few-Shot Learners (2020)

https://arxiv.org/abs/2005.14165

建立不做任务梯度更新的零样本、单样本与少样本实验定义。

- 读任务设置，找出各条件提供给模型的信息差别。
- 选择一个任务，说明示例数量变化是否同时改变输入预算。

**阅读问题：** 少样本结果改善能否直接说明权重学习了新任务？

**参考思路：** 不能。推理条件发生变化，但没有由该任务执行梯度更新；需区分表现变化与参数变化。

### Rethinking the Role of Demonstrations: What Makes In-Context Learning Work? (2022)

https://aclanthology.org/2022.emnlp-main.759/

用受控对照理解示例内容、标签空间与格式，而非把示例数量当作唯一解释。

- 定位标签扰动、输入分布和格式的比较。
- 检查考察任务的范围，再判断哪些结论可以迁移到科研抽取。

**阅读问题：** 为何不能据此在科研示例中随意填写错误标签？

**参考思路：** 原研究结论受任务和模型条件约束；错误样例可能改变任务规则、污染输出，生产示例仍应正确。

### Lost in the Middle: How Language Models Use Long Contexts (2023)

https://arxiv.org/abs/2307.03172

为长上下文增加位置敏感性检查。

- 比较关键材料在不同位置时的评价设计。
- 写出在自己的模型和文献任务上复测的位置置换方案。

**阅读问题：** 模型标称支持长上下文是否保证所有位置一样可靠？

**参考思路：** 容量只是可接收长度；有效使用能力需要在对应模型、任务和证据位置上实际检验。

### PICARD: Parsing Incrementally for Constrained Auto-Regressive Decoding from Language Models (2021)

https://aclanthology.org/2021.emnlp-main.779/

理解生成时限制可接受 token 与生成后解析之间的区别。

- 阅读增量解析如何拒绝不可接受的后续 token。
- 区分 SQL 语法合法、查询意图正确和结果事实可信。

**阅读问题：** 本课单标签掩码能否被称为完整 PICARD 重现？

**参考思路：** 不能。它只演示有限集合上的概率掩码；完整增量语法解析和模型集成没有在本课实现。

## 练习与完整参考解答

### 练习 1. 某配置上下文上限为4096，最终模板与问题占640，预留输出512。还可放多少证据token？若加入标题后多80token怎么办？

提示：所有实际序列标记都要计入输入。

参考解答：证据初始预算为4096−640−512=2944。若标题原本未计入，剩余变成2864；最终对完整渲染序列重新编码确认。不能靠字符长度替代。

### 练习 2. 四个示例来自测试文献的改写句，但没有直接复制最终答案。这能算完全独立的少样本评价吗？

提示：独立单位不只是一句话。

参考解答：不能直接声称独立。研究对象、表述和事实可能来自同一文档家族，形成来源泄漏。按论文或研究分区，开发示例不使用最终测试来源，再冻结评价。

### 练习 3. 一个回答 JSON 合法、引用 ID 存在，并写“菌群变化导致症状改善”。只有观察性相关证据时，应如何记录？

提示：把结构结果和主张支持结果分开。

参考解答：结构可通过，ID归属可通过，但该因果主张的证据支持不通过。保留原始回答与失败原因，将结论改回材料能够支持的关联，或返回证据不足；不能伪造干预来源。

### 练习 4. 提示B比A更好，但B同时增加4个示例和2篇检索文献。如何判断改善来自哪里？

提示：设计一次只改变主要因素的对照。

参考解答：增加A＋示例与A＋证据两组，必要时形成2×2设计；固定模型、题目、选择规则和预算报告。先在开发集选配置，测试集只用于最终比较。

## 验收自测

### 1. 常规少样本推理中，最直接变化的是什么？

A. 本次条件输入
B. 训练集梯度已自动写入权重
C. 优化器动量
D. 模型参数规模

参考答案：A。示例进入上下文；没有反向传播和参数更新时，不发生任务微调。

### 2. 预算统计最可靠的对象是什么？

A. 中文字符数
B. 原始消息的字节数总和适用于任何模型
C. 最终渲染文本经实际tokenizer编码后的长度
D. 文档页数

参考答案：C。模板与特殊标记影响实际序列；编码器也因模型而异。

### 3. 约束解码使枚举标签合法，能否保证结论真实？

A. 能，概率归一化就是事实检查
B. 不能，仍需证据与语义核验
C. 只要温度为零就能
D. 只要输出够长就能

参考答案：B。形式集合与事实支持属于不同问题。

### 4. 测量示例顺序影响时应怎样做？

A. 每次同时换示例和模型
B. 在测试集上试到最高分
C. 保持同组示例并使用预先确定的排列
D. 只展示最好一次

参考答案：C。改变一个主要因素，避免测试集选择偏差。

### 5. 本课360字节预算演示说明什么？

A. TinyGPT默认已支持360上下文
B. 已训练大型领域模型
C. 长上下文没有位置问题
D. 编排规则可执行，实际模型容量仍需独立核对

参考答案：D。脚本不加载生成模型；演示预算不是模型配置变更。

## 收尾思考

- 如果任务失败，怎样区分没有提供证据和模型没有使用证据？
- 你的科研提示中，哪些字段能程序核验，哪些仍需专业判断？
- 哪些已知缺失信息应明确返回，而不能通过更长提示补出来？

下一步：进入 D32，把多次采样、候选选择、验证器和搜索预算纳入同一评价。
