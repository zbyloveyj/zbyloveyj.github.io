# 30天 AI Agent 实战

成长学院项目10。课程入口：<https://zbyloveyj.github.io/personal-growth-lab/academy/agent-lab/>。

## 教学设计

每天建议60分钟：15分钟概念、30分钟操作与参数对照、10分钟验收与自测、5分钟记录。每课提供20分钟轻量路线和另计的20分钟拓展。30天表示学习顺序，允许暂停和顺延。前置条件是能打开文件与终端；第1课提供Python环境带练，安装和模型下载可另计。

每课包含目标、先修、四节概念讲解、四步带练、命令和预期结果、参数实验、三项成果验收、排错、两道带解析的自测、术语、参考阅读范围与反思。第7、14、21、28天完成阶段整合，第29–30天完成综合检查与演示。

主线依次覆盖工具契约、有限行动循环、检索与证据、记忆、规划、重试、人工批准、MCP、图式编排、角色分工、CSV工具、输入边界、评价、追踪、本地网页、缓存与预算、打包复现。终点是可解释、可检查的研究助手原型。

## 运行与材料

`practice/README.md` 提供详细运行说明。Python3.10+标准库即可运行离线主线：

```sh
cd practice
python run.py day 1
python run.py evaluate --split test --top-k 3
python -m unittest discover -s tests -v
python run.py serve --port 8765
```

离线输出是规则教学流程，并非真实语言模型推理。Ollama/OpenAI可选路径、MCP教学子集及SDK、LangGraph可选示例单独标注执行范围。合成CSV和整理后的教学语料不代表真实研究结果。公开评价集不是盲测基准。

`course/dayNN.json` 是教材单一来源；`sources.json` 区分已核验GitHub收藏、Fork、既有项目和补充资料；`assets/course-data.js` 为生成文件。下载目录提供逐课PDF/Markdown、完整教材PDF/Markdown、实践ZIP、课程与实践合包。

```sh
python tools/build_materials.py --font /path/to/NotoSansSC-Regular.ttf
python tools/validate_course.py
node tools/test_progress.cjs
```

PDF构建使用ReportLab、pypdf和Google Fonts发布的OFL Noto Sans SC静态TrueType字体（可用fontTools将变量字体实例化为weight400）；字体许可见 `downloads/FONT-LICENSE.txt`。ZIP排除运行输出、密钥、缓存和虚拟环境。

## 学习记录

浏览器存储键 `yixindao.agent-academy.v1` 保存本课程记录；完成摘要兼容总学院 `yixindao.growth-academy.v1` 的 `agent:N` 记录。每课记录独立按更新时间合并备份，轻量完成与完整验收分开。接收跨标签更新不会反写存储，避免更新循环。JSON导入检查schema、白名单课程、字段长度和答案范围。笔记仅保存在使用者的浏览器，没有上传接口。

## 发布与范围

作为现有GitHub Pages目录发布，保持既有课程和页面。`validation.json` 记录本次实际验证；API真实推理需用户本机模型或账号，不把离线验收冒充真实模型评测。
