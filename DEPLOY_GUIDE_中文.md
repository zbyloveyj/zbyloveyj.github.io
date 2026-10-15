# 朱宝圆个人学术主页 V3 · GitHub Pages 上线说明

本网站完全独立于《看不见的文明》小说网站，不会修改已有仓库。计划地址为 **https://zbyloveyj.github.io/**，但在新仓库建立及部署成功之前，这个地址不能视为已发布网站。

## 一次性操作

1. 打开 https://github.com/new?name=zbyloveyj.github.io 。
2. Owner 选择 `zbyloveyj`；Repository name 填写 `zbyloveyj.github.io`；Visibility 选择 **Public**；创建仓库。
3. 回到聊天告诉我“仓库建好了”，便可以通过已经连接的 GitHub 工具继续提交源码；也可以自行上传 ZIP 解压后的**内部文件**（`index.html`、`assets/`、`.github/`等），不要只上传 ZIP。
4. 进入 **Settings → Pages → Build and deployment**，选择 **GitHub Actions** 作为 Source（若已配置可跳过）。
5. 上传到 `main` 分支后，`Deploy academic homepage to GitHub Pages` 将验证文件和论文数据、发布静态网站。
6. 在 Actions 中确认运行成功，再分别打开：首页、`/research.html`、`/publications.html`、`/projects.html`、`/cv.html`。

## 最新目录

- 首页：`index.html`
- 研究：`research.html`
- 论文：`publications.html`
- 开放项目：`projects.html`
- 英文简历：`cv.html` 和 `assets/Baoyuan_Zhu_Academic_CV.pdf`
- BibTeX：`assets/Baoyuan_Zhu_Selected_Publications.bib`
- RIS：`assets/Baoyuan_Zhu_Selected_Publications.ris`
- 数据编辑：`assets/data.js`

## 学术规范和数据保护

论文均有 DOI 与已知正式发表信息，研究阶段项目单独标记。已公开的 10 篇精选成果不等于所有 SCI 成果；历史 SCI 数量来源于 2026 年 10 月的学术简历，后续应定期更新。网站不展示生日、电话号码、身份证、家庭住址和未获公开许可的研究数据。

## 界面核查

已对首页、研究页、论文页、开源项目页和 CV 页，在 360/390/768/1024/1440 像素宽度进行浏览器测试；测试包括横向溢出、JavaScript 异常、论文年份筛选、中英文切换、日夜模式和移动端菜单。自动检查不能取代真实手机设备的最后一轮触摸操作测试。

## 后续建议

- 替换为授权的正式学术头像（当前网页采用排版标识，不必暴露个人生活照片）。
- 如果有 Google Scholar / ResearchGate 或个人高校教师主页的官方链接，可补充到 ORCID/GitHub 旁边；未经确认不添加。
- 每次新论文上线，优先核对 DOI、正式期刊版本和作者贡献声明，然后更新 `assets/data.js` 和 `.bib/.ris`。
- 如未来有独立研究代码或科研博客，可在 Projects 页面增加链接，保留发布状态和适用边界。
