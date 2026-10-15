# GitHub 原生个人主页部署指南

这里的文件是已制作完成的 Profile README。**这不是另一个独立网页模板。**

## 为什么必须有一个特殊仓库

GitHub 只会在账号 `zbyloveyj` 的**公开同名仓库** `zbyloveyj/zbyloveyj` 中读取仓库根目录的 `README.md`，并把内容显示在 https://github.com/zbyloveyj 的 Overview 顶部。

目前存在的 `zbyloveyj.github.io` 仓库负责独立学术网站，不能自动充当 Profile README 的仓库。

## 创建方式

打开 https://github.com/new?name=zbyloveyj 并创建名为 `zbyloveyj` 的 **Public** 仓库，选择 **Add a README file**。

完成这一次账户侧操作后，重新在 ChatGPT 告诉助手“Profile 仓库创建好了”，就可以直接将这里的 `README.md` 和 `assets/` 两幅 SVG 通过已连接的 GitHub 写入新仓库。

## 文件用途

- `README.md`：GitHub Profile 个人展示正文，含中文和英文。
- `assets/profile-banner-dark.svg`：GitHub 暗色模式专用横幅。
- `assets/profile-banner-light.svg`：GitHub 浅色模式专用横幅。
- `index.html` / `preview.css`：用于审阅的静态模拟网页；不需上传至特殊仓库根目录。

## 使用边界

GitHub Markdown README 无法运行自定义 JavaScript，因此不能在 Profile README 内做真正的中英文切换按钮；展示使用双语并列。独立学术网站支持交互式语言切换。GitHub 左侧原生 Bio、头像和 Popular repositories 的置顶仓库顺序，需要在 GitHub 自己的界面调整。
