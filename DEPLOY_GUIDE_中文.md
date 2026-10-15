# 朱宝圆个人学术主页 V3 · GitHub Pages 维护说明

**发布状态：** 已于2026年10月15日提交网站源码至公开仓库 [zbyloveyj/zbyloveyj.github.io](https://github.com/zbyloveyj/zbyloveyj.github.io)；GitHub Pages 的自动部署与校验均已成功完成。

**网站地址：** https://zbyloveyj.github.io/

**构建记录：** https://github.com/zbyloveyj/zbyloveyj.github.io/actions/runs/38733330834

网站与《看不见的文明》及其他科研仓库相互独立。部署前仓库原有的 README 已归档到 `archive/README_before_academic_homepage.md`，未丢弃。

## 后续如何更新

1. 修改对应网页或 `assets/` 中的代码与数据文件。
2. 将修改提交到此仓库的 `main` 分支。
3. `.github/workflows/deploy.yml` 会自动检查论文数据、文件链接和脚本语法，然后重新发布网站。
4. 在 [Actions](https://github.com/zbyloveyj/zbyloveyj.github.io/actions) 确认构建完成，打开首页和各个栏目检查实际效果。如遇缓存延迟，可用无痕窗口重新访问。

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
