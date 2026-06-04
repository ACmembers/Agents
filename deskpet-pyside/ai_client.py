"""AI 客户端 — 支持多提供商（OpenAI-compatible 格式）"""

import httpx
from config import load_config, save_config

PROVIDER_DEFAULTS = {
    "deepseek": {"base_url": "https://api.deepseek.com/v1", "models": ["deepseek-chat", "deepseek-reasoner"]},
    "openai":   {"base_url": "https://api.openai.com/v1", "models": ["gpt-4o-mini", "gpt-4o"]},
    "qwen":     {"base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1", "models": ["qwen-plus", "qwen-max"]},
    "moonshot": {"base_url": "https://api.moonshot.cn/v1", "models": ["moonshot-v1-8k", "moonshot-v1-32k"]},
    "zhipu":    {"base_url": "https://open.bigmodel.cn/api/paas/v4", "models": ["glm-4-flash", "glm-4-plus"]},
}


def get_active_provider_config() -> dict:
    cfg = load_config()
    api_cfg = cfg.get("api", {})
    provider_id = api_cfg.get("active_provider", "deepseek")
    providers = api_cfg.get("providers", {})
    if provider_id not in providers:
        # 初始化默认
        defaults = PROVIDER_DEFAULTS.get(provider_id, PROVIDER_DEFAULTS["deepseek"])
        providers[provider_id] = {
            "base_url": defaults["base_url"],
            "api_key": "",
            "model": defaults["models"][0],
            "temperature": 0.7
        }
        cfg["api"]["providers"] = providers
        save_config(cfg)
    return providers[provider_id]


async def chat(
    message: str,
    system_prompt: str,
    skill_injections: list[str] | None = None,
) -> str:
    """发送聊天请求，返回 AI 回复"""
    provider = get_active_provider_config()
    api_key = provider.get("api_key", "")
    base_url = provider.get("base_url", "")
    model = provider.get("model", "deepseek-chat")
    temperature = provider.get("temperature", 0.7)

    if not api_key:
        return "请先配置 API Key 哦～ 点击托盘 → 设置 ⚙️"

    # 构建消息
    messages = [{"role": "system", "content": system_prompt}]

    # 注入 Skill
    if skill_injections:
        for inj in skill_injections:
            messages.append({"role": "system", "content": f"[当前情境] {inj}"})

    # 注入记忆
    from persona import get_recent_messages
    history = get_recent_messages()
    for h in history:
        messages.append({"role": h["role"], "content": h["content"]})

    messages.append({"role": "user", "content": message})

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
        except httpx.HTTPStatusError as e:
            return f"唔… API 出错了（{e.response.status_code}）请检查配置 (._.)"
        except Exception as e:
            return f"唔… 网络好像不太稳定 ({str(e)[:50]})"


async def test_connection() -> tuple[bool, str]:
    """测试 API 连接"""
    provider = get_active_provider_config()
    api_key = provider.get("api_key", "")
    base_url = provider.get("base_url", "")

    if not api_key:
        return False, "请先填写 API Key"

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(
                f"{base_url}/models",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            return resp.status_code == 200, f"连接成功 (HTTP {resp.status_code})"
        except Exception as e:
            return False, str(e)[:80]
