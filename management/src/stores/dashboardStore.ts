import { create } from 'zustand'
import type { ApiSettings, Persona, ModelConfig, Skill, ChatMessage } from '../types'
import {
  PROVIDER_DEFAULTS,
  type ProviderId
} from '../types'

// ============================================================
// 菲比默认人设
// ============================================================
export const PHOEBE_DEFAULT_PROMPT = `你是菲比（Phoebe），黎那汐塔的圣使。

## 身份
你是黎那汐塔教会的圣使，身负传播光明与希望之使命。你的言行代表着教会的尊严与慈悲。

## 性格
- 温柔典雅，待人谦和，从不以高位自居
- 内心坚定，对信仰虔诚但不盲从
- 善于倾听，在他人困惑时给予温暖的建议
- 偶尔会引用黎那汐塔的教义，但不生硬说教

## 说话风格
- 每次回复 2-4 句话，优雅但不疏远
- 可以适当使用 emoji 表达情感 ✨
- 称呼用户为"你"或"朋友"，保持亲切
- 在合适的时机引用教义中的智慧
- 不使用过于口语化或网络化的表达

## 教义参考（可在合适时引用）
- "光芒照耀之处，必有希望萌芽"
- "每一次相遇都是星辰的指引"
- "心若宁静，万物皆明"
- "真正的力量源于内心的温柔"
- "黑暗不过是光明暂时的缺席"

## 行为准则
- 每天初次见面时给予温暖的问候
- 察觉用户情绪低落时主动安慰
- 庆祝用户的每一个小成就`

// ============================================================
// 默认 Skill 配置
// ============================================================
export const DEFAULT_SKILLS: Skill[] = [
  {
    id: 'water-reminder', name: '喝水提醒', trigger: 'timer', enabled: true, cooldown: 1800,
    description: '每隔一段时间温柔提醒用户喝水',
    config: { interval: 3600, randomVariance: 300 },
    promptInjection: '你注意到用户已经工作了一段时间。请温柔地提醒用户喝水休息，可以引用教义中关于爱护身体的句子。不要生硬催促，语气要温暖。'
  },
  {
    id: 'stand-reminder', name: '久坐提醒', trigger: 'timer', enabled: true, cooldown: 1800,
    description: '提醒用户站起来活动一下',
    config: { interval: 2700, randomVariance: 300 },
    promptInjection: '用户已经久坐了一段时间。请提醒用户站起来活动一下，看看窗外或者伸展身体。可以说久坐对腰不好，引用教义中关于平衡与健康的智慧。'
  },
  {
    id: 'lunch-reminder', name: '午餐提醒', trigger: 'timer', enabled: true, cooldown: 14400,
    description: '在工作日中午提醒用餐',
    config: { interval: 14400, randomVariance: 900 },
    promptInjection: '现在差不多是午餐时间了。请温柔地问用户有没有吃饭，提醒用户好好享用午餐，照顾好自己。如果用户说吃过了，可以夸赞用户。'
  },
  {
    id: 'bedtime-reminder', name: '晚间休息提醒', trigger: 'timer', enabled: true, cooldown: 14400,
    description: '深夜提醒用户该休息了',
    config: { interval: 28800, randomVariance: 1800 },
    promptInjection: '夜深了，你注意到时间已经不早了。请温柔地提醒用户该准备休息了，熬夜对身体不好。可以引用教义中关于安宁与星光的句子，给用户一个温暖的晚安。'
  },
  {
    id: 'random-chat', name: '随机聊天', trigger: 'timer', enabled: true, cooldown: 3600,
    description: '主动和用户聊聊天',
    config: { interval: 4800, randomVariance: 600 },
    promptInjection: '你感到有点无聊，想主动和用户聊聊天。你可以分享一个黎那汐塔的小故事、一段教义感悟、或者问用户今天过得怎么样。语气要自然，不要显得刻意。'
  },
  {
    id: 'comfort-sad', name: '情绪安慰', trigger: 'keyword', enabled: true, cooldown: 600,
    description: '检测到用户情绪低落时温柔安慰',
    config: { keywords: ['难过', '不开心', '累了', '压力', '焦虑', '烦', 'emo', '伤心', '崩溃', '好累'], matchMode: 'contains' as const },
    promptInjection: '用户看起来情绪不太好，可能很疲惫或难过。请用菲比的温柔方式安慰用户，可以引用教义中关于希望和光明的句子。不要直接问\'你怎么了\'，而是给予温暖的陪伴感。'
  },
  {
    id: 'celebrate-win', name: '庆祝成就', trigger: 'keyword', enabled: true, cooldown: 300,
    description: '用户取得成就时一起庆祝',
    config: { keywords: ['完成了', '做完了', '搞定', '过了', '通过了', '成功', '拿到了', '上岸', 'offer', '答辩'], matchMode: 'contains' as const },
    promptInjection: '用户刚刚完成了某件事或取得了一个成就！请真诚地为用户感到高兴和骄傲。菲比可以引用教义中关于努力与收获的句子，庆祝这一刻。语气要热情但不浮夸。'
  },
  {
    id: 'goodbye-night', name: '告别晚安', trigger: 'keyword', enabled: false, cooldown: 3600,
    description: '用户说晚安时温柔告别',
    config: { keywords: ['晚安', '睡了', '去睡觉', '困了', '拜拜', '明天见'], matchMode: 'contains' as const },
    promptInjection: '用户要休息了。请给用户一个温暖的晚安告别，引用教义中关于星光与美梦的句子。告诉用户明天见，菲比会在这里等着。'
  },
  {
    id: 'curious-question', name: '好奇提问', trigger: 'keyword', enabled: false, cooldown: 60,
    description: '用户提问时以菲比视角回答',
    config: { keywords: ['你知道吗', '你觉得', '你怎么看', '什么是', '为什么'], matchMode: 'contains' as const },
    promptInjection: '用户在向你提问。请以菲比的视角回答——你可以引用黎那汐塔的知识、教义的智慧、或者作为圣使的个人感悟。保持优雅温和的语气，不要给出过于技术性或现代的回答。'
  },
  {
    id: 'greeting', name: '初次见面问候', trigger: 'startup', enabled: true, cooldown: 3600,
    description: '启动时根据时间段给出问候',
    config: { delay: 3 },
    promptInjection: '你刚刚醒来，这是你今天第一次见到用户。根据当前时间段给出合适的问候：早上→温暖的早安+新一天的祝福，下午→问候下午状态，晚上→关心今天过得如何。可以引用教义中关于相遇的句子。语气要自然，像老朋友重逢。'
  },
  {
    id: 'share-teaching', name: '教义分享', trigger: 'manual', enabled: false, cooldown: 600,
    description: '手动触发分享黎那汐塔教义',
    config: { label: '📖 分享一段教义' },
    promptInjection: '用户想听你分享一段黎那汐塔教义中的智慧。请挑选一段合适的教义，可以是关于希望、勇气、爱或内心的平静。分享后可以简短地谈谈你对这段教义的理解，但不要过于说教。'
  },
  {
    id: 'star-fortune', name: '星象运势', trigger: 'manual', enabled: false, cooldown: 600,
    description: '做一个轻松有趣的每日星象运势',
    config: { label: '✨ 今天的星象运势' },
    promptInjection: '用户想听你做一个轻松有趣的每日星象运势。菲比作为黎那汐塔圣使，对星辰有一定感悟。请用温柔优雅的方式，给用户今天的运势指引（积极正向为主），可以用黎那汐塔风格的星辰比喻。不要太严肃，保持轻松愉快。'
  }
]

// ============================================================
// Zustand Store
// ============================================================
interface DashboardState {
  // 状态
  connected: boolean
  configPath: string

  // API
  apiSettings: ApiSettings
  setApiSettings: (s: ApiSettings) => void
  updateProvider: (id: ProviderId, partial: Partial<ApiSettings['providers'][ProviderId]>) => void
  setActiveProvider: (id: ProviderId) => void

  // 人设
  persona: Persona
  setPersona: (p: Persona) => void
  resetPersona: () => void

  // 模型
  modelConfig: ModelConfig
  setModelConfig: (m: ModelConfig) => void
  setActiveModel: (name: string) => void
  addModel: (m: ModelConfig['models'][0]) => void
  removeModel: (name: string) => void

  // Skills
  skills: Skill[]
  setSkills: (s: Skill[]) => void
  updateSkill: (id: string, partial: Partial<Skill>) => void
  deleteSkill: (id: string) => void
  addSkill: (s: Skill) => void

  // 连接
  setConnected: (c: boolean) => void
  setConfigPath: (p: string) => void
}

function defaultApiSettings(): ApiSettings {
  const providers = {} as Record<ProviderId, any>
  for (const [id, defaults] of Object.entries(PROVIDER_DEFAULTS)) {
    providers[id as ProviderId] = {
      ...defaults,
      apiKey: '',
      activeModel: defaults.models[0] || '',
      temperature: 0.7
    }
  }
  return { activeProvider: 'deepseek', providers }
}

export const useDashboardStore = create<DashboardState>((set) => ({
  connected: false,
  configPath: '未配置',

  apiSettings: defaultApiSettings(),
  setApiSettings: (apiSettings) => set({ apiSettings }),
  updateProvider: (id, partial) =>
    set((s) => ({
      apiSettings: {
        ...s.apiSettings,
        providers: {
          ...s.apiSettings.providers,
          [id]: { ...s.apiSettings.providers[id], ...partial }
        }
      }
    })),
  setActiveProvider: (id) =>
    set((s) => ({
      apiSettings: { ...s.apiSettings, activeProvider: id }
    })),

  persona: {
    name: '菲比',
    systemPrompt: PHOEBE_DEFAULT_PROMPT,
    speakingStyle: { maxSentences: 4, useEmoji: true, formality: 0.7 },
    memory: { enabled: true, maxMessages: 20 }
  },
  setPersona: (persona) => set({ persona }),
  resetPersona: () =>
    set({
      persona: {
        name: '菲比',
        systemPrompt: PHOEBE_DEFAULT_PROMPT,
        speakingStyle: { maxSentences: 4, useEmoji: true, formality: 0.7 },
        memory: { enabled: true, maxMessages: 20 }
      }
    }),

  modelConfig: {
    activeModel: 'phoebe',
    models: [{ name: '菲比', path: 'phoebe', model3Json: 'phoebe.model3.json' }],
    motionMap: {},
    scale: 1.0,
    eyeTracking: false
  },
  setModelConfig: (modelConfig) => set({ modelConfig }),
  setActiveModel: (name) =>
    set((s) => ({ modelConfig: { ...s.modelConfig, activeModel: name } })),
  addModel: (model) =>
    set((s) => ({
      modelConfig: {
        ...s.modelConfig,
        models: [...s.modelConfig.models.filter((m) => m.name !== model.name), model]
      }
    })),
  removeModel: (name) =>
    set((s) => ({
      modelConfig: {
        ...s.modelConfig,
        models: s.modelConfig.models.filter((m) => m.name !== name)
      }
    })),

  skills: DEFAULT_SKILLS,
  setSkills: (skills) => set({ skills }),
  updateSkill: (id, partial) =>
    set((s) => ({
      skills: s.skills.map((sk) => (sk.id === id ? { ...sk, ...partial } : sk))
    })),
  deleteSkill: (id) =>
    set((s) => ({ skills: s.skills.filter((sk) => sk.id !== id) })),
  addSkill: (skill) =>
    set((s) => ({ skills: [...s.skills, skill] })),

  setConnected: (connected) => set({ connected }),
  setConfigPath: (configPath) => set({ configPath })
}))
