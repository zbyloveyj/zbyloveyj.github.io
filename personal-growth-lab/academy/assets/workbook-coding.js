'use strict';
(()=>{
const c=ACADEMY.courses.find(c=>c.id==='coding'),S=(title,body,kind='lesson',code='')=>({title,body,kind,code});
const units=[
{
trace:'这段程序只完成读取和契约检查，不是质控器。执行顺序：先将多行CSV文字放进变量text；StringIO把字符串包装成可读对象；DictReader把首行当列名；list(reader)真正遍历记录；最后检查行数和第一条编号。读到的丰度仍是字符串，NaN和abc此时不会自动报错。',
lines:'import csv, io：csv负责CSV规则，io提供内存中的文件接口，二者都是标准库。\nreader.fieldnames：读取表头，得到列名列表；or []防止空文件时对None进行集合比较。\nissubset：检查必需列是否都存在，允许额外列；若契约不允许额外列，应比较集合相等。\nrows=list(reader)：迭代器被消费为列表。之后再次list(reader)通常为空，因为读取位置已经到末尾。\nrows[0]["sample_id"]：先取首行字典，再取该列；不要写成rows["sample_id"]，外层是列表不是字典。',
inputs:'逐行观察前四条：0001→字符串“0001”和“1”；0002→“0002”和“0”；0003→“0003”和“2.5”；0004→“0004”和“-1”。负号不会使CSV读取失败，因为读取和业务验证是两层。',
quiz:'题1：为何不把sample_id转换成int？\n题2：把表头abundance改成value，程序应在哪一步失败？\n题3：第一次list(reader)后再转换一次，能否重新得到12行？\n题4：增加一列batch，当前契约允许吗？',
answers:'1. ID是身份标签，不是数量，int("0001")会变成1，可能破坏匹配。2. 必需列子集断言应失败，不能到最后才因找不到键崩溃。3. 不能，需重新建立StringIO和DictReader，或使用已保存的rows。4. 允许，因为检查的是必需列存在，不是表头完全相等。',
solution:String.raw`import csv, io

def read_table(text: str) -> list[dict[str, str]]:
    reader = csv.DictReader(io.StringIO(text))
    required = {"sample_id", "abundance"}
    missing = required - set(reader.fieldnames or [])
    if missing:
        raise ValueError("missing columns: " + ", ".join(sorted(missing)))
    rows = list(reader)
    if not rows:
        raise ValueError("no data rows")
    return rows

rows = read_table("sample_id,abundance,batch\n0001,0,A\n")
assert rows[0]["sample_id"] == "0001"
for bad in ["", "sample_id,abundance\n", "sample_id,value\na,1\n"]:
    try:
        read_table(bad)
    except ValueError:
        pass
    else:
        raise AssertionError("invalid input was accepted")
print("schema cases passed")
`,
extend:'把CSV改为实际文件输入时，先只用自己创建的synthetic.csv。用Path.read_text(encoding="utf-8-sig")读取可兼容常见UTF-8 BOM；缺文件、缺列和无数据行是不同错误，应分别报告。不要添加自动删除非法行的行为。'},
{
trace:'validate接收行字典列表，返回问题列表。它先初始化seen和issues；每行先检查ID，再检查数值；即使发现重复ID，也继续检查abundance。这样同一行的两个错误可以同时被记录。函数不修改rows，所以原始“NaN”会继续保留在输入中。',
lines:'enumerate(rows,start=2)：因为CSV表头视为第1行，第一条数据报告第2行。若输入经过筛行，这个序号不再自动等于原文件行号，需要保留原始行号。\nrow.get("sample_id","").strip()：给缺失键一个默认空字符串并去首尾空格；若真实值可能是None，须先显式处理类型。\nseen.add(sid)：将非空ID写入集合，集合只关心是否出现，不保留重复次数。\nfloat：解析字符串；解析成功后仍需有限性和范围检查。\nexcept (ValueError,TypeError)：只捕获预期输入问题，不用裸except掩盖其他程序错误。',
inputs:'首行a/2：seen由空变为{a}，issues仍空。第二行a/3：发现重复，加入第3行duplicate_id。第三行b/NaN：解析出浮点NaN，但isfinite为False，加入第4行invalid_abundance。最终是两项问题，不是三行全部失败。',
quiz:'题1：将第二行数值改为-3，应产生几项问题？\n题2：为什么if value会把0误判？\n题3：重复ID出现3次，除了首次会报几次？\n题4：为何报告数量不一定等于错误行数量？',
answers:'1. 三项：第二条记录重复ID且负数，第三条非法数值。2. 0在布尔上下文为False，但本契约允许0，应检查值域。3. 后两次分别报错，共两次。4. 一行可能包含多个错误，要另外统计unique line numbers。',
solution:String.raw`import math

def issues_for(rows):
    seen, issues = set(), []
    for line, row in enumerate(rows, 2):
        sid = str(row.get("sample_id") or "").strip()
        if not sid:
            issues.append((line, "missing_id"))
        elif sid in seen:
            issues.append((line, "duplicate_id"))
        if sid:
            seen.add(sid)
        try:
            value = float(row.get("abundance", ""))
            if not math.isfinite(value) or value < 0:
                raise ValueError("out of range")
        except (ValueError, TypeError):
            issues.append((line, "invalid_abundance"))
    return issues

rows = [{"sample_id":"a","abundance":"2"},
        {"sample_id":"a","abundance":"-3"},
        {"sample_id":"b","abundance":"NaN"}]
result = issues_for(rows)
assert len(result) == 3
assert len({line for line, _ in result}) == 2
print(result)
`,
extend:'把tuple问题记录扩成dict，加入column、value、severity。原值可能包含隐私，因此这里只在合成数据演示；真实系统需按权限控制报告内容。随后将error_count和invalid_row_count分别输出，让使用者知道是三项问题出在两行。'},
{
trace:'nonnegative将“可解析、有限、非负”设成三层契约。测试循环逐个输入非法值。try执行检查；出现预期ValueError就继续；没有异常时进入else主动触发断言。这样不会把错误地接受输入当作通过。',
lines:'float("NaN")和float("inf")都可以成功，因此类型转换不足。\nmath.isfinite(number)：排除NaN与正负无穷。\nnumber<0：在有限性之后判断值域；NaN与数比较不会像普通数一样工作。\nelse属于try，不是for，只有try未抛异常才执行。\n断言合法值0和1.5：防止把所有输入都拒绝的“错误实现”也通过非法输入测试。',
inputs:'空串与abc在解析层失败；-1解析成功后在值域层失败；NaN和±inf在有限性层失败；0是有限非负数，必须通过。可以为每类错误设不同消息，但不应依靠任意文本内容来猜异常类型。',
quiz:'题1：把函数改成永远raise ValueError，原测试哪些部分能抓住？\n题2：删除isfinite检查，哪些非法输入可能被接受？\n题3：为什么不把所有异常都except Exception吞掉？',
answers:'1. 负例仍“通过”，但0和1.5的正例会失败，这说明必须包含正反两类。2. NaN和正inf会越过number<0检查；负inf仍小于0。3. 它会把KeyError、拼写和程序逻辑问题也掩盖成预期输入错误。',
solution:String.raw`import math, unittest

def nonnegative(value):
    n = float(value)
    if not math.isfinite(n) or n < 0:
        raise ValueError("expected finite nonnegative number")
    return n

class TestContract(unittest.TestCase):
    def test_valid(self):
        for x, expected in [("0", 0), ("1.5", 1.5), (" 2 ", 2)]:
            with self.subTest(value=x):
                self.assertEqual(nonnegative(x), expected)
    def test_invalid(self):
        for x in ["", "abc", "-1", "NaN", "inf", "-inf"]:
            with self.subTest(value=x):
                with self.assertRaises(ValueError):
                    nonnegative(x)

if __name__ == "__main__":
    unittest.main()
`,
extend:'将测试另存test_qc.py，用python -m unittest -v执行。做一次故意变异：删除有限性检查，确认测试红；恢复后确认绿。保存两次输出，不只保存最终成功截图。'},
{
trace:'本例在临时目录里写一个合成CSV并计算SHA256。TemporaryDirectory退出时清理目录；哈希取决于文件字节，连换行符也参与。report记录环境与输入身份，但不会自动记录代码版本和运行参数，需要扩展。',
lines:'Path / "synthetic.csv"：路径拼接，避免用硬编码Windows或Linux分隔符。\nwrite_bytes：按给定字节写入，不做文本换行转换。\nread_bytes：计算哈希的输入是同一份文件字节，不是屏幕显示的文字。\nhexdigest：把摘要转为十六进制字符串，适于日志。\nstat().st_size：文件字节长度，不是字符数或记录数。',
inputs:'数据有表头加一行。UTF-8中文字符可能占多个字节，因此文件大小与字符数不能混用。输入哈希相同支持字节一致，但不同文件名可以指相同字节，相同文件名也可能已被覆盖。',
quiz:'题1：只把文件名改了，哈希是否改变？\n题2：末尾增加一个换行，哈希是否通常改变？\n题3：哈希一致能否证明流程与科学结论正确？',
answers:'1. 不改变内容哈希。2. 改变字节，哈希通常改变。3. 不能，只确认这一输入的字节身份；还需代码、参数、依赖和解释。',
solution:String.raw`from pathlib import Path
from tempfile import TemporaryDirectory
import hashlib, json, platform

sha = lambda b: hashlib.sha256(b).hexdigest()
with TemporaryDirectory() as d:
    source = Path(d) / "synthetic.csv"
    source.write_bytes(b"sample_id,abundance\na,1\n")
    copied = Path(d) / "renamed.csv"
    copied.write_bytes(source.read_bytes())
    assert sha(source.read_bytes()) == sha(copied.read_bytes())
    assert sha(source.read_bytes()) != sha(source.read_bytes() + b"\n")
    manifest = {"python": platform.python_version(), "input_sha256": sha(source.read_bytes()),
                "command": "python qc.py synthetic.csv", "data_kind": "synthetic"}
    path = Path(d) / "manifest.json"
    path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    assert json.loads(path.read_text()) == manifest
print("manifest round-trip passed")
`,
extend:'README分安装、输入契约、命令、输出解释、错误案例、限制六段。新目录复跑时不靠旧工作区变量；缺任何信息就在README补，不临时用口头说明掩盖。'},
{
trace:'groups包含60个参与者ID，每人重复两次。X有120行，但跨参与者泛化的分割应以60组为单位。GroupShuffleSplit选一部分组后，将这些组对应的全部行划到同一侧。',
lines:'np.repeat(np.arange(60),2)：得到0,0,1,1,…59,59；这不是120个独立人。\ny同样repeat：标签按人定义后复制到两次记录。\nnext(splitter.split(...))：取一个划分；返回的是行索引，不是组ID。\nset(groups[train]) & set(groups[test])：求组集合交集，必须为空。\nset(train).isdisjoint(test)：仅检查行无重叠，必要但不足。',
inputs:'test_size=.2指组比例，此例评价12组、24行，开发48组、96行。若每组记录数不同，20%组不一定对应20%行；报告两者。',
quiz:'题1：行集合无交集却组集合有交集，评价的含义变了什么？\n题2：每人一个未来时间点预测，与跨新参与者预测是否同一划分？\n题3：分组划分是否自动保证两类标签比例完全一样？',
answers:'1. 可能在评价曾见过参与者的新记录，而非全新参与者。2. 不是，未来预测需明确时间与可获得输入；不能默认同一设计。3. 不保证，需检查组层标签与比例，必要时采用匹配任务的分层分组策略。',
solution:String.raw`import numpy as np
from sklearn.model_selection import GroupShuffleSplit

g = np.repeat(np.arange(8), [1,2,3,4,1,2,3,4])
X = np.arange(len(g)).reshape(-1,1)
tr, te = next(GroupShuffleSplit(n_splits=1, test_size=.25, random_state=7).split(X, groups=g))
assert not set(g[tr]) & set(g[te])
assert len(set(g[te])) == 2
print({"test_groups": sorted(map(int, set(g[te]))), "test_rows": len(te), "total_rows": len(g)})
`,
extend:'将train/test索引与原始sample_id同时保存。之后重排数据时，通过ID恢复分割，不直接将旧行号套在新顺序上。增加一个断言验证开发和评价覆盖的ID并集等于入组范围。'},
{
trace:'make_classification生成200人的教学特征和标签。train_test_split保留一部分评价，并通过stratify大致保持类别比例。Dummy估计训练先验；Pipeline在训练集fit缩放器再fit逻辑回归。两者最终在相同te上比较。',
lines:'StandardScaler.fit只计算训练均值与尺度；predict时用已经保存的参数，不重新从测试计算。\nLogisticRegression.predict_proba输出每类概率列，[:,1]取classes_对应的第二列，本例标签为0和1。\np>=.5产生教学阈值标签；不同阈值问题留到模型卡讨论。\nroc_auc_score用连续分数，不要误传已经阈值化的类别。\nmax_iter给优化上限，不保证必定收敛，真实运行还需检查警告。',
inputs:'先验基线若返回常量概率，对排序没有区分力，含两类测试标签时AUC为0.5。逻辑回归可能高或低，分数依赖合成设定。单次高分不构成真实应用效果。',
quiz:'题1：为什么不是先把全X标准化再划分？\n题2：把p变为0/1再算AUC会损失什么？\n题3：所有测试标签同类时AUC能否按通常方式解释？',
answers:'1. 全体拟合参数含评价分布信息。2. 丢掉阈值内排序，变成对粗糙离散分数的评价。3. 缺少正负成对比较，需处理指标不适用而非填一个漂亮数值。',
solution:String.raw`import numpy as np
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression

Xtr = np.array([[0.,0.],[1.,0.],[2.,1.],[3.,1.]])
ytr = np.array([0,0,1,1])
Xte = np.array([[100.,2.],[101.,3.]])
p = make_pipeline(StandardScaler(), LogisticRegression())
p.fit(Xtr, ytr)
scaler = p.named_steps['standardscaler']
assert np.allclose(scaler.mean_, Xtr.mean(axis=0))
before = scaler.mean_.copy()
p.predict_proba(Xte)
assert np.array_equal(scaler.mean_, before)
print({"training_mean": before.tolist(), "unchanged_after_predict": True})
`,
extend:'输出数据卡：样本生成方式、类别比例、分割ID、学习步骤位置、主要指标和固定阈值。多模型比较前先冻结选择规则，别用最终测试分数挑一串参数。'},
{
trace:'rng.permutation只改变训练标签与输入之间的对应关系，测试标签不变。重复三次用于展示波动，而不是正式P值检验。此合成数据中，随机标签偶尔仍可能产生较高AUC，不能据一个值给程序或作者下结论。',
lines:'rng=np.random.default_rng(19)：固定伪随机过程以便复跑；固定种子不是消除不确定性。\n每轮建立新Pipeline：避免复用已拟合对象混淆实验状态。\nfit(X[tr],rng.permutation(y[tr]))：只打乱训练部分，保持训练类别数量。\nscores.append：保留所有轮次，不挑最符合期待的一次。\nformal_p_value=None：明确这段程序没有执行有效的正式显著性推断。',
inputs:'标签打乱与特征消融不同：前者破坏目标对应关系，后者保留目标但减少一类输入。两者都需在一致评价设计下解释。若出现组或时间依赖，任意打乱行标签未必对应合格零假设。',
quiz:'题1：为何不能不断改种子直到所有分数接近0.5？\n题2：三次置换能否证明模型没有泄漏？\n题3：正式置换检验通常需要怎样处理被置换后的学习流程？',
answers:'1. 这是选择性展示对照。2. 不能，只观察这几个案例，仍需审核流程。3. 根据目标零假设重做相应完整学习/选择，并使用适当交换单位；仅把固定模型预测重排通常回答另一问题。',
solution:String.raw`import numpy as np

y = np.array([0,0,0,1,1,1])
rng = np.random.default_rng(9)
shuffled = [rng.permutation(y) for _ in range(5)]
for z in shuffled:
    assert sorted(z.tolist()) == sorted(y.tolist())
# Illustrative null-statistic ranking only, not a model evaluation.
null = np.array([.45,.52,.57,.48,.60])
observed = .59
p_rank = (1 + np.count_nonzero(null >= observed)) / (1 + len(null))
assert np.isclose(p_rank, 2/6)
print({"illustrative_rank_p": float(p_rank), "validity_requires_correct_null": True})
`,
extend:'这里的秩公式只有零统计量来自有效置换设计时才能用于相应检验。扩展作业先写交换单位和重拟合步骤，不直接将教学null数组作为研究P值。'},
{
trace:'四个对象标签是0,0,1,1；概率是0.1,0.6,0.7,0.8。阈值0.5得到0,1,1,1。混淆矩阵行是真实类别、列是预测类别；因此TN=1、FP=1、FN=0、TP=2。',
lines:'labels=[0,1]固定矩阵顺序，避免缺类场景改变形状。\np>=.5与p>.5在恰等于阈值时不同，需要约定。\nbrier_score_loss是四个预测概率与0/1标签平方差的均值。\nabs(score-.125)<1e-12容许浮点误差，不直接要求所有计算位级相等。\nAUC需要连续概率，本例confusion_matrix需要类别，两类输入不要混用。',
inputs:'Brier手算：(0.1²+0.6²+(0.7-1)²+(0.8-1)²)/4=(0.01+0.36+0.09+0.04)/4=0.125。若阈值改0.7，预测0,0,1,1，在这四人上错误变少，但不能据最终评价反选阈值。',
quiz:'题1：0.5阈值的准确率、灵敏度、特异度是多少？\n题2：改变阈值会改变同一组概率的Brier吗？\n题3：在四人中0.7更好，可以直接写为最佳临床阈值吗？',
answers:'1. 准确率3/4、灵敏度2/2、特异度1/2。2. 不会，只要Brier仍输入原概率而非阈值标签。3. 不能，样本是教学数据且阈值选择与最终评价应分开，不涉及临床用途。',
solution:String.raw`import numpy as np
from sklearn.metrics import confusion_matrix, brier_score_loss

y=np.array([0,0,1,1]); p=np.array([.1,.6,.7,.8])
for threshold in [.5,.7]:
    tn,fp,fn,tp=confusion_matrix(y,p>=threshold,labels=[0,1]).ravel()
    print({"threshold":threshold,"accuracy":float((tn+tp)/4),
           "sensitivity":float(tp/(tp+fn)),"specificity":float(tn/(tn+fp))})
assert np.isclose(np.mean((p-y)**2), brier_score_loss(y,p))
`,
extend:'给模型卡加入阈值来源和适用范围。校准练习要看概率与发生频率的关系，不能把高AUC写成概率准确保证。小样本例子只用于理解公式，不做临床决策。'},
{
trace:'x形状8×3；Linear(3,4)把每行3特征映射到4隐藏单元；ReLU保持形状；Linear(4,1)每人输出1个logit。y是8×1浮点标签，与输出严格对应。loss.backward将梯度写入参数的grad。',
lines:'nn.Linear(3,4)包含4×3权重和4偏置，共16个参数。\nnn.Linear(4,1)包含1×4权重和1偏置，共5个参数。\n总参数量21，不是3×4×1。\nReLU没有可训练参数，但对反向传播改变梯度路径。\nBCEWithLogitsLoss内部以数值稳定方式处理logit，不需要先sigmoid。\n输入x未设requires_grad仍能训练参数；需要的是参数具有梯度。',
inputs:'logit=0对应sigmoid=0.5；正logit对应概率大于0.5，负值小于0.5。概率与类别又是两层，阈值0.5只是教学约定。batch维度变化不应改变每人一输出的语义。',
quiz:'题1：输入换为5×3，输出应是多少？\n题2：label为shape[8]时能否只靠广播猜语义？\n题3：为何这里不在模型末尾再加Sigmoid？',
answers:'1. 5×1。2. 不应，显式对齐样本与输出维度；用unsqueeze只在确认含义后操作。3. 损失接收logit，先sigmoid会使输入语义错误。',
solution:String.raw`import torch
from torch import nn

m=nn.Sequential(nn.Linear(3,4),nn.ReLU(),nn.Linear(4,1))
assert sum(p.numel() for p in m.parameters()) == 21
for batch in [1,5,8]:
    x=torch.randn(batch,3); y=torch.zeros(batch,1)
    logits=m(x)
    assert logits.shape == y.shape == (batch,1)
    loss=nn.BCEWithLogitsLoss()(logits,y)
    assert torch.isfinite(loss)
print("shape and parameter tests passed")
`,
extend:'把每层输入输出写进shape_log，不要为了让代码运行而任意reshape。加入batch=1测试，可发现无参数squeeze意外删除批量轴的问题。'},
{
trace:'单个logit z=0、y=1时，sigmoid(z)=0.5；二元交叉熵为-ln(0.5)=ln2≈0.693147；对z的导数为sigmoid(z)-y=-0.5。梯度下降用z减去学习率乘梯度，因此z上升，目标类概率提高。',
lines:'requires_grad=True要求追踪这个叶节点。\nbinary_cross_entropy_with_logits接收未激活的z。\nloss.backward()计算梯度，第一次z.grad为-0.5。\n再次backward会在已有grad上累加，训练循环通常先zero_grad。\nloss.item()取Python数用于日志，此数不能再用于保持原计算图的反传。',
inputs:'学习率0.1时，z_new=0-0.1×(-0.5)=0.05；sigmoid约0.5125；对y=1的loss会略降。若y改0，初始梯度+0.5，更新会使z变负。',
quiz:'题1：为何梯度负会使参数增加？\n题2：两次反传前不清零会得到什么？\n题3：一次loss下降可否说明泛化改善？',
answers:'1. 更新是减去梯度。2. 梯度会累加，本例相同计算两次可得到-1；这有时用于有意的梯度累积，但不能无意使用。3. 只能说明当前优化目标在该输入上的变化，需要独立评价。',
solution:String.raw`import torch
import torch.nn.functional as F

z=torch.tensor([0.],requires_grad=True); y=torch.tensor([1.])
loss=F.binary_cross_entropy_with_logits(z,y); loss.backward()
assert torch.allclose(z.grad,torch.tensor([-.5]))
with torch.no_grad():
    z -= .1*z.grad
z.grad.zero_()
new=F.binary_cross_entropy_with_logits(z,y)
assert new < loss
new.backward()
print({"z":z.item(),"new_loss":new.item(),"new_gradient":z.grad.item()})
`,
extend:'在小网络中只改变学习率并保存训练/验证两条曲线。保持同一划分与种子，不把学习率实验与数据更换混在一起。'},
{
trace:'60行中前40行训练，40—49验证，50—59最终评价。本例为说明控制流程，固定顺序划分合成独立行，不代表真实数据都能这样切。每轮在训练模式更新参数，再在eval+no_grad下计算验证loss；最小时保存深拷贝。',
lines:'model.train与model.eval控制Dropout/BatchNorm等模块行为；并不等同于启用/停用自动求导。\nwith torch.no_grad关闭当前块的梯度记录。\nopt.zero_grad在反传前清理旧梯度。\ncopy.deepcopy(state_dict())保存独立参数副本，后续优化不应改掉已选模型。\nload_state_dict(saved)恢复最佳验证轮；最终测试在选择结束后出现。',
inputs:'设验证loss先0.8、再0.6、再0.7，选择第二轮而不是最后一轮。若只写saved=model.state_dict()，张量引用可能继续随训练改变，saved看似指第二轮却已不是当时数值。',
quiz:'题1：为什么eval不能替代no_grad？\n题2：最佳验证轮是否必然拥有最佳测试表现？\n题3：三种宽度、三种学习率都在同一测试集挑选，测试还有什么角色？',
answers:'1. eval改变特定模块行为，梯度是否记录由自动求导控制。2. 不必然，验证选择有噪声，不能再按测试挑轮次。3. 测试已被用于开发决策，需如实重定义角色并保留新的合适评价。',
solution:String.raw`import copy, torch
from torch import nn

m=nn.Linear(1,1)
with torch.no_grad(): m.weight.fill_(1.)
reference=m.state_dict()
snapshot=copy.deepcopy(m.state_dict())
with torch.no_grad(): m.weight.add_(2.)
assert reference['weight'].item()==3.
assert snapshot['weight'].item()==1.
m.load_state_dict(snapshot)
assert m.weight.item()==1.
print("snapshot restoration passed")
`,
extend:'把每轮配置、训练loss、验证loss与是否保存状态写日志。多种子实验报告所有预定种子，不挑表现最好的一次作代表。'},
{
trace:'参数文件只有张量，不自动保存你怎样生成特征、特征顺序或网络结构。重载时重新创建Linear(3,1)，载入权重，再用相同x验证输出一致。临时目录保证教学例不在用户工作区留下文件。',
lines:'state_dict包含参数和缓冲状态；模型类定义需另可获得。\nmap_location="cpu"将张量映射到CPU，避免依赖保存时设备。\nweights_only=True缩小反序列化范围，但不应把陌生文件当安全输入。\nrestored.eval()避免训练行为影响预测。\nallclose比较数值容差，适用于此处输出核对；不是模型质量指标。',
inputs:'原特征是[age,score,batch_code]，重载后换成[score,age,batch_code]，形状仍3列，程序可能正常运行但结果语义错误。必须把特征顺序作为模型输入契约。',
quiz:'题1：结构相同、参数相同，却改变列顺序，会被shape断言抓到吗？\n题2：保存模型前需另存哪三种信息？\n题3：能重新输出同样概率，是否已经经过外部验证？',
answers:'1. 不一定，需检查feature_names。2. 输入/预处理契约、配置与版本、评价及适用范围说明。3. 没有，这是计算复现检查。',
solution:String.raw`import torch
from torch import nn

m=nn.Linear(2,1,bias=False)
with torch.no_grad(): m.weight.copy_(torch.tensor([[1.,10.]]))
x=torch.tensor([[2.,3.]])
with torch.no_grad():
    original=m(x); permuted=m(x[:,[1,0]])
assert original.item()==32 and permuted.item()==23
schema=["feature_A","feature_B"]
incoming=["feature_B","feature_A"]
assert incoming != schema
print({"same_shape":True,"different_semantics":True})
`,
extend:'写predict入口时要求列名按契约对齐，再做数值转换。不要在预测端偷偷重新fit标准化器；保存和恢复整条预处理流程。'},
{
trace:'字典A、B的交集为p1、p3。sorted明确共同ID顺序；joined逐个共同ID取A与B特征后拼接。字典本身已假设ID唯一；如果原表有重复，构造字典前必须检测，否则后值覆盖前值。',
lines:'set(A)取字典键，不是特征值。\nA-only=set(A)-set(B)，B-only反向。\nA[sid]+B[sid]在这里是列表拼接，不是数值向量相加。\n元组(sid,features)保留身份，避免只留合并矩阵失去追踪。\n同ID不同访视也可能不配对，必要时用(ID,visit)复合键。',
inputs:'A按p1,p2,p3顺序，B按p3,p1,p4顺序。按行拼接会把p1与p3误配、p2与p1误配、p3与p4误配；行数都是3也不能保证身份一致。',
quiz:'题1：为什么inner join可能改变研究人群？\n题2：一人两次访视，用ID作唯一键会发生什么？\n题3：交集排序是不是数据清洗的一种科学决定？',
answers:'1. 只保留共同对象，缺失模态者被排除，需报告范围。2. 可能覆盖或产生一对多连接，应定义复合键。3. 排序本身只是明确输出顺序，选择交集才改变纳入范围，应有说明。',
solution:String.raw`def unique_map(rows):
    result={}
    for r in rows:
        key=(r['id'],r['visit'])
        if key in result:
            raise ValueError("duplicate key: "+repr(key))
        result[key]=r['value']
    return result

rows=[{'id':'p1','visit':0,'value':1},{'id':'p1','visit':1,'value':2}]
assert len(unique_map(rows))==2
try: unique_map(rows+[rows[0]])
except ValueError: pass
else: raise AssertionError("duplicate not rejected")
print("composite-key checks passed")
`,
extend:'输出alignment_report，包含双方总数、交集数、独有ID数、重复键和时间配对规则。若要删去未配对者，将排除清单单独保存。'},
{
trace:'A、B各160×2，标签由A第一列、B第一列和噪声共同生成，故两种模态在这个教学设定中包含互补信息。模型仍可能因样本与噪声表现不同，不能把预设生成机制当真实发现。',
lines:'np.column_stack([A,B])沿特征轴拼成160×4。\n相同tr/te用于A、B和A+B，评价人群可比。\n每个模型使用自己的训练缩放器，因为输入维度不同。\n标签生成已明确用了两模态；这不是在未知真实系统里证实互补。\nAUC返回排序性能，不能直接读为机制强弱。',
inputs:'若A-only用全部A对象、融合只用完整病例，两者分数差同时混入人群选择。公平模型比较先固定共同评价对象，再另报告覆盖率；两个问题可以都分析但不能混成一个比较。',
quiz:'题1：A+B提高性能时还可能有哪些解释？\n题2：为什么至少需要简单单模态基线？\n题3：把B整表重排后再拼接，会验证真实配对吗？',
answers:'1. 更多预测信息、维度与容量、噪声结构或混杂；需进一步对照。2. 才知道额外模态是否在同一任务上带来增益。3. 那是错配对照，不是恢复正确配对，原映射必须保留。',
solution:String.raw`import numpy as np

A=np.array([[1,2],[3,4],[5,6]])
B=np.array([[10],[20],[30]])
F=np.column_stack([A,B])
assert F.shape==(3,3)
assert F[1].tolist()==[3,4,20]
idx=np.array([2,0])
assert np.array_equal(F[idx],np.column_stack([A[idx],B[idx]]))
print("shared-row comparison invariant passed")
`,
extend:'在报告中分开“共同完整对象上的比较”和“全部目标对象的可用比例”。每种缺失策略要说明开发阶段和部署阶段如何一致执行。'},
{
trace:'observed五位布尔掩码中三位True，覆盖率3/5=0.6。perm指定另一顺序，B[perm]改变了身份对应而不改变B值集合。原例只显示数据变换，没有真正评价缺失模型；扩展时需另定义预测策略。',
lines:'observed.mean把True计1、False计0，是比例计算。\nids[observed]返回实际可评价对象。\nB[perm]是按索引重排，不是改变单个值。\nnp.array_equal检查数组是否完全相同，并不检查科学配对含义。\n缺失用NaN和0不同；0可能是合法测量。',
inputs:'五人中只对p1、p3、p4能融合，即使三人预测全对，不能写成五人准确率100%。可报告完整对象表现并同时说明覆盖60%，其余对象未评价或使用另一预定路径。',
quiz:'题1：预测成功率与覆盖率能否共用同一分母？\n题2：把缺失B填0需什么说明？\n题3：为何打乱配对时要保留固定评价标签？',
answers:'1. 不能混用，应明说分母是被评价对象还是全部目标对象。2. 说明0语义、插补规则、拟合位置与缺失指示；不能默认0=不存在。3. 需要知道破坏的是哪一种关系，随意同时乱标签可能无法解释对照。',
solution:String.raw`import numpy as np
from sklearn.impute import SimpleImputer

train=np.array([[1.],[3.],[np.nan]])
test=np.array([[100.],[np.nan]])
imputer=SimpleImputer(strategy='mean',add_indicator=True)
imputer.fit(train)
filled=imputer.transform(test)
assert imputer.statistics_[0]==2.
assert filled[1,0]==2. and filled[1,1]==1.
print(filled.tolist())
`,
extend:'这是教学均值插补，并非推荐所有真实数据如此处理。对缺失与结局可能相关的情景，需检查完整病例选择与适用范围，不能只做数值填补。'},
{
trace:'分析卡是可检查的结构化元数据，不是由软件自动证明可靠性的证书。required.issubset确认关键字段存在；causal_claim和clinical_use为False，只是诚实说明此项目未执行这些验证。',
lines:'limitations应是具体限制数组，不只“需要更多研究”。\ncomparisons说明实际要运行的对照；未运行的应有状态。\nassert检查键存在不能检查文字真假。\njson.dumps(indent=2)提供可读输出，不改变证据。\n卡中data_kind必须与实际示例一致，不能把synthetic改real就当真实模型。',
inputs:'良好卡片将“设计过、运行过、验证过”分开。一个比较列在方案中不等于完成；结果字段空缺应保留not_run，不能自动填零，因为零也是数值结论。',
quiz:'题1：schema完整是否等于内容真实？\n题2：哪些项目可以由自动测试检查？\n题3：哪类判断仍需人工研究审阅？',
answers:'1. 不等于。2. 必需字段、类型、路径存在、执行命令是否成功、结果维度等。3. 目标量、测量适用性、混杂与机制解释，不能由字段齐全推断。',
solution:String.raw`import json

card={'data_kind':'synthetic','comparisons':{
    'A':{'status':'not_run','auc':None},
    'B':{'status':'not_run','auc':None},
    'A+B':{'status':'not_run','auc':None}},
    'causal_claim':False,'clinical_use':False}
for v in card['comparisons'].values():
    assert v['status']=='not_run' and v['auc'] is None
print(json.dumps(card,indent=2))
`,
extend:'制作演示时先讲输入与目标，再展示真正执行过的结果，最后列限制。不要用全绿schema检查截图替代研究评价。'},
{
trace:'100Hz采样的一秒数据有100个点，索引0到99，时刻0到0.99。窗长N/fs为1秒；最后采样点(N-1)/fs为0.99，两者都正确但含义不同。正弦频率10Hz，每周期10点。',
lines:'n=int(fs*seconds)：此例恰为整数；任意时长需明确舍入规则。\nt=np.arange(n)/fs生成均匀时间格点。\n2*np.pi*frequency*t是相位，单位相容后为无量纲弧度。\nx以任意幅度单位生成，不能标真实微伏。\nfrequency<fs/2为本例理想单频信号的基本约束，不是完整采集保证。',
inputs:'fs=12、f=8时，样本可与-4Hz的正弦序列一致。事后把时间点插密只绘制更密曲线，没有恢复原来未能辨认的连续频率。',
quiz:'题1：一秒窗与最后时刻为何不同？\n题2：linspace含端点会改变什么？\n题3：fs加倍、时长不变，N怎样变化？',
answers:'1. 窗长计N个采样间隔的覆盖约定，最后点距第一个点只有N-1个间隔。2. 默认100点含0与1会形成99个间隔，不是100Hz。3. N加倍。',
solution:String.raw`import numpy as np

fs=12.; t=np.arange(24)/fs
x8=np.sin(2*np.pi*8*t)
x4=np.sin(2*np.pi*4*t)
assert np.allclose(x8,-x4,atol=1e-12)
print({"observed_samples_indistinguishable_up_to_sign":True,
       "window_seconds":len(t)/fs,"last_sample":float(t[-1])})
`,
extend:'给每个信号数组配fs、单位、通道含义和生成公式。没有这些信息的数组先不作频段或心理解释。'},
{
trace:'对200点、100Hz信号，rfftfreq返回0至50Hz，网格0.5Hz；rfft只保留实信号的非负频率部分。2×绝对值/N是本例非直流、非Nyquist、整数周期正弦的单边幅度缩放，不能直接套所有谱点。',
lines:'np.fft.rfft输出复数，绝对值是复幅度大小。\nargmax选最大位置，不排除直流时可能选中0Hz。\nfrequency_grid=fs/N，不要误写N/fs。\n幅度谱与功率谱不一样，功率还涉及平方和归一化定义。\n窗函数改变谱泄漏和幅度解释，需要报告窗与校正。',
inputs:'两秒观测10Hz正好20周期，谱峰落在格点；若改10.3Hz，能量会分散到多个频格。峰不落整数不意味着程序错；它反映有限窗和非整数周期。',
quiz:'题1：加一个常数偏置会影响哪一项？\n题2：将N从200变400且fs不变，频率格间隔是多少？\n题3：补零到400能替代额外测两秒吗？',
answers:'1. 增加直流分量。2. 0.25Hz。3. 不能，补零只让计算格更密，实际观测时长仍2秒。',
solution:String.raw`import numpy as np

fs=100.; n=200; t=np.arange(n)/fs
x=3+np.sin(2*np.pi*10*t)
f=np.fft.rfftfreq(n,1/fs)
raw=np.abs(np.fft.rfft(x))
centered=np.abs(np.fft.rfft(x-x.mean()))
assert f[raw.argmax()]==0.
assert f[centered.argmax()]==10.
print({"raw_peak":float(f[raw.argmax()]),"centered_peak":float(f[centered.argmax()])})
`,
extend:'去均值是一个分析动作，应在报告中说明。不要为了让谱峰符合期待而连续尝试多种滤波又只保留有利版本。'},
{
trace:'10名参与者各10窗得到100行。随机按行划分很可能两侧都含同一个人，而按GroupShuffleSplit划分可以把一人的所有窗留同侧。此例只比较集合，不训练真实解码器。',
lines:'np.repeat(np.arange(10),10)定义层级。\ntrain_test_split返回不重叠行，无法自动理解参与者身份。\nnaive_overlap显示共同参与者ID，属于目标检查。\nGroupShuffleSplit中groups必须与X每行严格对齐。\nassert overlap失败意味着检查发现风险，不是程序必须把交集藏掉。',
inputs:'若参与者1的窗口0—7在训练、8—9在测试，模型可能利用该人的稳定特征。评价新窗口与评价新参与者是不同任务，不能只用“不重复数据”概括。',
quiz:'题1：把窗口再细分十倍是否让独立参与者也增加十倍？\n题2：跨会话但同人评价应怎样命名？\n题3：数据增强应发生在划分前还是后？',
answers:'1. 没有。2. 描述为所定义的跨会话/同人场景，不冒充跨新参与者。3. 先按独立来源划分，训练增强留训练侧，避免原数据与其变体跨边界。',
solution:String.raw`import numpy as np

subject=np.repeat([1,2,3],4)
parent_window=np.arange(12)
# Two augmented views per original row, with inherited source identity.
aug_subject=np.repeat(subject,2)
aug_parent=np.repeat(parent_window,2)
train=np.flatnonzero(aug_subject!=3); test=np.flatnonzero(aug_subject==3)
assert not set(aug_subject[train]) & set(aug_subject[test])
assert not set(aug_parent[train]) & set(aug_parent[test])
print({"source_participants":3,"augmented_rows":len(aug_subject)})
`,
extend:'数据字典同时保留subject、session、trial、window、parent_sample等身份。验证划分时检查目标层及增强来源，不只检查矩阵行号。'},
{
trace:'报告明确合成正弦、任意单位、200样本、100Hz、未滤波；由此计算窗长2秒、最后采样点1.99秒。未执行滤波写not applied，防止读者把空白当默认已经处理。',
lines:'报告字段不是附属装饰，决定别人能否重建信号。\nwindow_seconds与last_sample_seconds同时出现可防常见时间误解。\nfrequency_hz是本合成生成器已知参数，不是从真实人脑估计到的节律。\nclinical_interpretation=False描述未检验范围。\njson会保存数值，但数组等对象需适当序列化。',
inputs:'使用同一生成公式和参数可重新得到无噪声信号；有噪声还需要分布、幅度和种子。若读者只知道峰值10Hz，无法知道采样、时间窗和去趋势，因此不能复建完整过程。',
quiz:'题1：仅保存频谱图为何不能完全复现？\n题2：保存随机种子但不保存噪声分布够吗？\n题3：图注中单位该写什么？',
answers:'1. 缺原始生成/采集信息与处理参数。2. 不够，生成器和分布也影响输入。3. 按实际测量或教学设定，本例是任意单位，不能伪装微伏。',
solution:String.raw`import numpy as np

config={'fs':100.,'n':200,'frequency':10.,'noise_sd':.2,'seed':5}
def generate(cfg):
    rng=np.random.default_rng(cfg['seed'])
    t=np.arange(cfg['n'])/cfg['fs']
    return t,np.sin(2*np.pi*cfg['frequency']*t)+rng.normal(0,cfg['noise_sd'],cfg['n'])
t,a=generate(config); _,b=generate(config)
assert np.array_equal(a,b)
assert np.allclose(np.diff(t),1/config['fs'])
print({"deterministic_given_configuration":True})
`,
extend:'交付包括配置JSON、代码、时序与频谱图、预处理日志和限制。重新运行后对照数值与轴单位，不能只看图像形状相似。'},
{
trace:'每条自写笔记有稳定source_id、type与text。ID按编号生成用于这个固定教学语料；长期维护时应保证新增和重排不会改变旧ID对应内容。文本检索的来源标识不能随排序而漂移。',
lines:'enumerate(notes)得到位置与文本；f字符串生成带前导零的ID。\nall(text.strip())检查非空内容，但不能确认是否有版权许可。\nset(ids)去重后数量比较检查ID冲突。\n“original teaching note”是来源类型，不是外部论文引文。\n语料版本变化要记录，不静默让旧引用指到新段落。',
inputs:'十段笔记不等于十篇论文。同一论文可以有多段，但应继承文献ID并区分段ID与位置；不要将自己的概括标成作者原文。',
quiz:'题1：按列表顺序重新编号会破坏什么？\n题2：原句、概括和问题能用同一个type吗？\n题3：只存URL足够定位证据吗？',
answers:'1. 旧查询与引用对应关系。2. 应分开，避免把推测当原文。3. 不够，需标题、版本和可用位置等；动态网页尤其应记录核验范围。',
solution:String.raw`def validate_corpus(rows):
    ids=set()
    allowed={'original_note','quotation','summary','question'}
    for r in rows:
        if not r['source_id'] or r['source_id'] in ids:
            raise ValueError('missing or duplicate source_id')
        if r['type'] not in allowed or not r['text'].strip():
            raise ValueError('invalid type or empty text')
        ids.add(r['source_id'])
    return True

rows=[{'source_id':'n1','type':'original_note','text':'Check the evaluation unit.'}]
assert validate_corpus(rows)
try: validate_corpus(rows+rows)
except ValueError: pass
else: raise AssertionError('duplicate allowed')
print('corpus checks passed')
`,
extend:'加入license/status/location字段，但未知项保留unknown。处理外部文章时先核访问与使用范围，不直接把版权全文打包发布。'},
{
trace:'TfidfVectorizer先在语料fit，建立词表和IDF，再transform查询。cosine_similarity返回查询与各段的分数。代码按降序取前三，再筛阈值，完全无关且无词项重合的查询得到空列表。',
lines:'fit_transform只在语料阶段执行；不要对每个查询重新fit，否则向量空间不一致。\nquery向量维度与语料词表相同，未知词不会自动变成理解。\nargsort(-scores)以负数实现降序。\n阈值.05是教学设定，不代表真实系统通用拒答阈值。\n返回source_id、text、score，保留证据而不伪造摘要。',
inputs:'query=training preprocessing与第一段有词汇重合；volcanic pineapple无重合，向量可为全0，余弦相似度输出零。词汇方法可能找不到没有共同词的同义问法，需另设评价。',
quiz:'题1：为什么不能把最高分直接称为正确答案？\n题2：未知查询也强行top1会有什么后果？\n题3：如何检验同义词检索失败而非凭印象？',
answers:'1. 相似不等于支持主张。2. 系统会把不相关段落展示为似乎有依据的回答。3. 预先建立同义改写查询及人工相关段，报告相应Recall和错误类型。',
solution:String.raw`import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

texts=['split participants before fitting preprocessing','record sampling frequency in hertz']
v=TfidfVectorizer(); mat=v.fit_transform(texts)
queries=['participants preprocessing','unrelated pineapple','sampling frequency']
scores=cosine_similarity(v.transform(queries),mat)
assert scores.shape==(3,2)
assert scores[0].argmax()==0 and scores[2].argmax()==1
assert np.allclose(scores[1],0)
print(scores.tolist())
`,
extend:'检索器先处理相关证据返回和无答案行为，再考虑生成式层。任何生成回答都需指回原文，不把TF-IDF分数转换为真实性概率。'},
{
trace:'gold第一问有a,b两段相关，返回只命中a，所以Recall=1/2；第二问只有c且找回，所以Recall=1；第三问没有答案，单独算拒答。宏平均Recall为(0.5+1)/2=0.75。',
lines:'set(found[:3])防止重复返回同一ID虚增命中。\nrelevant & found求交集，分母len(relevant)是全部相关项。\n宏平均每个问题权重相同；微平均按总体相关项数量汇总。\n无答案查询不参与Recall分母，在rejected独立评估。\nPrecision@k要约定不足k时分母如何定义，写清评估协议。',
inputs:'本例总命中2、总相关3，微平均Recall=2/3，与宏平均0.75不同。两者都可用，但不应只挑更高的一个报告。拒答率1来自只有一条无答案题，不能称可靠拒答已验证。',
quiz:'题1：同一相关ID返回三次，命中数是多少？\n题2：相关证据很多的问题对微平均影响更大吗？\n题3：20个问题都用于调阈值，再在同一20题报告最终表现，有何限制？',
answers:'1. 应按集合计1。2. 是，微平均按项汇总。3. 这些题已参与开发，评价不再是独立最终检验；需留适当测试查询。',
solution:String.raw`gold=[{'a','b'},{'c'}]
found=[['a','a','x'],['c','z']]
hits=[len(g & set(f[:3])) for g,f in zip(gold,found)]
macro=sum(h/len(g) for h,g in zip(hits,gold))/len(gold)
micro=sum(hits)/sum(map(len,gold))
assert macro==.75 and abs(micro-2/3)<1e-12
print({'macro_recall':macro,'micro_recall':micro})
`,
extend:'将错误分为没有召回、证据不支持问题、证据只有一部分、无答案却强行返回。人工标注规则和评价题也要版本化，不能只保存一个总分。'},
{
trace:'最终清单为六项目各建一个not-reviewed状态，明确尚未由检查证明完成。required列举交付要求，程序只生成检查表，不扫描仓库，更不会自动确认隐私审查或临床有效性。',
lines:'required.copy使各项目得到独立列表，避免修改一个项目影响全部。\nstatus与result分开：没有运行用None/not_run，不能拿0作默认成绩。\nlen(portfolio)==6只确认列表数量，不确认六个项目实现。\nall(status==...)防止清单预填虚假完成。\nJSON输出方便检查和版本记录，但只是管理文件。',
inputs:'每个项目至少演示一个正常输入和一个失败输入。失败输入不是为了显得严谨，而是验证错误行为是否明确且不破坏数据。README命令需能从新目录执行，作品页面应写成熟度。',
quiz:'题1：为什么检查表不直接默认passed？\n题2：六个脚本能运行是否等于六个成品？\n题3：自动测试不能替代哪些人工判断？',
answers:'1. 状态应来自实际检查。2. 不等于，还需接口、测试、说明与独立复跑。3. 科学适用性、权限与隐私、结论证据和真实贡献。',
solution:String.raw`def apply_review(record, evidence):
    required={'run_log','tests','readme','limitations'}
    missing=required-set(evidence)
    if missing:
        return {**record,'status':'needs_review','missing':sorted(missing)}
    return {**record,'status':'documented','evidence':dict(evidence)}

record={'name':'qc','status':'not-reviewed'}
assert apply_review(record,{'readme':'README.md'})['status']=='needs_review'
full={k:k+'.txt' for k in ['run_log','tests','readme','limitations']}
assert apply_review(record,full)['status']=='documented'
assert record['status']=='not-reviewed'
print('review transition checks passed; evidence truth still requires inspection')
`,
extend:'最终作品页分“解决什么小问题”“如何运行”“哪些检查已执行”“哪些没验证”。上传前人工检查实际文件，不把脚本返回documented当成证据真实性证明。'}
];
c.lessons.forEach((l,i)=>{
 const u=units[i];
 const walkthrough=`运行前先回答：输入在哪一行建立，主要变量是什么类型，输出由哪一步产生？\n\n执行流程：${u.trace}\n\n关键代码逐项解释：\n${u.lines}\n\n把程序暂停在中间读值：${u.inputs}\n\n跟练方法：先手写中间变量的形状、类型或内容，再运行核对；不一致时检查最近一个发生改变的步骤。不要一开始就到最后看是否打印“passed”。`;
 const exercise=`本课专属题：\n${u.quiz}\n\n手算与调试要求：先写自己的答案，再运行下方参考实现。遇到异常保留完整报错，并将它归为输入、依赖、形状、类型或逻辑问题；不要只删除报错行。\n\n从示例到项目的具体扩展：${u.extend}`;
 const answers=`参考答案：\n${u.answers}\n\n参考实现的角色：下方程序是本课扩展题的一种可执行解答，不是把基线原样再跑一次。先根据题意预测断言，再逐行检查实际输入。断言通过仅确认给定案例，其他边界仍需自己补充。`;
 l.detail=l.detail.filter(s=>!s.title.startsWith('05 /')&&!s.title.startsWith('06 /')&&!s.title.startsWith('07 /')&&!s.title.startsWith('08 /'));
 l.detail.splice(4,0,S('代码带读｜从输入到每一步中间结果',walkthrough),S('专属练习｜手算、找错、扩展',exercise,'exercise'),S('解题说明｜逐问核对',answers,'answer'),S('扩展参考程序｜可另存后执行','保存为coding-'+String(i+1).padStart(2,'0')+'-solution.py。使用与本课基线相同的环境；只使用教学/合成输入。','code',u.solution));
 l.solutionCode=u.solution;
 l.workbook=true;
});
})();