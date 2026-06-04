import { BrowserWindow, ipcMain, app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import type { DeepseekConfig, PetState } from '../shared/types'

/** 配置文件路径 */
function getConfigPath(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'config.json')
}

/** 状态文件路径 */
function getStatePath(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'pet-state.json')
}

/** 注册所有 IPC 处理器 */
export function registerIpcHandlers(_win: BrowserWindow): void {
  // 设置相关
  ipcMain.handle('settings:get', async (): Promise<DeepseekConfig> => {
    try {
      const data = readFileSync(getConfigPath(), 'utf-8')
      return JSON.parse(data)
    } catch {
      return {
        apiKey: '',
        model: 'deepseek-chat',
        temperature: 0.7
      }
    }
  })

  ipcMain.handle('settings:set', async (_event, config: Partial<DeepseekConfig>) => {
    const existing = await ipcMain.emit('settings:get')
    // 读取现有配置
    let current: DeepseekConfig = {
      apiKey: '',
      model: 'deepseek-chat',
      temperature: 0.7
    }
    try {
      const data = readFileSync(getConfigPath(), 'utf-8')
      current = { ...current, ...JSON.parse(data) }
    } catch { /* 使用默认值 */ }

    const merged = { ...current, ...config }
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(getConfigPath(), JSON.stringify(merged, null, 2))
  })

  // 宠物状态持久化
  ipcMain.handle('pet:state-save', async (_event, state: PetState) => {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(getStatePath(), JSON.stringify(state, null, 2))
  })

  ipcMain.handle('pet:state-load', async (): Promise<PetState | null> => {
    try {
      const data = readFileSync(getStatePath(), 'utf-8')
      return JSON.parse(data)
    } catch {
      return null
    }
  })
}
