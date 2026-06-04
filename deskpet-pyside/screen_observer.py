"""屏幕感知 — 获取当前活跃窗口 + 截屏能力"""

import sys
import ctypes
from ctypes import wintypes
from PySide6.QtCore import QObject, QTimer

# Windows API
user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32


def get_active_window_title() -> str:
    """获取当前活跃窗口标题"""
    try:
        hwnd = user32.GetForegroundWindow()
        length = user32.GetWindowTextLengthW(hwnd)
        if length == 0:
            return ""
        buf = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buf, length + 1)
        return buf.value
    except Exception:
        return ""


def get_active_process_name() -> str:
    """获取当前活跃进程名"""
    try:
        hwnd = user32.GetForegroundWindow()
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        handle = kernel32.OpenProcess(0x0400 | 0x0010, False, pid.value)
        if handle:
            buf = ctypes.create_unicode_buffer(260)
            kernel32.QueryFullProcessImageNameW(handle, 0, buf, ctypes.byref(wintypes.DWORD(260)))
            kernel32.CloseHandle(handle)
            path = buf.value
            return path.split("\\")[-1].replace(".exe", "")
        return ""
    except Exception:
        return ""


class ScreenObserver(QObject):
    """定期检测用户行为并注入上下文到 AI"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._last_title = ""
        self._last_process = ""
        self._focus_start = 0
        self._current_context = ""
        self.on_context_change = None   # callback(context_summary)

        # 每 10 秒检测一次活跃窗口
        self._timer = QTimer(self)
        self._timer.timeout.connect(self._check)
        self._timer.start(10000)

    def _check(self):
        title = get_active_window_title()
        process = get_active_process_name()

        if title != self._last_title or process != self._last_process:
            self._last_title = title
            self._last_process = process

            # 构建上下文
            context = self._build_context(title, process)
            if context != self._current_context:
                self._current_context = context
                if self.on_context_change:
                    self.on_context_change(context)

    def _build_context(self, title: str, process: str) -> str:
        app_hints = {
            "Code": "用户正在写代码",
            "devenv": "用户在使用 Visual Studio",
            "pycharm": "用户在使用 PyCharm 写代码",
            "idea": "用户在使用 IntelliJ",
            "chrome": "用户正在浏览网页",
            "msedge": "用户正在浏览网页",
            "firefox": "用户正在浏览网页",
            "WeChat": "用户正在用微信聊天",
            "explorer": "用户正在浏览文件",
            "Terminal": "用户在使用终端",
            "cmd": "用户在使用命令行",
            "powershell": "用户在使用 PowerShell",
            "Notepad": "用户正在写笔记",
            "Obsidian": "用户正在记笔记",
            "Word": "用户正在写文档",
            "Excel": "用户正在处理表格",
            "Steam": "用户正在玩游戏",
            "Spotify": "用户正在听音乐",
            "QQMusic": "用户正在听音乐",
        }

        hint = ""
        for key, value in app_hints.items():
            if key.lower() in process.lower() or key.lower() in title.lower():
                hint = value
                break

        if title:
            return f"{hint}（活跃窗口: {title[:60]}）" if hint else f"用户当前活跃窗口: {title[:60]}"
        return ""

    def get_context(self) -> str:
        """获取当前上下文（注入到 AI prompt）"""
        return self._current_context

    def stop(self):
        self._timer.stop()
