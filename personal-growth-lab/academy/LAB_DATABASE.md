# 科研环境证据库维护

公开入口：`labs.html`。内容数据：`data/labs.json`。每日网页巡检：`data/lab-monitor.json`。

## 内容复核

优先美国、英国、瑞士、德国、荷兰。覆盖计算神经科学、脑机接口、神经影像、AI生物医学、计算生物学、AI Virtual Cell（AIVC）、单细胞/空间组学与前沿生物信息学。AIVC需说明是直接项目、扰动方法还是图谱/评估支撑，不泛化为已能模拟完整细胞。

每组保留稳定id、当前任职、核心问题、跨年度至少两篇代表作（标研究/方法/综述/预印本）、技术平台、能力衔接、技能缺口、起步项目、适配边界、博士后与访问/联合培养分别核验、官方URL和逐条内容核验日期。代表作不是完整产出计量；适配是编辑推断，不是导师评价。

机会只有三种编辑状态：`recruiting`（明确博士后招聘且无关闭/过期证据）、`inquiry`（明确欢迎主动申请/潜在项目咨询）、`unknown`。仅有联系方式不足以标咨询；旧公告不算当前岗位；普通博士入学或硕士项目不等于博士联合培养。无截止日期必须明示名额未确认。

实际打开来源并核对内容后才更新对应`verifiedAt`，不得以HTTP 200或自动抓取刷新内容日期。修改说明写入`history`；下架机会保留旧证据和原因。若同一天再次复核，可将`verifiedAt`写为ISO日期时间，以重置变化基线。页面显示内容日期超过30天、截止日期已过、机会页变化或读取失败时，当前机会降为未知/待复核，历史核验结论仍可读。其他研究来源变化单独提示。第一轮成功抓取只建立机器基线，不证明与编辑复核时文本一致。

## 自动巡检

`.github/workflows/lab-evidence-monitor.yml` 每天UTC22:17（北京时间06:17）运行；首次编辑数据push和手动dispatch也触发。GitHub计划任务可能延迟。官方HTML正文去掉脚本/样式/导航后计算SHA256，保存基线和最后成功时间，不保存网页全文。变化相对于最近内容复核基线持续保留，失败不会覆盖成功记录；无LLM关键词自动判定岗位。403/验证码是读取失败，不能当岗位关闭。

监测工作流只能提交公共`lab-monitor.json`。GITHUB_TOKEN产生的commit通常不触发Pages构建，因此页面从公开raw GitHub拉取最新monitor并与站点内副本比较，取最近成功发布的检查批次；两个入口都不可用时诚实提示。检查时间超过3天会警示。`labs.json`仍随常规编辑提交由现有Pages流水线发布，不创建竞争的Pages部署工作流。

每周内容研究任务由ChatGPT定期任务执行：复核存量、发现候选、核准后提交公开数据。定期任务的账户信息、任务ID、私人背景和申请进度不写仓库。自动任务失败时保留旧内容与日期，页面30天失效保护继续有效。GitHub对长期无活动公共库可能暂停schedule，需在Actions查看运行状态并恢复；每周经过核验的内容维护可保持仓库活跃。

## 验证与兼容

运行 `python personal-growth-lab/academy/tools/test_labs.py`、`node personal-growth-lab/academy/tools/check_workbook.cjs`、`node --check personal-growth-lab/academy/assets/labs.js`，以及浏览器`tools/test_labs_browser.cjs`（BASE_URL指向academy目录）。新筛选/比较不读写localStorage、不上传数据。12个career单元、839总单元、课程id、任务数量、storage key与记录schema不改。只给原单元增补真实证据入口和练习，虚构教学范例仍明确标注。正式申请或联系导师不由监测任务自动执行。
