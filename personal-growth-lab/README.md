# 个人成长实验室 · Personal Growth Lab

> 把表达，练成一种可靠的能力。

**在线学习：** https://zbyloveyj.github.io/personal-growth-lab/

**第一课：** https://zbyloveyj.github.io/personal-growth-lab/?day=01

## 21天口才与表达 · 详细自学版

完整开放21课，每课建议60分钟。学习进度由自己勾选，不根据自然日期自动推进，也不把没有做过的课程视为完成。2026年10月20日为本轮起点；遇到会议、出差或休息，可以从实际停留的课次继续。

| 阶段 | 课程 | 核心训练 |
|---|---|---|
| 01 | Day 01—07 | 基线录音、易混音、连续吐字、语速停顿、重音与第一次复测 |
| 02 | Day 08—14 | 先说结论、理由与例子、证据边界、叙事、通俗解释、即兴表达 |
| 03 | Day 15—21 | 倾听追问、说服协商、现场问答、进度汇报、受众适配、限时表达与结业演讲 |

### 每一课都提供

- 连续0—60分钟的操作安排，与网页、PDF采用同一内容来源。
- 方法讲解、正误对照、三道“题目—参考做法—核对标准”带练题。
- 具体发音或结构材料、六句完整表达、扩充的原创朗读文章及停顿提示。
- 脱稿复述提纲与全文示范；一个材料完整的新情境，先独立作答再看答案。
- 日常沟通与少量科研交流示范；角色对话、追问、反对意见等按课题安排。
- 100分自评与具体计分依据、首录和修正版的保存方法、可打印手写的独立打卡页。

21课共63道逐步带练题、21个独立迁移情境。日常与科研示范是同一时段的可选材料，不要求把所有内容额外挤进60分钟。60分钟包括默读、准备、开口、回听和记录，并非连续发声。

## 每天独立下载PDF

**完整下载目录：** https://zbyloveyj.github.io/personal-growth-lab/downloads/

**21份每日PDF打包：** https://zbyloveyj.github.io/personal-growth-lab/downloads/21-daily-pdfs.zip

**完整合订本：** https://zbyloveyj.github.io/personal-growth-lab/downloads/21-days-complete-workbook.pdf

每天的独立文件为 `downloads/pdf/Day-01.pdf` 至 `Day-21.pdf`。课程顶部与首页目录均有直接下载入口；无需使用浏览器“打印”才能取得PDF。PDF嵌入中文字形，最后一页留有评分、录音证据和复盘的手写空间。页数、文件大小和SHA-256校验值见 `downloads/pdf-manifest.json`。

## 学习与记录

第一次先独立录音，再看参考。修正版另存，不覆盖原始录音。第7、14、21课结合相同题目与新情境观察变化；没有旧录音就建立当前基线，不补造进步数据。

网页中的答案默认折叠。打卡、评分、笔记存在当前浏览器的localStorage；更新教材不更换原有记录键。完成与否始终由本人操作。支持JSON导出和导入，跨设备或清理浏览器前请主动备份。

麦克风录音仅在用户授权后由浏览器生成，需自行下载保存，不上传到网站服务器。网站没有后端账户或自动跨设备同步。不使用外部CDN框架。

## 文件结构与维护

```text
personal-growth-lab/
  index.html
  assets/                  # 响应式阅读、计时、打卡、录音
  data/
    week1.js ... week3.js   # 基础课程源材料
    deep1.js ... deep3.js   # 方法讲解源材料
    editorial/week*.json    # 逐课案例、带练、新题与修订内容
    edition-v3.js           # 网页使用的完整统一课程
    curriculum-v3.json      # 可审阅的结构化课程
  downloads/
    index.html             # 不依赖JavaScript的PDF目录
    pdf/Day-01.pdf ... Day-21.pdf
    print/Day-01.html ... Day-21.html
    21-daily-pdfs.zip
    21-days-complete-workbook.pdf
    pdf-manifest.json
    personal-growth-lab-source.zip
  tools/
    build_workbooks.py
    build_edition.py
    upgrade_reader.py
    validate_workbooks.py
```

构建环境需要Noto CJK、WeasyPrint和pypdf。开发者可使用：

```bash
python3 tools/upgrade_reader.py
python3 tools/build_edition.py
python3 tools/validate_workbooks.py --browser
```

GitHub Actions自动检查21课、60分钟时间表、100分权重、PDF中文字形嵌入、文件校验、独立打卡页、课程下载、手机/平板/桌面排版和学习记录持久化。生成内容只更新本目录，不替换学术主页或书籍。

## 内容与使用边界

所有情境、示范人物、模拟数据均用于学习，不代表用户的真实经历、研究结果或进步记录。示范不能直接改成自己的成果。自评分是课程设计工具，不是普通话等级考试、临床测评或专业认证；不同课总分不宜直接排名。

普通话发音不确定时，保留“待核验”，结合规范音频或可靠听众确认，不把未经核验的自评当作客观准确率。保持舒适音量；明显疲劳、不适时停止发声，改做默读或复盘。持续不适应寻求专业评估。

本栏目仍位于 `zbyloveyj/zbyloveyj.github.io` 仓库的 `personal-growth-lab/` 目录，并非另一个新建仓库。文件按独立静态项目组织，未来可迁移；课程链接与资源采用相对路径。

---
一心问道 · 2026年10月 · https://zbyloveyj.github.io/
