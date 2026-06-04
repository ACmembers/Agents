/// <reference types="vite/client" />

/** preload 暴露的桌面宠物 API */
interface DeskpetAPI {
  deepseekChat: (message: string) => Promise<string>
  getSettings: () => Promise<DeepseekConfig>
  setSettings: (config: Partial<DeepseekConfig>) => Promise<void>
  savePetState: (state: PetState) => Promise<void>
  loadPetState: () => Promise<PetState | null>
  onOpenSettings: (callback: () => void) => () => void
}

interface DeepseekConfig {
  apiKey: string
  model: 'deepseek-chat' | 'deepseek-reasoner' | 'deepseek-v4-pro'
  temperature: number
}

type PetAnimationState = 'idle' | 'walking' | 'dragging' | 'speaking' | 'sleeping'

interface PetState {
  x: number
  y: number
  animation: PetAnimationState
  mood: number
  energy: number
  isVisible: boolean
}

declare global {
  interface Window {
    deskpet: DeskpetAPI
  }
}
