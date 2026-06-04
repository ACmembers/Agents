import { contextBridge, ipcRenderer } from 'electron'
import type { DeepseekConfig, PetState } from '../shared/types'

/** 暴露给渲染进程的 API */
const api = {
  // Deepseek 聊天
  deepseekChat: (message: string): Promise<string> =>
    ipcRenderer.invoke('deepseek:chat', message),

  // 设置管理
  getSettings: (): Promise<DeepseekConfig> =>
    ipcRenderer.invoke('settings:get'),
  setSettings: (config: Partial<DeepseekConfig>): Promise<void> =>
    ipcRenderer.invoke('settings:set', config),

  // 宠物状态持久化
  savePetState: (state: PetState): Promise<void> =>
    ipcRenderer.invoke('pet:state-save', state),
  loadPetState: (): Promise<PetState | null> =>
    ipcRenderer.invoke('pet:state-load'),

  // 事件监听（来自主进程）
  onOpenSettings: (callback: () => void) => {
    ipcRenderer.on('open-settings', callback)
    return () => ipcRenderer.removeListener('open-settings', callback)
  }
}

contextBridge.exposeInMainWorld('deskpet', api)
