/** 共享类型定义 —— 主进程与渲染进程共用 */

/** Deepseek API 配置 */
export interface DeepseekConfig {
  apiKey: string
  model: 'deepseek-chat' | 'deepseek-reasoner' | 'deepseek-v4-pro'
  temperature: number
}

/** 宠物动画状态 */
export type PetAnimationState = 'idle' | 'walking' | 'dragging' | 'speaking' | 'sleeping'

/** 宠物状态 */
export interface PetState {
  x: number
  y: number
  animation: PetAnimationState
  mood: number        // 0~100 心情值
  energy: number      // 0~100 精力值
  isVisible: boolean
}

/** 对话消息 */
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

/** 主进程 → 渲染进程 IPC 通道 */
export interface IpcChannels {
  'deepseek:chat': (message: string) => Promise<string>
  'deepseek:chat-stream': (message: string) => AsyncIterable<string>
  'settings:get': () => Promise<DeepseekConfig>
  'settings:set': (config: Partial<DeepseekConfig>) => Promise<void>
  'pet:state-save': (state: PetState) => Promise<void>
  'pet:state-load': () => Promise<PetState | null>
}

/** 窗口拖拽事件 */
export interface DragPayload {
  deltaX: number
  deltaY: number
}
