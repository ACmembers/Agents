# 🐾 DeskPet — AI 桌面宠物

<div align="center">

![Version](https://img.shields.io/badge/version-0.2.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey)
![Rust](https://img.shields.io/badge/rust-edition%202021-orange)
![Qt](https://img.shields.io/badge/Qt-6.8-green)

**一个 AI 驱动的原生桌面宠物。常驻桌面，陪你聊天，随情绪变换表情。**

</div>

---

## ✨ 功能

| 功能 | 描述 | 状态 |
|------|------|------|
| 🖥️ **桌面悬浮** | 透明无边框窗口，始终置顶，不遮挡工作区 | ✅ |
| 📌 **边缘吸附** | 拖到屏幕边缘自动隐藏，鼠标靠近恢复 | ✅ |
| 🗣️ **AI 对话** | 支持 5 家 LLM 提供商（Deepseek/OpenAI/Qwen/Moonshot/Zhipu） | ✅ |
| 😊 **8 状态表情** | idle / greeting / thinking / happy / sad / surprised / listening / sleeping | ✅ |
| 🎭 **角色包系统** | 可扩展角色包，manifest.json 驱动，支持自定义人格 + TTS 语音 | ✅ |
| 🔊 **语音合成** | Edge TTS 免费语音合成，支持中日双语，可配置语速/音量 | ✅ |
| 🌐 **联网搜索** | DuckDuckGo 搜索注入 LLM 上下文，关键词自动触发 | ✅ |
| 💾 **对话记忆** | 本地持久化对话记录，按日期存储 | ✅ |
| ⏰ **主动聊天** | 定时技能调度（喝水提醒、随机聊天、问候） | ✅ |
| 🔧 **设置面板** | 可视化设置 API、TTS、搜索、角色切换 | ⚡ |

---

## 🧱 技术栈

| 层 | 技术选型 |
|----|----------|
| 🖼️ **UI** | Qt Quick / QML 6.8 |
| 🦀 **核心** | Rust (edition 2021) |
| 🌐 **HTTP** | reqwest |
| ⚡ **异步** | tokio |
| 💬 **LLM** | OpenAI-compatible API (JSON Mode) |
| 🔍 **搜索** | DuckDuckGo Instant Answer API |
| 🔊 **TTS** | Microsoft Edge TTS (免费) |
| 🔗 **桥接** | JSON 文件桥接 (临时) → qmetaobject (计划中) |

---

## 🏗️ 架构

```
┌────────────────────────────────────────────┐
│  QML Shell (UI Layer)                      │
│  App.qml → PetSurface → ChatBubble/Input  │
│          → SettingsDialog → StateBadge     │
└──────────────┬─────────────────────────────┘
               │ JSON bridge (C:/tmp/deskpet-bridge/)
┌──────────────▼─────────────────────────────┐
│  Rust Core (native-desktop-core)           │
│                                             │
│  app_core ── orchestrates the pipeline     │
│  ├── state       DisplayState + Resolver   │
│  ├── config      ConfigStore + 5 presets   │
│  ├── llm         LlmAdapter + extraction   │
│  ├── conversation  Context management      │
│  ├── search      DuckDuckGo + keyword trig │
│  ├── speech      Edge TTS + fallback       │
│  ├── roles       RolePack/VoicePack loader │
│  ├── memory      Conversation persistence  │
│  └── auto_chat   Proactive chat scheduler  │
└────────────────────────────────────────────┘
```

### 数据流

```
用户输入 → ConversationContext
  → should_search? → DuckDuckGo API
  → build_system_prompt (persona + voice hints + search results)
  → LlmAdapter.send() [JSON Mode]
  → extract_state_and_text()
  → StateResolver.resolve() [validate/throttle/priority]
  → SpeechEngine.synthesize() [Edge TTS → fallback → silent]
  → QML: state.json 轮询更新
```

---

## 🚀 快速开始

### 前置要求

- [Rust](https://www.rust-lang.org/) (MSVC toolchain)
- [Qt 6.8+](https://www.qt.io/download) (含 QML 模块，MinGW 版本)
- LLM API Key（推荐 [Deepseek](https://platform.deepseek.com/)，也支持 OpenAI / Qwen / Moonshot / Zhipu）

### 环境配置

```bash
# 1. 克隆仓库
git clone https://github.com/yourname/deskpet.git
cd deskpet

# 2. 配置 API Key（二选一）
# 方式 A: 环境变量
# 创建 .env 文件:
echo "DEEPSEEK_API_KEY=sk-your-key-here" > .env

# 方式 B: 启动后在设置面板中配置

# 3. 加载 Qt 环境（Windows MinGW）
source env.sh
```

### 构建 & 运行

```bash
# 编译检查
cargo check --workspace

# 运行所有测试（57 个）
cargo test --workspace

# 构建 Release
cargo build --release -p native-desktop

# 运行（Rust 后端会自动启动 QML 前端）
cargo run -p native-desktop

# 或手动启动 QML 前端进行 UI 调试：
C:/Qt/6.8.3/mingw_64/bin/qml.exe native-desktop/ui/qml/App.qml
```

---

## 📁 项目结构

```
deskpet/
├── native-desktop-core/          # 🦀 纯 Rust 核心库（无 Qt 依赖）
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs                # 模块声明
│       ├── state.rs              # DisplayState 枚举 + StateResolver 状态机
│       ├── config.rs             # AppConfig + ConfigStore + 5 提供商预设
│       ├── llm.rs                # LlmAdapter (JSON Mode / SSE / 状态提取)
│       ├── conversation.rs       # ConversationContext 环形缓冲
│       ├── search.rs             # DuckDuckGo 搜索 + 关键词触发
│       ├── speech.rs             # Edge TTS + SSML 合成
│       ├── roles.rs              # RolePack / VoicePack 加载器 + RoleManager
│       ├── app_core.rs           # 中央编排器（搜索→LLM→状态→TTS）
│       ├── memory.rs             # 对话持久化
│       └── auto_chat.rs          # 主动聊天调度器
│
├── native-desktop/               # 🖼️ Qt/QML 壳 + Rust 二进制
│   ├── Cargo.toml                # 依赖 native-desktop-core
│   ├── src/
│   │   └── main.rs               # 入口：启动 QML + JSON 桥接主循环
│   ├── ui/qml/
│   │   ├── App.qml               # 自包含演示版（当前使用）
│   │   ├── Main.qml              # 组件化版本（引用 components/）
│   │   └── components/
│   │       ├── PetSurface.qml    # 宠物图片 + 拖拽 + 点击区域
│   │       ├── ChatBubble.qml    # 聊天气泡（自动消失）
│   │       ├── ChatInput.qml     # 文本输入覆盖层
│   │       ├── SettingsDialog.qml # 完整设置面板（4 标签页）
│   │       └── StateBadge.qml    # 调试状态标签
│   └── assets/roles/
│       ├── default/images/       # 默认角色 8 张 PNG
│       └── sakura/               # 夜乃桜 角色包
│           ├── manifest.json     # 角色定义 + 人格 + TTS 配置
│           ├── images/           # 8 张 PNG
│           └── voice/            # TTS 参考音频
│
├── deskpet-pyside/               # 🐍 PySide6 参考实现（功能最全）
│   ├── main.py                   # QApplication + 托盘
│   ├── ai_client.py              # 5 提供商统一接口
│   ├── pet_window.py             # 透明无边框窗口
│   ├── phoebe_skills.py          # 12 预设技能
│   └── ...
│
├── src/                          # 🔌 Electron/React 原版（已停滞）
│   ├── main/                     # Electron 主进程
│   └── renderer/                 # React UI + Live2D
│
├── management/                   # 📊 独立 React 管理面板
│   └── src/components/           # 设置/角色/模型/对话历史
│
├── docs/
│   ├── superpowers/specs/        # 设计文档
│   └── alternatives/             # 备选方案讨论
│
├── AGENTS.md                     # 架构文档（给 AI 助手）
├── plan.md                       # 整体开发计划
├── plan1.md                      # 原生重写进展说明
├── Cargo.toml                    # Rust workspace 根
├── env.sh                        # Qt + Rust 环境脚本
└── .env                          # API Key（不提交）
```

---

## 🎯 设计原则

- **LLM 只输出状态枚举** — 模型返回 8 种固定状态之一，不直接控制 UI
- **状态机本地化** — StateResolver 负责校验、节流（500ms）、优先级判定
- **角色包可扩展** — 所有角色通过 manifest.json 定义，不写死在代码里
- **降级链无处不在** — TTS 失败 → 纯文本，搜索失败 → 纯 LLM，配置损坏 → 默认值

---

## 🎭 角色包格式

```jsonc
{
  "name": "夜乃桜",
  "images": {
    "idle": "images/idle.png",
    "happy": "images/happy.png",
    // ... 共 8 个状态
  },
  "tts_voice": "ja-JP-NanamiNeural",   // 可选 TTS 覆盖
  "tts_language": "ja",
  "persona": {                          // 可选人格定义
    "identity": "学园最强战力 · 桌面守护者",
    "personality": "冷静、孤高、克制...",
    "speaking_style": "日语为主，短句多...",
    "catchphrases": ["……起きてる？", ...]
  }
}
```

---

## 📊 测试状态

```bash
$ cargo test --workspace
test result: ok. 57 passed; 0 failed; 0 ignored ✅
```

---

## 🗺️ 开发路线

### 已完成 ✅
- [x] Rust 核心引擎（10 模块，57 测试）
- [x] 8 状态 DisplayState + StateResolver 状态机
- [x] 5 家 LLM 提供商预设 + JSON Mode
- [x] Edge TTS 语音合成（中日双语）
- [x] DuckDuckGo 联网搜索
- [x] 角色包 / 语音包加载系统
- [x] 对话记忆持久化
- [x] 主动聊天技能调度器
- [x] QML 透明悬浮窗 + 边缘吸附 + 拖拽
- [x] Rust ↔ QML JSON 文件桥接
- [x] QML 设置面板 UI
- [x] 2 个角色包（default + sakura）

### 进行中 🚧
- [ ] 统一 App.qml 和 Main.qml 两套 QML
- [ ] 音频播放（TTS 生成 MP3 后实际播放）
- [ ] 设置面板与 Rust 后端连线
- [ ] Rust ↔ QML 桥接升级为 qmetaobject
- [ ] 更多角色包内容

### 计划中 📋
- [ ] 跨平台支持（macOS / Linux）
- [ ] 语音克隆（GPT-SoVITS 集成）
- [ ] 应用打包与自动更新
- [ ] 从 PySide6 版迁移更多技能

---

## 🔗 相关文档

- [AGENTS.md](./AGENTS.md) — 完整架构文档
- [plan.md](./plan.md) — 整体开发计划
- [plan1.md](./plan1.md) — 原生重写进展
- [设计文档](./docs/superpowers/specs/2026-06-05-native-state-image-desktop-design.md)

---

## 📄 许可证

[MIT](./LICENSE)

---

<div align="center">
  <sub>用 🦀 + Qt 和 ❤️ 制作</sub>
</div>
