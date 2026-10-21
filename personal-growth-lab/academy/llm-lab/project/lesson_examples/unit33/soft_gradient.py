# 持续学习与知识蒸馏：学新任务时怎样保留旧能力 / 06｜软目标、温度与T²要一起推导
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import torch
import torch.nn.functional as F

torch.set_num_threads(1)
teacher_logits = torch.tensor([[2.,0.,-1.],[0.,1.,2.]], dtype=torch.float64)
initial = torch.tensor([[0.1,-0.2,0.3],[0.4,0.2,-0.1]], dtype=torch.float64)
temperature = 3.0

def soft_loss(student_logits, scaled):
    target = F.softmax(teacher_logits/temperature, dim=-1).detach()
    value = F.kl_div(F.log_softmax(student_logits/temperature, dim=-1),
                     target, reduction='batchmean')
    return value * (temperature**2 if scaled else 1.0)

unscaled = initial.clone().requires_grad_()
scaled = initial.clone().requires_grad_()
soft_loss(unscaled, False).backward()
soft_loss(scaled, True).backward()
assert torch.allclose(scaled.grad, temperature**2 * unscaled.grad)
expected = (temperature/initial.shape[0]) * (
    F.softmax(initial/temperature, dim=-1)-F.softmax(teacher_logits/temperature, dim=-1))
assert torch.allclose(scaled.grad, expected, atol=1e-12)
assert teacher_logits.grad is None
assert soft_loss(teacher_logits.clone(), True).abs() < 1e-12
print('scaled soft-target KL:', float(soft_loss(initial, True)))
print('gradient norm:', float(scaled.grad.norm()))
print('T^2 corrects objective scale; it does not make gradients equal for all T.')
