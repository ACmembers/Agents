# DeskPet · 菲比

> 基于 PySide6 的 AI 桌面宠物 — 菲比（Phoebe）常驻桌面，感知你的状态，温柔陪伴。

![](assets/phoebe.jpg)

## ✨ 功能

### 🎭 桌面陪伴
- 透明悬浮窗，始终置顶，不遮挡工作区
- 图片驱动：支持快速换图 + 角色包导入
- 帧缓存渲染引擎，10fps 零 CPU 开销

### 🧠 AI 对话
- 支持 5 家 AI 提供商：Deepseek / OpenAI / 通义千问 / Moonshot / 智谱
- 双击输入栏聊天，AI 角色扮演回复
- 滑动窗口会话记忆，越聊越懂你

### 👁️ 屏幕感知
- 实时检测活跃窗口，知道你正在做什么
- 上下文注入 AI Prompt，AI 理解用户状态
- 主动搭话：切换应用时 AI 判断是否要说点什么

### ⚡ Skill 系统
- 12 个预置技能，支持导入/导出/自定义
- 四种触发：定时 / 关键词 / 手动 / 启动
- 喝水提醒、久坐提醒、情绪安慰、成就庆祝……

### 🔊 语音（可选）
- 语音包导入：zip 含 manifest.json + 音频文件
- Edge TTS 免费合成，无需 API Key
- 语音包驱动 AI Prompt：voice_prompt + personality 注入

### 🎨 外观
- 快速换图：选择 PNG/JPG 即刻生效
- 角色包导入：zip 含 manifest.json + 图片

## 🚀 快速开始

### 环境
- Python >= 3.11
- Windows 10/11（屏幕感知依赖 Win32 API）

### 安装

```bash
cd deskpet-pyside
pip install -r requirements.txt
python main.py
```

### 配置 API

首次启动后，右键托盘 → 设置 → API 标签页：
1. 选择提供商（Deepseek 默认）
2. 填入 API Key
3. 点击「测试连接」
4. 保存

## 📁 项目结构

```
deskpet-pyside/
├── main.py              # 入口：QApplication + 托盘 + 交互调度
├── pet_window.py        # 透明无边框窗口 + 拖拽/点击/双击
├── renderer.py          # 帧缓存动画引擎（预渲染零 CPU）
├── ai_client.py         # 5 家 AI 提供商统一接口
├── persona.py           # System Prompt 构建 + 会话记忆
├── phoebe_persona.py    # 菲比默认人设
├── skill_scheduler.py   # QTimer 定时 + 关键词检测
├── phoebe_skills.py     # 12 个预置 Skill
├── screen_observer.py   # Win32 屏幕感知 + 主动关怀
├── settings_window.py   # 6 标签页 Qt 设置面板
├── voice_manager.py     # 语音包导入/管理/播放
├── tts_engine.py        # Edge TTS 免费合成
├── character_manager.py # 角色包导入/切换
├── config.py            # ~/.deskpet/ JSON 持久化
├── bubble.py            # 对话气泡
└── assets/phoebe.jpg    # 默认菲比角色图
```

## 🎮 交互

| 操作 | 效果 |
|------|------|
| 🖱️ 拖拽 | 移动窗口 |
| 👆 点击头/脸/身体 | 晃动 + 气泡反馈 |
| 🖱️🖱️ 双击 | 弹出输入栏，打字回车聊天 |
| ⚙️ 右键托盘 | 设置面板 |

## ⚙️ 设置面板

| 标签 | 功能 |
|------|------|
| 🔌 API | 切换 AI 提供商 / 测试连接 |
| ✨ 人设 | 编辑 System Prompt + 记忆设置 |
| ⚡ Skill | 导入/导出/新增/编辑/开关 |
| 🖼️ 外观 | 快速换图 + 角色包导入 |
| 🔊 语音 | 导入语音包 + TTS + 音量 |
| 💬 历史 | 查看/导出/清除对话 |

## 📦 扩展格式

### Skill JSON
```json
[{
  "id": "my-skill",
  "name": "自定义技能",
  "trigger": "keyword",
  "enabled": true,
  "cooldown": 300,
  "config": {"keywords": ["关键词"], "match_mode": "contains"},
  "prompt": "触发时的 AI 提示词"
}]
```

### 语音包 ZIP
```
voicepack.zip
├── manifest.json     ← name / voice_prompt / personality / mappings
└── audio/
    ├── greeting.wav
    └── tap_head.wav
```

### 角色包 ZIP
```
character.zip
├── manifest.json     ← name / images / persona / tap_replies
├── idle.png
└── speaking.png
```

## 🔧 依赖

```
PySide6>=6.6        # Qt for Python
httpx>=0.27          # 异步 HTTP
qasync>=0.27         # asyncio + Qt 事件循环
edge-tts>=6.1        # 免费 TTS（可选）
```

## 📄 许可

MIT — 自用随意，菲比形象版权归库洛游戏所有。
