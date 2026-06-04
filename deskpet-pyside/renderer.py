"""动画渲染引擎 — 优化版：预缩放 + 最小化重绘"""

import math
from PySide6.QtCore import QObject, QTimer, Qt, QRect
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
        self.scaled_pixmap: QPixmap | None = None  # 预缩放的基准图
        self._display_pixmap: QPixmap | None = None  # 当前帧

        self.anim_state = ANIM_IDLE
        self.breath_phase = 0.0
        self.talk_phase = 0.0
        self.tap_reaction = 0.0
        self._dirty = True  # 是否需要重绘

        self.timer = QTimer(self)
        self.timer.timeout.connect(self._tick)
        self.timer.start(66)  # ~15fps — 桌宠不需要 30fps

    def load_image(self, path: str):
        self.base_pixmap = QPixmap(path)
        self._rescale()
        self._redraw()

    def _rescale(self):
        """预缩放一次，不在每帧做"""
        if not self.base_pixmap:
            return
        lh = self.label.height()
        if lh <= 0:
            return
        fit_h = int(lh * 0.85)
        self.scaled_pixmap = self.base_pixmap.scaledToHeight(
            fit_h, Qt.TransformationMode.SmoothTransformation
        )

    def _tick(self):
        self.breath_phase += 0.1
        if self.anim_state == ANIM_SPEAKING:
            self.talk_phase += 0.6
        if self.tap_reaction > 0:
            self.tap_reaction = max(0, self.tap_reaction - 0.16)
        self._redraw()

    def _redraw(self):
        if not self.scaled_pixmap:
            return
        lw, lh = self.label.width(), self.label.height()
        if lw <= 0 or lh <= 0:
            return

        pix = self.scaled_pixmap
        pw, ph = pix.width(), pix.height()

        # 呼吸缩放
        breath = math.sin(self.breath_phase) * 0.006
        if self.anim_state == ANIM_SLEEPING:
            breath *= 0.4

        sx, sy = 1.0 + breath, 1.0 + breath * 0.5
        nw = max(10, int(pw * sx))
        nh = max(10, int(ph * sy))

        # 说话弹跳
        oy = int((lh - nh) // 2)
        if self.anim_state == ANIM_SPEAKING:
            oy -= int(abs(math.sin(self.talk_phase)) * 4)

        # 点击晃动
        ox = int((lw - nw) // 2)
        if self.tap_reaction > 0:
            ox += int(math.sin(self.tap_reaction * 20) * 8 * self.tap_reaction)

        # 只用 QPixmap.scaled，不用 QPainter（省掉创建 QPainter 的开销）
        frame = pix.scaled(nw, nh,
                           Qt.AspectRatioMode.KeepAspectRatio,
                           Qt.TransformationMode.SmoothTransformation)

        # 只在位置/尺寸变化时创建新 QPixmap
        if nw != lw or nh != lh:
            canvas = QPixmap(lw, lh)
            canvas.fill(Qt.GlobalColor.transparent)
            p = QPainter(canvas)
            if self.anim_state == ANIM_SLEEPING:
                p.setOpacity(0.6)
            p.drawPixmap(ox, oy, frame)
            p.end()
            self._display_pixmap = canvas
        elif ox != getattr(self, '_last_ox', -1) or oy != getattr(self, '_last_oy', -1):
            canvas = QPixmap(lw, lh)
            canvas.fill(Qt.GlobalColor.transparent)
            p = QPainter(canvas)
            if self.anim_state == ANIM_SLEEPING:
                p.setOpacity(0.6)
            p.drawPixmap(ox, oy, frame)
            p.end()
            self._display_pixmap = canvas
        else:
            # 尺寸位置没变 → 复用上一帧，不创建新对象
            pass

        self._last_ox, self._last_oy = ox, oy
        self.label.setPixmap(self._display_pixmap or canvas or frame)

    def set_anim(self, state: str):
        self.anim_state = state
        if state != ANIM_SPEAKING:
            self.talk_phase = 0

    def tap(self, zone: str):
        self.tap_reaction = 1.0
