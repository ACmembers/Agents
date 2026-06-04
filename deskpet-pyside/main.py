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
from screen_observer import ScreenObserver


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

        # 屏幕感知 + 主动关怀
        self.observer = ScreenObserver()
        self._screen_context = ""
        self._last_proactive_context = ""
        self._proactive_cooldown = 0  # 冷却计时器

        def on_ctx(ctx):
            self._screen_context = ctx
            # 上下文变化时检查是否需要主动回应
            if ctx and ctx != self._last_proactive_context and self._proactive_cooldown <= 0:
                self._last_proactive_context = ctx
                self._proactive_cooldown = 120  # 2 分钟冷却
                asyncio.ensure_future(self._proactive_check(ctx))

        self.observer.on_context_change = on_ctx

        # 每 30 秒衰减冷却
        self._cooldown_timer = QTimer()
        self._cooldown_timer.timeout.connect(self._decay_cooldown)
        self._cooldown_timer.start(30000)

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
        """双击 → 显示输入框"""
        self._show_input_bar()

    def _show_input_bar(self):
        """显示聊天输入栏 — 放在图片下方"""
        from PySide6.QtWidgets import QLineEdit
        if hasattr(self, '_input_bar') and self._input_bar:
            self._input_bar.deleteLater()

        inp = QLineEdit(self.pet)
        inp.setPlaceholderText("和菲比说点什么…")
        inp.setStyleSheet("""
            QLineEdit {
                background: rgba(255,255,255,0.92);
                border: 1.5px solid #d4a840;
                border-radius: 18px;
                padding: 7px 14px;
                font-size: 13px;
                color: #3e4967;
            }
        """)
        # 放在图片下方，窗口底部
        pet_h = self.pet.height()
        pet_w = self.pet.width()
        bar_w = pet_w - 30
        bar_h = 34
        bar_x = 15
        bar_y = pet_h - bar_h - 10
        inp.setGeometry(bar_x, bar_y, bar_w, bar_h)
        inp.returnPressed.connect(lambda: self._send_message(inp))
        inp.show()
        inp.setFocus()
        self._input_bar = inp

    def _send_message(self, inp):
        text = inp.text().strip()
        if not text:
            return
        inp.deleteLater()
        self._input_bar = None
        self.pet.speak("")
        self._show_bubble("…")
        asyncio.ensure_future(self._do_chat(text))

    async def _do_chat(self, message: str):
        ctx = self._screen_context
        system_prompt = build_system_prompt(screen_context=ctx)
        try:
            reply = await chat(message, system_prompt)
        except Exception:
            reply = "唔… 我好像卡住了 (._.)"
        save_message("user", message)
        save_message("assistant", reply)
        self._show_bubble(reply)
        self.pet.idle()
        # 回复后重新显示输入框，方便连续对话
        self._show_input_bar()

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
        system_prompt = build_system_prompt([skill_prompt], screen_context=self._screen_context)
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

    def _decay_cooldown(self):
        if self._proactive_cooldown > 0:
            self._proactive_cooldown -= 30

    async def _proactive_check(self, ctx: str):
        """检测到用户切换应用 → AI 判断是否主动搭话"""
        if not ctx:
            return
        system_prompt = build_system_prompt(screen_context=ctx)
        # 让 AI 决定是否回应
        check_prompt = (
            f"{system_prompt}\n\n"
            f"## 用户当前状态\n{ctx}\n\n"
            f"你注意到用户切换了应用。请判断是否应该主动说点什么。"
            f"如果用户刚开始一个新任务，可以简短鼓励一句（不超过1句话）。"
            f"如果不需要说话，回复一个字「无」。"
        )
        try:
            reply = await chat("", check_prompt)
            reply = reply.strip()
            if reply and reply != "无" and len(reply) > 1:
                save_message("assistant", reply)
                self._show_bubble(reply)
                self.pet.speak("")
                QTimer.singleShot(3000, self.pet.idle)
        except Exception:
            pass

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
