# AI Agent 30 天 · 一小时实践包

配合个人成长院的 30 天课程使用。每天运行一条命令，修改一个参数，检查真实输出，再留下自己的判断。主线需要 **Python 3.10 或更新版本**，全部采用标准库，不需要显卡、API Key 或付费调用。此次交付实际验证环境为 Python 3.12.14。

默认 `offline` 是**规则流程教学**：词项检索、原文拼接、参数验证、状态转移和数值计算。它不会产生真正的模型推理。需要体验模型自主选择工具时，使用下文的可选 Ollama / OpenAI 路径；调用失败会明确报错，不会悄悄切换到离线结果。

## 1. 第一次启动

解压后，在包含 `run.py` 的 `practice` 文件夹里打开终端。

macOS / Linux：

```bash
python3 --version
python3 -m venv .venv
source .venv/bin/activate
python run.py day 1
```

Windows PowerShell：

```powershell
py -3 --version
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python run.py day 1
```

若 PowerShell 不允许激活脚本，可直接使用 ` .\.venv\Scripts\python.exe run.py day 1`。后续出现的 `python` 都可替换为这个解释器路径。主线无需 `pip install`。

成功标志：终端显示 `day: 1` 与 `task_card`，并生成 `outputs/day01.json`。每次重跑同一天会覆盖当天输出；保留实验对照时，请自行复制为另一文件名。`checkpoint.json`、`memory.json`、审批示范报告也只写入 `outputs`。

## 2. 每天怎么学

建议按课程页面安排：5 分钟回忆、10 分钟阅读、30 分钟操作、10 分钟验收、5 分钟复盘。当天状态不好时，完成课程提供的 20 分钟保底任务即可；把未完成的实验记下来，下次从那一步继续。

```bash
python run.py day 4
```

打开 `experiments.json`，仅将 `day04.remove_field` 从空字符串改为 `"uncertainty"`，保存，再执行同一命令。打开 `outputs/day04.json`，应看到 `result.check.valid` 变为 `false`，并列出缺失字段。复盘时解释为什么失败，再恢复参数。

每日文件统一为：

```json
{
  "day": 4,
  "title": "结构化输出校验",
  "mode": "offline",
  "result": {
    "candidate": {},
    "check": {"valid": false, "errors": []}
  }
}
```

上面仅展示字段结构；真实 `candidate` 和 `errors` 由运行生成。不同天的 `result` 根据主题变化，详细字段在 `AUTHORING_CONTRACT.md`，对应课程给出逐日操作与验收。

也可以复制一份配置并指定路径：

```bash
python run.py day 4 --config experiments-mine.json
```

JSON 的字符串必须用双引号，布尔值是 `true` / `false`，最后一个字段后不加逗号。`question` 必须非空，`top_k` 必须为 1–5 的整数，不能写成 `"3"` 或 `true`。

## 3. 四组完整案例

| 阶段 | 实际产出 | 关键检查 |
|---|---|---|
| Day 1–7 | 任务卡、函数契约、结构化答案、证据卡 | 参数错误、预算停止、字段缺失、来源与解释分开 |
| Day 8–15 | 词项检索证据助手、公开开发集评估、检查点与记忆、依赖图 | 哈希变化、top_k 影响、恢复条件、用户隔离、环检测 |
| Day 16–23 | 重试/超时、审批、MCP、状态图、审查分工、CSV 与工具边界 | 实际失败分支、摘要绑定、幂等、分母、允许工具清单 |
| Day 24–30 | 公开测试集、运行轨迹、本地 Web、缓存预算、交付清单、困难案例 | 数据局限、实际调用数、未知成本、词法误匹配与人工验收 |

### 案例 A：有来源的教学证据助手

```bash
python run.py ask "What does relative abundance measure?" --top-k 3
python run.py evaluate --split dev --top-k 1
python run.py evaluate --split dev --top-k 3
```

返回的 `citations` 是教学笔记的**精确摘录**。`source_url` 指向进一步阅读材料，不表示笔记是该论文或文档的逐字原文。检索使用词项重合，没有 embedding、向量数据库或语义重排。

`retrieval_recall` 统计预期证据 ID 被检索到的比例；`answerable_accuracy` 检查答案是否包含预期 ID；`abstention_accuracy` 检查无支持案例是否拒答。这些是练习用代理指标，未评价自然语言的事实、因果或医学正确性。`dev` 与 `test` 各有 8 条公开案例；test 文件可见，不能称为盲测。两处检索和答案生成使用相同 `top_k`。

### 案例 B：人工批准后写入报告

```bash
python run.py day 17
```

第一次返回 `needs_approval`，展示报告 `preview`、固定写入 `path` 和 `digest`。认真读完预览后，将该摘要复制到 `experiments.json` 的 `day17.approved_digest`，保持 `draft_text` 不变，再运行：

```bash
python run.py day 17
python run.py day 17
```

第二次返回 `written`，产生 `outputs/approved_report.txt`；第三次返回 `already_applied`，不重复写入。修改 `draft_text` 却保留旧摘要会得到 `approval_mismatch`。摘要同时绑定目标路径和文本；这是本机审批机制练习，没有用户身份认证和多人授权系统。

### 案例 C：合成数据分析

```bash
python run.py day 22
```

`data/participants.csv` 有 9 行虚构记录；默认 abundance 列有 6 个有效值、3 个缺失/无效值。默认 `exclude` 只用有效值计算均值，结果同时报告分母。改成 `missing_policy: "error"` 会明确失败并报出 CSV 行号；改为 `column: "age"` 可以对照没有缺失值时的分母。数据不是患者记录，不用于诊断、疗效评价或因果结论。

### 案例 D：本地网页

```bash
python run.py serve --port 8765
```

打开 <http://127.0.0.1:8765/>，输入问题，选择证据数，点击查找。服务只绑定回环地址，网页调用固定的离线检索流程。`Ctrl+C` 关闭。端口被占用时改成 `--port 8766`，并使用相应网址。

接口示例：`POST /api/ask`，JSON 为 `{"question":"tool contract","top_k":3}`。`GET /health` 可检查服务。请求体上限 16 KiB；外部 Host / Origin 会被拒绝。Day 26 命令本身只展示接口调用结果，不会阻塞启动服务器。

## 4. 可选：连接真正的模型

先完成离线主线，观察其规则和失败，再进行模型对照。以下路径会向选定模型发送问题，以及允许工具返回的教学材料。真实运行的速度、费用与效果取决于具体模型和本机/账户环境。

### Ollama 本机路径

按 [Ollama 工具调用官方文档](https://docs.ollama.com/capabilities/tool-calling) 安装 Ollama，并下载一个明确支持工具调用的模型。先运行 `ollama list` 确认本机模型的完整名称。在下面命令中，将 `YOUR_LOCAL_MODEL` 替换成这个名称：

```bash
python run.py ask "What is a tool contract?" --provider ollama --model YOUR_LOCAL_MODEL --allow-network --max-steps 6
python run.py day 6 --provider ollama --model YOUR_LOCAL_MODEL --allow-network
```

程序访问固定的 `http://127.0.0.1:11434/api/chat`。`--allow-network` 也适用于本地模型端口，表示你明确选择实际模型请求。若 Ollama 未启动、模型名称不存在或模型不支持工具，程序给出错误或无效输出状态。它不会自动下载模型。

### OpenAI API 路径

在自己的终端环境中设置 `OPENAI_API_KEY`，并从账户可用模型中选择支持函数调用的名称，替换 `YOUR_OPENAI_MODEL`。无需安装 OpenAI SDK：

```bash
python run.py ask "What is a tool contract?" --provider openai --model YOUR_OPENAI_MODEL --allow-network --max-steps 6
python run.py day 14 --provider openai --model YOUR_OPENAI_MODEL --allow-network
```

实现使用 [Responses API 函数调用](https://developers.openai.com/api/docs/guides/function-calling)，设置 `store: false`，在多轮请求中保留返回的 output 项和函数调用关联 ID。相关 [无状态 reasoning 项说明](https://developers.openai.com/api/docs/guides/reasoning) 解释了为什么应保留返回项。密钥仅从环境变量读取；不要写进课程笔记、JSON、代码或压缩包。

支持真实 provider 的入口为 `ask` 和 Day 3、6、14、25、30；其他日的专门机制实验仍保持离线。每轮最多接受 4 次工具调用，总工具调用预算为 `2 × max_steps`，模型请求轮数不超过 `max_steps`。工具只允许检索笔记、按 ID 读笔记和分析固定 CSV，没有任意文件、Shell 或外部写入工具。每个 HTTP 请求有超时和响应大小限制。

观察 `provider`、`status`、`trace` 与 `check`：格式/引用校验失败会标记 `invalid_model_output`。API 未报告的 token 数和无法确认的成本保持 `null`。这次交付验证了适配器的模拟协议往返，**没有使用真实 Ollama 或 OpenAI 模型进行推理测试**。

## 5. 可选：真实框架与 SDK 对照

主线 Day 18 已经通过真正的子进程标准输入/输出完成 JSON-RPC 通信；只实现 `initialize`、`notifications/initialized`、`tools/list`、`tools/call`，教学协议版本固定为 `2025-06-18`，不宣称完整 MCP 一致性。

安装框架需要网络，建议在虚拟环境中运行：

```bash
python -m pip install -r optional/requirements.txt
python optional/mcp_sdk_demo.py
python optional/langgraph_demo.py
```

`optional/requirements.txt` 固定 `mcp==1.30.0` 与 `langgraph==1.2.16`。MCP 示例对应 **SDK v1** 的 `FastMCP` / `ClientSession`，请不要把依赖直接升级到 v2 再照抄本示例；新主版本接口不同。官方资料见 [Python SDK](https://github.com/modelcontextprotocol/python-sdk)、[v1.30.0 发行页](https://pypi.org/project/mcp/1.30.0/)。本次实际 SDK 会话协商出 `2025-11-25`，与手写教学子集版本独立。

LangGraph 示例使用真正的 `StateGraph`，执行 `retrieve → draft → review`，保留显式状态和节点轨迹；节点本身仍为规则函数，不调用语言模型。代码结构可对照 [LangGraph Quickstart](https://docs.langchain.com/oss/python/langgraph/quickstart)。本次两个可选示例均已实际运行通过。

## 6. 必须看懂的局限

- **一个相关词不足以证明支持答案。** Day 29 默认问题包含 `unknown`，会命中 E08 的 `Unknown token usage`，因此基线会输出 `answered` 并返回一段与疾病无关的笔记。这个结果应被你判为失败。把问题改成 `zxqv nebula recipe`，可观察真正零命中时的 `abstained`。二者共同说明：有引用与可回答是不同判断。
- 引用检查只验证 ID 存在、quote 是笔记中的精确片段，不会验证回答的语义支持关系。冲突示例仅检查教学材料中的否定词，不是通用矛盾检测模型。
- Day 13 使用固定逻辑时钟，目的是可重复观察 TTL、跨用户查询与删除；这不是登录认证系统。Day 12 只对同问题且同语料哈希复用检查点。
- Day 16 的截止时间会停止等待；已经运行的 Python 线程无法被强制终止。示例工作时间上限为 200 毫秒，不能将同样方法直接理解为任意外部任务的取消机制。
- Day 20 的三个角色是确定性函数分工；Day 23 不可信文本仅作为数据展示，不通过真实模型，因此不能证明提示词攻击已被解决。
- Day 27 的缓存只存在于当前进程，以问题、top_k 和语料哈希为键。调用预算约束实际提交数量，不等于 API 费用计费系统。

## 7. 自检与排障

```bash
python -m unittest discover -s tests -v
python run.py evaluate --split test --top-k 3
python run.py day 30
```

测试包含 localhost HTTP 通信，需要运行环境允许本机端口。受限制的在线沙箱可能禁止这一步；在普通本机终端可直接运行。详细测试范围和实际结果见 `VALIDATION.md`。

| 现象 | 检查和处理 |
|---|---|
| 找不到 `run.py` | 终端先进入 `practice` 文件夹；不要在压缩包里直接运行 |
| `python` 不存在 | 检查 Python 安装；macOS/Linux 用 `python3`，Windows 可用 `py -3` |
| JSON 解析报错 | 检查双引号、英文逗号、布尔值与尾逗号；对照原始配置 |
| `top_k` 不通过 | 只使用整数 1–5，不能使用字符串或布尔值 |
| Day 12 意外显示恢复 | 同题运行过会复用检查点；改 `resume` 为 `false` 可重建 |
| Day 17 没写文件 | 先阅读 `preview`，准确复制 `digest`；改稿后需重新批准 |
| Day 22 `missing_policy=error` 报错 | 这是预期失败分支；检查缺失行，再明确自己的处理策略 |
| 模型端点错误 | 查模型名、本地服务或账户环境；不要把离线结果误写成真实模型结果 |
| 课程跑完但答案无关 | 查看每个 evidence ID 和原文；记录失败案例，拒绝把格式通过当成事实正确 |

## 8. 文件与资料说明

`agentkit/` 包含核心检索、模型适配器、逐日实验、教学 MCP 和 Web；`data/` 包含原创双语教学笔记、合成 CSV 与公开评估题；`tests/` 验证实际边界；`optional/` 提供框架示例。`experiments.json` 是你的实验旋钮，保留每次只改一个变量的习惯。

笔记 E01–E08 的进一步阅读分别为：[因果推断教材](https://miguelhernan.org/whatifbook)、[微生物组组成数据论文](https://doi.org/10.3389/fmicb.2017.02224)、[MCP 工具规范](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)、[W3C 来源信息](https://www.w3.org/TR/prov-overview/)、[记忆概念](https://docs.langchain.com/oss/python/concepts/memory)、[Python CSV](https://docs.python.org/3/library/csv.html)、[OWASP 提示词注入](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)、[评估实践](https://developers.openai.com/api/docs/guides/evaluation-best-practices)。链接于 2026-10-21 核对；笔记由课程原创整理，不作为上述资料的直接引文。
