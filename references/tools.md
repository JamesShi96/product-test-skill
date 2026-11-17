# 各平台怎么测

开测前对要测的每一端跑一次"能用吗"那行命令。缺工具就告诉用户缺什么、怎么装或怎么打开（如 computer-use：「Claude 桌面 App → 设置 → This computer → Computer use」），先测能测的。

命令里的 `<run>` 指本次 run 目录，`<scratchpad>` 指会话的临时目录（没有就用 `<run>/tmp`）。临时安装、编译产物、空的测试目录都放 `<scratchpad>`，不放进被测项目。

## 把截图存成文件

Playwright、adb、simctl 自己就能存文件。Claude in Chrome 和 computer-use 的截图只给你看、不落盘，要存时：

- 截整个屏幕：`screencapture -x <run>/NN-描述.png`（需要终端有"屏幕录制"权限；没有就请用户在系统设置里打开，或在报告里标"会话内所见，未存档"）
- Claude in Chrome 录的 GIF 导出后通常在 `~/Downloads`，移到 run 目录
- 录屏：`screencapture -v -V<秒数> <run>/NN-描述.mov`，到时间自己停

## 停止后台录制和日志

你按不了 Ctrl-C。录屏和日志要么设时长，要么用 SIGINT 停（直接 kill 可能留下放不了的视频）：

- adb 录屏：`adb shell screenrecord --time-limit <秒> /sdcard/r.mp4`
- simctl 录屏：后台跑，结束时 `pkill -INT -f 'simctl io .*recordVideo'`
- 日志：`log stream` 加 `--timeout 10m`；或后台跑，结束时 `pkill -INT -f 'log stream'`

## 网页

| 选择 | 什么时候用 |
|---|---|
| Claude in Chrome | 测自己的产品时首选：用用户自己的 Chrome 和登录态，能录 GIF、看 console 和网络请求。测别人的产品时开无痕窗口或新 profile，不在用户已登录的账号里操作。用前加载它的 skill |
| 内置浏览器 | Chrome 扩展没连上时；测别人产品的"新用户体验"也适合，没有登录态 |
| Playwright 无头浏览器 | 前两个都不行，或交给子代理批量重放时 |

- **能用吗**：列一次标签页（Chrome）；或 `npx playwright --version`
- **手机宽度**：Chrome 里把窗口调到 375 宽；Playwright 用 `devices['iPhone 13']` 模拟
- **Playwright 临时装**：在 `<scratchpad>` 里 `npm i playwright && npx playwright install chromium`，不要装进被测项目
- **Playwright 要接上的**：`page.on('console')`、`page.on('pageerror')`、`page.on('requestfailed')` 和 4xx/5xx 响应都记下来；录屏用 `browser.newContext({ recordVideo: { dir: '<run>' } })`
- **性能和无障碍参考**（可选）：`npx lighthouse <url> --only-categories=performance,accessibility --output=html --output-path=<run>/lighthouse.html`。只当参考，以亲眼看到的为准

## Android（模拟器或真机）

全程能用 adb 命令完成，不需要 computer-use。

- **能用吗**：`adb devices` 至少列出一台；模拟器用 `emulator -list-avds` 看有哪些，`emulator -avd <名字>` 启动。连了多台时每条命令都加 `-s <序列号>`
- **看屏幕和点按**（可选）：`scrcpy` 把手机画面投到 Mac 上，再用 computer-use 操作这个窗口；真机测中文 App 时最省事
- **编译自己的 App**：`cd android && ./gradlew assembleDebug`，apk 在 `app/build/outputs/apk/debug/`；React Native / Expo 的 Debug 包要先在后台起 Metro（`npx react-native start` 或 `npx expo start`），否则会红屏，或者直接打 Release 包
- **装和启动**：`adb install -r app.apk`；`adb shell monkey -p <包名> -c android.intent.category.LAUNCHER 1`
- **打开链接 / 深层链接**：`adb shell am start -a android.intent.action.VIEW -d "<url>"`
- **截图**：`adb exec-out screencap -p > <run>/01.png`
- **录屏**：`adb shell screenrecord --time-limit <秒> /sdcard/r.mp4`（最长 180 秒），再 `adb pull /sdcard/r.mp4 <run>/`
- **找按钮位置**：`adb shell uiautomator dump /sdcard/ui.xml && adb pull /sdcard/ui.xml <run>/`，按元素的 `bounds` 算中心点
- **点按和输入**：`adb shell input tap <x> <y>`；`adb shell input swipe <x1> <y1> <x2> <y2> 300`；`adb shell input text 'hello%sworld'`（`%s` 是空格，只能输英文）。中文：装 ADBKeyBoard 并设为当前输入法后 `adb shell am broadcast -a ADB_INPUT_TEXT --es msg '中文内容'`，或在 scrcpy 窗口里用 computer-use 输入；返回键 `adb shell input keyevent KEYCODE_BACK`
- **日志**：`adb logcat -c` 清空，操作后 `adb logcat -d '*:E' > <run>/logcat.txt`
- **权限**：`adb shell pm revoke <包名> android.permission.CAMERA`（grant 反过来）
- **深色模式、大字体**：`adb shell cmd uimode night yes`；`adb shell settings put system font_scale 1.3`
- **断网**：`adb shell svc wifi disable && adb shell svc data disable`（测完记得 enable）
- **别人的 App**：海外 App 用带 Google Play 的模拟器或真机，用户自己登录商店后安装；国内 App 大多不在 Google Play、不少会拒绝在模拟器上运行，优先用真机，安装包从官网或国内应用商店下载，下载前先问用户

## iOS 模拟器

`xcrun simctl` 能装、启动、截图、录屏、改系统设置，但**不能点按**。点按用 computer-use 操作 Simulator 窗口（用前加载它的 skill，并请用户授权 Simulator）。开了多台模拟器时，用 `xcrun simctl list devices booted` 拿到 UDID，命令里用 UDID 代替 `booted`。

- **能用吗**：`xcrun simctl list devices available`；`xcrun simctl boot "<设备名>" && open -a Simulator`
- **编译自己的 App**：`xcodebuild -scheme <scheme> -destination 'platform=iOS Simulator,name=<设备名>' -derivedDataPath <scratchpad>/build build`，再 `xcrun simctl install booted <scratchpad>/build/Build/Products/Debug-iphonesimulator/<App>.app`。用 CocoaPods 的项目（React Native、Flutter 等）先 `pod install`，并加 `-workspace ios/<名字>.xcworkspace`；React Native 的 Debug 包同样要先起 Metro
- **启动 / 打开链接**：`xcrun simctl launch booted <bundle id>`；`xcrun simctl openurl booted "<url>"`
- **截图**：`xcrun simctl io booted screenshot <run>/01.png`
- **录屏**：`xcrun simctl io booted recordVideo <run>/flow.mp4`，后台跑，停法见开头
- **放测试照片进相册**：`xcrun simctl addmedia booted <照片路径>`
- **权限**：`xcrun simctl privacy booted reset all <bundle id>`（下次重新弹窗）；`revoke photos <bundle id>` 测拒绝后的表现
- **深色模式、大字体**：`xcrun simctl ui booted appearance dark`；`xcrun simctl ui booted content_size accessibility-large`
- **定位、推送**：`xcrun simctl location booted set <纬度>,<经度>`；`xcrun simctl push booted <bundle id> <payload.json>`
- **日志**：`xcrun simctl spawn booted log stream --timeout 10m --predicate 'process == "<App名>" AND messageType == error' > <run>/ios.log`，后台跑
- **项目有 UI 测试**（XCUITest）时，可以照着它的写法补一段测试来重放复现步骤
- App Store 上的 App 装不进模拟器，看下一节

## App Store 上的 iPhone App（别人的 App）

- 用 computer-use 操作 macOS 的「iPhone 镜像」App（要求 macOS 15 以上，iPhone 在旁边、同一 Apple ID、已锁屏）。连接、解锁、下载 App 都请用户自己完成
- 截图、录屏按开头"把截图存成文件"的办法存
- 「iPhone 镜像」里不能用相机；要上传照片时，先请用户在相册里放一张测试图，只选这张
- 没有「iPhone 镜像」时，请用户用手机自己录屏发过来，或只评测网页版和应用商店页

## 小程序

- 自己的：在「微信开发者工具」里用 computer-use 测，模拟器选 iPhone 尺寸；上线前还要在真机预览里走一遍核心旅程
- 别人的：只能在手机微信里打开，走上面的「iPhone 镜像」或 Android 真机

## 桌面应用

- computer-use 操作，用前加载它的 skill，并请用户授权这个 App
- 截图、录屏按开头的办法存
- 日志（macOS）：`log stream --timeout 10m --predicate 'process == "<App名>" AND messageType == error' > <run>/app.log`，后台跑
- 测完关掉再打开一次，看设置和数据还在不在

## 命令行工具

- 在 `<scratchpad>` 里新建空目录测，不在用户的项目目录里乱写文件
- **确认跑的是工作区里的新代码**：用项目环境调用（如 `uv run --project <仓库> <命令>`、`<仓库>/.venv/bin/<命令>`、`node <仓库>/bin/<入口>`），先看一眼 `which <命令>` 和 `--version`；PATH 里的可能是以前装的旧版本
- 每条命令都记退出码：`<命令>; echo "exit=$?"`；stdout 和 stderr 分开存：`<命令> > <run>/out.txt 2> <run>/err.txt`
- 非交互环境：`<命令> < /dev/null | cat`，看会不会卡住等输入、颜色码会不会乱
- 录终端过程：把命令和输出原样存成文本就够，不需要录屏

## API

- 先找文档：`/docs`、`/openapi.json`、README 里的例子，照着例子调一遍
- `curl -sS -i <url>` 看状态码和返回头；每个请求和返回成对存进 `<run>/api/`，**存之前把 token、cookie、密码换成 `***`**
- 认证测不带和带过期的；"带别人的 token、访问别人的数据"只在自己的产品上、用自己建的两个测试账号测
- 别人的 API 只按文档正常调用，不压测、不扫描
