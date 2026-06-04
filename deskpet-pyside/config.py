"""JSON 配置读写 — 所有数据存在 ~/.deskpet/ 下"""

import json
from pathlib import Path
from typing import Any

BASE_DIR = Path.home() / ".deskpet"
CONFIG_FILE = BASE_DIR / "config.json"
SKILLS_FILE = BASE_DIR / "skills.json"
CONV_DIR = BASE_DIR / "conversations"
VOICEPACK_DIR = BASE_DIR / "voicepacks"


def _ensure_dirs():
    BASE_DIR.mkdir(parents=True, exist_ok=True)
    CONV_DIR.mkdir(parents=True, exist_ok=True)
    VOICEPACK_DIR.mkdir(parents=True, exist_ok=True)


def load_config() -> dict:
    _ensure_dirs()
    if not CONFIG_FILE.exists():
        return _default_config()
    try:
        return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return _default_config()


def save_config(data: dict):
    _ensure_dirs()
    CONFIG_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def load_skills() -> list[dict]:
    _ensure_dirs()
    if not SKILLS_FILE.exists():
        return []
    try:
        return json.loads(SKILLS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []


def save_skills(skills: list[dict]):
    _ensure_dirs()
    SKILLS_FILE.write_text(json.dumps(skills, ensure_ascii=False, indent=2), encoding="utf-8")


def load_conversations(date_str: str) -> list[dict]:
    _ensure_dirs()
    f = CONV_DIR / f"{date_str}.json"
    if not f.exists():
        return []
    try:
        return json.loads(f.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []


def save_conversation(msg: dict):
    from datetime import date
    _ensure_dirs()
    today = date.today().isoformat()
    f = CONV_DIR / f"{today}.json"
    msgs = load_conversations(today)
    msgs.append(msg)
    f.write_text(json.dumps(msgs, ensure_ascii=False, indent=2), encoding="utf-8")


def _default_config() -> dict:
    return {
        "api": {
            "active_provider": "deepseek",
            "providers": {
                "deepseek": {
                    "base_url": "https://api.deepseek.com/v1",
                    "api_key": "",
                    "model": "deepseek-chat",
                    "temperature": 0.7
                }
            }
        },
        "persona": {
            "name": "菲比",
            "max_sentences": 4,
            "use_emoji": True,
            "formality": 0.7,
            "memory_enabled": True,
            "memory_size": 20
        }
    }
