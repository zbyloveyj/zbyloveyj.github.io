# 持续学习与知识蒸馏：学新任务时怎样保留旧能力 / 07｜实际训练一个学生，并审计教师是否冻结
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import copy
import torch
from torch import nn
from torch.nn import functional as F

torch.manual_seed(33)
torch.set_num_threads(1)
x = torch.randn(192, 4)
x_train, x_holdout = x[:128], x[128:]
# Fixed synthetic teacher function: random initialization, not a trained biological model.
teacher = nn.Sequential(nn.Linear(4, 24), nn.Tanh(), nn.Linear(24, 3)).eval()
teacher.requires_grad_(False)
student = nn.Linear(4, 3)
teacher_before = copy.deepcopy(teacher.state_dict())
temperature = 2.0
with torch.no_grad():
    target_train = F.softmax(teacher(x_train)/temperature, dim=-1)
    target_holdout = F.softmax(teacher(x_holdout)/temperature, dim=-1)

def objective(model, features, targets):
    return temperature**2 * F.kl_div(
        F.log_softmax(model(features)/temperature, dim=-1), targets, reduction='batchmean')

initial = float(objective(student, x_train, target_train).detach())
optimizer = torch.optim.Adam(student.parameters(), lr=0.03)
for _ in range(120):
    optimizer.zero_grad(set_to_none=True)
    loss = objective(student, x_train, target_train)
    loss.backward()
    optimizer.step()
with torch.no_grad():
    final = float(objective(student, x_train, target_train))
    heldout = float(objective(student, x_holdout, target_holdout))
    agreement = float((student(x_holdout).argmax(1) == teacher(x_holdout).argmax(1)).float().mean())
assert final < initial
assert all(torch.equal(value, teacher_before[key]) for key,value in teacher.state_dict().items())
assert all(parameter.grad is None for parameter in teacher.parameters())
print({'teacher_parameters': sum(p.numel() for p in teacher.parameters()),
       'student_parameters': sum(p.numel() for p in student.parameters()),
       'train_KL_initial': initial, 'train_KL_final': final,
       'heldout_KL': heldout, 'heldout_teacher_agreement': agreement})
print('Teacher agreement is imitation quality, not truth or clinical accuracy.')
