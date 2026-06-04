"""DeskPet — PySide6 桌面宠物入口"""

import sys
import io
import asyncio
from pathlib import Path
from PySide6.QtWidgets import QApplication, QSystemTrayIcon, QMenu, QLabel
from PySide6.QtGui import QIcon
from PySide6.QtCore import QTimer
import qasync

# Windows 控制台 UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from pet_window import PetWindow
from renderer import ANIM_SPEAKING, ANIM_IDLE
from persona import build_system_prompt, save_message
from ai_client import chat
from skill_scheduler import SkillScheduler
from config import load_config


class App:
    def __init__(self):
        self.app = QApplication(sys.argv)
        self.app.setApplicationName("DeskPet")
        self.app.setQuitOnLastWindowClosed(False)

        # 加载外观图片
        cfg = load_config()
        img_path = cfg.get("appearance", {}).get("image_path", "")
        if not img_path:
            img_path = str(Path(__file__).parent / "assets" / "phoebe.jpg")

        self.pet = PetWindow()
        self.pet.renderer.load_image(img_path)
        self.pet.on_double_click = self._on_chat
        self.pet.on_tap = self._on_tap

        self.tray = self._create_tray()
        self._bubble_label: QLabel | None = None
        self.bubble_timer = QTimer()
        self.bubble_timer.setSingleShot(True)
        self.bubble_timer.timeout.connect(self._clear_bubble)

        # Skill 调度器
        self.scheduler = SkillScheduler()
        self.scheduler.on_skill_triggered = self._on_skill
        self.scheduler.load()
        self.scheduler.trigger_startup()

        QTimer.singleShot(3000, self._greeting)

    def _create_tray(self):
        icon_path = Path(__file__).parent / "assets" / "phoebe.jpg"
        icon = QIcon(str(icon_path)) if icon_path.exists() else QIcon()
        tray = QSystemTrayIcon(icon, self.app)
        tray.setToolTip("DeskPet")

        menu = QMenu()
        menu.addAction("显示/隐藏", self._toggle_visible)
        menu.addSeparator()
        menu.addAction("⚙️ 设置", self._open_settings)
        menu.addSeparator()
        menu.addAction("❌ 退出", self._quit)
        tray.setContextMenu(menu)
        tray.activated.connect(self._on_tray_activated)
        tray.show()
        return tray

    def _toggle_visible(self):
        self.pet.setVisible(not self.pet.isVisible())

    def _open_settings(self):
        from settings_window import SettingsWindow
        self.settings_win = SettingsWindow(app_ref=self)
        self.settings_win.show()

    def _quit(self):
        self.app.quit()

    def _on_tray_activated(self, reason):
        if reason == QSystemTrayIcon.ActivationReason.DoubleClick:
            self._toggle_visible()

    def _on_chat(self):
        self.pet.speak("")
        self._show_bubble("稍等，让我想想… 🤔")
        asyncio.ensure_future(self._do_chat())

    async def _do_chat(self):
        system_prompt = build_system_prompt()
        try:
            reply = await chat("今天过得怎么样呀？陪我聊聊天吧！", system_prompt)
        except Exception:
            reply = "唔… 我好像卡住了 (._.)"
        save_message("user", "今天过得怎么样呀？陪我聊聊天吧！")
        save_message("assistant", reply)
        self._show_bubble(reply)
        self.pet.idle()

    def _on_tap(self, zone: str):
        replies = {
            "head": "诶嘿~ 别摸头啦 ✨",
            "face": "别戳啦... 会害羞的",
            "body": "嗯？怎么啦？",
        }
        self._show_bubble(replies.get(zone, "嗯？"))

    def _on_skill(self, skill: dict):
        skill_name = skill.get("name", "")
        prompt = skill.get("prompt", "")
        self._show_bubble(f"({skill_name})")
        asyncio.ensure_future(self._do_skill_chat(prompt))

    async def _do_skill_chat(self, skill_prompt: str):
        system_prompt = build_system_prompt([skill_prompt])
        try:
            reply = await chat("", system_prompt)
        except Exception:
            reply = "唔… 信号不太好呢 (._.)"
        save_message("assistant", reply)
        self._show_bubble(reply)
        self.pet.idle()

    def _show_bubble(self, text: str):
        if self._bubble_label:
            self._bubble_label.deleteLater()
        bubble = QLabel(text, self.pet)
        bubble.setStyleSheet("""
            background: rgba(255,255,255,0.92);
            border: 1px solid #e0d5c0;
            border-radius: 14px;
            padding: 10px 16px;
            font-size: 13px;
            color: #3e4967;
        """)
        bubble.setWordWrap(True)
        bubble.setMaximumWidth(240)
        bubble.adjustSize()
        bw = bubble.width()
        bubble.setGeometry((self.pet.width() - bw) // 2, 10, bw, bubble.height())
        bubble.show()
        self._bubble_label = bubble
        self.bubble_timer.start(8000)

    def _clear_bubble(self):
        if self._bubble_label:
            self._bubble_label.deleteLater()
            self._bubble_label = None

    def _greeting(self):
        self._show_bubble("早安，今天也是充满希望的一天 ✨")

    def run(self):
        self.pet.show()
        loop = qasync.QEventLoop(self.app)
        asyncio.set_event_loop(loop)
        with loop:
            loop.run_forever()


if __name__ == "__main__":
    App().run()
