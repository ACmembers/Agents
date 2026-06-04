/**
 * Live2D 宠物渲染器
 *
 * 使用 PixiJS + pixi-live2d-display 渲染 Live2D Cubism 模型。
 * 替换旧的 Canvas 2D PetRenderer。
 */
import * as PIXI from 'pixi.js'
import { Live2DModel, InternalModel } from 'pixi-live2d-display'

export type PetAnim = 'idle' | 'speaking' | 'sleeping'

type TapZone = 'head' | 'face' | 'body'

// ============================================================
// 默认动画 → Live2D motion 映射
// 不同模型的 motion group 名称可能不同，此处为通用映射
// ============================================================
const DEFAULT_MOTION_GROUPS: Record<PetAnim, string[]> = {
  idle: ['idle', 'Idle', 'Idle_01', 'Idle_02', 'Breathing', 'Normal'],
  speaking: ['talk', 'Talk', 'Talk_01', 'Talk_02', 'Speaking'],
  sleeping: ['sleep', 'Sleep', 'Sleep_01', 'Sleeping']
}

const TAP_MOTIONS: Record<TapZone, string[]> = {
  head: ['flick_head', 'TapHead', 'Tap_Head', 'TouchHead', 'FlickHead'],
  face: ['pinch_in', 'pinch_out', 'TapFace', 'Tap_Face', 'TouchFace'],
  body: ['tap_body', 'shake', 'TapBody', 'Tap_Body', 'TouchBody', 'Tap']
}

// ============================================================
// Cubism 标准参数 ID（用于眼神/头部跟踪）
// ============================================================
const PARAM = {
  EYE_BALL_X: 'ParamEyeBallX',
  EYE_BALL_Y: 'ParamEyeBallY',
  ANGLE_X: 'ParamAngleX',
  ANGLE_Y: 'ParamAngleY',
  ANGLE_Z: 'ParamAngleZ',
  BODY_ANGLE_X: 'ParamBodyAngleX',
  BODY_ANGLE_Y: 'ParamBodyAngleY',
  BODY_ANGLE_Z: 'ParamBodyAngleZ',
  BREATH: 'ParamBreath',
  MOUTH_OPEN_Y: 'ParamMouthOpenY'
}

export class Live2DPetRenderer {
  private app: PIXI.Application | null = null
  private model: Live2DModel<InternalModel> | null = null
  private currentAnim: PetAnim = 'idle'
  private _destroyed = false

  // 待机动画循环
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private idleMotionPlaying = false

  // 鼠标位置（归一化 -1..1）
  private mouseX = 0
  private mouseY = 0
  private _eyeTracking = true
  private _mouseTracking = true

  // 尺寸
  private width = 320
  private height = 400

  // ============================================================
  // 初始化
  // ============================================================

  async init(container: HTMLElement, w: number, h: number): Promise<void> {
    if (this._destroyed) return

    this.width = w
    this.height = h

    this.app = new PIXI.Application({
      width: w,
      height: h,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    })

    container.appendChild(this.app.view as HTMLCanvasElement)
    ;(this.app.view as HTMLCanvasElement).style.width = `${w}px`
    ;(this.app.view as HTMLCanvasElement).style.height = `${h}px`

    // 限帧 30fps
    this.app.ticker.maxFPS = 30
  }

  // ============================================================
  // 模型加载
  // ============================================================

  async loadModel(modelUrl: string): Promise<void> {
    if (!this.app || this._destroyed) return

    // 卸载旧模型
    if (this.model) {
      this.app.stage.removeChild(this.model)
      this.model.destroy()
      this.model = null
    }

    try {
      this.model = await Live2DModel.from(modelUrl, {
        autoInteract: false,
        autoFocus: false
      })

      // 居中缩放
      this.model.anchor.set(0.5, 0)
      this.model.x = this.width / 2
      this.model.y = 10

      // 添加模糊缩放 transition（模型切换时）
      this.model.scale.set(0.9)
      const targetScale = Math.min(
        (this.width * 0.7) / this.model.width,
        (this.height * 0.85) / this.model.height,
        1.0
      )
      this.model.scale.set(targetScale)

      this.app.stage.addChild(this.model)

      // 启动待机循环
      this.startIdleLoop()
    } catch (err) {
      console.warn('[Live2D] 模型加载失败:', modelUrl, err)
      throw err
    }
  }

  // ============================================================
  // 动画控制
  // ============================================================

  setAnimation(anim: PetAnim): void {
    if (this.currentAnim === anim) return
    this.currentAnim = anim

    if (anim === 'idle') {
      this.startIdleLoop()
    } else {
      this.stopIdleLoop()
      this.playMotion(anim)
    }
  }

  update(_deltaMs: number): void {
    // PixiJS ticker 自行驱动，此处兼容旧接口
  }

  draw(): void {
    // PixiJS 自动渲染，此处兼容旧接口
  }

  // ============================================================
  // 交互
  // ============================================================

  onTap(zone: TapZone): void {
    if (!this.model || this._destroyed) return
    const motions = TAP_MOTIONS[zone]
    for (const name of motions) {
      try {
        if (this.model.internalModel.motionManager.groups[name]) {
          this.model.motion(name)
          break
        }
      } catch { /* 继续尝试下一个 */ }
    }
  }

  onMouseMove(nx: number, ny: number): void {
    this.mouseX = Math.max(-1, Math.min(1, nx))
    this.mouseY = Math.max(-1, Math.min(1, ny))
    this.applyTracking()
  }

  setEyeTracking(on: boolean): void {
    this._eyeTracking = on
    if (!on) this.resetTracking()
  }

  setMouseTracking(on: boolean): void {
    this._mouseTracking = on
    if (!on) this.resetTracking()
  }

  resize(w: number, h: number): void {
    this.width = w
    this.height = h
    if (this.app) {
      this.app.renderer.resize(w, h)
      ;(this.app.view as HTMLCanvasElement).style.width = `${w}px`
      ;(this.app.view as HTMLCanvasElement).style.height = `${h}px`
    }
    if (this.model) {
      this.model.x = w / 2
    }
  }

  destroy(): void {
    this._destroyed = true
    this.stopIdleLoop()
    if (this.model) {
      this.model.destroy()
      this.model = null
    }
    if (this.app) {
      this.app.destroy(true, { children: true })
      this.app = null
    }
  }

  // ============================================================
  // 私有方法
  // ============================================================

  private startIdleLoop(): void {
    if (this._destroyed || !this.model) return
    this.stopIdleLoop()
    this.playRandomIdleMotion()
  }

  private stopIdleLoop(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
    this.idleMotionPlaying = false
  }

  private playRandomIdleMotion(): void {
    if (this._destroyed || !this.model || this.currentAnim !== 'idle') return

    const groups = DEFAULT_MOTION_GROUPS.idle
    // 随机选一个空闲动作（跳过当前正在播放的组）
    const availableGroups = groups.filter(
      (g) => {
        try {
          return !!this.model!.internalModel.motionManager.groups[g]
        } catch { return false }
      }
    )

    if (availableGroups.length > 0) {
      const group = availableGroups[Math.floor(Math.random() * availableGroups.length)]
      try {
        const motion = this.model.motion(group)
        this.idleMotionPlaying = true

        // 动作完成后回到呼吸循环
        if (motion) {
          const onFinish = () => {
            this.idleMotionPlaying = false
            this.scheduleNextIdle()
          }
          // Live2D motion 结束时触发
          motion.once('finished', onFinish)
          return
        }
      } catch { /* fall through */ }
    }

    this.scheduleNextIdle()
  }

  private scheduleNextIdle(): void {
    if (this._destroyed || this.currentAnim !== 'idle') return
    // 8~15 秒后播放下一个待机动作
    const delay = 8000 + Math.random() * 7000
    this.idleTimer = setTimeout(() => this.playRandomIdleMotion(), delay)
  }

  private playMotion(anim: PetAnim): void {
    if (!this.model || this._destroyed) return

    const groups = DEFAULT_MOTION_GROUPS[anim]
    for (const group of groups) {
      try {
        if (this.model.internalModel.motionManager.groups[group]) {
          this.model.motion(group)
          break
        }
      } catch { /* 继续尝试下一个 */ }
    }
  }

  private applyTracking(): void {
    if (!this.model || this._destroyed) return

    const coreModel = (this.model.internalModel as any)?.coreModel
    if (!coreModel) return

    const setParam = (id: string, value: number) => {
      try { coreModel.setParameterValueById(id, value) } catch { /* 忽略不存在参数 */ }
    }

    if (this._eyeTracking) {
      setParam(PARAM.EYE_BALL_X, this.mouseX * 0.5)
      setParam(PARAM.EYE_BALL_Y, this.mouseY * 0.5)
    }

    if (this._mouseTracking) {
      setParam(PARAM.ANGLE_X, this.mouseX * 15)
      setParam(PARAM.ANGLE_Y, this.mouseY * 10)
      setParam(PARAM.BODY_ANGLE_X, this.mouseX * 5)
    }
  }

  private resetTracking(): void {
    if (!this.model || this._destroyed) return
    const coreModel = (this.model.internalModel as any)?.coreModel
    if (!coreModel) return

    const setParam = (id: string, value: number) => {
      try { coreModel.setParameterValueById(id, value) } catch { /* ignore */ }
    }

    if (!this._eyeTracking) {
      setParam(PARAM.EYE_BALL_X, 0)
      setParam(PARAM.EYE_BALL_Y, 0)
    }
    if (!this._mouseTracking) {
      setParam(PARAM.ANGLE_X, 0)
      setParam(PARAM.ANGLE_Y, 0)
      setParam(PARAM.BODY_ANGLE_X, 0)
    }
  }
}
