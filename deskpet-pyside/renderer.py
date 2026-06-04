"""动画引擎 — 帧缓存版：零 per-frame 计算"""

import math
from PySide6.QtCore import QObject, QTimer, Qt
from PySide6.QtGui import QPixmap, QPainter
from PySide6.QtWidgets import QLabel

ANIM_IDLE = "idle"
ANIM_SPEAKING = "speaking"
ANIM_SLEEPING = "sleeping"

FRAMES = 10       # 预渲染帧数
FPS = 10          # 帧率
BREATH_AMP = 0.006


class PetRenderer(QObject):
    def __init__(self, label: QLabel, parent=None):
        super().__init__(parent)
        self.label = label
        self._base: QPixmap | None = None
        self._idle_frames: list[QPixmap] = []     # 预渲染呼吸帧
        self._speak_frames: list[QPixmap] = []    # 预渲染说话帧
        self._sleep_frames: list[QPixmap] = []    # 预渲染睡觉帧
        self._tap_frames: list[QPixmap] = []      # 点击晃动帧

        self.anim_state = ANIM_IDLE
        self._frame_idx = 0
        self._tap_idx = 0
        self._tap_frames_left = 0

        self.timer = QTimer(self)
        self.timer.timeout.connect(self._tick)
        self.timer.start(1000 // FPS)

    # ============================================================
    # 预渲染所有帧（load_image 时一次性完成）
    # ============================================================

    def load_image(self, path: str):
        self._base = QPixmap(path)
        self._prerender()

    def _prerender(self):
        """预计算所有动画帧 — 之后只做 QLabel.setPixmap 切换"""
        if not self._base:
            return
        lw, lh = self.label.width(), self.label.height()
        if lw <= 0 or lh <= 0:
            return

        fit_h = int(lh * 0.75)
        scaled = self._base.scaledToHeight(fit_h, Qt.TransformationMode.SmoothTransformation)
        pw, ph = scaled.width(), scaled.height()

        # idle 呼吸帧
        self._idle_frames.clear()
        for i in range(FRAMES):
            phase = (i / FRAMES) * 2 * math.pi
            breath = math.sin(phase) * BREATH_AMP
            sx = 1.0 + breath
            sy = 1.0 + breath * 0.5
            nw, nh = max(10, int(pw * sx)), max(10, int(ph * sy))
            frame = self._make_frame(scaled, nw, nh, 0, 0, 1.0)
            self._idle_frames.append(frame)

        # speaking 帧（嘴部动作由气泡表现，这里只做弹跳）
        self._speak_frames.clear()
        for i in range(FRAMES):
            phase = (i / FRAMES) * 2 * math.pi
            bounce = abs(math.sin(phase * 3)) * 4
            nw = pw
            nh = ph
            frame = self._make_frame(scaled, nw, nh, 0, -int(bounce), 1.0)
            self._speak_frames.append(frame)

        # sleep 帧
        self._sleep_frames.clear()
        for i in range(FRAMES):
            phase = (i / FRAMES) * 2 * math.pi
            breath = math.sin(phase) * BREATH_AMP * 0.4
            sx = 1.0 + breath
            sy = 1.0 + breath * 0.3
            nw, nh = max(10, int(pw * sx)), max(10, int(ph * sy))
            frame = self._make_frame(scaled, nw, nh, 0, 0, 0.5)
            self._sleep_frames.append(frame)

        # tap 晃动帧
        self._tap_frames.clear()
        for i in range(8):
            t = i / 7
            shake = math.sin(t * math.pi * 3) * 8 * (1 - t)
            frame = self._make_frame(scaled, pw, ph, int(shake), 0, 1.0)
            self._tap_frames.append(frame)

    def _make_frame(self, src: QPixmap, w: int, h: int,
                    ox: int, oy: int, opacity: float) -> QPixmap:
        """渲染一帧到透明画布"""
        lw, lh = self.label.width(), self.label.height()
        canvas = QPixmap(lw, lh)
        canvas.fill(Qt.GlobalColor.transparent)
        p = QPainter(canvas)
        p.setOpacity(opacity)
        x = (lw - w) // 2 + ox
        y = (lh - h) // 2 - 15 + oy  # 偏上
        scaled = src.scaled(w, h, Qt.AspectRatioMode.KeepAspectRatio,
                            Qt.TransformationMode.SmoothTransformation)
        p.drawPixmap(x, y, scaled)
        p.end()
        return canvas

    # ============================================================
    # 每帧：只切换 QPixmap，零计算
    # ============================================================

    def _tick(self):
        if self._tap_frames_left > 0:
            self._tap_frames_left -= 1
            self.label.setPixmap(self._tap_frames[self._tap_idx])
            self._tap_idx = (self._tap_idx + 1) % len(self._tap_frames)
            if self._tap_frames_left == 0:
                self._frame_idx = 0  # 回到呼吸
            return

        frames = self._idle_frames
        if self.anim_state == ANIM_SPEAKING:
            frames = self._speak_frames
        elif self.anim_state == ANIM_SLEEPING:
            frames = self._sleep_frames

        if not frames:
            return

        self.label.setPixmap(frames[self._frame_idx])
        self._frame_idx = (self._frame_idx + 1) % len(frames)

    def set_anim(self, state: str):
        self.anim_state = state
        self._frame_idx = 0

    def tap(self, zone: str = ""):
        if self._tap_frames:
            self._tap_idx = 0
            self._tap_frames_left = len(self._tap_frames)
