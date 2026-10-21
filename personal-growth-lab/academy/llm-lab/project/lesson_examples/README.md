# 可运行的课程机制实验

本目录由 course/dayNN.json 自动生成。建议从 project 根目录运行以下命令；不要将代码文件移动到未知位置。

这些脚本与网页代码一致。第10/13/14课有明确的演示数据或训练产物前置；它们会检查真实生成文件，不使用伪造结果。

| 单元 | 实验 | 从 project 目录运行 | 前置 |
| --- | --- | --- | --- |
| 1 | 张量形状，是理解模型最可靠的入口 | `python lesson_examples/unit01/s5.py` | 安装项目依赖 |
| 1 | 从一次手算开始理解自动求导 | `python lesson_examples/unit01/s6.py` | 安装项目依赖 |
| 2 | 计算机看到的文本，比“一个字”复杂 | `python lesson_examples/unit02/s1.py` | 安装项目依赖 |
| 2 | 手工做一次 BPE | `python lesson_examples/unit02/s3.py` | 安装项目依赖 |
| 2 | 输入和目标只差一格 | `python lesson_examples/unit02/s5.py` | 安装项目依赖 |
| 2 | 让任何窗口都能回溯来源 | `python lesson_examples/unit02/s7.py` | 安装项目依赖 |
| 3 | 查表与 one-hot 乘法为何等价 | `python lesson_examples/unit03/s2.py` | 安装项目依赖 |
| 3 | 写出最小预测器，并准确说明它的限制 | `python lesson_examples/unit03/s6.py` | 安装项目依赖 |
| 3 | Embedding 的梯度会更新哪些行 | `python lesson_examples/unit03/s8.py` | 安装项目依赖 |
| 4 | 两位置例子：把一次注意力算完 | `python lesson_examples/unit04/s3.py` | 安装项目依赖 |
| 4 | 稳定 softmax 与负无穷遮罩 | `python lesson_examples/unit04/s5.py` | 安装项目依赖 |
| 4 | 实现单头注意力 | `python lesson_examples/unit04/s7.py` | 安装项目依赖 |
| 4 | 用未来扰动，检验真正的因果性 | `python lesson_examples/unit04/s8.py` | 安装项目依赖 |
| 5 | 拆头、转置与合头，最容易悄悄出错 | `python lesson_examples/unit05/s2.py` | 安装项目依赖 |
| 5 | 直接运行工程里的 TinyGPT | `python lesson_examples/unit05/s7.py` | 安装项目依赖 |
| 6 | 交叉熵到底在奖励什么 | `python lesson_examples/unit06/s1.py` | 安装项目依赖 |
| 6 | 一个优化步的顺序 | `python lesson_examples/unit06/s3.py` | 安装项目依赖 |
| 6 | 学习率调度、warmup与稳定性 | `python lesson_examples/unit06/s5.py` | 安装项目依赖 |
| 7 | 困惑度是怎样从损失得到的 | `python lesson_examples/unit07/s1.py` | 安装项目依赖 |
| 7 | Temperature 改变分布，不增加知识 | `python lesson_examples/unit07/s4.py` | 安装项目依赖 |
| 7 | Top-k 与 top-p 分别截断什么 | `python lesson_examples/unit07/s5.py` | 安装项目依赖 |
| 8 | 只在答案位置计算损失 | `python lesson_examples/unit08/d08-03.py` | 安装项目依赖 |
| 9 | 分块：保证事实和限定条件留在一起 | `python lesson_examples/unit09/d09-03.py` | 安装项目依赖 |
| 9 | 把检索质量与回答质量分开计分 | `python lesson_examples/unit09/d09-07.py` | 安装项目依赖 |
| 10 | 用断言替代“看起来对齐了” | `python lesson_examples/unit10/d10-10.py` | 先运行 python -m curatemicrobiota make-demo --out data/demo |
| 11 | 用两项单元实验检查模型假设 | `python lesson_examples/unit11/d11-09.py` | 安装项目依赖 |
| 12 | 留一研究外测需要每折重新训练 | `python lesson_examples/unit12/d12-07.py` | 安装项目依赖 |
| 13 | 一个可运行的训练参考距离诊断 | `python lesson_examples/unit13/d13-06.py` | 先 make-demo，再运行 python -m curatemicrobiota pretrain --data data/demo --out runs/microbiome --steps 40 |
| 13 | 数据增强要写出保留了什么假设 | `python lesson_examples/unit13/d13-08.py` | 安装项目依赖 |
| 14 | 从运行目录建立可复现证据链 | `python lesson_examples/unit14/d14-03.py` | 先运行 python -m curatemicrobiota pipeline --quick --out runs/demo |
| 15 | SVD、秩与低秩近似 | `python lesson_examples/unit15/s2.py` | 安装项目依赖 |
| 15 | 熵、交叉熵与KL的关系 | `python lesson_examples/unit15/s5.py` | 安装项目依赖 |
| 15 | 有限差分：用数值独立核对梯度 | `python lesson_examples/unit15/s8.py` | 安装项目依赖 |
| 16 | 准确重复、近重复和同源关系 | `python lesson_examples/unit16/s3.py` | 安装项目依赖 |
| 16 | BPE训练：把合并规则真正学出来 | `python lesson_examples/unit16/s4.py` | 安装项目依赖 |
| 16 | 编码阶段不能重新训练词表 | `python lesson_examples/unit16/s5.py` | 安装项目依赖 |
| 17 | RoPE：相对位置怎样进入点积 | `python lesson_examples/unit17/s2.py` | 安装项目依赖 |
| 17 | RMSNorm与LayerNorm，少了哪一步 | `python lesson_examples/unit17/s3.py` | 安装项目依赖 |
| 17 | SwiGLU：乘法门控如何改变MLP | `python lesson_examples/unit17/s4.py` | 安装项目依赖 |
| 17 | MoE路由的一个可计算例子 | `python lesson_examples/unit17/s7.py` | 安装项目依赖 |
| 17 | SSM与Mamba：压缩历史的另一条路径 | `python lesson_examples/unit17/s12.py` | 安装项目依赖 |
| 18 | DataLoader：顺序、批处理与随机源 | `python lesson_examples/unit18/s2.py` | 安装项目依赖 |
| 18 | 变长数据的梯度累积必须按分母推导 | `python lesson_examples/unit18/s3.py` | 安装项目依赖 |
| 18 | 完整检查点：保存下一步所需要的状态 | `python lesson_examples/unit18/s7.py` | 安装项目依赖 |
| 19 | KV缓存按键值头计算，激活按实际图计算 | `python lesson_examples/unit19/s2.py` | 安装项目依赖 |
| 19 | FlashAttention：改变数据搬运，不改变目标 | `python lesson_examples/unit19/s7.py` | 安装项目依赖 |
| 19 | FLOPs、时间与利用率：写清近似 | `python lesson_examples/unit19/s9.py` | 安装项目依赖 |
| 20 | 答案mask：正确的监督从第一个答案token开始 | `python lesson_examples/unit20/s3.py` | 安装项目依赖 |
| 20 | Packing：省padding需要保留任务边界 | `python lesson_examples/unit20/s4.py` | 安装项目依赖 |
| 20 | DPO：比较相对于参考模型的回答优势 | `python lesson_examples/unit20/s8.py` | 安装项目依赖 |
| 20 | RLHF与PPO：旧策略和参考策略不能混淆 | `python lesson_examples/unit20/s9.py` | 安装项目依赖 |
| 20 | GRPO：用同题回答组构造相对优势 | `python lesson_examples/unit20/s10.py` | 安装项目依赖 |
| 21 | BM25：词频饱和、长度归一与逆文档频率 | `python lesson_examples/unit21/d21-03.py` | 安装项目依赖 |
| 21 | 混合检索用排名融合，避免直接相加不同尺度 | `python lesson_examples/unit21/d21-05.py` | 安装项目依赖 |
| 21 | 结构化输出通过语法后，还要过引用与语义核验 | `python lesson_examples/unit21/d21-10.py` | 安装项目依赖 |
| 22 | 工具合同要同时约束名称、字段、单位和结果 | `python lesson_examples/unit22/d22-03.py` | 安装项目依赖 |
| 22 | 预算和终态：让流程能够有解释地停止 | `python lesson_examples/unit22/d22-07.py` | 安装项目依赖 |
| 22 | 缓存与幂等：复用结果时仍检查版本和范围 | `python lesson_examples/unit22/d22-08.py` | 安装项目依赖 |
| 23 | 配对比较：两套系统必须面对同一批问题 | `python lesson_examples/unit23/d23-04.py` | 安装项目依赖 |
| 23 | 人工标注先有规则，再计算一致性 | `python lesson_examples/unit23/d23-05.py` | 安装项目依赖 |
| 23 | 校准与拒答：更少回答不自动意味着更可靠 | `python lesson_examples/unit23/d23-07.py` | 安装项目依赖 |
| 24 | 先证明缓存与完整因果计算等价 | `python lesson_examples/unit24/d24-03.py` | 安装项目依赖 |
| 24 | 量化：看数值范围、比例因子与任务误差 | `python lesson_examples/unit24/d24-06.py` | 安装项目依赖 |
| 24 | 流式输出首先明确时间事件和停止原因 | `python lesson_examples/unit24/d24-08.py` | 安装项目依赖 |
| 25 | 对齐不是取交集后悄悄补零 | `python lesson_examples/unit25/d25-02.py` | 安装项目依赖 |
| 25 | CLR与ILR：转换的是相对关系 | `python lesson_examples/unit25/d25-05.py` | 安装项目依赖 |
| 26 | 排序词元：少了数值就改变了任务 | `python lesson_examples/unit26/d26-03.py` | 安装项目依赖 |
| 26 | 对比学习学习的是你规定的不变性 | `python lesson_examples/unit26/d26-07.py` | 安装项目依赖 |
| 27 | 嵌套验证把选择与最终评价隔开 | `python lesson_examples/unit27/d27-02.py` | 安装项目依赖 |
| 27 | 配对与层级bootstrap需要说明条件 | `python lesson_examples/unit27/d27-07.py` | 安装项目依赖 |
| 28 | 反向互补不变性要服从任务含义 | `python lesson_examples/unit28/d28-03.py` | 安装项目依赖 |
| 28 | 从基因表示到群落需要显式权重 | `python lesson_examples/unit28/d28-07.py` | 安装项目依赖 |
| 29 | 配对表比融合网络先完成 | `python lesson_examples/unit29/d29-02.py` | 安装项目依赖 |
| 29 | 实跑：训练域残差化后的PLS关联 | `python lesson_examples/unit29/d29-06.py` | 安装项目依赖 |
| 29 | 规范模型估计个体偏离，而不是直接分类 | `python lesson_examples/unit29/d29-07.py` | 安装项目依赖 |
| 30 | 05｜独立代码一：用摘要锁定输入、划分与配置 | `python lesson_examples/unit30/d30-05.py` | 安装项目依赖 |
| 30 | 06｜独立代码二：从逐研究数字检查主结论 | `python lesson_examples/unit30/d30-06.py` | 安装项目依赖 |
