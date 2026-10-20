'use strict';
(()=>{
const D=DEPTH,S=D.section,c=D.course('coding');
const P=[
['CSV质控','一行就是一个待检查记录，不能把成功读入等同于数据有效。输入不覆盖；问题报告应保留行号、字段、原因和严重程度。','输入协议 → 验证函数 → 异常测试 → 独立复现'],
['可信预测','先定义未来面对的人群与可获得的输入，再确定划分。预处理、调参与阈值选择属于开发过程；不能用预留评价数据指导这些选择。','预测任务 → Pipeline基线 → 负对照 → 模型卡'],
['神经网络','先画张量形状和训练流程，再调整网络大小。梯度计算回答参数怎么改变，验证回答这种改变是否能在未参与拟合的数据上成立。','张量 → 损失梯度 → 开发集选择 → 保存与复现'],
['跨模态','整合首先是身份和测量语义的整合。按行拼接可能把不同人接在一起；融合模型必须与单模态在同一评价对象上比较。','配对契约 → 公平比较 → 错配与缺失 → 解释边界'],
['神经信号','数列只有附上单位、采样率和时间轴才成为可解释测量。这里全用合成信号；频谱峰值和分类分数不能直接说明认知状态或临床用途。','采样 → 频谱 → 评价单位 → 参数报告'],
['证据检索','先让可追溯文本被可靠找回，不把生成流畅度当证据。无答案查询应有明确行为；返回相似度不是返回真实性概率。','语料 → TF-IDF基线 → 检索评价 → 作品交付']
];
const U=[
{teach:'数据契约至少说明必需列、类型、允许值与错误行为。sample_id必须按文本处理，保留前导零；abundance在本教学项目中规定为有限且非负的数。CSV中的字符串“NaN”并不是普通缺失标记，转换成浮点后仍需检查有限性。',task:'制作12行输入，包含空ID、重复ID、空数值、负值、文本与NaN。先手写每行预期，再运行示例。故意删除abundance列，要求程序报告缺列而非默默生成空输出。',question:'为什么float("nan")转换成功，仍不能把它当合格丰度？',answer:'浮点转换只检查能否解析；NaN不是有限数值。还要调用math.isfinite，并根据数据契约检查范围。',expected:'打印12个记录以及必需列；断言前导零ID仍为0001。此例建立输入，不代替下一课的完整校验。',requires:'仅Python标准库',code:String.raw`import csv, io
text = """sample_id,abundance
0001,1
0002,0
0003,2.5
0004,-1
0005,
0006,abc
0007,NaN
0008,inf
0009,4
0010,5
0010,6
,7
"""
reader = csv.DictReader(io.StringIO(text))
assert {"sample_id", "abundance"}.issubset(reader.fieldnames or [])
rows = list(reader)
assert len(rows) == 12 and rows[0]["sample_id"] == "0001"
print({"rows": len(rows), "columns": reader.fieldnames})
`},
{teach:'把检查逻辑写成输入明确、返回值稳定的纯函数，命令行仅负责读写。重复ID、非法数值与空值不要挤成同一条“数据有问题”；报告应能告诉使用者回到哪一行。',task:'逐行跟踪下面三个输入，预测每一条问题。加入一个负值、一行缺ID和一行文本数值。保持原记录不变，返回JSON可序列化的问题列表，并约定遇到重复ID是否继续检查数值。',question:'同一行同时重复ID且数值非法，应该只报一个问题吗？',answer:'应由契约明确。本例继续检查并可报告多个问题，便于一次修复；不能因为第一项失败就无声漏掉其他字段问题。',expected:'输出两项问题：第3行重复ID、第4行非法数值。行号把CSV表头视为第1行。',requires:'仅Python标准库',code:String.raw`import math, json

def validate(rows):
    seen, issues = set(), []
    for line, row in enumerate(rows, start=2):
        sid = row.get("sample_id", "").strip()
        if not sid:
            issues.append({"line": line, "error": "missing_id"})
        elif sid in seen:
            issues.append({"line": line, "error": "duplicate_id"})
        if sid:
            seen.add(sid)
        try:
            value = float(row.get("abundance", ""))
            if not math.isfinite(value) or value < 0:
                raise ValueError("invalid range")
        except (ValueError, TypeError):
            issues.append({"line": line, "error": "invalid_abundance"})
    return issues

rows = [{"sample_id": "a", "abundance": "2"},
        {"sample_id": "a", "abundance": "3"},
        {"sample_id": "b", "abundance": "NaN"}]
issues = validate(rows)
assert len(issues) == 2 and rows[2]["abundance"] == "NaN"
print(json.dumps(issues, ensure_ascii=False))
`},
{teach:'测试既检查成功路径，也检查失败是否按预定方式发生。抛出任意异常不等于正确：要检查类型和问题原因。测试自己也可能写错，所以先故意破坏一个实现，确认测试真的能抓住。',task:'运行六类边界测试；把math.isfinite这一行临时删掉，观察哪项断言失败，再恢复。另为缺列与重复ID写独立测试；将输入为空和文件不存在分别定义为不同错误。',question:'六个测试全绿是否等于质控软件适合真实研究？',answer:'不等于。它只证明这些已定义案例通过，真实输入还可能有编码、分隔符、单位或业务语义问题；需继续扩展测试和人工审阅。',expected:'输出6个被正确拒绝的非法输入，并验证0和1.5可通过。',requires:'仅Python标准库',code:String.raw`import math

def nonnegative(value):
    number = float(value)
    if not math.isfinite(number) or number < 0:
        raise ValueError("expected a finite nonnegative value")
    return number

bad = ["", "abc", "-1", "NaN", "inf", "-inf"]
for value in bad:
    try:
        nonnegative(value)
    except ValueError:
        pass
    else:
        raise AssertionError("accepted invalid input: " + repr(value))
assert nonnegative("0") == 0 and nonnegative("1.5") == 1.5
print({"rejected_cases": len(bad), "valid_cases": 2})
`},
{teach:'可复现交付把运行所需的信息从你的记忆搬到文件中。记录输入哈希、环境、命令和输出说明，可以追溯本次到底跑了什么。哈希一致只说明字节一致，不说明科学结论正确。',task:'在一个新目录按README重新运行质控。记录Python版本、输入SHA256、执行命令与问题数。让README只使用相对路径；请自己隔一天只看说明重跑，不依赖原工作目录。',question:'为什么需要同时保存原始输入和哈希，而不是只截图输出？',answer:'截图不能证明具体输入版本。原文件与哈希能帮助核对字节级一致性；仍需参数、环境与处理说明才能复跑。',expected:'打印包含Python版本、SHA256和bytes的元数据，并断言文件读取前后哈希相同。',requires:'仅Python标准库',code:String.raw`from pathlib import Path
from tempfile import TemporaryDirectory
import hashlib, platform, json

payload = b"sample_id,abundance\n0001,1.0\n"
with TemporaryDirectory() as directory:
    path = Path(directory) / "synthetic.csv"
    path.write_bytes(payload)
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    report = {"python": platform.python_version(), "sha256": digest,
              "bytes": path.stat().st_size, "data_kind": "synthetic"}
    assert digest == hashlib.sha256(payload).hexdigest()
    print(json.dumps(report))
`},
{teach:'当同一个人有多行记录，划分单位不应不经思考地设为行。按参与者分组是评价跨参与者预测的一种设计；它与预测同一人未来变化不是同一任务。先写目标场景，再选择划分方法。',task:'画60位参与者各两次测量的层级。运行分组划分并保存ID清单；再比较随机按行划分。写出实际部署时每个特征何时获得，删除只有结局发生后才知道的输入。',question:'每组两行，随机80/20划分是否必然完全独立？',answer:'不是。同一个人的记录可能同时进入两部分。本例用GroupShuffleSplit并断言group交集为空；若目标是未来时间预测，还需要处理时间顺序。',expected:'训练和评价组交集为0；打印两部分记录数与组数。',requires:'numpy、scikit-learn',code:String.raw`import numpy as np
from sklearn.model_selection import GroupShuffleSplit

rng = np.random.default_rng(17)
groups = np.repeat(np.arange(60), 2)
X = rng.normal(size=(120, 4))
y = np.repeat(np.arange(60) % 2, 2)
train, test = next(GroupShuffleSplit(n_splits=1, test_size=.2,
                                     random_state=17).split(X, y, groups))
assert not set(groups[train]) & set(groups[test])
assert set(train).isdisjoint(test)
print({"train_rows": len(train), "test_rows": len(test),
       "train_groups": len(set(groups[train])), "test_groups": len(set(groups[test]))})
`},
{teach:'Pipeline将会从训练数据学习的步骤与模型放在一起，便于在交叉验证的每个训练折重新拟合。它不能自动修复错误的划分单位，也不能阻止你反复查看测试集后挑方案。',task:'运行Dummy与逻辑回归；解释每一步的fit与transform发生在哪里。记录类别比例、平衡准确率与AUC；将scaler先在全数据fit作为故意错误版本，只用于说明为什么流程不合规，不据此选分数。',question:'用了Pipeline是否就绝对没有泄漏？',answer:'不是。ID泄漏、未来变量、先在全数据选特征，以及反复用测试结果作选择，都可能发生在Pipeline外。',expected:'打印同一测试集上两个模型的教学分数；不要求某个固定AUC，也不将合成结果解释为临床性能。',requires:'numpy、scikit-learn',code:String.raw`from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.dummy import DummyClassifier
from sklearn.metrics import balanced_accuracy_score, roc_auc_score

X, y = make_classification(n_samples=200, n_features=6, n_informative=3, random_state=17)
tr, te = train_test_split(range(len(y)), test_size=.25, stratify=y, random_state=17)
models = {"dummy": DummyClassifier(strategy="prior"),
          "logistic": make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))}
for name, model in models.items():
    model.fit(X[tr], y[tr])
    p = model.predict_proba(X[te])[:, 1]
    score = roc_auc_score(y[te], p)
    assert 0 <= score <= 1
    print(name, {"balanced_accuracy": balanced_accuracy_score(y[te], p >= .5), "auc": score})
`},
{teach:'标签置换检查模型是否在无真实标签关系时仍得到异常表现，但一次置换不是严谨的显著性检验。本练习固定开发/测试划分，仅打乱开发标签，观察行为；完整置换检验还需要适合设计的交换规则。',task:'先运行真实标签基线，再做三次开发标签置换。保持评价标签不变；记录所有结果，不挑最接近0.5的一次。移除一个特征组作为消融，并说明两种操作回答的不同问题。',question:'一次置换后AUC为0.65，能断言存在泄漏吗？',answer:'不能。有限样本会波动，需要检查设计并考虑多次置换的分布；本练习不提供由单次分数下结论的阈值。',expected:'打印三次教学负对照分数，断言范围合法而不强求低于某个值。',requires:'numpy、scikit-learn',code:String.raw`import numpy as np
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

X, y = make_classification(n_samples=180, n_features=6, random_state=19)
tr, te = train_test_split(range(len(y)), stratify=y, random_state=19)
rng = np.random.default_rng(19)
scores = []
for _ in range(3):
    model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))
    model.fit(X[tr], rng.permutation(y[tr]))
    scores.append(float(roc_auc_score(y[te], model.predict_proba(X[te])[:, 1])))
assert all(0 <= s <= 1 for s in scores)
print({"training_label_shuffle_auc": scores, "formal_p_value": None})
`},
{teach:'AUC评价排序，阈值决定实际分组。一个固定阈值可能产生不同的假阳性与假阴性；不能根据最终测试集反复挑最合意阈值。模型卡应报告任务、数据来源、划分、评价、不适用场景与限制。',task:'手算下面四人的混淆矩阵与Brier分数；比较0.5和0.7阈值的变化，只把它作为教学观察。给自己的项目写模型卡，明确合成数据、不用于诊断、阈值选择发生在哪里。',question:'AUC高是否意味着概率0.8就确有80%的机会？',answer:'不意味着。排序与概率校准不同；校准需要与任务及样本相匹配的检查，不能从AUC直接推出。',expected:'阈值0.5时矩阵为[[1,1],[0,2]]，Brier分数0.125。',requires:'numpy、scikit-learn',code:String.raw`import numpy as np
from sklearn.metrics import confusion_matrix, brier_score_loss

y = np.array([0, 0, 1, 1])
p = np.array([.1, .6, .7, .8])
cm = confusion_matrix(y, p >= .5, labels=[0, 1])
score = brier_score_loss(y, p)
assert cm.tolist() == [[1, 1], [0, 2]]
assert abs(score - .125) < 1e-12
print({"threshold": .5, "matrix": cm.tolist(), "brier": float(score)})
`},
{teach:'张量形状是模型最基础的接口。二分类每人一个logit可用[n,1]表示，标签形状需相同。未经说明的广播可能让代码运行却优化错误目标；运行前手画批量、特征和输出三个轴。',task:'用8人3特征输入写出每层形状，运行后比较。故意将标签改为[8]，观察损失函数是否拒绝；不要通过随意reshape掩盖语义错误。追踪requires_grad在参数和输入上的差异。',question:'输出[n,1]为何不是概率？',answer:'最后一层未经过sigmoid时是logit。BCEWithLogitsLoss接收logit；将sigmoid重复应用会改变优化目标。',expected:'输入(8,3)，logits(8,1)；所有模型参数都有梯度。',requires:'PyTorch',code:String.raw`import torch
from torch import nn

torch.manual_seed(7)
x = torch.randn(8, 3)
y = torch.randint(0, 2, (8, 1)).float()
model = nn.Sequential(nn.Linear(3, 4), nn.ReLU(), nn.Linear(4, 1))
logits = model(x)
assert logits.shape == y.shape == (8, 1)
loss = nn.BCEWithLogitsLoss()(logits, y)
loss.backward()
assert all(p.grad is not None for p in model.parameters())
print({"input_shape": list(x.shape), "logit_shape": list(logits.shape)})
`},
{teach:'损失将预测误差压成可优化的数，梯度说明局部参数改变的方向。对logit=0、标签=1的二分类样本，概率为0.5；BCE损失约0.693，logit梯度为-0.5。训练曲线下降不等于评价性能变好。',task:'先手算本例，再运行反向传播核对。把标签改为0，预测梯度符号。随后在原项目里只改学习率，保留划分、种子和训练轮数，记录训练与验证曲线。',question:'梯度为负时，梯度下降会让logit升高还是降低？',answer:'参数更新减去学习率乘梯度，所以负梯度会使该logit升高；这是此局部单变量示例，完整网络需通过链式求导。',expected:'损失接近ln(2)，梯度接近-0.5。',requires:'PyTorch',code:String.raw`import math
import torch
import torch.nn.functional as F

logit = torch.tensor([0.0], requires_grad=True)
target = torch.tensor([1.0])
loss = F.binary_cross_entropy_with_logits(logit, target)
loss.backward()
assert abs(loss.item() - math.log(2)) < 1e-6
assert abs(logit.grad.item() + .5) < 1e-6
print({"loss": loss.item(), "gradient": logit.grad.item()})
`},
{teach:'训练、验证和测试承担不同职能。早停或最佳轮次选择可以使用验证集，但测试集在选择中不能出现。保存最佳参数时需要独立副本，否则继续训练可能把你以为保存的“最佳模型”一起改掉。',task:'运行本例并定位最佳参数的保存与恢复。删除deepcopy作为思考实验，解释可变对象引用风险。扩展为三个种子；不要要求三次完全同分，而要记录波动与环境。',question:'为什么训练结束时的参数不一定是用于测试的参数？',answer:'如果方案以验证损失选择轮次，最终应恢复被选中的状态，而不是默认最后一轮。选择规则应预先固定。',expected:'打印最佳验证损失和测试输出形状[10,1]；测试只在开发选择结束后计算。',requires:'PyTorch',code:String.raw`import copy
import torch
from torch import nn

torch.manual_seed(11)
x = torch.randn(60, 3)
y = (x[:, :1] > 0).float()
model = nn.Sequential(nn.Linear(3, 4), nn.ReLU(), nn.Linear(4, 1))
opt = torch.optim.SGD(model.parameters(), lr=.1)
criterion = nn.BCEWithLogitsLoss()
best, saved = float("inf"), None
for _ in range(30):
    model.train(); opt.zero_grad()
    loss = criterion(model(x[:40]), y[:40]); loss.backward(); opt.step()
    model.eval()
    with torch.no_grad():
        value = criterion(model(x[40:50]), y[40:50]).item()
    if value < best:
        best, saved = value, copy.deepcopy(model.state_dict())
model.load_state_dict(saved); model.eval()
with torch.no_grad():
    pred = model(x[50:])
assert pred.shape == (10, 1) and torch.isfinite(pred).all()
print({"best_validation_loss": best, "test_shape": list(pred.shape)})
`},
{teach:'可加载的模型包包含结构、参数、输入定义和环境记录。只保存参数不能让别人猜出模型结构；能够重载同样预测也不等于模型适合真实数据。只加载可信来源的权重文件。',task:'保存并重载下面的小模型，验证同一输入输出一致。再写一个模型卡，注明合成数据、CPU、结构、特征顺序和限制；不把示例权重当研究模型发布。',question:'重载后结果不一致，先查什么？',answer:'先查结构、参数是否确实载入、eval模式、输入顺序和预处理；有随机性时还需确认种子与算子环境。',expected:'临时目录中保存state_dict，重载输出allclose为True；离开临时目录后不留下用户文件。',requires:'PyTorch（支持weights_only参数的版本）',code:String.raw`from tempfile import TemporaryDirectory
from pathlib import Path
import torch
from torch import nn

torch.manual_seed(13)
model = nn.Linear(3, 1).eval()
x = torch.randn(4, 3)
with torch.no_grad():
    before = model(x)
with TemporaryDirectory() as directory:
    path = Path(directory) / "weights.pt"
    torch.save(model.state_dict(), path)
    restored = nn.Linear(3, 1)
    restored.load_state_dict(torch.load(path, weights_only=True, map_location="cpu"))
    restored.eval()
    with torch.no_grad():
        after = restored(x)
    assert torch.allclose(before, after)
print({"reload_prediction_matches": True})
`},
{teach:'ID对齐要显式报告共同对象、仅A有、仅B有和重复对象。取交集是一项分析决定，不应偷偷丢掉未配对者。对齐后还要确认采样时间与测量语义匹配。',task:'故意打乱两张表的行顺序，用ID而非行号配对。打印未配对清单，并写下采用交集的理由。加入重复ID时要求失败；不要用字典覆盖掩盖原始重复。',question:'两表行数相同为何仍可能不能直接拼接？',answer:'它们可能来自不同对象或不同顺序；还可能同名ID对应不同时间点。行数一致不是身份一致。',expected:'配对ID为p1、p3；A-only为p2，B-only为p4。字典示例前提是上游已检查ID唯一。',requires:'仅Python标准库',code:String.raw`A = {"p1": [1., 2.], "p2": [3., 4.], "p3": [5., 6.]}
B = {"p3": [30.], "p1": [10.], "p4": [40.]}
paired = sorted(set(A) & set(B))
report = {"paired": paired, "only_A": sorted(set(A)-set(B)),
          "only_B": sorted(set(B)-set(A))}
joined = [(sid, A[sid] + B[sid]) for sid in paired]
assert paired == ["p1", "p3"] and joined[0][1] == [1., 2., 10.]
print(report)
`},
{teach:'单模态与融合比较应使用同一批评价对象、同一目标和匹配的开发过程。参数更多的模型更容易拟合，但不能把额外拟合能力自动解释成跨模态互补。',task:'运行A、B、A+B三个模型并保存同一索引。为每个模型记录维度与预处理。再比较使用交集样本与全可用单模态样本时问题如何改变，不能把不同人群分数直接排序。',question:'融合分数高，就证明两种生物机制互相作用了吗？',answer:'没有。分数改善是预测层面现象，可能涉及信息、噪声或容量差异；机制交互需要另外的设计与证据。',expected:'打印三个使用共同训练/测试索引的AUC；只检验合法范围，不保证融合必胜。',requires:'numpy、scikit-learn',code:String.raw`import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

rng = np.random.default_rng(21)
A, B = rng.normal(size=(160, 2)), rng.normal(size=(160, 2))
y = (A[:, 0] + B[:, 0] + rng.normal(size=160)*.3 > 0).astype(int)
tr, te = train_test_split(range(160), stratify=y, random_state=21)
for name, X in {"A": A, "B": B, "A+B": np.column_stack([A, B])}.items():
    m = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))
    m.fit(X[tr], y[tr]); auc = roc_auc_score(y[te], m.predict_proba(X[te])[:, 1])
    assert 0 <= auc <= 1
    print(name, float(auc))
`},
{teach:'错配对照破坏的是对象对应关系；缺失模态改变的是可用人群和输入。二者不同，不能只报告一个“下降了”。缺失者若系统性不同，完整病例表现还可能不代表全部目标人群。',task:'建立5人的B模态和缺失掩码，计算覆盖率；再置换B对应关系。把原映射与新映射保存为表，说明这不是重新测量到的数据；在完整项目中评价错配与缺失影响。',question:'只有完整病例才能运行融合时，应怎样报告性能？',answer:'同时报告可评价的人群范围与覆盖率；不能把完整病例分数冒充所有目标对象的表现。缺失处理若学习参数，应仍在开发数据内拟合。',expected:'覆盖率0.6，置换示例仅演示映射并保留有限值检查。',requires:'numpy',code:String.raw`import numpy as np

ids = np.array(["p1", "p2", "p3", "p4", "p5"])
B = np.array([[1.], [2.], [3.], [4.], [5.]])
observed = np.array([True, False, True, True, False])
coverage = observed.mean()
perm = np.array([2, 0, 4, 1, 3])
assert abs(coverage - .6) < 1e-12
assert not np.array_equal(B, B[perm])
print({"coverage": float(coverage), "evaluated_ids": ids[observed].tolist(),
       "shuffled_B": B[perm, 0].tolist(), "kind": "synthetic_control"})
`},
{teach:'跨模态原型交付要将分析事实和生物解释分开。可运行、能复现、预测有增益、机制成立是四种不同主张。报告每个主张的证据位置，没有证据时写未检验。',task:'编写一页分析卡，明确ID匹配规则、纳入范围、开发/评价分离、缺失规则、对照和不能推出的结论。做3分钟演示：输入1分钟、比较1分钟、限制1分钟。',question:'一个可复现的软件包能否直接证明研究结论可靠？',answer:'软件可复现使过程可检查，但研究设计、测量偏差和解释仍需独立判断。可复现是重要条件而非充分条件。',expected:'分析卡通过必需字段检查，并明确causal_claim为False。',requires:'仅Python标准库',code:String.raw`import json

card = {"data_kind": "synthetic", "alignment": "unique participant ID",
        "evaluation_unit": "participant", "missing_policy": "report coverage",
        "comparisons": ["A", "B", "A+B", "misalignment control"],
        "causal_claim": False, "clinical_use": False,
        "limitations": ["synthetic data", "no external population evaluation"]}
required = {"data_kind", "alignment", "evaluation_unit", "missing_policy", "limitations"}
assert required.issubset(card) and card["causal_claim"] is False
print(json.dumps(card, indent=2))
`},
{teach:'采样率fs表示每秒样本数，时间点通常取arange(N)/fs。若包含端点会改变有效间隔。对严格带限信号，避免混叠需要满足采样约束并考虑抗混叠处理；本例只演示已知正弦。',task:'生成fs=100Hz、1秒、10Hz信号，标时间轴。再用fs=12Hz采8Hz信号，观察可能被看成4Hz；明确低采样率无法仅靠插值恢复失去的信息。',question:'为什么不用linspace(0,1,100)默认端点来表示100Hz的一秒采样？',answer:'默认含两端，99个间隔覆盖1秒，间隔不等于1/100。可用arange(100)/100，或明确endpoint=False。',expected:'100个样本、时间步长0.01秒、最后时刻0.99秒。',requires:'numpy',code:String.raw`import numpy as np

fs, frequency, seconds = 100., 10., 1.
n = int(fs * seconds)
t = np.arange(n) / fs
x = np.sin(2 * np.pi * frequency * t)
assert len(x) == 100 and abs(t[1]-t[0]-.01) < 1e-12
assert abs(t[-1]-.99) < 1e-12
assert frequency < fs/2
print({"n_samples": len(x), "dt_seconds": float(t[1]-t[0]), "last_time": float(t[-1])})
`},
{teach:'有限窗长决定频率网格间隔fs/N。本例对整数周期正弦直接计算FFT，不涉及窗函数校正；真实数据还要说明窗、去趋势和功率定义。谱峰可反映信号中的周期成分，不自动对应心理状态。',task:'先预测10Hz峰在哪里，再运行。把时长从2秒变4秒，计算网格间隔；加固定种子的噪声比较。不要为了图更漂亮改变滤波而不记录。',question:'补零增加FFT点数是否等于增加真实信息或真正频率分辨能力？',answer:'补零使显示网格更密，但不增加观测时长；不能将更平滑的谱线误当新增信息。',expected:'主峰10Hz，频率网格间隔0.5Hz；此处幅度缩放仅用于该整数周期正弦。',requires:'numpy',code:String.raw`import numpy as np

fs, n = 100., 200
t = np.arange(n) / fs
x = np.sin(2 * np.pi * 10 * t)
f = np.fft.rfftfreq(n, d=1/fs)
amplitude = 2 * np.abs(np.fft.rfft(x)) / n
peak = f[np.argmax(amplitude)]
assert abs(peak-10) < 1e-12 and abs((f[1]-f[0])-.5) < 1e-12
print({"peak_hz": float(peak), "frequency_grid_hz": float(f[1]-f[0])})
`},
{teach:'信号切成窗口后行数增加，不代表独立参与者增加。跨被试解码应避免同一被试窗口穿越训练与评价；跨会话或跨时间目标还需对应层级划分。',task:'用10人每人10个窗口比较随机按行与按人划分。列出两部分交叉的参与者ID，不只看行索引是否重叠。画出subject→session→trial→window层级，并标明目标推广层级。',question:'训练与测试没有相同的行，是否已经足够？',answer:'不足。同一来源的相邻窗口或同一人不同试次仍可能相关；需要匹配目标推广场景的更高层级划分。',expected:'按行划分存在共享参与者；按组划分的参与者交集为空。',requires:'numpy、scikit-learn',code:String.raw`import numpy as np
from sklearn.model_selection import train_test_split, GroupShuffleSplit

g = np.repeat(np.arange(10), 10)
X = np.zeros((100, 2)); y = np.repeat(np.arange(10) % 2, 10)
a, b = train_test_split(np.arange(100), random_state=31)
naive_overlap = sorted(set(g[a]) & set(g[b]))
tr, te = next(GroupShuffleSplit(n_splits=1, test_size=.2, random_state=31).split(X, y, g))
assert naive_overlap and not set(g[tr]) & set(g[te])
print({"row_split_shared_subjects": naive_overlap, "group_split_shared_subjects": []})
`},
{teach:'信号报告要能重建时间轴和处理顺序。采样率、通道、单位、窗长、事件定义和排除规则都是分析的一部分。记录“已滤波”而没有参数，会让复现者无法判断哪些成分被改变。',task:'为前几周信号写参数清单，列出未执行的步骤，例如“未滤波，不适用于真实EEG结论”。附时序、频谱和数据生成公式；重新读取报告核对时长与样本数一致。',question:'为何必须把未做的步骤也写清？',answer:'避免读者把空白当成默认已完成；尤其是伪迹、单位与实际设备测量的缺失，直接影响解释边界。',expected:'由200样本和100Hz得到观测窗长2秒；最后采样点1.99秒，二者不混淆。',requires:'仅Python标准库',code:String.raw`import json

report = {"data_kind": "synthetic sine", "n_samples": 200, "sampling_hz": 100.,
          "amplitude_unit": "arbitrary unit", "frequency_hz": 10.,
          "filter": "not applied", "clinical_interpretation": False}
report["window_seconds"] = report["n_samples"] / report["sampling_hz"]
report["last_sample_seconds"] = (report["n_samples"] - 1) / report["sampling_hz"]
assert report["window_seconds"] == 2 and report["last_sample_seconds"] == 1.99
print(json.dumps(report, indent=2))
`},
{teach:'语料单元需要稳定ID、来源类型和文本。引语、作者概括与自己的问题应分开。此练习使用原创短笔记，不下载受版权限制的全文，也不将模型生成文字标成原始证据。',task:'从10段自写笔记开始，每段只讲一个问题。为每段加source_id、type与text；故意复制一个ID，要求程序拒绝。若以后引入外部内容，另记录许可与页码，不只记录URL。',question:'source_id为什么不能直接用列表行号长期维护？',answer:'排序和插入会改变行号，使旧引用指向别处；稳定ID能保持引用关系，仍需版本记录。',expected:'10个唯一ID；所有文本非空且明确属于原创教学笔记。',requires:'仅Python标准库',code:String.raw`import json

notes = ["Check identifiers before joining tables.", "Fit preprocessing on training data.",
         "Report the evaluation unit.", "A baseline makes comparisons interpretable.",
         "Record sampling frequency and units.", "A frequency peak is not a diagnosis.",
         "Separate observation from interpretation.", "Keep original data unchanged.",
         "State the limitations of a model.", "Return source text with retrieval results."]
corpus = [{"source_id": f"note-{i+1:02d}", "type": "original teaching note", "text": text}
          for i, text in enumerate(notes)]
ids = [r["source_id"] for r in corpus]
assert len(ids) == len(set(ids)) == 10 and all(r["text"].strip() for r in corpus)
print(json.dumps({"documents": len(corpus), "first": corpus[0]}))
`},
{teach:'TF-IDF检索比较词项表示，适合先建立一个可解释的本地基线。它不理解所有同义改写；相似度也不是事实可信度。无词汇重叠的查询应该返回空结果，而不是随便挑前三段。',task:'运行已知相关和完全无关的查询，核对返回原文与source_id。把training改成development等同义表达，观察词汇方法的限制。阈值在独立评价前根据开发查询确定。',question:'cosine相似度0.8能解释为答案有80%概率正确吗？',answer:'不能。它是特定向量表示下的相似度；真实性、相关性和回答充分性需要另外的判断。',expected:'training查询返回d1；无关词组返回空列表，保留原文，不生成答案。',requires:'numpy、scikit-learn',code:String.raw`import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

texts = ["Fit preprocessing on training data only.", "Check participant identifiers before alignment.",
         "Record sampling frequency and signal units."]
vectorizer = TfidfVectorizer(); matrix = vectorizer.fit_transform(texts)
def search(query):
    scores = cosine_similarity(vectorizer.transform([query]), matrix)[0]
    order = np.argsort(-scores)
    return [{"source_id": f"d{i+1}", "text": texts[i], "score": float(scores[i])}
            for i in order[:3] if scores[i] >= .05]
assert search("training preprocessing")[0]["source_id"] == "d1"
assert search("volcanic pineapple") == []
print({"relevant": search("training preprocessing"), "unanswerable": search("volcanic pineapple")})
`},
{teach:'Recall@k问相关证据有多少被前k个结果找回；Precision@k问返回项有多少相关。没有相关证据的查询不能随意塞进Recall分母，需要单独评价拒答行为。',task:'先手算本例，再制作20条测试问题。为每条问题写相关段ID，区分有答案与无答案。留出一部分查询不参与调阈值；记录同义改写、错误主题和证据不足三类失败。',question:'若真实相关证据有2段，只返回其中1段和2段无关内容，Recall@3与Precision@3是多少？',answer:'Recall@3为1/2，Precision@3为1/3。把两者混为“命中率”会丢失重要信息。',expected:'有答案查询的宏平均Recall@3为0.75；无答案查询拒答率为1。',requires:'仅Python标准库',code:String.raw`gold = [{"a", "b"}, {"c"}, set()]
returned = [["a", "x", "y"], ["c", "z"], []]
recalls, rejected = [], []
for relevant, found in zip(gold, returned):
    if relevant:
        recalls.append(len(relevant & set(found[:3])) / len(relevant))
    else:
        rejected.append(len(found) == 0)
macro_recall = sum(recalls) / len(recalls)
rejection_rate = sum(rejected) / len(rejected)
assert macro_recall == .75 and rejection_rate == 1
print({"macro_recall_at_3": macro_recall, "no_answer_rejection_rate": rejection_rate})
`},
{teach:'作品集不以文件夹数量计分。每个项目至少有任务、输入、运行命令、测试、结果解释与失败案例。公开前检查密钥、临床数据、版权内容和绝对路径；不要用一张成功截图代替复现。',task:'分别检查六个项目，未完成项保留未审核状态。为每个项目制作一页说明并演示一个正常输入和一个失败输入；请别人或隔时的自己仅按README运行。',question:'六个起步脚本都能运行，是否等于完成了六个成品项目？',answer:'不是。起步示例只验证最小行为，还需要按各周任务扩展、测试、写清限制并独立复跑。',expected:'生成六项目审核清单，全部初始化为not-reviewed；程序不伪造完成状态。',requires:'仅Python标准库',code:String.raw`import json

names = ["qc", "baseline", "representation", "multimodal", "signal", "retrieval"]
required = ["task", "input_schema", "run_command", "tests", "limitations", "privacy_review"]
portfolio = {name: {"status": "not-reviewed", "required": required.copy()} for name in names}
assert len(portfolio) == 6 and all(x["status"] == "not-reviewed" for x in portfolio.values())
print(json.dumps(portfolio, indent=2))
`}
];
c.pace='24周 · 每周3次×60分钟 · 24个可运行讲解例';
c.note='每周分理解、实现、验证三次；已有基础可合并。详解示例可逐课下载为Python文件；网页不执行Python，全部输入均为教学或合成数据。起步代码不等于已完成项目。';
c.lessons.forEach((l,i)=>{
 const u=U[i],p=P[Math.floor(i/4)],stage=i%4;
 const prereq=i===0?'先确认电脑能执行python --version。不会命令行时，先练进入一个新文件夹、保存.py文件和运行文件；无需真实科研数据。':`准备本项目上一课产物；本课为第${i+1}周。遇到缺失基础，先复做前一课的最小例子，不在真实数据上试错。`;
 l.code=u.code;l.codeRequires=u.requires;
 const sections=[S('01 / 本周任务与工程地图',prereq+'\n当前项目：'+p[0]+'。'+p[1]+'\n项目四周顺序：'+p[2]+'。本周只推进其中第'+(stage+1)+'步，不能把跑通示例误写为整个项目完成。'),S('02 / 原理拆解：先能解释，再能运行',u.teach+'\n纸面练习：画输入→处理→输出三格。在每格写明类型、维度或数据单位；为处理箭头写出一个失败条件。若不能说清楚输入代表谁，先不调模型。'),S('03 / 环境与第一次运行','本课依赖：'+u.requires+'。建议使用独立虚拟环境；Python语言和库接口以资源区官方文档为准。\n在自己的课程目录执行 python -m venv .venv。Windows可使用 .venv\\Scripts\\python；macOS/Linux可使用 .venv/bin/python。用这个解释器执行 -m pip install 加上需要的包名。PyTorch安装按官网选择CPU或设备版本；不需要购买API或GPU。\n将下方示例保存为 coding-'+String(i+1).padStart(2,'0')+'.py，用虚拟环境解释器运行。先保存完整报错，不反复盲改。'),S('04 / 可运行最小示例','这段代码是本课独立教学例，使用明确数据和断言。先预测输出，再运行；不包含真实受试者数据，不会自动上传文件。','code',u.code),S('05 / 逐块读代码与预期输出','按四块阅读：①导入和输入；②核心处理；③断言；④输出。给每个中间变量记录类型/形状；将每个assert翻译成一句中文契约。\n本例预期：'+u.expected+'\n若实际不同，先查是否完整复制、解释器是否正确、包版本是否符合接口。涉及随机或模型拟合的分数允许合理差异，本课只对确定关系和合法范围作断言。'),S('06 / 第一次60分钟：理解与手算','00—10分钟：读任务和准备环境；10—25分钟：画输入输出，给代码分四块；25—40分钟：不运行先预测输出和一道辨析题；40—55分钟：运行并逐项核对；55—60分钟：记下尚不能解释的一行。\n本周辨析题：'+u.question,'exercise'),S('07 / 第二次60分钟：实现与改变一个条件','00—10分钟：回看基线；10—40分钟：完成本周具体扩展；40—50分钟：比较变更前后；50—60分钟：保存最小复现。\n具体扩展：'+u.task+'\n每次只改变一个因素；记录预期、实际、解释。多处同时改变却无法说明差异来自哪里，不算完成对照。','exercise'),S('08 / 第三次60分钟：测试与交付','00—15分钟：设计正常、边界、失败三类案例；15—35分钟：加入断言并故意制造一个失败；35—50分钟：恢复实现并在新目录重跑；50—60分钟：写README和失败记录。\n测试记录格式：案例ID／输入特征／预期行为／实际行为／通过或失败／修改。若异常是预期行为，要明确捕获的异常类型，不能把任何报错都当测试成功。','exercise'),S('09 / 参考解析与常见误解',D.review+'\n'+u.answer+'\n常见误区：只检查脚本退出成功，不检查输出语义；为了让断言通过直接删除断言；看到一次高分就改研究结论；复制示例却没有留下自己的扩展和测试。修正时回到数据契约与评价目标，不凭直觉调到满意。','answer'),S('10 / 交付清单、验收和下一步','本周保留：可运行.py文件、环境版本、输入说明、至少三类测试、一次故意失败及修复记录、150—300字解释。README要给能复制执行的命令、预期输出和已知限制。\n独立复跑：在新目录按说明完成一次；失败时保留错误信息并修订说明。可以先保存草稿，不能用“示例能跑”代替本周扩展完成。\n'+D.fields)
 ];
 D.apply(c,l,sections,180,['能解释本课断言和预期输出','独立运行本课最小示例并完成一次扩展','有正常、边界与失败测试及修复记录']);
 l.tasks=['第一次60分钟：原理、手算、环境、最小示例与输出核对。','第二次60分钟：按本周具体任务完成扩展，保存前后对照。','第三次60分钟：测试、故意失败、修复、README与新目录复跑。'];
 l.refs=[...new Set([...(l.refs||[]),'depth_python',...(i>=4&&i<16?['depth_validation']:[])])];
});
})();