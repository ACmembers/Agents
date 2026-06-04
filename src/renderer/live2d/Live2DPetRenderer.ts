/**
 * 菲比桌宠渲染器 — 图片精灵版
 *
 * 使用真实角色立绘，canvas 渲染 + 呼吸动画 + 交互反馈。
 */
export type PetAnim = 'idle' | 'speaking' | 'sleeping'

function getImageUrl(): string {
  // Electron 开发模式下用 dev server 路径，生产用相对路径
  if (typeof window !== 'undefined' && window.location.protocol === 'http:') {
    return window.location.origin + '/assets/phoebe.jpg'
  }
  return './assets/phoebe.jpg'
}
export type TapZone = 'head' | 'face' | 'body'

export class Live2DPetRenderer {
  private ctx: CanvasRenderingContext2D | null = null
  private canvas: HTMLCanvasElement | null = null
  private image: HTMLImageElement | null = null
  private _destroyed = false

  private loadError: string | null = null
  private currentAnim: PetAnim = 'idle'
  private breathPhase = 0
  private talkPhase = 0
  private tapReaction = 0
  private tapZone: TapZone = 'body'
  private w = 320; private h = 400

  async init(container: HTMLElement, w: number, h: number): Promise<void> {
    this.w = w; this.h = h
    container.innerHTML = ''

    this.canvas = document.createElement('canvas')
    const dpr = window.devicePixelRatio || 1
    this.canvas.width = w * dpr
    this.canvas.height = h * dpr
    this.canvas.style.width = `${w}px`
    this.canvas.style.height = `${h}px`
    this.canvas.style.position = 'absolute'
    this.canvas.style.top = '0'; this.canvas.style.left = '0'
    this.ctx = this.canvas.getContext('2d')!
    container.appendChild(this.canvas)

    // 加载图片 — 先画占位确认 Canvas 工作，再加载图片
    this.drawPlaceholder('加载中…')
    this.startLoop()

    try {
      const url = getImageUrl()
      console.log('[Pet] 图片 URL:', url)
      this.image = await this.loadImage(url)
      console.log('[Pet] ✅ 图片加载成功', this.image.naturalWidth, 'x', this.image.naturalHeight)
      this.loadError = null
    } catch (e: any) {
      console.error('[Pet] ❌ 图片加载失败:', e.message)
      this.loadError = e.message
    }
  }

  private async loadImage(src: string): Promise<HTMLImageElement> {
    // 直接创建 Image，让浏览器原生处理缓存和加载
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        console.log('[Pet] ✅ Image 加载成功', img.naturalWidth, 'x', img.naturalHeight)
        resolve(img)
      }
      img.onerror = () => {
        console.error('[Pet] ❌ Image 加载失败, src:', src)
        reject(new Error(`图片加载失败`))
      }
      // 加时间戳避免缓存问题
      img.src = src
    })
  }

  private startLoop(): void {
    let last = performance.now()
    const tick = (now: number) => {
      if (this._destroyed) return
      this.update(now - last)
      last = now
      this.draw()
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  // ============================================================
  // 动画控制
  // ============================================================
  setAnimation(anim: PetAnim): void { this.currentAnim = anim }

  update(deltaMs: number): void {
    const dt = deltaMs / 1000
    this.breathPhase += dt * 1.5
    if (this.currentAnim === 'speaking') this.talkPhase += dt * 8
    if (this.tapReaction > 0) this.tapReaction = Math.max(0, this.tapReaction - dt * 3)
  }

  private drawPlaceholder(msg: string): void {
    const ctx = this.ctx
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.save()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = 'rgba(255,200,150,0.3)'
    ctx.fillRect(20, 20, this.w - 40, this.h - 40)
    ctx.fillStyle = '#333'
    ctx.font = '16px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(msg, this.w / 2, this.h / 2)
    ctx.restore()
  }

  draw(): void {
    const ctx = this.ctx
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.save()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, this.w, this.h)

    if (!this.image) {
      if (this.loadError) {
        this.drawPlaceholder(`❌ ${this.loadError}`)
      } else {
        this.drawPlaceholder('图片加载中…')
      }
      ctx.restore()
      return
    }

    const img = this.image
    const iw = img.naturalWidth
    const ih = img.naturalHeight

    // 计算图片适配 — 等比缩放到窗口内
    const fitH = this.h * 0.85
    const fitW = (iw / ih) * fitH
    const cx = this.w / 2
    const cy = this.h * 0.52

    ctx.translate(cx, cy)

    // 呼吸
    const breath = Math.sin(this.breathPhase) * 0.006
    ctx.scale(1 + breath, 1 + breath * 0.5)

    // 点击晃动
    if (this.tapReaction > 0) {
      const shake = Math.sin(this.tapReaction * 12) * 4 * this.tapReaction
      ctx.translate(shake, 0)
    }

    // 说话弹跳
    if (this.currentAnim === 'speaking') {
      ctx.translate(0, -Math.abs(Math.sin(this.talkPhase)) * 3)
    }

    // 睡觉暗化
    if (this.currentAnim === 'sleeping') {
      ctx.globalAlpha = 0.55
    }

    ctx.drawImage(img, -fitW / 2, -fitH / 2, fitW, fitH)

    ctx.restore()
  }

  // ============================================================
  // 交互
  // ============================================================
  onTap(zone: TapZone): void { this.tapReaction = 1; this.tapZone = zone }
  onMouseMove(_nx: number, _ny: number): void { /* 静态图片不需要 */ }
  setEyeTracking(_on: boolean): void { }

  resize(w: number, h: number): void {
    this.w = w; this.h = h
    if (this.canvas) {
      const dpr = window.devicePixelRatio || 1
      this.canvas.width = w * dpr
      this.canvas.height = h * dpr
      this.canvas.style.width = `${w}px`
      this.canvas.style.height = `${h}px`
    }
  }

  destroy(): void {
    this._destroyed = true
    if (this.canvas?.parentNode) this.canvas.parentNode.removeChild(this.canvas)
    this.ctx = null; this.canvas = null; this.image = null
  }
}
