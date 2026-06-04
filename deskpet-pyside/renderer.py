"""动画渲染引擎 — QTimer 驱动的 QPixmap 动画"""

import math
from PySide6.QtCore import QObject, QTimer, Qt
from PySide6.QtGui import QPixmap, QPainter
from PySide6.QtWidgets import QLabel

ANIM_IDLE = "idle"
ANIM_SPEAKING = "speaking"
ANIM_SLEEPING = "sleeping"


class PetRenderer(QObject):
    def __init__(self, label: QLabel, parent=None):
        super().__init__(parent)
        self.label = label
        self.base_pixmap: QPixmap | None = None
        self.anim_state = ANIM_IDLE
        self.breath_phase = 0.0
        self.talk_phase = 0.0
        self.tap_reaction = 0.0
        self.tap_zone = "body"

        self.timer = QTimer(self)
        self.timer.timeout.connect(self._tick)
        self.timer.start(33)  # ~30fps

    def load_image(self, path: str):
        self.base_pixmap = QPixmap(path)
        self._redraw()

    def _tick(self):
        self.breath_phase += 0.05
        if self.anim_state == ANIM_SPEAKING:
            self.talk_phase += 0.3
        if self.tap_reaction > 0:
            self.tap_reaction = max(0, self.tap_reaction - 0.08)
        self._redraw()

    def _redraw(self):
        if not self.base_pixmap:
            return
        lw, lh = self.label.width(), self.label.height()
        if lw <= 0 or lh <= 0:
            return

        # 等比缩放
        fit_h = int(lh * 0.85)
        scaled = self.base_pixmap.scaledToHeight(fit_h, Qt.TransformationMode.SmoothTransformation)

        # 呼吸
        breath = math.sin(self.breath_phase) * 0.006
        sx, sy = 1 + breath, 1 + breath * 0.5
        if self.anim_state == ANIM_SLEEPING:
            sx, sy = 1 + breath * 0.4, 1 + breath * 0.2

        new_w = max(10, int(scaled.width() * sx))
        new_h = max(10, int(scaled.height() * sy))
        scaled = scaled.scaled(new_w, new_h,
                               Qt.AspectRatioMode.KeepAspectRatio,
                               Qt.TransformationMode.SmoothTransformation)

        # 偏移
        ox = (lw - scaled.width()) // 2
        oy = (lh - scaled.height()) // 2
        if self.tap_reaction > 0:
            ox += int(math.sin(self.tap_reaction * 20) * 8 * self.tap_reaction)
        if self.anim_state == ANIM_SPEAKING:
            oy -= int(abs(math.sin(self.talk_phase)) * 4)

        # 绘制
        final = QPixmap(lw, lh)
        final.fill(Qt.GlobalColor.transparent)
        p = QPainter(final)
        if self.anim_state == ANIM_SLEEPING:
            p.setOpacity(0.6)
        p.drawPixmap(ox, oy, scaled)
        p.end()

        self.label.setPixmap(final)

    def set_anim(self, state: str):
        self.anim_state = state
        if state != ANIM_SPEAKING:
            self.talk_phase = 0

    def tap(self, zone: str):
        self.tap_reaction = 1.0
        self.tap_zone = zone
