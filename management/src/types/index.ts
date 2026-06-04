/** 共享类型 —— 管理面板与桌宠运行时共用 */

// ============================================================
// API 配置
// ============================================================

export type ProviderId = 'deepseek' | 'openai' | 'qwen' | 'moonshot' | 'zhipu' | 'custom'

export interface ProviderConfig {
  name: string
  baseUrl: string
  models: string[]
  apiKey: string
  activeModel: string
  temperature: number
}

export interface ApiSettings {
  activeProvider: ProviderId
  providers: Record<ProviderId, ProviderConfig>
}

// ============================================================
// 预设提供商
// ============================================================

export const PROVIDER_DEFAULTS: Record<ProviderId, Omit<ProviderConfig, 'apiKey' | 'activeModel' | 'temperature'>> = {
  deepseek: {
    name: 'Deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner']
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo']
  },
  qwen: {
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-plus', 'qwen-max', 'qwen-turbo']
  },
  moonshot: {
    name: 'Moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k']
  },
  zhipu: {
    name: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4-flash', 'glm-4-plus', 'glm-4-air']
  },
  custom: {
    name: '自定义',
    baseUrl: '',
    models: []
  }
}

// ============================================================
// Live2D 模型
// ============================================================

export interface ModelMeta {
  name: string
  path: string
  model3Json: string
  thumbnail?: string
}

export interface ModelConfig {
  activeModel: string
  models: ModelMeta[]
  motionMap: Record<string, string[]>
  scale: number
  eyeTracking: boolean
}

// ============================================================
// 人设
// ============================================================

export interface Persona {
  name: string
  systemPrompt: string
  speakingStyle: {
    maxSentences: number
    useEmoji: boolean
    formality: number  // 0~1
  }
  memory: {
    enabled: boolean
    maxMessages: number
  }
}

// ============================================================
// Skill
// ============================================================

export type SkillTrigger = 'timer' | 'keyword' | 'manual' | 'startup'

export interface TimerConfig { interval: number; randomVariance: number }
export interface KeywordConfig { keywords: string[]; matchMode: 'exact' | 'contains' | 'regex' }
export interface ManualConfig { label: string }
export interface StartupConfig { delay: number }

export interface Skill {
  id: string
  name: string
  description: string
  trigger: SkillTrigger
  config: TimerConfig | KeywordConfig | ManualConfig | StartupConfig
  promptInjection: string
  enabled: boolean
  cooldown: number
}

// ============================================================
// 对话
// ============================================================

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

// ============================================================
// 全局配置
// ============================================================

export interface AppConfig {
  api: ApiSettings
  persona: Persona
  modelConfig: ModelConfig
}
