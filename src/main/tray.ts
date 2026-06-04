import { app, BrowserWindow, Menu, Tray } from 'electron'
import { join } from 'path'

let tray: Tray | null = null

export function createTray(win: BrowserWindow): void {
  const iconPath = join(__dirname, '../../public/icon-tray.png')

  tray = new Tray(iconPath)
  tray.setToolTip('DeskPet — 我的 AI 桌宠')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示/隐藏',
      click: () => {
        if (win.isVisible()) {
          win.hide()
        } else {
          win.show()
          win.focus()
        }
      }
    },
    { type: 'separator' },
    {
      label: '设置',
      click: () => {
        win.webContents.send('open-settings')
        win.show()
        win.focus()
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    if (win.isVisible()) {
      win.hide()
    } else {
      win.show()
      win.focus()
    }
  })
}
