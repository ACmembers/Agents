"""人设管理 — 完全由角色包驱动 + 会话记忆"""

from config import load_config, load_conversations, save_conversation
from character_manager import CharacterManager

_cm: CharacterManager | None = None


def get_character_manager() -> CharacterManager:
    global _cm
    if _cm is None:
        _cm = CharacterManager()
    return _cm


def build_system_prompt(skill_injections: list[str] | None = None) -> str:
    """从当前角色包构建 System Prompt"""
    cm = get_character_manager()
    prompt = cm.active.build_system_prompt()

    if not prompt:
        # 回退到配置文件中的自定义 Prompt
        from phoebe_persona import PHOEBE_SYSTEM_PROMPT
        cfg = load_config()
        prompt = cfg.get("persona", {}).get("system_prompt", "") or PHOEBE_SYSTEM_PROMPT

    # 追加用户偏好
    cfg = load_config()
    persona_cfg = cfg.get("persona", {})
    ms = persona_cfg.get("max_sentences", 4)
    emoji = persona_cfg.get("use_emoji", True)
    prompt += f"\n\n## 回复规则\n- 每轮不超过 {ms} 句话"
    if emoji:
        prompt += "\n- 适当使用 emoji"

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
