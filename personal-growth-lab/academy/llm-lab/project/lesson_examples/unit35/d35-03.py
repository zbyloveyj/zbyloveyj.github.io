# 把检索向量训练出来：双塔、负例与索引验收 / 实际训练一个微型双塔，再主动限制结论
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

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

