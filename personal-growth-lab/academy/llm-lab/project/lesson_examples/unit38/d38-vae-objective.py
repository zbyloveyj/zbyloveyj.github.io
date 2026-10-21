# 结构先验与生成目标：图模型、VAE 和扩散怎样进入菌群研究 / 独立实验二：把 VAE 损失分成观测项与潜变量项
# 前置：安装项目依赖
from pathlib import Path as _CMPath
import sys as _cm_sys
_cm_sys.path.insert(0, str(_CMPath(__file__).resolve().parents[2]))

import math
import torch
from torch.distributions import Normal, kl_divergence
torch.manual_seed(38)
# 两个样本的人工连续坐标；不是原始计数或真实受试者。
x = torch.tensor([[0.6,-0.4],[-0.2,0.8]], dtype=torch.float64)
mu = torch.tensor([[0.2,-0.1],[0.4,0.3]],dtype=torch.float64,requires_grad=True)
logvar = torch.tensor([[0.1,-0.2],[0.0,0.2]],dtype=torch.float64,requires_grad=True)
std = (0.5*logvar).exp()
z = mu + std * torch.randn_like(mu)
W = torch.tensor([[0.7,0.2],[-0.1,0.6]],dtype=torch.float64)
recon = z @ W
# 单位方差的高斯观测模型；按特征求和，再按样本平均。
nll = 0.5*((x-recon)**2).sum(-1) + 0.5*x.shape[1]*math.log(2*math.pi)
kl = 0.5*(mu.square()+logvar.exp()-1-logvar).sum(-1)
reference = kl_divergence(Normal(mu,std), Normal(torch.zeros_like(mu),torch.ones_like(std))).sum(-1)
assert torch.allclose(kl,reference)
loss = (nll+kl).mean()  # 一次重参数采样给出的负ELBO蒙特卡洛估计。
loss.backward()
assert torch.isfinite(mu.grad).all() and torch.isfinite(logvar.grad).all()
print({"mean_nll": float(nll.detach().mean()),"mean_kl":float(kl.detach().mean()),
       "negative_elbo_estimate":float(loss.detach()),"finite_gradients":True})
# 运行一次损失与梯度核验不等于训练完成，更不等于验证了群落生成质量。

