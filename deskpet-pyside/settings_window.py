"""设置窗口 — 五标签页: API | 人设 | Skill | 语音 | 历史"""

import json
from pathlib import Path
from PySide6.QtWidgets import (
    QDialog, QTabWidget, QVBoxLayout, QHBoxLayout, QWidget,
    QLabel, QLineEdit, QPushButton, QComboBox, QSlider, QTextEdit,
    QCheckBox, QSpinBox, QListWidget, QListWidgetItem, QMessageBox,
    QFileDialog, QGroupBox, QFormLayout
)
from PySide6.QtCore import Qt

from config import load_config, save_config, load_skills, save_skills, load_conversations
from ai_client import PROVIDER_DEFAULTS
from phoebe_skills import DEFAULT_SKILLS
from phoebe_persona import PHOEBE_SYSTEM_PROMPT


class SettingsWindow(QDialog):
    def __init__(self, app_ref=None, parent=None):
        super().__init__(parent)
        self.app_ref = app_ref
        self.setWindowTitle("DeskPet · 设置")
        self.resize(640, 520)

        self.tabs = QTabWidget()
        self.tabs.addTab(self._tab_api(), "🔌 API")
        self.tabs.addTab(self._tab_persona(), "✨ 人设")
        self.tabs.addTab(self._tab_skills(), "⚡ Skill")
        self.tabs.addTab(self._tab_characters(), "🎭 角色")
        self.tabs.addTab(self._tab_voice(), "🔊 语音")
        self.tabs.addTab(self._tab_history(), "💬 历史")

        layout = QVBoxLayout(self)
        layout.addWidget(self.tabs)

    # ============================================================
    # Tab 1: API
    # ============================================================
    def _tab_api(self):
        w = QWidget()
        cfg = load_config()
        api = cfg.get("api", {})
        providers = api.get("providers", {})

        form = QFormLayout(w)
        form.setSpacing(10)

        self.cb_provider = QComboBox()
        for pid in PROVIDER_DEFAULTS:
            self.cb_provider.addItem(PROVIDER_DEFAULTS[pid]["base_url"].split("//")[1].split("/")[0], pid)
        self.cb_provider.setCurrentText(api.get("active_provider", "deepseek"))
        self.cb_provider.currentIndexChanged.connect(self._on_provider_changed)
        form.addRow("提供商:", self.cb_provider)

        self.input_key = QLineEdit()
        self.input_key.setEchoMode(QLineEdit.EchoMode.Password)
        form.addRow("API Key:", self.input_key)

        self.input_url = QLineEdit()
        form.addRow("API URL:", self.input_url)

        self.cb_model = QComboBox()
        self.cb_model.setEditable(True)
        form.addRow("模型:", self.cb_model)

        self.slider_temp = QSlider(Qt.Orientation.Horizontal)
        self.slider_temp.setRange(0, 20)
        self.label_temp = QLabel("0.7")
        temp_row = QHBoxLayout()
        temp_row.addWidget(self.slider_temp)
        temp_row.addWidget(self.label_temp)
        form.addRow("Temperature:", temp_row)
        self.slider_temp.valueChanged.connect(lambda v: self.label_temp.setText(f"{v/10:.1f}"))

        btn_row = QHBoxLayout()
        btn_test = QPushButton("🔄 测试连接")
        btn_test.clicked.connect(self._test_connection)
        btn_save = QPushButton("💾 保存")
        btn_save.clicked.connect(self._save_api)
        btn_row.addWidget(btn_test)
        btn_row.addWidget(btn_save)
        form.addRow("", btn_row)

        self._on_provider_changed()
        # 加载当前配置
        pid = api.get("active_provider", "deepseek")
        p = providers.get(pid, {})
        self.input_key.setText(p.get("api_key", ""))
        self.input_url.setText(p.get("base_url", ""))
        if p.get("model"):
            self.cb_model.setCurrentText(p["model"])
        self.slider_temp.setValue(int(p.get("temperature", 0.7) * 10))

        return w

    def _on_provider_changed(self):
        pid = self.cb_provider.currentData()
        defaults = PROVIDER_DEFAULTS.get(pid, {})
        self.input_url.setText(defaults.get("base_url", ""))
        self.cb_model.clear()
        for m in defaults.get("models", []):
            self.cb_model.addItem(m)
        if defaults.get("models"):
            self.cb_model.setCurrentText(defaults["models"][0])

    def _save_api(self):
        cfg = load_config()
        pid = self.cb_provider.currentData()
        providers = cfg.get("api", {}).get("providers", {})
        providers[pid] = {
            "base_url": self.input_url.text(),
            "api_key": self.input_key.text(),
            "model": self.cb_model.currentText(),
            "temperature": self.slider_temp.value() / 10
        }
        cfg["api"]["active_provider"] = pid
        cfg["api"]["providers"] = providers
        save_config(cfg)

    def _test_connection(self):
        import asyncio
        from ai_client import test_connection
        # 先保存
        self._save_api()
        async def test():
            ok, msg = await test_connection()
            QMessageBox.information(self, "连接测试", msg)
        asyncio.ensure_future(test())

    # ============================================================
    # Tab 2: 人设
    # ============================================================
    def _tab_persona(self):
        w = QWidget()
        cfg = load_config()
        persona = cfg.get("persona", {})

        layout = QVBoxLayout(w)

        layout.addWidget(QLabel("角色名称:"))
        self.input_name = QLineEdit(persona.get("name", "菲比"))
        layout.addWidget(self.input_name)

        layout.addWidget(QLabel("System Prompt:"))
        self.prompt_edit = QTextEdit()
        self.prompt_edit.setPlainText(persona.get("system_prompt", "") or PHOEBE_SYSTEM_PROMPT)
        self.prompt_edit.setMinimumHeight(200)
        self.prompt_edit.setStyleSheet("font-family: 'Consolas', 'Courier New', monospace; font-size: 12px;")
        layout.addWidget(self.prompt_edit)

        row = QHBoxLayout()
        row.addWidget(QLabel("每轮最多句数:"))
        self.spin_sentences = QSpinBox()
        self.spin_sentences.setRange(1, 10)
        self.spin_sentences.setValue(persona.get("max_sentences", 4))
        row.addWidget(self.spin_sentences)
        self.chk_emoji = QCheckBox("使用 Emoji")
        self.chk_emoji.setChecked(persona.get("use_emoji", True))
        row.addWidget(self.chk_emoji)
        layout.addLayout(row)

        row2 = QHBoxLayout()
        row2.addWidget(QLabel("记忆:"))
        self.chk_memory = QCheckBox("启用上下文记忆")
        self.chk_memory.setChecked(persona.get("memory_enabled", True))
        row2.addWidget(self.chk_memory)
        self.spin_memory = QSpinBox()
        self.spin_memory.setRange(0, 100)
        self.spin_memory.setValue(persona.get("memory_size", 20))
        row2.addWidget(QLabel("保留最近"))
        row2.addWidget(self.spin_memory)
        row2.addWidget(QLabel("条"))
        layout.addLayout(row2)

        btn_row = QHBoxLayout()
        btn_reset = QPushButton("🔄 恢复默认")
        btn_reset.clicked.connect(lambda: self.prompt_edit.setPlainText(PHOEBE_SYSTEM_PROMPT))
        btn_savep = QPushButton("💾 保存人设")
        btn_savep.clicked.connect(self._save_persona)
        btn_row.addWidget(btn_reset)
        btn_row.addWidget(btn_savep)
        layout.addLayout(btn_row)

        return w

    def _save_persona(self):
        cfg = load_config()
        cfg["persona"] = {
            "name": self.input_name.text(),
            "system_prompt": self.prompt_edit.toPlainText(),
            "max_sentences": self.spin_sentences.value(),
            "use_emoji": self.chk_emoji.isChecked(),
            "formality": 0.7,
            "memory_enabled": self.chk_memory.isChecked(),
            "memory_size": self.spin_memory.value()
        }
        save_config(cfg)

    # ============================================================
    # Tab 3: Skill
    # ============================================================
    def _tab_skills(self):
        w = QWidget()
        layout = QVBoxLayout(w)

        self.skill_list = QListWidget()
        self._refresh_skill_list()
        layout.addWidget(self.skill_list)

        btn_row = QHBoxLayout()
        btn_reset = QPushButton("🔄 恢复默认 Skill")
        btn_reset.clicked.connect(lambda: [save_skills(DEFAULT_SKILLS), self._refresh_skill_list()])
        btn_row.addWidget(btn_reset)
        layout.addLayout(btn_row)

        self.skill_list.itemDoubleClicked.connect(self._edit_skill)
        return w

    def _refresh_skill_list(self):
        self.skill_list.clear()
        skills = load_skills() or DEFAULT_SKILLS
        for sk in skills:
            status = "✅" if sk.get("enabled") else "❌"
            self.skill_list.addItem(f"{status} [{sk.get('trigger','?')}] {sk.get('name','?')} — {sk.get('description','')}")

    def _edit_skill(self, item):
        skills = load_skills() or DEFAULT_SKILLS
        idx = self.skill_list.currentRow()
        if idx < 0 or idx >= len(skills):
            return
        sk = skills[idx]
        sk["enabled"] = not sk.get("enabled", True)
        save_skills(skills)
        self._refresh_skill_list()

    # ============================================================
    # Tab 4: 语音
    # ============================================================
    def _tab_voice(self):
        w = QWidget()
        layout = QVBoxLayout(w)

        from voice_manager import VoiceManager
        self.vm = VoiceManager()

        layout.addWidget(QLabel("已安装语音包:"))
        self.voice_list = QListWidget()
        for p in self.vm.list_packs():
            self.voice_list.addItem(p)
        layout.addWidget(self.voice_list)

        btn_row = QHBoxLayout()
        btn_import = QPushButton("📦 导入语音包 (.zip)")
        btn_import.clicked.connect(self._import_voicepack)
        btn_activate = QPushButton("✅ 设为当前")
        btn_activate.clicked.connect(self._activate_voicepack)
        btn_row.addWidget(btn_import)
        btn_row.addWidget(btn_activate)
        layout.addLayout(btn_row)

        layout.addWidget(QLabel("音量:"))
        self.vol_slider = QSlider(Qt.Orientation.Horizontal)
        self.vol_slider.setRange(0, 100)
        self.vol_slider.setValue(80)
        self.vol_slider.valueChanged.connect(lambda v: setattr(self.vm, 'volume', v))
        layout.addWidget(self.vol_slider)

        self.chk_voice = QCheckBox("启用语音")
        self.chk_voice.setChecked(True)
        self.chk_voice.toggled.connect(lambda v: setattr(self.vm, 'enabled', v))
        layout.addWidget(self.chk_voice)

        layout.addWidget(QLabel("TTS 音色 (Edge TTS, 免费):"))
        self.tts_voice = QComboBox()
        self.tts_voice.addItems([
            "zh-CN-XiaoxiaoNeural (女声·温柔)",
            "zh-CN-XiaoyiNeural (女声·活泼)",
            "zh-CN-YunxiNeural (男声·温暖)",
            "zh-CN-YunyangNeural (男声·新闻)",
        ])
        layout.addWidget(self.tts_voice)

        return w

    def _import_voicepack(self):
        path, _ = QFileDialog.getOpenFileName(self, "导入语音包", "", "ZIP 文件 (*.zip)")
        if path:
            ok, msg = self.vm.import_pack(path)
            self.voice_list.clear()
            for p in self.vm.list_packs():
                self.voice_list.addItem(p)

    def _activate_voicepack(self):
        item = self.voice_list.currentItem()
        if item:
            self.vm.set_active(item.text())

    # ============================================================
    # Tab 5: 历史
    # ============================================================
    def _tab_history(self):
        w = QWidget()
        layout = QVBoxLayout(w)

        self.history_text = QTextEdit()
        self.history_text.setReadOnly(True)
        self.history_text.setStyleSheet("font-size: 12px;")
        layout.addWidget(self.history_text)

        btn_row = QHBoxLayout()
        btn_refresh = QPushButton("🔄 刷新")
        btn_refresh.clicked.connect(self._refresh_history)
        btn_export = QPushButton("📥 导出 JSON")
        btn_export.clicked.connect(self._export_history)
        btn_clear = QPushButton("🗑️ 清除今日")
        btn_clear.clicked.connect(self._clear_history)
        btn_row.addWidget(btn_refresh)
        btn_row.addWidget(btn_export)
        btn_row.addWidget(btn_clear)
        layout.addLayout(btn_row)

        self._refresh_history()
        return w

    def _refresh_history(self):
        from datetime import date
        msgs = load_conversations(date.today().isoformat())
        lines = []
        for m in msgs:
            role = "👤 用户" if m["role"] == "user" else "✨ 菲比"
            lines.append(f"{role}: {m['content']}")
        self.history_text.setPlainText("\n\n".join(lines))

    def _export_history(self):
        path, _ = QFileDialog.getSaveFileName(self, "导出对话", "conversations.json", "JSON (*.json)")
        if path:
            from datetime import date
            msgs = load_conversations(date.today().isoformat())
            Path(path).write_text(json.dumps(msgs, ensure_ascii=False, indent=2), encoding="utf-8")

    def _clear_history(self):
        from datetime import date
        from config import CONV_DIR
        f = CONV_DIR / f"{date.today().isoformat()}.json"
        if f.exists():
            f.unlink()
        self._refresh_history()
