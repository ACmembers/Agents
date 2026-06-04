/**
 * 🚀 Canvas 精灵渲染器
 *
 * 在 <canvas> 上直接绘制宠物，完全绕过 DOM/React 渲染管道。
 * 配合 requestAnimationFrame 游戏循环，实现高性能动画。
 */

export type PetAnim = 'idle' | 'walking' | 'dragging' | 'speaking' | 'sleeping'

interface SpriteState {
  frame: number
  frameTimer: number
}

/**
 * 宠物色调配置
 */
const COLORS = {
  body: '#f8c291',
  bodyShadow: '#e8b080',
  ear: '#e67e22',
  earDark: '#d35400',
  eye: '#2c3e50',
  eyeHighlight: '#ffffff',
  mouth: '#e74c3c',
  blush: 'rgba(255, 184, 184, 0.5)',
  whisker: '#7f8c8d',
  sleepZ: '#a0c4ff'
}

/**
 * 每个动画的帧配置
 */
const ANIM_FRAMES: Record<PetAnim, { frames: number; duration: number }> = {
  idle:     { frames: 2, duration: 2000 },
  walking:  { frames: 4, duration: 600 },
  dragging: { frames: 1, duration: 0 },
  speaking: { frames: 3, duration: 900 },
  sleeping: { frames: 1, duration: 0 }
}

/**
 * Canvas 宠物渲染器
 */
export class PetRenderer {
  private ctx: CanvasRenderingContext2D
  private width: number
  private height: number
  private state: SpriteState = { frame: 0, frameTimer: 0 }
  private currentAnim: PetAnim = 'idle'
  private scale: number = 1
  private breathPhase: number = 0

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!
    this.width = canvas.width
    this.height = canvas.height

    // 处理 HiDPI 屏幕
    const dpr = window.devicePixelRatio || 1
    if (dpr > 1) {
      canvas.width = this.width * dpr
      canvas.height = this.height * dpr
      this.ctx.scale(dpr, dpr)
    }
  }

  /** 设置动画状态 */
  setAnimation(anim: PetAnim): void {
    if (this.currentAnim !== anim) {
      this.currentAnim = anim
      this.state = { frame: 0, frameTimer: 0 }
    }
  }

  /** 更新帧动画 */
  update(deltaMs: number): void {
    const config = ANIM_FRAMES[this.currentAnim]
    if (config.frames <= 1) return

    this.state.frameTimer += deltaMs
    if (this.state.frameTimer >= config.duration / config.frames) {
      this.state.frameTimer = 0
      this.state.frame = (this.state.frame + 1) % config.frames
    }

    // 呼吸相位
    this.breathPhase = (this.breathPhase + deltaMs * 0.002) % (Math.PI * 2)
  }

  /** 绘制当前帧 */
  draw(offsetX: number = 0, offsetY: number = 0): void {
    const ctx = this.ctx
    const w = this.width
    const h = this.height

    // 清空透明背景
    ctx.clearRect(0, 0, w, h)

    ctx.save()
    ctx.translate(offsetX, offsetY)

    // 呼吸浮动
    const breathOffset = this.currentAnim === 'sleeping' ? 0
      : Math.sin(this.breathPhase) * 2
    ctx.translate(0, breathOffset)

    const cx = w / 2
    const cy = h / 2 - 10

    this.drawBody(ctx, cx, cy)
    this.drawEars(ctx, cx, cy)
    this.drawFace(ctx, cx, cy)
    this.drawEyes(ctx, cx, cy)
    this.drawMouth(ctx, cx, cy)
    this.drawWhiskers(ctx, cx, cy)
    this.drawBlush(ctx, cx, cy)

    if (this.currentAnim === 'sleeping') {
      this.drawSleepZ(ctx, cx, cy)
    }

    ctx.restore()
  }

  // ---- 绘制各部分 ----

  private drawBody(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    // 身体
    ctx.beginPath()
    ctx.ellipse(cx, cy + 10, 38, 34, 0, 0, Math.PI * 2)
    ctx.fillStyle = COLORS.body
    ctx.fill()

    // 拖拽/说话时的特殊效果
    if (this.currentAnim === 'dragging') {
      ctx.beginPath()
      ctx.ellipse(cx, cy + 38, 20, 6, 0, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,0,0,0.08)'
      ctx.fill()
    }
  }

  private drawEars(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    // 左耳
    ctx.beginPath()
    ctx.moveTo(cx - 20, cy - 18)
    ctx.lineTo(cx - 32, cy - 42)
    ctx.lineTo(cx - 8, cy - 24)
    ctx.closePath()
    ctx.fillStyle = COLORS.ear
    ctx.fill()

    // 右耳
    ctx.beginPath()
    ctx.moveTo(cx + 20, cy - 18)
    ctx.lineTo(cx + 32, cy - 42)
    ctx.lineTo(cx + 8, cy - 24)
    ctx.closePath()
    ctx.fillStyle = COLORS.ear
    ctx.fill()
  }

  private drawFace(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    ctx.beginPath()
    ctx.ellipse(cx, cy + 2, 30, 26, 0, 0, Math.PI * 2)
    ctx.fillStyle = COLORS.body
    ctx.fill()
  }

  private drawEyes(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    if (this.currentAnim === 'sleeping') {
      // 睡觉：闭眼（弧线）
      ctx.strokeStyle = COLORS.eye
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.arc(cx - 10, cy - 2, 6, 0.1, Math.PI - 0.1)  // 左闭眼
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(cx + 10, cy - 2, 6, 0.1, Math.PI - 0.1)  // 右闭眼
      ctx.stroke()
    } else {
      // 睁眼
      const eyeW = 6, eyeH = 7

      // 根据帧动画眨眼
      const blink = this.currentAnim === 'idle' && this.state.frame === 1
      const eyeHFinal = blink ? 1.5 : eyeH

      // 左眼
      ctx.beginPath()
      ctx.ellipse(cx - 12, cy - 2, eyeW, eyeHFinal, 0, 0, Math.PI * 2)
      ctx.fillStyle = COLORS.eye
      ctx.fill()
      if (!blink) {
        ctx.beginPath()
        ctx.ellipse(cx - 11, cy - 4, 2, 2.5, 0, 0, Math.PI * 2)
        ctx.fillStyle = COLORS.eyeHighlight
        ctx.fill()
      }

      // 右眼
      ctx.beginPath()
      ctx.ellipse(cx + 12, cy - 2, eyeW, eyeHFinal, 0, 0, Math.PI * 2)
      ctx.fillStyle = COLORS.eye
      ctx.fill()
      if (!blink) {
        ctx.beginPath()
        ctx.ellipse(cx + 13, cy - 4, 2, 2.5, 0, 0, Math.PI * 2)
        ctx.fillStyle = COLORS.eyeHighlight
        ctx.fill()
      }
    }
  }

  private drawMouth(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    if (this.currentAnim === 'speaking') {
      // 说话：张嘴
      ctx.beginPath()
      ctx.ellipse(cx, cy + 12, 6, 4 + this.state.frame, 0, 0, Math.PI * 2)
      ctx.fillStyle = COLORS.mouth
      ctx.fill()
    } else if (this.currentAnim === 'sleeping') {
      // 睡觉：微微张嘴
      ctx.beginPath()
      ctx.ellipse(cx, cy + 12, 3, 2, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#e8a0a0'
      ctx.fill()
    } else {
      // 正常微笑
      ctx.beginPath()
      ctx.arc(cx - 5, cy + 8, 5, 0.1, Math.PI - 0.1)
      ctx.strokeStyle = COLORS.mouth
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(cx + 5, cy + 8, 5, 0.1, Math.PI - 0.1)
      ctx.stroke()
    }
  }

  private drawWhiskers(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    ctx.strokeStyle = COLORS.whisker
    ctx.lineWidth = 1.2

    // 左胡须
    ctx.beginPath()
    ctx.moveTo(cx - 16, cy)
    ctx.lineTo(cx - 30, cy - 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx - 16, cy + 4)
    ctx.lineTo(cx - 30, cy + 6)
    ctx.stroke()

    // 右胡须
    ctx.beginPath()
    ctx.moveTo(cx + 16, cy)
    ctx.lineTo(cx + 30, cy - 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx + 16, cy + 4)
    ctx.lineTo(cx + 30, cy + 6)
    ctx.stroke()
  }

  private drawBlush(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    ctx.beginPath()
    ctx.ellipse(cx - 20, cy + 6, 5, 3, 0, 0, Math.PI * 2)
    ctx.fillStyle = COLORS.blush
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(cx + 20, cy + 6, 5, 3, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawSleepZ(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    ctx.font = '16px sans-serif'
    ctx.fillStyle = COLORS.sleepZ
    ctx.textAlign = 'center'
    const zOffset = Math.sin(this.breathPhase) * 3
    ctx.fillText('💤', cx + 30, cy - 30 + zOffset)
  }

  /** 调整画布大小（响应 DPR 变化） */
  resize(w: number, h: number): void {
    const dpr = window.devicePixelRatio || 1
    this.width = w
    this.height = h
    const canvas = this.ctx.canvas
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    this.ctx.scale(dpr, dpr)
  }
}
