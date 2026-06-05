# TTS 音频播放 — 实施方案

## Context

Rust 核心的 TTS 链路已经完全打通：`AppCore::process_user_input()` → `SpeechEngine::speak_to_file()` → Edge TTS API → MP3 文件写入 `%TEMP%/deskpet-tts/tts_{uuid}.mp3`。`ProcessResult.audio_path` 已经返回了文件路径。

**但 MP3 文件生成后没有任何播放。** 用户听不到宠物的声音，语音对话这个核心体验是断裂的。

当前 `main.rs` 中 `audio_path` 字段被硬编码为 `None`，实际上 AppCore 返回的 `result.audio_path` 从未被使用。

## 目标

- LLM 回复文本 → TTS 合成 MP3 → **自动播放音频**
- 播放不阻塞主循环（异步/后台线程）
- 播放完成后自动清理临时 MP3 文件
- 纯 Rust 方案，不依赖 QtMultimedia（当前未安装）

## 技术选型：rodio + symphonia

### 为什么是 rodio？

| 方案 | 依赖 | 平台支持 | 控制力 | 复杂度 |
|------|------|----------|--------|--------|
| **rodio + symphonia** | 纯 Rust | Win/Mac/Linux | ✅ 完整 | 低 |
| QtMultimedia | Qt 6.8 模块 | 需要安装 | ✅ 完整 | 需要重装 Qt |
| 系统命令 (`cmd /c start`) | 无 | Windows only | ❌ 无法控制 | 最低 |
| cpal 直接 | 纯 Rust | 全平台 | ⚠️ 需手写解码 | 高 |

**rodio** 是 Rust 生态最成熟的音频播放库：
- 后端用 `cpal` → Windows 上走 WASAPI，低延迟
- 解码用 `symphonia` → 纯 Rust MP3/OGG/WAV/FLAC 解码，零 C 依赖
- API 极简：`Sink::try_new()` → `sink.append(source)` → 自动播放
- 不阻塞：内部有独立音频线程，`sink.sleep_until_end()` 可选

### 为什么不用 QtMultimedia？

当前 Qt 6.8.3 MinGW 安装中不包含 QtMultimedia 模块。重装 Qt 不仅耗时，还会引入不必要的构建复杂度。rodio 方案只需在 `Cargo.toml` 加两行依赖。

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `native-desktop/Cargo.toml` | 新增 `rodio` 和 `symphonia` 依赖 |
| `native-desktop/src/main.rs` | 播放逻辑 + `audio_path` 连线 |

仅 2 个文件，改动集中在 `native-desktop` 壳层，核心库 `native-desktop-core` 不动。

## 实施方案

### Step 1: 添加依赖

**文件：** `native-desktop/Cargo.toml`

在 `[dependencies]` 末尾添加：

```toml
rodio = { version = "0.20", features = ["symphonia"] }
```

`symphonia` feature 会自动引入 `symphonia` 全家桶（`symphonia-core`, `symphonia-format-mp3`, `symphonia-codec-mp3` 等），支持 MP3 解码。

> rodio 0.20 使用 symphonia 作为默认解码后端。只需要这一个依赖即可同时获得音频输出和 MP3 解码能力。

### Step 2: 在 main.rs 中实现播放逻辑

**文件：** `native-desktop/src/main.rs`

#### 2a. 添加 import

```rust
use std::io::BufReader;
```

#### 2b. 新增 `play_audio()` 函数

```rust
/// Play an MP3 file on a background thread, non-blocking.
/// Returns immediately; audio plays asynchronously.
fn play_audio(path: &std::path::Path) {
    let path_buf = path.to_path_buf();
    std::thread::spawn(move || {
        match std::fs::File::open(&path_buf) {
            Ok(file) => {
                let reader = BufReader::new(file);
                match rodio::Decoder::try_from(reader) {
                    Ok(source) => {
                        match rodio::OutputStream::try_default() {
                            Ok((_stream, handle)) => {
                                match rodio::Sink::try_new(&handle) {
                                    Ok(sink) => {
                                        sink.append(source);
                                        sink.sleep_until_end();
                                        log::info!("[DeskPet] Audio playback finished");
                                    }
                                    Err(e) => log::warn!("[DeskPet] Failed to create audio sink: {e}"),
                                }
                            }
                            Err(e) => log::warn!("[DeskPet] No audio output device: {e}"),
                        }
                    }
                    Err(e) => log::warn!("[DeskPet] Failed to decode audio: {e}"),
                }
                // Cleanup temp file after playback
                let _ = std::fs::remove_file(&path_buf);
            }
            Err(e) => log::warn!("[DeskPet] Failed to open audio file {:?}: {e}", path_buf),
        }
    });
}
```

**关键设计：**
- `std::thread::spawn` — 在独立线程播放，不阻塞主循环的 200ms 轮询
- `Sink::sleep_until_end()` — 等待播放完成（在后台线程内，不影响主循环）
- 播放完成后自动 `remove_file` — 清理临时 MP3，不堆积磁盘
- 每层都有错误处理 — 缺音频设备、解码失败、文件不存在都不会崩溃

#### 2c. 连线 `audio_path`

在 `main.rs` 主循环的 `"chat"` action 分支中，mock 模式之后：

```rust
// 当前代码 (约 220-223 行)：
if let Some(new_state) = result.state {
    // Core already updated by process_user_input
}
write_state(&c, &result.text, false);
```

改为：

```rust
if let Some(ref audio_path) = result.audio_path {
    play_audio(audio_path);
}
write_state(&c, &result.text, false);
```

同时更新 mock 模式的 `audio_path` 从 `None` 改为实际调用 TTS（可选，先保持 `None` 让 mock 模式只显示文字）。

#### 2d. 更新 `PetState` 结构体（可选增强）

可以考虑在 `PetState` 中增加 `has_audio: bool` 字段，让 QML 知道正在播放语音（显示一个音量图标动画）。这是锦上添花，第一版可跳过。

### Step 3: 编译与测试

```bash
# 编译检查
cargo check -p native-desktop

# 构建
cargo build --release -p native-desktop

# 手动测试
# 1. 启动应用
# 2. 发送一条聊天消息
# 3. 确认能听到 Edge TTS 语音
# 4. 检查 %TEMP%/deskpet-tts/ 目录中 MP3 是否在播放后被清理
```

## 完整改动清单

### native-desktop/Cargo.toml
```diff
+ rodio = { version = "0.20", features = ["symphonia"] }
```

### native-desktop/src/main.rs
1. `use std::io::BufReader;` (新增 import)
2. `fn play_audio()` 函数 (新增 ~30 行)
3. `"chat"` 分支中调用 `play_audio(&result.audio_path)` (改动 3 行)

**总计：约 40 行新增代码，0 行删除。**

## 降级链

rodio 内置了完善的错误处理：

```
打开 MP3 文件
  ↓ 失败 → log warning, 跳过播放
解码 MP3 (symphonia)
  ↓ 失败 → log warning, 跳过播放
获取音频输出设备 (cpal → WASAPI)
  ↓ 失败 → log warning, 静默降级
播放音频
  ↓ 完成 → 清理临时文件 ✅
```

任何环节失败都不会影响聊天功能 — 文字回复仍然显示在气泡中。

## 性能考量

- **内存：** rodio 流式解码，不将整个 MP3 加载到内存
- **CPU：** MP3 解码在后台线程，不影响主循环
- **延迟：** WASAPI 低延迟模式，通常 < 50ms 从文件到出声
- **磁盘：** 播放后自动清理，临时文件存活时间 = 语音时长

## 验证清单

- [ ] `cargo check -p native-desktop` 无错误
- [ ] `cargo test --workspace` 全部 57 测试通过
- [ ] 启动应用后发送消息，能听到语音播放
- [ ] 语音播放不阻塞 UI（宠物仍可拖拽、状态正常切换）
- [ ] `%TEMP%/deskpet-tts/` 目录中 MP3 播放后被清理
- [ ] 没有音频设备时静默降级，不崩溃
- [ ] 快速连续发多条消息，音频按顺序播放（rodio Sink 自带队列）
