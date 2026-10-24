# 完蛋！我被四班同学包围了

手绘手账风格的校园剧情小游戏。包含张正、曲嘉华、李逸鸿和徐一鸣的互动，以及不同选择和结局。剧情和朋友圈文案为虚构创作，照片仅作角色配图。

## 本次更新

- 好感度改为醒目的四人卡片，显示“当前数值 / 100”与进度条，初始 0 分也可见；滚动剧情时固定在顶部。
- 增加水彩爱心 CG，在三处告白得到回应时展示，并附轻微的爱心飘动。友情及慢慢了解的选择不会误触发。
- 全新装订手记界面：打孔纸页、铅笔双线描边、胶带相纸、手绘人物头像和编号便签。
- 首页只保留一个“开始游戏”，取消所有特别篇直达入口。
- 157 个剧情节点整合成连续流程：初见 → 四班日常 → 运动会 → 风把心事告诉你 → 画册里的你 → 朋友圈之外 → 四班尾声。
- 保留所有剧情分支。每章的不同结果会自动接入下一章，尾声汇总本次收录的故事。
- 四位角色的好感度贯穿全篇，只有全篇结束后重新开始才会重置。

## 下载与运行

发布文件位于 `dist/`，也可从 [GitHub Releases](https://github.com/FlynnYu2011/ohno_dhses4/releases) 下载。

- [Windows EXE](https://github.com/FlynnYu2011/ohno_dhses4/releases/download/v1.2.2/ohno_dhses4.exe)
- [单文件 HTML](https://github.com/FlynnYu2011/ohno_dhses4/releases/download/v1.2.2/ohno_dhses4.html)
- [Android APK](https://github.com/FlynnYu2011/ohno_dhses4/releases/download/v1.2.2/ohno_dhses4.apk)
- [源码包](https://github.com/FlynnYu2011/ohno_dhses4/releases/download/v1.2.2/ohno_dhses4-source.zip)

| 文件 | 使用方式 |
| --- | --- |
| `ohno_dhses4.html` | 单文件离线版，已内嵌全部照片和视频。用较新的 Edge、Chrome 或 Safari 打开。 |
| `ohno_dhses4.exe` | Windows x64 独立窗口版，需要 .NET Framework 4.6.2 或更新版本，以及 Microsoft Edge WebView2 Runtime。无需管理员权限。 |
| `ohno_dhses4.apk` | Android 8.0 及以上的本地测试签名版，建议更新 Android System WebView。离线运行，无网络、相机或通讯录权限。 |

Windows EXE 为单文件应用，首次启动会把内嵌游戏资源解压到 `%LOCALAPPDATA%\OhnoDhses4\`。它依赖系统 WebView2，不包含独立 Chromium 内核，也未进行 Windows 商业代码签名。若缺少运行时，可安装 [Microsoft WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)，或使用 HTML 版。

APK 使用项目本地测试密钥签名，尚未上传应用商店。若要长期发布可持续升级的正式 Android 版本，应保留自己的发布签名密钥；新生成的测试密钥不能覆盖另一把密钥签名的已安装版本。

目前通过了脚本逻辑检查、资源检查、Windows 编译与解包验证，以及 APK 编译、结构和签名校验；尚未完成 Windows 窗口运行及 Android 真机安装测试。

## 从源码运行

直接打开 `dhses4.html`。同目录的图片和视频必须一起保留。此版本不保存跨启动进度；章节推进保留当前会话的好感度，全篇结束后重新开始会重置本次手记。

## 构建三个版本

在 Windows PowerShell 7 环境中，准备 Node.js 以及系统自带的 .NET Framework C# 编译器：

```powershell
node scripts/verify-game.cjs
./scripts/setup-build-tools.ps1
./scripts/build-all.ps1
```

工具下载自 Microsoft、Google 和官方 NuGet 源，仅安装到项目内的 `.build-tools/`。Android SDK ZIP 按官方包索引校验 SHA-1，JDK 按 Microsoft 校验文件核对 SHA-256。构建脚本优化发布图片的尺寸，保留源码目录里的原始文件；为兼容 Android 打包器，发布资源采用 ASCII 文件名。

Android 使用 JDK 17、Android SDK 35 的 `javac`、`d8`、`aapt`、`zipalign` 和 `apksigner` 编译，无第三方 Android 运行时框架。Windows 使用 Microsoft WebView2 SDK 1.0.4314.35。

`node scripts/verify-game.cjs` 检查从唯一入口出发的全部节点可达性、93 个选择事件、章节不会倒退或跳过、篇章结果自动衔接、尾声收录与重新开始、媒体引用、朋友圈切换和好感度上限。它不代替浏览器视觉测试或真机测试。

## GitHub 发布

仓库目标名称：`ohno_dhses4`。`.github/workflows/release.yml` 支持手动构建；推送 `v*` 标签后，会在成功构建后创建 GitHub Release，附带 HTML、EXE、APK 和 SHA-256 校验文件。

仓库不得提交 `.build-tools/`、临时构建目录或本地签名密钥。若以后使用正式签名，请把密钥放入仓库 Secrets，并更新签名步骤。

构建参考：[WebView2 官方文档](https://learn.microsoft.com/microsoft-edge/webview2/)、[Android 命令行构建工具](https://developer.android.com/build/building-cmdline)。

