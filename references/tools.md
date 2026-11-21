# 各平台怎么测

开测前对要测的每一端跑一次"能用吗"那行命令。缺工具先看这一端有没有替代路线；都不行再告诉用户缺什么、怎么装或怎么打开（如 computer-use：「Claude 桌面 App → 设置 → This computer → Computer use」），先测能测的。

**自己的 App 的 Debug 包通常连本地开发服务**，那可能是用户正在用的服务和数据。编译时把 API 地址改到隔离环境或一个没人用的端口（看项目怎么配地址：Info.plist、xcconfig、`.env`、build setting）；不需要后端的界面优先用 App 自带的预览 / 演示模式。

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
| Playwright 无头浏览器 | 屏幕被别的测试占着、要没有登录态的干净会话、要并行或交给子代理时首选；前两个都不行时也用它 |

- **能用吗**：列一次标签页（Chrome）；Playwright 要真的启动一次浏览器才算数，`--version` 能跑不代表浏览器装对了：`node -e "require('playwright').chromium.launch().then(b=>b.close()).then(()=>console.log('ok'))"`
- **手机宽度**：Chrome 里把窗口调到 375 宽；Playwright 用 `devices['iPhone SE']`（375×667，`iPhone 13` 是 390 宽）。手机上点按用 `page.touchscreen.tap(x, y)`，`page.mouse` 发的是鼠标事件
- **Playwright 临时装**：在 `<scratchpad>` 里 `npm i playwright && npx playwright install chromium`，不要装进被测项目
- **一步一步地测用 `scripts/pw-driver.js`**：常驻一个无头浏览器，带电脑和手机两个会话，每一步发一段代码过去，自动截图，并带回这一步的 console 报错、失败请求、弹窗和下载。用法写在脚本开头。不要每一步都写一个新脚本从头开浏览器，状态会丢
- **下载**：pw-driver 已经接好（存进 run 目录）。网站用浏览器原生"另存为"（`showSaveFilePicker`）时，无头浏览器里会被取消，用 `PW_NO_FS_PICKER=1` 让它退回普通下载，并在报告里记一条 ENV：真实的保存框没测到
- **浏览器版本对不上**（报 Executable doesn't exist）：`npx playwright install chromium`，或用 `PW_EXE` 指向 `~/Library/Caches/ms-playwright/` 里已有的 `chrome-headless-shell`
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

`xcrun simctl` 能装、启动、截图、录屏、改系统设置，但**不能点按**。点按有两条路：

1. **computer-use** 操作 Simulator 窗口（用前加载它的 skill，并请用户授权 Simulator）。最像真人
2. **XCUITest 代替手指**（没有 computer-use，或要反复重放时）：只能测自己有代码的 App。在临时拷贝里加一个 UI 测试类，按新用户的路径一步步点，每步 `XCUIScreen.main.screenshot()` 存成 PNG 写进 run 目录（目录用 `TEST_RUNNER_<变量名>` 环境变量传给测试）。`xcodebuild build-for-testing` 编一次，之后用 `test-without-building -only-testing:<目标>/<类>/<方法>` 反复跑。**判断看截图，不看测试是否通过**；已有测试的断言不算结论。页面里有 WKWebView 时，不要遍历全部元素（`allElementsBoundByIndex` 会因网页元素变动报 snapshot 错误、整个测试失败），只按 identifier 取要看的元素。测试类里 `continueAfterFailure = true`，一步没找到不影响后面继续截图

下面的命令都用 UDID，不用 `booted`（`xcrun simctl list devices booted` 查）。

- **能用吗**：`xcrun simctl list devices available`；`xcrun simctl boot <UDID> && open -a Simulator`
- **要小屏机测大字体**（checklist 要求的 iPhone SE）：`xcrun simctl list runtimes` 找到 iOS 运行时，`xcrun simctl create PT-SE com.apple.CoreSimulator.SimDeviceType.iPhone-SE-3rd-generation <runtime id>`，测完 `xcrun simctl delete <UDID>`。每次测试新建，不用用户自己的模拟器
- **改动还没提交、又要加临时测试**：先 `rsync -a --exclude build --exclude .git --exclude node_modules <项目>/ <scratchpad>/app-copy/`，在拷贝里改和编译，不碰用户的工作区。用 XcodeGen 的项目在拷贝里 `xcodegen generate`，或把测试方法加进已有的测试文件，免得改工程文件
- **编译自己的 App**：`xcodebuild -project <名字>.xcodeproj -scheme <scheme> -destination 'platform=iOS Simulator,id=<UDID>' -derivedDataPath <scratchpad>/dd -resultBundlePath <scratchpad>/r1.xcresult CODE_SIGNING_ALLOWED=NO build`，再 `xcrun simctl install <UDID> <scratchpad>/dd/Build/Products/Debug-iphonesimulator/<App>.app`。用 CocoaPods 的项目（React Native、Flutter 等）先 `pod install`，并把 `-project` 换成 `-workspace ios/<名字>.xcworkspace`；React Native 的 Debug 包同样要先起 Metro。API 地址按开头说的改掉
- **启动 / 打开链接**：`xcrun simctl launch <UDID> <bundle id>`；`xcrun simctl openurl <UDID> "<url>"`
- **截图**：`xcrun simctl io <UDID> screenshot <run>/01.png`
- **录屏**：`xcrun simctl io <UDID> recordVideo <run>/flow.mp4`，后台跑，停法见开头
- **放测试照片进相册**：`xcrun simctl addmedia <UDID> <照片路径>`。测"从相册里自动挑照片"这类功能时，放一组有对有错的：该挑出的（全身照）和该去掉的（半身、多人、单品图、杂物），看结果挑得对不对
- **权限**：`xcrun simctl privacy <UDID> reset all <bundle id>`（下次重新弹窗）；`revoke photos <bundle id>` 测拒绝后的表现
- **深色模式、大字体**：`xcrun simctl ui <UDID> appearance dark`；`xcrun simctl ui <UDID> content_size accessibility-large`
- **定位、推送**：`xcrun simctl location <UDID> set <纬度>,<经度>`；`xcrun simctl push <UDID> <bundle id> <payload.json>`
- **日志**：`xcrun simctl spawn <UDID> log stream --timeout 10m --predicate 'process == "<App名>" AND messageType == error AND NOT subsystem BEGINSWITH "com.apple.dt"' > <run>/ios.log`，后台跑（XCUITest 驱动时不排除 `com.apple.dt` 会被自动化日志刷屏）
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
