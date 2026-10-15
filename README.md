# 口袋同传 🎙️

自制手机实时翻译工具。灵感来自对某"智能翻译耳机"App 的逆向分析——结论是**耳机只是蓝牙麦克风+扬声器，翻译全部由手机 App + 云服务完成**。所以这个项目只用一部手机（可连接任意普通蓝牙耳机）实现同样的能力。

**在线使用：** `https://<你的GitHub用户名>.github.io/pocket-translator/`

## ✨ 功能

| 模式 | 说明 |
|---|---|
| 🗣️ **面对面翻译** | 我说中文→手机外放外语；对方说外语→耳机/手机播中文。点「我说 / 对方说」切换说话方，说完一句自动翻译并朗读，点译文可大字展示给对方看 |
| 👂 **倾听模式** | 持续收听周围外语，逐句翻译成你的语言并朗读（旅游、听课、旁听会议） |
| ⌨️ 打字翻译 | 不方便说话时手动输入 |
| 📜 翻译记录 | 全部保存在本机，可回看/复制 |
| 🔊 重听 | 点每条气泡旁的 ↻ 重新朗读 |

## 📱 iPhone 安装（免开发者账号）

1. 用 **Safari** 打开线上地址（必须是 HTTPS）
2. 首次使用允许**麦克风权限**
3. 分享 → **添加到主屏幕**，即可像 App 一样全屏使用
4. 连接任意蓝牙耳机后，声音自动走耳机（麦克风+播放）

> 若主屏幕图标打开后麦克风不可用，回到 Safari 里打开页面使用（个别 iOS 版本对主屏幕 WebApp 的麦克风有限制）。

## ⚙️ 翻译引擎

- **免费通道**（默认）：MyMemory 公共翻译接口，无需注册
- **大模型通道**（可选，更口语化）：设置里填入任意 OpenAI 兼容接口的 Key，内置预设：
  - 智谱 GLM（`glm-4-flash` 免费）
  - DeepSeek
  - 通义千问
  - OpenAI
  - 自定义任意兼容端点

Key 只保存在你自己手机的 localStorage，不经过任何中间服务器。

## 🛠️ 本地开发

```bash
npm install
npm run dev      # 开发
npm run build    # 构建到 dist/
npm run preview  # 本地预览构建产物
```

技术栈：Vite + React + TypeScript + vite-plugin-pwa（离线缓存、可安装）。
语音识别用浏览器原生 Web Speech API（iOS Safari / Chrome 均支持），语音合成用 speechSynthesis，零原生依赖、零后端。

## 🚀 部署（GitHub Pages）

```bash
git init && git add -A && git commit -m "init"
gh repo create pocket-translator --public --source . --push
git subtree push --prefix dist origin gh-pages
gh api -X POST repos/:owner/pocket-translator/pages -f "source[branch]=gh-pages" -f "source[path]=/"
```

改完代码后重新发布：`npm run build && git subtree push --prefix dist origin gh-pages`

## ⚠️ 已知限制

- 语音识别依赖 Safari 的 Web Speech API：需联网，且**首次需点击按钮触发**（系统要求用户手势）
- iOS 后台/锁屏时监听会暂停（Web 应用的系统限制；原生 App 无此限制，见下方路线图）
- 通话中翻译、抓取其他 App 音频在 iOS 上第三方应用无法实现（iOS 26 系统自带「实时翻译」已覆盖电话/FaceTime/信息）
- MyMemory 免费接口每日有匿名额度，超量或追求质量请切换大模型通道

## 🗺️ 路线图（可选升级）

1. **Expo 原生版**：`expo-speech-recognition` + 苹果 `Translation` 框架 + AVSpeechSynthesizer，可后台常驻、锁屏监听、快捷指令启动；用 EAS 云构建（Windows 可开发），TestFlight 或 7 天自签安装
2. 会议纪要：连续转写 + LLM 摘要（对齐原厂"会议记录"模式）
3. 术语热词：自定义词典提升专有名词准确度（对齐原厂"热词"功能）

## 📄 相关文档

- [逆向分析报告（为什么耳机不是必需品）](../逆向分析报告-爱说派APP.md)

## License

MIT
