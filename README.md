# product-test

一个 Claude Code Skill：让 Claude 以真实用户的身份体验、测试和评测产品，边用边截图取证，最后给出"能不能用 + 好不好用"的报告。

支持网站、Web 应用、手机 App（iOS / Android / 小程序）、桌面应用、命令行工具、API、浏览器扩展；自己做的产品和别人家的产品都能测。

## 三种模式

| 模式 | 什么时候用 | 产出 |
|---|---|---|
| 局部测试 | 刚改完一个功能、修完一个 bug | 这次改动通过了几条 + 核心功能有没有被带坏 |
| 整体测试 | 上线前、大版本，像新用户一样从头到尾用一遍 | 能不能发 + 问题清单（按严重度） |
| 体验评测 | 别人的产品、拿不到代码、竞品对比 | 值不值得用 + 各维度判断 + 对比表 |

不用记模式名，直接说就行，比如"测一下这次改的""上线前整体测一遍""review 一下这个网站""对比一下 A 和 B 的注册流程"。

## 安装

```bash
git clone https://github.com/JamesShi96/product-test-skill.git ~/.claude/skills/product-test
```

更新：`git -C ~/.claude/skills/product-test pull`

## 用到的工具

按要测的端准备，缺什么 Claude 开测前会先告诉你：

- 网页：Claude in Chrome 扩展，或内置浏览器 / Playwright
- iOS：Xcode（`xcrun simctl`）+ Claude 桌面 App 里打开 Computer use；App Store 上的 App 用 macOS 的「iPhone 镜像」
- Android：Android SDK 的 `adb`（可选 `scrcpy`）
- 桌面应用、小程序开发者工具：Computer use
- 命令行、API：终端即可

## 它会在你的项目里留下什么

- `.product-test/product.md`：产品档案（核心用户旅程、各端测试情况、测试命令、已知问题），可以提交，方便团队共用
- `.product-test/runs/`：每次测试的报告、截图、录屏。目录里自带 `.gitignore`，不会被提交

测没有代码的产品时，这些放在 `~/.product-test/<产品名>/`。

## 文件

- `SKILL.md`：主流程
- `references/checklist.md`：测什么（通用问题、按产品类型的检查项、评测维度）
- `references/tools.md`：各平台的具体命令
- `references/templates.md`：产品档案、测试报告、评测报告、交给子代理的说明
