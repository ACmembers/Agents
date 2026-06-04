"""透明宠物窗口 — Qt 无边框置顶窗口 + 交互处理"""

from pathlib import Path
from PySide6.QtCore import Qt, QPoint
from PySide6.QtWidgets import QWidget, QLabel, QVBoxLayout

from renderer import PetRenderer, ANIM_IDLE, ANIM_SPEAKING, ANIM_SLEEPING

PET_W, PET_H = 320, 400


class PetWindow(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("DeskPet")
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint
            | Qt.WindowType.WindowStaysOnTopHint
            | Qt.WindowType.Tool
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.setFixedSize(PET_W, PET_H)

        # 图片标签（填满窗口）
        self.pet_label = QLabel(self)
        self.pet_label.setGeometry(0, 0, PET_W, PET_H)
        self.pet_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.pet_label.setStyleSheet("background: transparent;")

        # 动画渲染器
        self.renderer = PetRenderer(self.pet_label, self)
        img_path = Path(__file__).parent / "assets" / "phoebe.jpg"
        if img_path.exists():
            self.renderer.load_image(str(img_path))

        # 状态
        self._drag_pos: QPoint | None = None
        self.anim_state = ANIM_IDLE

        # 技能回调（由 main.py 注入）
        self.on_double_click = None
        self.on_tap = None

    # ============================================================
    # 交互事件
    # ============================================================

    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self._drag_pos = event.globalPosition().toPoint()

    def mouseMoveEvent(self, event):
        if self._drag_pos is not None:
            delta = event.globalPosition().toPoint() - self._drag_pos
            self.move(self.pos() + delta)
            self._drag_pos = event.globalPosition().toPoint()

    def mouseReleaseEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            drag_dist = 0
            if self._drag_pos is not None:
                drag_dist = (event.globalPosition().toPoint() - self._drag_pos).manhattanLength()
            self._drag_pos = None

            # 短按 = 点击（< 5px 移动）
            if drag_dist < 5:
                self._handle_click(event)

    def mouseDoubleClickEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            if self.on_double_click:
                self.on_double_click()

    def _handle_click(self, event):
        """点击热区检测 + 反馈"""
        y_ratio = event.position().y() / PET_H
        if y_ratio < 0.3:
            zone = "head"
        elif y_ratio < 0.7:
            zone = "face"
        else:
            zone = "body"
        self.renderer.tap(zone)
        if self.on_tap:
            self.on_tap(zone)

    # ============================================================
    # 动画控制
    # ============================================================

    def set_anim(self, state: str):
        self.anim_state = state
        self.renderer.set_anim(state)

    def speak(self, text: str):
        """触发说话动画"""
        self.set_anim(ANIM_SPEAKING)

    def idle(self):
        self.set_anim(ANIM_IDLE)

    def sleep(self):
        self.set_anim(ANIM_SLEEPING)
