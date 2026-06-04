import { contextBridge, ipcRenderer } from 'electron'
import type { DeepseekConfig, PetState, ModelMeta } from '../shared/types'

const api = {
  deepseekChat: (message: string): Promise<string> =>
    ipcRenderer.invoke('deepseek:chat', message),

  getSettings: (): Promise<DeepseekConfig> =>
    ipcRenderer.invoke('settings:get'),
  setSettings: (config: Partial<DeepseekConfig>): Promise<void> =>
    ipcRenderer.invoke('settings:set', config),

  savePetState: (state: PetState): Promise<void> =>
    ipcRenderer.invoke('pet:state-save', state),
  loadPetState: (): Promise<PetState | null> =>
    ipcRenderer.invoke('pet:state-load'),

  // 窗口移动
  moveWindow: (deltaX: number, deltaY: number): Promise<void> =>
    ipcRenderer.invoke('window:move', deltaX, deltaY),

  // 模型管理
  listModels: (): Promise<ModelMeta[]> =>
    ipcRenderer.invoke('model:list'),
  setActiveModel: (name: string): Promise<void> =>
    ipcRenderer.invoke('model:set-active', name),

  onOpenSettings: (callback: () => void) => {
    ipcRenderer.on('open-settings', callback)
    return () => ipcRenderer.removeListener('open-settings', callback)
  }
}

contextBridge.exposeInMainWorld('deskpet', api)
