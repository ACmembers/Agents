# TTS 语音克隆方案

**状态**：备选（未采用）
**决策时间**：阶段 4 开始前重新评估
**主方案**：Edge TTS 近亲匹配
**切换成本**：中高 — 需新增克隆后端、GPU 或付费 API

## 方案描述

语音包/角色包附带 3-10 秒参考音频 + 克隆模型权重，TTS 引擎使用语音克隆技术生成与角色完全一致的音色。

## 后端对比

| 后端 | 费用 | 部署 | 延迟 | 质量 |
|------|------|------|------|------|
| ElevenLabs | 付费 (~$5/月起) | 云端 API | 低 | 很高 |
| GPT-SoVITS | 免费 | 本地 GPU | 中 | 高 |
| Fish Speech | 免费 | 本地 GPU / 云端 | 低-中 | 高 |

## Sakura 角色包已含 GPT-SoVITS 模型

Sakura 的 `voice/models/` 下有 `Sakura-e15.ckpt` (~148MB) + `Sakura_e8_s7176.pth` (~165MB)，可用于本地语音克隆。

## manifest 扩展

```json
"voice": {
  "tts_backend": "gpt_sovits",
  "reference_audio": "voice/reference.ogg",
  "gpt_model": "voice/models/Sakura-e15.ckpt",
  "sovits_model": "voice/models/Sakura_e8_s7176.pth"
}
```

## 降级链

GPT-SoVITS → ElevenLabs → Edge TTS 近亲匹配 → 系统 TTS → 静默
