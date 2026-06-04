"""人设管理 — 完全由角色包驱动 + 会话记忆"""

from config import load_config, load_conversations, save_conversation
from character_manager import CharacterManager

_cm: CharacterManager | None = None


def get_character_manager() -> CharacterManager:
    global _cm
    if _cm is None:
        _cm = CharacterManager()
    return _cm


def build_system_prompt(
    skill_injections: list[str] | None = None,
    screen_context: str = ""
) -> str:
    """从当前角色包 + 语音包 + 屏幕感知构建 System Prompt"""
    cm = get_character_manager()
    prompt = cm.active.build_system_prompt()

    if not prompt:
        from phoebe_persona import PHOEBE_SYSTEM_PROMPT
        cfg = load_config()
        prompt = cfg.get("persona", {}).get("system_prompt", "") or PHOEBE_SYSTEM_PROMPT

    # 语音包 AI 提示词注入
    from voice_manager import VoiceManager
    vm = VoiceManager()
    voice_prompt = vm.voice_prompt
    if voice_prompt:
        prompt += f"\n\n## 语音风格指导\n{voice_prompt}"

    # 语音包性格提示注入
    hints = vm.personality_hints
    if hints:
        parts = []
        if hints.get("tone"):
            parts.append(f"- 语气: {hints['tone']}")
        if hints.get("pace"):
            parts.append(f"- 语速风格: {hints['pace']}")
        if hints.get("traits"):
            parts.append(f"- 性格特征: {', '.join(hints['traits'])}")
        if parts:
            prompt += "\n## 角色语音特征\n" + "\n".join(parts)

    # 用户偏好
    cfg = load_config()
    persona_cfg = cfg.get("persona", {})
    ms = persona_cfg.get("max_sentences", 4)
    emoji = persona_cfg.get("use_emoji", True)
    prompt += f"\n\n## 回复规则\n- 每轮不超过 {ms} 句话"
    if emoji:
        prompt += "\n- 适当使用 emoji"

    # 屏幕感知上下文 — 让 AI 知道用户在做什么
    if screen_context:
        prompt += f"\n\n## 用户当前状态\n{screen_context}\n（可以根据用户正在做的事情自然地提供帮助或评论）"

    if skill_injections:
        prompt += "\n## 当前情境\n" + "\n".join(f"- {inj}" for inj in skill_injections)

    # 会话记忆
    cfg = load_config()
    persona_cfg = cfg.get("persona", {})
    if persona_cfg.get("memory_enabled", True):
        history = get_recent_messages()
        if history:
            prompt += "\n## 最近的对话\n" + "\n".join(
                f"{'用户' if h['role'] == 'user' else cm.active.name}: {h['content']}"
                for h in history
            )

    return prompt


def get_recent_messages() -> list[dict]:
    from datetime import date, timedelta
    cfg = load_config()
    max_msgs = cfg.get("persona", {}).get("memory_size", 20)
    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    msgs = load_conversations(yesterday) + load_conversations(today)
    return msgs[-max_msgs:]


def save_message(role: str, content: str):
    from datetime import datetime
    save_conversation({
        "role": role,
        "content": content,
        "timestamp": datetime.now().isoformat()
    })
