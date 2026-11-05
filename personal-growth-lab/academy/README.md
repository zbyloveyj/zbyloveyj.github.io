# 一心问道 · 成长学院

独立入口：https://zbyloveyj.github.io/personal-growth-lab/academy/

十三个可直接进入的学习与探索项目，保留原21天口才和100天成长计划。

| 项目 | 单元数 | 路线 |
| --- | ---: | --- |
| 学术英语（重点） | 90 | `#/english` |
| 科研思维 | 52 | `#/research` |
| AI编程（重点） | 24 | `#/coding` |
| 论文精读 | 100 | `#/papers` |
| 科研绘图 | 24 | `#/visual` |
| 深度写作（重点） | 48 | `#/writing` |
| 思考与认知 | 365 | `#/thinking` |
| 脑科学与脑机接口 | 24 | `#/neuro` |
| 国际实验室与博后导航 | 12 | `#/career` |
| 人生体验 | 100 | `#/life` |
| 大模型全景实战 · CurateMicrobiota | 39 | `llm-lab/`（学院路线 `#/llm`） |
| 30天 AI Agent 实战 | 30 | `agent-lab/`（学院路线 `#/agent`） |
| 尤克里里30天弹唱 | 30 | `ukulele-lab/`（学院路线 `#/ukulele`） |

合计938个学习单元：原十个项目839个，加上大模型39课、AI Agent 30课和尤克里里30课。每节包含概念、具体任务、交付物和验收提示。英语有30组原创场景材料及90次递进练习；编程有六个可运行的合成数据起步样例；写作有12个月主题、原创示例及48次工作坊。其他项目以学习任务、公开资源和成果记录为主，不冒充完整教材或专家评审。原21天口才和100天成长计划另行保留，不计入938个单元。

## 通才培养计划 · 第01领域：哲学

[哲学两日学习课程](https://zbyloveyj.github.io/personal-growth-lab/academy/generalist-lab/)：十本核心著作，分两天建立知识判断、道德行动与人生选择的哲学框架。每本提供完整导读、论证、案例、复述线索及参考文献；课程支持章节导航、打印/PDF与当前浏览器的本地勾选进度。完整讲义位于 `generalist-lab/philosophy.md`。新增 [哲学100个核心知识学习器](https://zbyloveyj.github.io/personal-growth-lab/academy/generalist-lab/knowledge.html)，按10个主题模块组织100个概念，附通俗解释、具体例子、复述问题、20次分批学习、本地掌握记录、检索及随机抽测；数据存于 `generalist-lab/philosophy-100.json`。这是原13个项目之外新增的独立专题，不影响原有938个学习单元。

## 独立实战与音乐课程

[大模型全景实战 · CurateMicrobiota](https://zbyloveyj.github.io/personal-growth-lab/academy/llm-lab/)包含39个学习单元：14个核心、16个进阶和9个专题补全，覆盖71个知识主题。第31—39课已包含在课程目录、完整讲义与逐课材料中。课程数量和覆盖统计以`llm-lab/course-manifest.json`为准。

[30天 AI Agent 实战](https://zbyloveyj.github.io/personal-growth-lab/academy/agent-lab/)包含30课，每课建议60分钟，另有20分钟精简路线。提供完整逐日教材、PDF/Markdown与可运行Python实践包；30天表示学习顺序，可以暂停和顺延。

[尤克里里30天弹唱](https://zbyloveyj.github.io/personal-growth-lab/academy/ukulele-lab/)包含30天跟练、每日小测、三首曲目训练档案、和弦图与合成示范、节拍器、录音回听及五维自评。目标为舒适调、可降速的完整简化弹唱。第7、14、21、30天进行阶段检查，练习完成与技能达标分别显示；30天不是结果保证。完整学习记录使用`yixindao.ukulele-academy.v1`，请在课程内单独导出JSON。歌曲谱本外链可能要求登录，本站不转载第三方完整谱面。

## 使用

进入项目，选择一个单元。笔记自动保存，按课内验收要求手动确认完成。原十个项目提供完整课程或单课Markdown，并支持浏览器“打印本课 / 另存PDF”，不提供预生成的839份PDF。大模型课程提供完整可打印教材与逐课Markdown；AI Agent课程另有逐课和完整教材PDF下载。

学习记录仅在当前浏览器localStorage中，键为`yixindao.growth-academy.v1`。不读取或覆盖原口才与100天计划的记录，不上传笔记，不自动同步。定期导出JSON备份；在新设备导入可合并较新记录。不要记录临床个体数据、证件或账号密钥。

大模型与AI Agent的完整学习记录分别使用`yixindao.curatemicrobiota.v1`和`yixindao.agent-academy.v1`，请在对应课程页面分别导出JSON备份。课程更新保留既有存储键；刷新页面时不要清除站点数据，以免删除本地记录。

英语录音须主动授权麦克风，本站不上传音频。录音仅存当前页面内存，需下载后保留；系统朗读的可用性和联网行为取决于浏览器语音服务。

## 编程

下载`downloads/starter_projects.py`，按文件头部说明建立Python虚拟环境。六个子命令：`qc`、`baseline`、`representation`、`multimodal`、`signal`、`retrieval`。网页不执行Python。示例是教学起点，不是临床软件或已完成的研究成果。

## 书目和机构入口

`data/papers.js`存固定书目。`tools/build_catalog.py`使用官方NCBI E-utilities取标题、期刊、年份及PMID，保留既有ID顺序，完成100条后不自动改序。主题检索组织的书目不等于“100篇已经完成全文评审的经典论文”，也不复制版权全文。单篇阅读应核验研究类型、发表状态及全文权限。

机构链接是方向发现入口，不声称当前招聘、资助资格或录取承诺；具体机会须逐项查看官方页面。

## 本地运行与检查

从仓库根目录执行`python -m http.server 8000`，打开本路径。无需前端打包或外部CDN。

- `node personal-growth-lab/academy/tools/validate.js`：主目录与独立课程的一致性，以及课程结构、数量、引用与发布文件路径。
- `python personal-growth-lab/academy/tools/browser_check.py`：安装Playwright后检查路线、持久化、导入导出、移动布局。
- `python personal-growth-lab/academy/tools/verify_live.py`：核验公开页面与发布文件的SHA-256一致性。

使用现有main分支GitHub Pages机制发布，不建立第二个Pages部署工作流。新增质量工作流只检查内容并保存固定书目；公开验证工作流只读公开HTTPS文件。
