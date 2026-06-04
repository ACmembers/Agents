"""人设管理 — System Prompt + 会话记忆"""

from config import load_config, load_conversations, save_conversation
from phoebe_persona import PHOEBE_SYSTEM_PROMPT


def build_system_prompt(skill_injections: list[str] | None = None) -> str:
    """构建完整的 System Prompt（人设 + Skill 注入 + 记忆）"""
    cfg = load_config()
    persona = cfg.get("persona", {})

    # 使用配置的 Prompt 或默认
    prompt = persona.get("system_prompt", "") or PHOEBE_SYSTEM_PROMPT

    # 说话风格
    ms = persona.get("max_sentences", 4)
    emoji = persona.get("use_emoji", True)
    formality = persona.get("formality", 0.7)

    extra = f"\n\n## 当前设置\n- 每轮回复不超过 {ms} 句话\n"
    if emoji:
        extra += "- 适当使用 emoji\n"
    if formality > 0.7:
        extra += "- 语气偏正式庄重\n"

    prompt += extra

    # Skill 注入
    if skill_injections:
        prompt += "\n## 当前情境\n"
        for inj in skill_injections:
            prompt += f"- {inj}\n"

    return prompt


def get_recent_messages() -> list[dict]:
    """获取最近的对话记忆"""
    from datetime import date
    cfg = load_config()
    persona = cfg.get("persona", {})
    if not persona.get("memory_enabled", True):
        return []

    max_msgs = persona.get("memory_size", 20)
    today = date.today().isoformat()

    msgs = load_conversations(today)
    # 也加载昨天的
    from datetime import timedelta
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    msgs = load_conversations(yesterday) + msgs

    return msgs[-max_msgs:]


def save_message(role: str, content: str):
    """保存对话消息"""
    from datetime import datetime
    save_conversation({
        "role": role,
        "content": content,
        "timestamp": datetime.now().isoformat()
    })
