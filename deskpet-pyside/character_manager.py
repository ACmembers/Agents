"""角色包管理 — 导入 / 切换 / 管理角色外观"""

import json
import zipfile
import shutil
from pathlib import Path
from config import BASE_DIR

CHARACTERS_DIR = BASE_DIR / "characters"
ACTIVE_CONFIG = BASE_DIR / "active_character.json"


class CharacterManager:
    def __init__(self):
        CHARACTERS_DIR.mkdir(parents=True, exist_ok=True)
        self._active: dict | None = None
        self._load_active()

    def _load_active(self):
        if ACTIVE_CONFIG.exists():
            try:
                self._active = json.loads(ACTIVE_CONFIG.read_text(encoding="utf-8"))
            except Exception:
                self._active = None

    def import_pack(self, zip_path: str) -> tuple[bool, str]:
        """导入角色包 zip"""
        try:
            with zipfile.ZipFile(zip_path, "r") as zf:
                # 查找 manifest.json
                manifest_file = None
                for name in zf.namelist():
                    if name.rstrip("/").endswith("manifest.json"):
                        manifest_file = name
                        break

                if not manifest_file:
                    return False, "角色包中未找到 manifest.json"

                manifest = json.loads(zf.read(manifest_file))
                char_name = manifest.get("name", "未命名角色")
                if not char_name:
                    return False, "manifest.json 缺少 name 字段"

                # 解压到 characters 目录
                char_dir = CHARACTERS_DIR / char_name
                if char_dir.exists():
                    shutil.rmtree(char_dir)
                char_dir.mkdir(parents=True)
                zf.extractall(char_dir)

                # 验证必须的文件
                idle_img = manifest.get("images", {}).get("idle")
                if idle_img and not (char_dir / idle_img).exists():
                    return False, f"缺少 idle 图片: {idle_img}"

                return True, f"角色 '{char_name}' 导入成功"
        except zipfile.BadZipFile:
            return False, "无效的 zip 文件"
        except json.JSONDecodeError as e:
            return False, f"manifest.json 格式错误: {e}"
        except Exception as e:
            return False, f"导入失败: {e}"

    def set_active(self, char_name: str) -> tuple[bool, str]:
        """切换当前角色"""
        char_dir = CHARACTERS_DIR / char_name
        manifest = char_dir / "manifest.json"
        if not manifest.exists():
            return False, "角色不存在"

        try:
            data = json.loads(manifest.read_text(encoding="utf-8"))
            ACTIVE_CONFIG.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            self._active = data
            return True, f"已切换为 '{char_name}'"
        except Exception as e:
            return False, str(e)

    def get_active_image(self, anim: str = "idle") -> str | None:
        """获取当前角色指定动画状态的图片路径"""
        if not self._active:
            return None
        images = self._active.get("images", {})
        filename = images.get(anim)
        if not filename:
            filename = images.get("idle")
        if not filename:
            return None
        char_name = self._active.get("name", "")
        img_path = CHARACTERS_DIR / char_name / filename
        if img_path.exists():
            return str(img_path)
        return None

    def list_packs(self) -> list[dict]:
        """列出所有已安装角色包"""
        packs = []
        if not CHARACTERS_DIR.exists():
            return packs
        for d in sorted(CHARACTERS_DIR.iterdir()):
            if not d.is_dir():
                continue
            manifest = d / "manifest.json"
            if manifest.exists():
                try:
                    data = json.loads(manifest.read_text(encoding="utf-8"))
                    packs.append({
                        "name": data.get("name", d.name),
                        "author": data.get("author", ""),
                        "version": data.get("version", ""),
                        "images": list(data.get("images", {}).keys()),
                    })
                except Exception:
                    pass
        return packs

    def get_active_name(self) -> str:
        return self._active.get("name", "") if self._active else ""

    def delete_pack(self, char_name: str) -> bool:
        char_dir = CHARACTERS_DIR / char_name
        if char_dir.exists():
            shutil.rmtree(char_dir)
            if self.get_active_name() == char_name:
                self._active = None
                if ACTIVE_CONFIG.exists():
                    ACTIVE_CONFIG.unlink()
            return True
        return False
