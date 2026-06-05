# 统一 Character Pack（角色包+语音包合并）

**状态**：备选（未采用）
**决策时间**：阶段 3 开始前重新评估
**主方案**：角色包和语音包分离管理
**切换成本**：中 — 需重新设计 manifest schema、修改加载器、迁移现有角色包

## 方案描述

将语音包 manifest 的内容合并到角色包 manifest 中，成为 `voice` 子字段。用户只需导入一个 zip 即可获得完整角色体验。

```json
{
  "name": "夜乃桜",
  "images": { "idle": "images/idle.png", ... },
  "persona": { ... },
  "voice": {
    "tts_voice": "ja-JP-NanamiNeural",
    "tts_language": "ja",
    "tts_speed": 1.0,
    "event_audio": {
      "greeting": ["audio/greeting1.ogg"],
      "sleep": ["audio/sleep.ogg"],
      "tap_head": ["audio/tap_head.ogg"]
    },
    "reference_audio": "voice/reference.ogg",
    "gpt_sovits_models": { ... }
  }
}
```

## 对比

| | 主方案（分离） | 此方案（统一） |
|---|---|---|
| 用户操作 | 可能需导入两次 | 一次导入全搞定 |
| manifest 结构 | 简单分离 | 单文件较复杂 |
| 灵活性 | 角色+语音可任意组合 | 绑定更紧 |
| 向后兼容 | - | 需迁移工具 |

## 迁移路径

1. 定义统一 `manifest.json` schema v2
2. `RolePackLoader` 改为统一加载器
3. 导入逻辑支持两种格式自动检测
4. 旧格式角色包自动加 `voice: {}` 空字段
5. 旧格式语音包自动合并到当前激活角色包的 `voice` 字段
