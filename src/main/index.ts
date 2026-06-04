import { app, BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc'
import { createTray } from './tray'
import { registerModelProtocol } from './modelProtocol'

// ============================================================
// 🚀 性能优化：GPU 加速与渲染标志
// ============================================================

// 强制使用 GPU 硬件加速（而非软件渲染）
app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch('enable-gpu-rasterization')
// 使用更快的合成器
app.commandLine.appendSwitch('enable-zero-copy')
// 限制最大帧率以减少不必要的 GPU 开销（桌宠 30fps 足矣）
app.commandLine.appendSwitch('frame-rate-limit', '30')

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: 320,
    height: 400,
    x: screenWidth - 360,
    y: 100,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    show: false,                 // 准备好后再显示，避免白闪
    paintWhenInitiallyHidden: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,  // ⭐ 后台不降帧，桌宠动画保持流畅
      offscreen: false,             // 不使用离屏渲染（透明窗口需要实际绘制）
      sandbox: false                // preload 需要访问文件系统 IPC
    }
  })

  // ⭐ 性能：采用分层合成模式，透明窗口专用
  mainWindow.setContentProtection(false)

  // 准备好后再展示
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // 加载渲染进程
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 开发模式打开 DevTools
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }
}

app.whenReady().then(() => {
  registerModelProtocol()
  createWindow()
  createTray(mainWindow!)
  registerIpcHandlers(mainWindow!)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // ⭐ 性能：窗口失去焦点时仍然渲染（透明桌宠需要）
  app.on('browser-window-blur', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.setFrameRate(15) // 失焦降到 15fps 省电
    }
  })
  app.on('browser-window-focus', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.setFrameRate(30) // 恢复 30fps
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
