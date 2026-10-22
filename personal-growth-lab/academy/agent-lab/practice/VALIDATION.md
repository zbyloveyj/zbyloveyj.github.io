# 实际验证记录

验证日期：2026-10-21。环境：Linux，Python 3.12.14。主线代码采用 Python 3.10+ 标准库；此次没有实际切换到 Python 3.10，也没有在 Windows/macOS 上执行。

## 已运行通过

| 检查 | 结果与边界 |
|---|---|
| `python run.py day N`，N=1…30 | 30 个独立 CLI 调用退出码全部为 0；逐一验证终端 JSON 与 `outputs/dayNN.json` 相同 |
| 自动测试 | `python -m unittest discover -s tests -v`：24 项通过 |
| `ask` / `evaluate` | 实际 CLI 问答、dev top_k=1 和 test top_k=3 成功；省略 live `--allow-network` 返回退出码 2，明确 `fallback_used: false` |
| 教学 MCP 子集 | 真正启动 Python 子进程，通过 stdio 交换 4 个请求/通知，返回 3 个响应；初始化、列工具、调工具成功 |
| 本地 Web | 真正启动 127.0.0.1 临时端口并请求 `/health`、`/api/ask`；错误 Origin、Host、参数和 Content-Type 被拒绝；服务在测试后关闭 |
| 官方 MCP SDK v1 | 安装 `mcp==1.30.0`，实际运行 `optional/mcp_sdk_demo.py`；协商协议 `2025-11-25`，列出工具并返回检索结果 |
| LangGraph | 安装 `langgraph==1.2.16`，实际运行 `optional/langgraph_demo.py`；retrieve/draft/review 节点与输出检查通过 |
| 可移植副本 | 将交付源文件复制到含空格的新路径，在外部工作目录调用 Day 18、Day 30；实际子进程与结果保存均成功 |

24 项测试覆盖参数类型/范围与多余字段、精确摘录校验、预算停止、零命中拒答、导入哈希、分块重叠、评估 top_k 一致性、检查点、TTL/用户隔离/删除、依赖环、实际重试/超时、摘要审批/改稿失效/幂等、MCP 握手和格式错误、交付质量门、工具允许列表、CSV 缺失分母、缓存去重与预算、交付清单过滤、网络许可门、两个模型协议往返、失败不降级、本地 HTTP 边界。

部分检查需要本机通信权限。受限沙箱最初禁止本机 socket；在允许本机通信的验证环境重新运行后，完整 24 项与 SDK 示例通过。这个限制不影响主线 30 个离线 CLI 练习。

## 评估数据与已知失败

开发集和测试集各 8 条，均随包公开，**不是盲测**。默认 `top_k=3` 下，两组的检索召回、预期 ID 覆盖与零命中拒答代理指标为 1.0；`top_k=1` 时，检索召回为 0.9167、可回答案例的预期 ID 覆盖为 0.8333，拒答指标为 1.0。这些数字只说明本包公开小样本的行为，不能作为通用准确率、语义真实性或科研质量的证明。

特意保留的困难案例：Day 29 默认问题 `What is the cure for an unknown disease?` 因 `unknown` 一词命中 E08 关于 token 用量的笔记，基线返回 `answered`，但内容与所问疾病无关。教材要求学习者把它判为失败，区分“检索到文本”与“证据支持答案”。用 `zxqv nebula recipe` 对照，可观察零命中时真正返回 `abstained`。这项语义盲区没有通过针对题目的硬编码消除。

## 未执行与不能由测试推出的结论

- 未使用真实 Ollama 或 OpenAI 模型推理。两适配器测试使用模拟 HTTP 响应，覆盖工具参数、回传角色/call_id、多轮 output 保留、token 合计、预算与失败路径；不证明某个具体模型的工具选择效果或服务可用性。
- 未进行完整 MCP 一致性测试。手写教学子集固定 `2025-06-18`；可选 SDK 示例使用自身协商版本，两者不混同。
- 未证明引用的语义支持、科学因果结论、提示词注入的全面防御或临床有效性。CSV 为合成数据，证据库为 8 条原创教学笔记。
- 未测高并发负载、公网部署、身份系统、多人授权、计费或生产环境。Web 仅供本机离线学习。

## 复核命令

```bash
python -m unittest discover -s tests -v
python run.py evaluate --split dev --top-k 1
python run.py evaluate --split test --top-k 3
python run.py day 29
python run.py day 30
```

可选框架需先安装 `optional/requirements.txt`。直接依赖版本已固定；传递依赖由安装时的包管理器解析，未声称所有平台具有完全相同的锁文件。
