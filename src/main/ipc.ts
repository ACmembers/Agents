import { BrowserWindow, ipcMain, app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import type { DeepseekConfig, PetState, ModelMeta } from '../shared/types'

function getConfigPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

function getStatePath(): string {
  return join(app.getPath('userData'), 'pet-state.json')
}

function getModelsDir(): string {
  return join(app.getPath('userData'), 'models')
}

export function registerIpcHandlers(win: BrowserWindow): void {
  // ====================
  // 设置
  // ====================
  ipcMain.handle('settings:get', async (): Promise<DeepseekConfig> => {
    try {
      const data = readFileSync(getConfigPath(), 'utf-8')
      return JSON.parse(data)
    } catch {
      return { apiKey: '', model: 'deepseek-chat', temperature: 0.7 }
    }
  })

  ipcMain.handle('settings:set', async (_event, config: Partial<DeepseekConfig>) => {
    let current: DeepseekConfig = { apiKey: '', model: 'deepseek-chat', temperature: 0.7 }
    try {
      current = { ...current, ...JSON.parse(readFileSync(getConfigPath(), 'utf-8')) }
    } catch { /* use defaults */ }
    const merged = { ...current, ...config }
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(getConfigPath(), JSON.stringify(merged, null, 2))
  })

  // ====================
  // 宠物状态
  // ====================
  ipcMain.handle('pet:state-save', async (_event, state: PetState) => {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(getStatePath(), JSON.stringify(state, null, 2))
  })

  ipcMain.handle('pet:state-load', async (): Promise<PetState | null> => {
    try {
      return JSON.parse(readFileSync(getStatePath(), 'utf-8'))
    } catch { return null }
  })

  // ====================
  // 窗口移动
  // ====================
  ipcMain.handle('window:move', async (_event, deltaX: number, deltaY: number) => {
    const w = BrowserWindow.fromWebContents(_event.sender)
    if (w) {
      const [x, y] = w.getPosition()
      w.setPosition(x + deltaX, y + deltaY)
    }
  })

  // ====================
  // 模型管理
  // ====================
  ipcMain.handle('model:list', async (): Promise<ModelMeta[]> => {
    const modelsDir = getModelsDir()
    if (!existsSync(modelsDir)) return []
    try {
      const entries = readdirSync(modelsDir, { withFileTypes: true })
      const models: ModelMeta[] = []
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const dir = join(modelsDir, entry.name)
        const files = readdirSync(dir)
        const model3Json = files.find((f) => f.endsWith('.model3.json') || f.endsWith('.model.json'))
        if (model3Json) {
          models.push({ name: entry.name, path: entry.name, model3Json })
        }
      }
      return models
    } catch { return [] }
  })

  ipcMain.handle('model:set-active', async (_event, name: string) => {
    const configPath = getConfigPath()
    let config: any = {}
    try { config = JSON.parse(readFileSync(configPath, 'utf-8')) } catch { /* ok */ }
    config.activeModel = name
    writeFileSync(configPath, JSON.stringify(config, null, 2))
  })
}
