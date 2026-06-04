/** Live2D 模型相关共享类型 */

export interface ModelMeta {
  name: string
  path: string
  model3Json: string
  thumbnail?: string
}

export interface ModelConfig {
  activeModel: string
  models: ModelMeta[]
  scale: number
  eyeTracking: boolean
}
