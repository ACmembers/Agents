import { useEffect, useRef } from 'react'

/**
 * 🚀 高性能动画循环 Hook
 *
 * 使用 requestAnimationFrame 驱动动画，完全绕过 React 渲染周期。
 * callback 中改变 ref 值不会触发组件重绘，性能远优于 setState。
 *
 * @param callback  每帧调用 (deltaTime: number) => void
 * @param active    是否激活循环（默认 true）
 * @param fpsLimit  可选帧率上限（默认不限，桌宠建议 30）
 */
export function useAnimationFrame(
  callback: (deltaTime: number) => void,
  active: boolean = true,
  fpsLimit: number = 30
): void {
  const callbackRef = useRef(callback)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const frameInterval = 1000 / fpsLimit

  // 始终保持 callback 引用最新
  callbackRef.current = callback

  useEffect(() => {
    if (!active) return

    let accumulated = 0

    const loop = (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp
      }

      const delta = timestamp - lastTimeRef.current
      lastTimeRef.current = timestamp
      accumulated += delta

      // 帧率限制：累积超过间隔才执行
      if (accumulated >= frameInterval) {
        callbackRef.current(accumulated)
        accumulated = 0
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      lastTimeRef.current = 0
    }
  }, [active, frameInterval])
}

/**
 * 🚀 性能测量工具
 */
export function useFpsMeter(): { fps: React.RefObject<number> } {
  const fpsRef = useRef(0)
  const frameCount = useRef(0)
  const lastMeasure = useRef(performance.now())

  useAnimationFrame(() => {
    frameCount.current++
    const now = performance.now()
    const elapsed = now - lastMeasure.current
    if (elapsed >= 1000) {
      fpsRef.current = Math.round((frameCount.current * 1000) / elapsed)
      frameCount.current = 0
      lastMeasure.current = now
    }
  }, true, 60) // 60fps 测量

  return { fps: fpsRef }
}
