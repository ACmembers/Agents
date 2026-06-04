"""语音包管理 — 导入 / 切换 / 播放"""

import json
import zipfile
from pathlib import Path
from PySide6.QtMultimedia import QMediaPlayer, QAudioOutput
from PySide6.QtCore import QUrl

from config import VOICEPACK_DIR


class VoiceManager:
    def __init__(self):
        self._active_pack: dict | None = None
        self._active_name: str | None = None
        self._player: QMediaPlayer | None = None
        self._audio_output: QAudioOutput | None = None
        self.enabled = True
        self.volume = 80
        self._load_active()

    @property
    def voice_prompt(self) -> str:
        """语音包携带的 AI 提示词 — 注入到 System Prompt"""
        if not self._active_pack:
            return ""
        return self._active_pack.get("voice_prompt", "")

    @property
    def personality_hints(self) -> dict:
        """语音包携带的角色性格提示"""
        if not self._active_pack:
            return {}
        return self._active_pack.get("personality", {})

    def _load_active(self):
        """加载当前激活的语音包"""
        manifest = VOICEPACK_DIR / "active_manifest.json"
        if manifest.exists():
            try:
                self._active_pack = json.loads(manifest.read_text(encoding="utf-8"))
                self._active_name = self._active_pack.get("name", "")
            except Exception:
                pass

    def import_pack(self, zip_path: str) -> tuple[bool, str]:
        """导入语音包 zip"""
        try:
            with zipfile.ZipFile(zip_path, "r") as zf:
                # 查找 manifest.json
                manifest_file = None
                for name in zf.namelist():
                    if name.endswith("manifest.json") and "/" in name:
                        manifest_file = name
                        break
                    elif name == "manifest.json":
                        manifest_file = name
                        break

                if not manifest_file:
                    return False, "语音包中未找到 manifest.json"

                manifest = json.loads(zf.read(manifest_file))
                pack_name = manifest.get("name", "未命名语音包")

                # 解压到 voicepacks 目录
                pack_dir = VOICEPACK_DIR / pack_name
                pack_dir.mkdir(parents=True, exist_ok=True)
                zf.extractall(pack_dir)

                # 保存 manifest 到 voicepacks 根目录
                manifest_path = VOICEPACK_DIR / "active_manifest.json"
                manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2),
                                         encoding="utf-8")

                self._active_pack = manifest
                self._active_name = pack_name
                return True, f"语音包 '{pack_name}' 导入成功"
        except zipfile.BadZipFile:
            return False, "无效的 zip 文件"
        except json.JSONDecodeError:
            return False, "manifest.json 格式错误"
        except Exception as e:
            return False, f"导入失败: {e}"

    def get_audio(self, event: str) -> str | None:
        """根据事件获取音频文件路径"""
        if not self._active_pack:
            return None
        mappings = self._active_pack.get("mappings", {})
        files = mappings.get(event, [])
        if not files:
            return None
        # 随机选一个
        import random
        file_name = random.choice(files)
        pack_dir = VOICEPACK_DIR / (self._active_name or "")
        audio_path = pack_dir / file_name
        if audio_path.exists():
            return str(audio_path)
        return None

    def play(self, event: str):
        """播放事件对应的语音"""
        if not self.enabled:
            return
        audio_path = self.get_audio(event)
        if audio_path:
            self._play_file(audio_path)

    def _play_file(self, path: str):
        """使用 QMediaPlayer 播放音频"""
        if not self._player:
            self._player = QMediaPlayer()
            self._audio_output = QAudioOutput()
            self._player.setAudioOutput(self._audio_output)
        self._audio_output.setVolume(self.volume / 100)
        self._player.setSource(QUrl.fromLocalFile(path))
        self._player.play()

    def list_packs(self) -> list[str]:
        """列出已安装的语音包"""
        if not VOICEPACK_DIR.exists():
            return []
        packs = []
        for d in VOICEPACK_DIR.iterdir():
            if d.is_dir():
                manifest = d / "manifest.json"
                if manifest.exists():
                    try:
                        data = json.loads(manifest.read_text(encoding="utf-8"))
                        packs.append(data.get("name", d.name))
                    except Exception:
                        packs.append(d.name)
        return packs

    def set_active(self, pack_name: str):
        """切换激活的语音包"""
        pack_dir = VOICEPACK_DIR / pack_name
        manifest = pack_dir / "manifest.json"
        if manifest.exists():
            self._active_pack = json.loads(manifest.read_text(encoding="utf-8"))
            self._active_name = pack_name

    def delete_pack(self, pack_name: str) -> bool:
        """删除语音包"""
        pack_dir = VOICEPACK_DIR / pack_name
        if pack_dir.exists():
            import shutil
            shutil.rmtree(pack_dir)
            if self._active_name == pack_name:
                self._active_pack = None
                self._active_name = None
            return True
        return False
