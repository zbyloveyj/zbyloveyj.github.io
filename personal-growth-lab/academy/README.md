# 一心问道 · 成长学院

独立入口：https://zbyloveyj.github.io/personal-growth-lab/academy/

十个可直接进入的学习与探索项目，保留原21天口才和100天成长计划。

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

合计839个任务单元，每节包含概念、具体任务、交付物和验收提示。英语有30组原创场景材料及90次递进练习；编程有六个可运行的合成数据起步样例；写作有12个月主题、原创示例及48次工作坊。其他项目以学习任务、公开资源和成果记录为主，不冒充完整教材或专家评审。

## 使用

进入项目，选择一个单元。笔记自动保存，任务勾选完后手动确认完成。可下载完整课程或单课Markdown，使用浏览器“打印本课 / 另存PDF”。本站不提供预生成的839份PDF。

学习记录仅在当前浏览器localStorage中，键为`yixindao.growth-academy.v1`。不读取或覆盖原口才与100天计划的记录，不上传笔记，不自动同步。定期导出JSON备份；在新设备导入可合并较新记录。不要记录临床个体数据、证件或账号密钥。

英语录音须主动授权麦克风，本站不上传音频。录音仅存当前页面内存，需下载后保留；系统朗读的可用性和联网行为取决于浏览器语音服务。

## 编程

下载`downloads/starter_projects.py`，按文件头部说明建立Python虚拟环境。六个子命令：`qc`、`baseline`、`representation`、`multimodal`、`signal`、`retrieval`。网页不执行Python。示例是教学起点，不是临床软件或已完成的研究成果。

## 书目和机构入口

`data/papers.js`存固定书目。`tools/build_catalog.py`使用官方NCBI E-utilities取标题、期刊、年份及PMID，保留既有ID顺序，完成100条后不自动改序。主题检索组织的书目不等于“100篇已经完成全文评审的经典论文”，也不复制版权全文。单篇阅读应核验研究类型、发表状态及全文权限。

机构链接是方向发现入口，不声称当前招聘、资助资格或录取承诺；具体机会须逐项查看官方页面。

## 本地运行与检查

从仓库根目录执行`python -m http.server 8000`，打开本路径。无需前端打包或外部CDN。

- `node personal-growth-lab/academy/tools/validate.js`：课程结构、数量、引用与下载路径。
- `python personal-growth-lab/academy/tools/browser_check.py`：安装Playwright后检查路线、持久化、导入导出、移动布局。
- `python personal-growth-lab/academy/tools/verify_live.py`：核验公开页面与发布文件的SHA-256一致性。

使用现有main分支GitHub Pages机制发布，不建立第二个Pages部署工作流。新增质量工作流只检查内容并保存固定书目；公开验证工作流只读公开HTTPS文件。
