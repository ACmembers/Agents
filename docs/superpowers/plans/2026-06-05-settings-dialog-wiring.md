# 设置面板与 Rust 后端连线 — 实施方案

## Context

当前 DeskPet 项目的 QML 设置面板 (`SettingsDialog.qml`) 已经写好 UI，但完全不与 Rust 后端通信。Rust 的 `AppConfig` 包含完整的配置结构（API、TTS、搜索、显示等），但 QML 端无法读取或修改。需要建立一个双向设置同步通道，使用现有的 JSON 文件桥接机制 (`C:/tmp/deskpet-bridge/`)，让用户可以通过图形界面配置所有参数。

**目标：** 用户在 QML 中打开设置 → 看到当前 Rust 配置 → 修改并保存 → Rust 应用新配置并重建适配器。

---

## 设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 触发方式 | 右键点击宠物 | 不占视觉空间，符合桌面宠物的交互习惯 |
| 桥接协议 | 新增 action: `load_config` / `save_config` | 统一复用 `input.json` 通道 |
| 配置传输 | 新增 `config.json` 桥接文件 | 与 `state.json` 分离，避免混淆 |
| QML 文件 | 扩展 `App.qml`（自包含版） | 这是当前实际运行的文件 |
| 角色切换 | SettingsDialog 中显示为只读标签 | 角色切换逻辑复杂，先保持只读 |

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `native-desktop-core/src/app_core.rs` | 新增 `apply_config()` 方法 |
| `native-desktop/src/main.rs` | 扩展 bridge 协议，处理 settings action |
| `native-desktop/ui/qml/App.qml` | 集成 SettingsDialog，右键触发，读写 bridge |

---

## 实施步骤

### Step 1: AppCore 新增 `apply_config()` 方法

**文件：** `native-desktop-core/src/app_core.rs`

在 `impl AppCore` 块中，`save_config()` 方法之后，新增：

```rust
/// Apply a full config from QML settings, rebuild adapters, and persist.
pub fn apply_config(&mut self, mut config: AppConfig) -> anyhow::Result<()> {
    // Preserve API key if QML sent empty (masked in UI)
    if config.api.api_key.is_empty() {
        config.api.api_key = self.config.api.api_key.clone();
    }
    self.config = config;
    self.search_adapter = SearchAdapter::from_config(&self.config.search);
    self.llm_adapter = LlmAdapter::new(&self.config.api);
    self.conversation = ConversationContext::new(self.config.persona.memory_size);
    self.config_store.save(&self.config)
}
```

**关键逻辑：** 如果 QML 传来的 API key 为空（用户在设置中没有修改密码字段），保留原有的 key。这是因为密码字段在 UI 中以 `echoMode: TextInput.Password` 显示，用户不修改时返回空。

同时需要添加 `use crate::conversation::ConversationContext;` 和 `use crate::search::SearchAdapter;` 的 import（检查是否已有）。

---

### Step 2: 扩展 Rust 桥接协议

**文件：** `native-desktop/src/main.rs`

#### 2a. 扩展 `UserInput` 结构体

```rust
#[derive(Clone, Debug, Serialize, Deserialize)]
struct UserInput {
    message: String,
    action: String, // 新增: "load_config" | "save_config"
    zone: String,
    switch_to: String,
    #[serde(default)]
    settings: Option<serde_json::Value>, // 新增: QML settings 对象
}
```

#### 2b. 新增 `write_config()` 函数

```rust
fn write_config(core: &AppCore) {
    ensure_bridge_dir();
    let config_json = serde_json::json!({
        "apiKey": core.config.api.api_key,
        "activeProvider": core.config.api.active_provider,
        "model": core.config.api.model,
        "temperature": core.config.api.temperature,
        "language": core.config.tts.language,
        "ttsVoice": core.config.tts.voice_name,
        "ttsSpeed": core.config.tts.speed,
        "ttsVolume": core.config.tts.volume,
        "searchEnabled": core.config.search.enabled,
        "activeRole": core.role_manager.active_role_pack()
            .map(|r| r.name.clone())
            .unwrap_or_else(|| "默认".into()),
    });
    if let Ok(json) = serde_json::to_string_pretty(&config_json) {
        fs::write(bridge_path("config.json"), json).ok();
    }
}
```

#### 2c. 新增 `apply_settings()` 函数

```rust
fn apply_settings(core: &mut AppCore, settings: &serde_json::Value) -> anyhow::Result<()> {
    let mut config = core.config.clone();

    if let Some(v) = settings.get("apiKey").and_then(|v| v.as_str()) {
        if !v.is_empty() {
            config.api.api_key = v.to_string();
        }
    }
    if let Some(v) = settings.get("activeProvider").and_then(|v| v.as_str()) {
        config.api.active_provider = v.to_string();
    }
    if let Some(v) = settings.get("model").and_then(|v| v.as_str()) {
        config.api.model = v.to_string();
    }
    if let Some(v) = settings.get("temperature").and_then(|v| v.as_f64()) {
        config.api.temperature = v;
    }
    if let Some(v) = settings.get("language").and_then(|v| v.as_str()) {
        config.tts.language = v.to_string();
    }
    if let Some(v) = settings.get("ttsVoice").and_then(|v| v.as_str()) {
        config.tts.voice_name = v.to_string();
    }
    if let Some(v) = settings.get("ttsSpeed").and_then(|v| v.as_f64()) {
        config.tts.speed = v;
    }
    if let Some(v) = settings.get("ttsVolume").and_then(|v| v.as_u64()) {
        config.tts.volume = v as u8;
    }
    if let Some(v) = settings.get("searchEnabled").and_then(|v| v.as_bool()) {
        config.search.enabled = v;
    }
    // activeRole is read-only in UI, but accept if sent
    if let Some(v) = settings.get("activeRole").and_then(|v| v.as_str()) {
        if !v.is_empty() {
            config.display.active_role_pack = v.to_string();
        }
    }

    core.apply_config(config)
}
```

#### 2d. 主循环中新增 action 处理

在 `match input.action.as_str()` 块中，`"chat"` 分支之前，新增：

```rust
"load_config" => {
    let c = core.lock().unwrap();
    write_config(&c);
}
"save_config" => {
    let mut c = core.lock().unwrap();
    if let Some(ref settings) = input.settings {
        match apply_settings(&mut c, settings) {
            Ok(()) => {
                log::info!("[DeskPet] Settings saved successfully");
                write_config(&c);
            }
            Err(e) => {
                log::error!("[DeskPet] Failed to save settings: {e}");
            }
        }
    }
}
```

#### 2e. 启动时写入初始配置

在 `write_state(&c, "", false);` 之后，新增：

```rust
write_config(&c);
```

---

### Step 3: QML App.qml 集成 SettingsDialog

**文件：** `native-desktop/ui/qml/App.qml`

#### 3a. 添加 import

在文件顶部已有 import 后添加：

```qml
import QtQuick.Dialogs
```

#### 3b. 在 Window 根级别添加 SettingsDialog 实例

在 `Component.onCompleted` 之前添加：

```qml
SettingsDialog {
    id: settingsDialog
    onSettingsChanged: function(settings) {
        var payload = JSON.stringify({
            action: "save_config",
            message: "",
            zone: "",
            switch_to: "",
            settings: settings
        });
        var xhr = new XMLHttpRequest();
        xhr.open("PUT", "file:///C:/tmp/deskpet-bridge/input.json", false);
        xhr.send(payload);
    }
    onOpened: {
        // Read config from bridge before showing
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "file:///C:/tmp/deskpet-bridge/config.json", false);
        try { xhr.send(); } catch(e) { return; }
        try {
            var cfg = JSON.parse(xhr.responseText);
            root.apiKey = cfg.apiKey || "";
            root.activeProvider = cfg.activeProvider || "deepseek";
            root.model = cfg.model || "deepseek-chat";
            root.temperature = cfg.temperature || 0.7;
            root.language = cfg.language || "zh";
            root.ttsVoice = cfg.ttsVoice || "zh-CN-XiaoxiaoNeural";
            root.ttsSpeed = cfg.ttsSpeed || 1.0;
            root.ttsVolume = cfg.ttsVolume || 80;
            root.searchEnabled = cfg.searchEnabled !== undefined ? cfg.searchEnabled : true;
            root.activeRole = cfg.activeRole || "默认";
        } catch(e2) {}
    }
}
```

**注意：** 需要在 App.qml 的 Window 根级别声明与 SettingsDialog 对应的属性，或者在 onOpened 中直接设置 `settingsDialog.apiKey = cfg.apiKey` 而非 `root.apiKey`。

正确的做法是直接在 onOpened 中设置 settingsDialog 的属性：

```qml
SettingsDialog {
    id: settingsDialog
    onSettingsChanged: function(settings) { /* 同上 */ }
    onOpened: {
        // 先请求 Rust 写入最新 config
        var req = new XMLHttpRequest();
        req.open("PUT", "file:///C:/tmp/deskpet-bridge/input.json", false);
        req.send(JSON.stringify({action:"load_config",message:"",zone:"",switch_to:""}));
        // 等待一小段时间让 Rust 写入
        // 然后读取
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "file:///C:/tmp/deskpet-bridge/config.json", false);
        try { xhr.send(); } catch(e) { return; }
        try {
            var cfg = JSON.parse(xhr.responseText);
            settingsDialog.apiKey = cfg.apiKey || "";
            settingsDialog.activeProvider = cfg.activeProvider || "deepseek";
            settingsDialog.model = cfg.model || "deepseek-chat";
            settingsDialog.temperature = cfg.temperature || 0.7;
            settingsDialog.language = cfg.language || "zh";
            settingsDialog.ttsVoice = cfg.ttsVoice || "zh-CN-XiaoxiaoNeural";
            settingsDialog.ttsSpeed = cfg.ttsSpeed || 1.0;
            settingsDialog.ttsVolume = cfg.ttsVolume || 80;
            settingsDialog.searchEnabled = cfg.searchEnabled !== undefined ? cfg.searchEnabled : true;
            settingsDialog.activeRole = cfg.activeRole || "默认";
        } catch(e2) {}
    }
}
```

#### 3c. 右键触发设置

修改宠物 MouseArea，添加 `acceptedButtons`：

```qml
MouseArea {
    anchors.fill: parent
    acceptedButtons: Qt.LeftButton | Qt.RightButton
    // ... 现有属性 ...
    
    onClicked: mouse => {
        if (mouse.button === Qt.RightButton) {
            settingsDialog.open();
            return;
        }
        // 原有左键单击逻辑
        petImage.stateName = states[Math.floor(Math.random()*states.length)];
    }
    
    // 原来的 onReleased 逻辑需要调整：
    onReleased: m => {
        if (d) root.snapToEdge();
        // 左键单击的随机状态切换移到 onClicked 中
        d = false;
    }
}
```

**注意：** 需要调整点击逻辑。当前用 `onPressed/onReleased` 实现拖拽 + 单击。右键触发不应干扰拖拽判断。更安全的做法是在 `onReleased` 中检查鼠标按钮：

```qml
onReleased: m => {
    if (d) {
        root.snapToEdge();
    } else if (m.button === Qt.RightButton) {
        settingsDialog.open();
    } else {
        petImage.stateName = states[Math.floor(Math.random()*states.length)];
    }
    d = false;
}
```

但 MouseArea 的 `onClicked` 对右键更准确。最终方案使用 `onClicked` 处理右键：

```qml
onClicked: mouse => {
    if (mouse.button === Qt.RightButton) {
        // 先请求 Rust 写入最新配置
        var req = new XMLHttpRequest();
        req.open("PUT", "file:///C:/tmp/deskpet-bridge/input.json", false);
        req.send(JSON.stringify({action:"load_config",message:"",zone:"",switch_to:""}));
        // 等待 Rust 处理（200ms 轮询 + 处理时间）
        waitTimer.settingsTarget = "open";
        waitTimer.restart();
    }
}
```

由于 QML 的同步 XMLHttpRequest 不能真正等待 Rust 的异步处理，需要一个短暂的延迟机制。更简单的方案是利用 `onOpened` 中已经有的 load_config 请求 + 同步读取，配合 `onVisibleChanged`：

实际上在 Dialog 的 `onVisibleChanged` 或 `onOpened`（QtQuick.Dialogs 的 Dialog 在 Qt 6 中没有 onOpened 信号...需要验证）。

**最终简化方案：** 在 SettingsDialog 的 `onAboutToShow` 中发 load_config 请求，然后用一个短暂的 BusyIndicator。但由于 App.qml 的 SettingsDialog 引用需要实际存在，让我们采用最稳妥的方式：

1. 右键点击时，发送 `load_config` 到 input.json
2. 延迟 300ms 后（给 Rust 处理时间），打开 settingsDialog
3. settingsDialog 的 `onVisibleChanged` 中读取 config.json 并填充

```qml
// 右键点击时
onClicked: mouse => {
    if (mouse.button === Qt.RightButton) {
        var req = new XMLHttpRequest();
        req.open("PUT", "file:///C:/tmp/deskpet-bridge/input.json", false);
        req.send(JSON.stringify({action:"load_config",message:"",zone:"",switch_to:""}));
        settingsLoadTimer.restart();
    }
}

// 延迟加载定时器
Timer {
    id: settingsLoadTimer
    interval: 350  // Rust 200ms poll + 150ms processing
    repeat: false
    onTriggered: {
        // 读取 config.json
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "file:///C:/tmp/deskpet-bridge/config.json", false);
        try { xhr.send(); } catch(e) { return; }
        try {
            var cfg = JSON.parse(xhr.responseText);
            settingsDialog.apiKey = cfg.apiKey || "";
            settingsDialog.activeProvider = cfg.activeProvider || "deepseek";
            settingsDialog.model = cfg.model || "deepseek-chat";
            settingsDialog.temperature = cfg.temperature || 0.7;
            settingsDialog.language = cfg.language || "zh";
            settingsDialog.ttsVoice = cfg.ttsVoice || "zh-CN-XiaoxiaoNeural";
            settingsDialog.ttsSpeed = cfg.ttsSpeed || 1.0;
            settingsDialog.ttsVolume = cfg.ttsVolume || 80;
            settingsDialog.searchEnabled = cfg.searchEnabled !== undefined ? cfg.searchEnabled : true;
            settingsDialog.activeRole = cfg.activeRole || "默认";
        } catch(e2) {}
        settingsDialog.open();
    }
}
```

#### 3d. 保存设置后的状态更新

当用户点击 OK 保存设置后，Rust 已应用新配置。QML 需要刷新状态显示。在 `onSettingsChanged` 发送保存请求后，添加状态刷新逻辑（bridgeTimer 会在下一个周期自动更新 state.json）。

---

### Step 4: 处理 SettingsDialog 依赖的 QML 模块

`SettingsDialog.qml` 使用了：
- `import QtQuick.Controls` (ComboBox, TextField, Slider, Switch, GroupBox, Label, Button, ScrollView)
- `import QtQuick.Layouts` (ColumnLayout, RowLayout)
- `import QtQuick.Dialogs` (Dialog)

这些模块在 Qt 6.8.3 MinGW 安装中已验证存在。`App.qml` 需要添加相应的 import。

---

### Step 5: 编译验证与测试

```bash
# 1. 编译检查
cargo check --workspace

# 2. 运行核心测试
cargo test -p native-desktop-core

# 3. 运行完整测试
cargo test --workspace

# 4. 手动验证流程
# - 启动应用
# - 右键点击宠物 → 设置对话框弹出
# - 修改 API provider 为 openai
# - 修改 temperature 为 1.0
# - 点击 OK
# - 检查 C:/tmp/deskpet-bridge/config.json 内容是否更新
# - 检查 ~/.deskpet/config.json 是否持久化
# - 再次右键打开设置，确认值已保存
```

---

## 验证清单

- [ ] `cargo check --workspace` 无错误
- [ ] `cargo test --workspace` 全部通过 (57 tests)
- [ ] 右键宠物弹出设置对话框
- [ ] 设置对话框显示当前 Rust 配置（API provider, model, temperature, TTS 等）
- [ ] 修改 API provider 后点击 OK，Rust 日志显示 "Settings saved successfully"
- [ ] 再次打开设置，确认修改后的值已保存
- [ ] 检查 `~/.deskpet/config.json` 文件内容正确
- [ ] 空 API key 不会被覆盖（密码字段保护）
- [ ] 设置对话框 Cancel 不保存更改
- [ ] 原有聊天功能不受影响
