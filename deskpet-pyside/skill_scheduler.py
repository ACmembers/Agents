"""Skill 调度器 — QTimer 定时触发 + 关键词检测 + 手动/启动触发"""

import random
from datetime import datetime
from PySide6.QtCore import QObject, QTimer
from config import load_skills, save_skills
from phoebe_skills import DEFAULT_SKILLS


class SkillScheduler(QObject):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.skills: list[dict] = []
        self.timers: dict[str, QTimer] = {}
        self.last_triggered: dict[str, float] = {}
        self.on_skill_triggered = None  # callback(skill)

    def load(self):
        """加载技能（优先用户配置，否则用默认）"""
        saved = load_skills()
        if not saved:
            saved = DEFAULT_SKILLS
            save_skills(saved)
        self.skills = saved
        self._start_timers()

    def _start_timers(self):
        """启动所有 timer 类型技能"""
        for t in self.timers.values():
            t.stop()
        self.timers.clear()

        for skill in self.skills:
            if skill["trigger"] != "timer" or not skill.get("enabled"):
                continue
            cfg = skill.get("config", {})
            interval = cfg.get("interval", 3600)  # 秒
            variance = cfg.get("random_variance", 300)

            # 初始随机延迟
            init_delay = random.randint(5000, 15000)  # 5-15 秒后开始
            timer = QTimer(self)
            timer.setSingleShot(True)
            timer.timeout.connect(lambda s=skill: self._fire_timer(s, interval, variance))
            timer.start(init_delay)
            self.timers[skill["id"]] = timer

    def _fire_timer(self, skill: dict, interval: int, variance: int):
        """定时器触发"""
        self._trigger(skill)
        # 设置下一次
        next_interval = (interval + random.randint(-variance, variance)) * 1000
        next_interval = max(60000, next_interval)  # 最少 1 分钟
        timer = QTimer(self)
        timer.setSingleShot(True)
        timer.timeout.connect(lambda s=skill: self._fire_timer(s, interval, variance))
        timer.start(int(next_interval))
        self.timers[skill["id"]] = timer

    def check_keywords(self, message: str) -> list[dict]:
        """检测用户消息中的关键词技能"""
        triggered = []
        now = datetime.now().timestamp()
        for skill in self.skills:
            if skill["trigger"] != "keyword" or not skill.get("enabled"):
                continue
            cooldown = skill.get("cooldown", 60)
            last = self.last_triggered.get(skill["id"], 0)
            if now - last < cooldown:
                continue
            cfg = skill.get("config", {})
            keywords = cfg.get("keywords", [])
            msg_lower = message.lower()
            for kw in keywords:
                if kw.lower() in msg_lower:
                    triggered.append(skill)
                    self.last_triggered[skill["id"]] = now
                    break
        return triggered

    def trigger_startup(self):
        """触发所有 startup 技能"""
        for skill in self.skills:
            if skill["trigger"] == "startup" and skill.get("enabled"):
                cfg = skill.get("config", {})
                delay = cfg.get("delay", 3) * 1000
                QTimer.singleShot(int(delay), lambda s=skill: self._trigger(s))

    def trigger_manual(self, skill_id: str):
        """手动触发指定技能"""
        for skill in self.skills:
            if skill["id"] == skill_id and skill.get("enabled"):
                self._trigger(skill)
                return

    def _trigger(self, skill: dict):
        """触发技能 → 回调"""
        if self.on_skill_triggered:
            self.on_skill_triggered(skill)

    def get_manual_skills(self) -> list[dict]:
        """获取所有手动技能"""
        return [s for s in self.skills if s["trigger"] == "manual" and s.get("enabled")]

    def reload(self):
        self.load()
