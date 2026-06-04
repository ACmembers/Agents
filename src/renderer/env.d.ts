/// <reference types="vite/client" />

import type { DeepseekConfig, PetState, ModelMeta } from '../shared/types'

interface DeskpetAPI {
  deepseekChat: (message: string) => Promise<string>
  getSettings: () => Promise<DeepseekConfig>
  setSettings: (config: Partial<DeepseekConfig>) => Promise<void>
  savePetState: (state: PetState) => Promise<void>
  loadPetState: () => Promise<PetState | null>
  moveWindow: (deltaX: number, deltaY: number) => Promise<void>
  listModels: () => Promise<ModelMeta[]>
  setActiveModel: (name: string) => Promise<void>
  onOpenSettings: (callback: () => void) => () => void
}

declare global {
  interface Window {
    deskpet: DeskpetAPI
  }
}
