"""角色包管理 — 驱动整个桌宠外观的核心"""

import json
import zipfile
import shutil
from pathlib import Path
from config import BASE_DIR

CHARACTERS_DIR = BASE_DIR / "characters"
ACTIVE_CONFIG = BASE_DIR / "active_character.json"
BUILTIN_PHOEBE = Path(__file__).parent / "assets" / "phoebe.jpg"

# 菲比内置角色包清单
PHOEBE_MANIFEST = {
    "name": "菲比",
    "author": "内置",
    "version": "1.0",
    "images": {
        "idle": "phoebe.jpg",
        "speaking": "phoebe.jpg",
        "sleeping": "phoebe.jpg"
    },
    "tap_replies": {
        "head": "诶嘿~ 别摸头啦 ✨",
        "face": "别戳啦... 会害羞的",
        "body": "嗯？怎么啦？"
    },
    "greeting": "光芒照耀之处，必有希望萌芽 ✨\n今天也是美好的一天呢，朋友。",
    "sleep_message": "呼... 晚安，愿星辰守护你的梦境 🌙",
    # === AI 人设提示词 ===
    "persona": {
        "identity": "黎那汐塔的圣使",
        "personality": "温柔典雅、谦和坚定、善于倾听",
        "speaking_style": "优雅但不疏远，每次 2-4 句话，适当使用 emoji",
        "catchphrases": [
            "光芒照耀之处，必有希望萌芽",
            "每一次相遇都是星辰的指引",
            "心若宁静，万物皆明"
        ],
        "background": "黎那汐塔教会圣使，身负传播光明与希望之使命"
    }
}


def _ensure_builtin():
    """确保内置菲比角色包可用"""
    CHARACTERS_DIR.mkdir(parents=True, exist_ok=True)
    char_dir = CHARACTERS_DIR / "菲比"
    char_dir.mkdir(exist_ok=True)

    # 写入 manifest
    manifest_path = char_dir / "manifest.json"
    if not manifest_path.exists():
        manifest_path.write_text(json.dumps(PHOEBE_MANIFEST, ensure_ascii=False, indent=2), encoding="utf-8")

    # 复制默认图片
    img_path = char_dir / "phoebe.jpg"
    if not img_path.exists() and BUILTIN_PHOEBE.exists():
        shutil.copy(BUILTIN_PHOEBE, img_path)

    # 首次运行时激活菲比
    if not ACTIVE_CONFIG.exists():
        ACTIVE_CONFIG.write_text(json.dumps(PHOEBE_MANIFEST, ensure_ascii=False, indent=2), encoding="utf-8")


class CharacterPack:
    """单个角色包"""
    def __init__(self, data: dict, base_dir: Path):
        self.data = data
        self.base_dir = base_dir

    @property
    def name(self) -> str:
        return self.data.get("name", "未命名")

    @property
    def images(self) -> dict:
        return self.data.get("images", {})

    @property
    def tap_replies(self) -> dict:
        return self.data.get("tap_replies", {})

    @property
    def greeting(self) -> str:
        return self.data.get("greeting", "你好呀 ✨")

    @property
    def sleep_message(self) -> str:
        return self.data.get("sleep_message", "晚安... 🌙")

    @property
    def persona(self) -> dict:
        """AI 人设数据"""
        return self.data.get("persona", {})

    @property
    def voice_prompt(self) -> str:
        """语音包携带的 AI 提示词"""
        return self.data.get("voice_prompt", "")

    def build_system_prompt(self) -> str:
        """从角色包构建 System Prompt"""
        p = self.persona
        if not p:
            return ""

        parts = [
            f"你是{self.name}，{p.get('identity', '')}。",
            f"## 背景\n{p.get('background', '')}",
            f"## 性格\n{p.get('personality', '')}",
            f"## 说话风格\n{p.get('speaking_style', '')}",
        ]

        catchphrases = p.get("catchphrases", [])
        if catchphrases:
            parts.append("## 经典语录\n" + "\n".join(f"- 「{c}」" for c in catchphrases))

        voice_prompt = self.voice_prompt
        if voice_prompt:
            parts.append(f"## 语音提示\n{voice_prompt}")

        return "\n\n".join(parts)

    def get_image(self, anim: str = "idle") -> str | None:
        """获取动画状态对应的图片路径"""
        images = self.images
        filename = images.get(anim) or images.get("idle")
        if not filename:
            return None
        path = self.base_dir / filename
        return str(path) if path.exists() else None

    def has_anim(self, anim: str) -> bool:
        return anim in self.images


class CharacterManager:
    """角色包管理器（单例）"""

    def __init__(self):
        _ensure_builtin()
        self.packs: dict[str, CharacterPack] = {}
        self._active: CharacterPack | None = None
        self._scan()

    def _scan(self):
        """扫描所有已安装角色包"""
        self.packs.clear()
        if not CHARACTERS_DIR.exists():
            return
        for d in sorted(CHARACTERS_DIR.iterdir()):
            if not d.is_dir():
                continue
            manifest = d / "manifest.json"
            if manifest.exists():
                try:
                    data = json.loads(manifest.read_text(encoding="utf-8"))
                    self.packs[data.get("name", d.name)] = CharacterPack(data, d)
                except Exception:
                    pass

        # 加载激活角色
        if ACTIVE_CONFIG.exists():
            try:
                data = json.loads(ACTIVE_CONFIG.read_text(encoding="utf-8"))
                name = data.get("name", "")
                if name in self.packs:
                    self._active = self.packs[name]
            except Exception:
                pass

        # 回退到菲比
        if not self._active and "菲比" in self.packs:
            self._active = self.packs["菲比"]

    @property
    def active(self) -> CharacterPack:
        """返回当前激活的角色包"""
        if not self._active:
            self._scan()
        if not self._active:
            raise RuntimeError("没有可用的角色包")
        return self._active

    def get_image(self, anim: str = "idle") -> str | None:
        return self.active.get_image(anim)

    def import_pack(self, zip_path: str) -> tuple[bool, str]:
        """导入角色包 zip"""
        try:
            with zipfile.ZipFile(zip_path, "r") as zf:
                manifest_file = None
                for name in zf.namelist():
                    if name.rstrip("/").endswith("manifest.json"):
                        manifest_file = name
                        break
                if not manifest_file:
                    return False, "角色包中未找到 manifest.json"

                manifest = json.loads(zf.read(manifest_file))
                char_name = manifest.get("name")
                if not char_name:
                    return False, "manifest.json 缺少 name 字段"

                char_dir = CHARACTERS_DIR / char_name
                if char_dir.exists():
                    shutil.rmtree(char_dir)
                char_dir.mkdir(parents=True)
                zf.extractall(char_dir)

                self._scan()
                return True, f"'{char_name}' 导入成功"
        except zipfile.BadZipFile:
            return False, "无效的 zip 文件"
        except json.JSONDecodeError as e:
            return False, f"manifest.json 格式错误: {e}"
        except Exception as e:
            return False, f"导入失败: {e}"

    def set_active(self, char_name: str) -> tuple[bool, str]:
        if char_name not in self.packs:
            return False, f"角色 '{char_name}' 不存在"
        pack = self.packs[char_name]
        self._active = pack
        ACTIVE_CONFIG.write_text(json.dumps(pack.data, ensure_ascii=False, indent=2), encoding="utf-8")
        return True, f"已切换为 '{char_name}'"

    def list_packs(self) -> list[dict]:
        result = []
        for name, pack in self.packs.items():
            result.append({
                "name": name,
                "author": pack.data.get("author", ""),
                "version": pack.data.get("version", ""),
                "animations": list(pack.images.keys()),
                "active": self._active is pack,
            })
        return result

    def delete_pack(self, char_name: str) -> bool:
        if char_name not in self.packs:
            return False
        if self._active and self._active.name == char_name:
            return False  # 不能删除当前使用的角色
        char_dir = CHARACTERS_DIR / char_name
        if char_dir.exists():
            shutil.rmtree(char_dir)
        self._scan()
        return True
