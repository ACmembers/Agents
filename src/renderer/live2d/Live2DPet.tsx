/**
 * 菲比桌宠 React 组件
 *
 * 使用 PIXI 精灵渲染器，支持动画切换、眼神跟踪、点击交互、拖拽移窗。
 */
import React, { useRef, useEffect, useCallback } from 'react'
import { Live2DPetRenderer, type PetAnim } from './Live2DPetRenderer'

interface PetProps {
  animation?: PetAnim
  onTap?: (zone: 'head' | 'face' | 'body') => void
}

const CANVAS_W = 320
const CANVAS_H = 400

const Pet: React.FC<PetProps> = ({ animation, onTap }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<Live2DPetRenderer | null>(null)
  const draggingRef = useRef(false)
  const offsetRef = useRef({ x: 0, y: 0 })

  // 动画状态同步
  useEffect(() => {
    if (animation) rendererRef.current?.setAnimation(animation)
  }, [animation])

  // 初始化渲染器（仅一次）
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false

    const renderer = new Live2DPetRenderer()
    renderer.init(container, CANVAS_W, CANVAS_H).then(() => {
      if (cancelled) { renderer.destroy(); return }
      rendererRef.current = renderer
    })

    return () => { cancelled = true; renderer.destroy(); rendererRef.current = null }
  }, [])

  // 鼠标位置 → 眼神跟踪
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    rendererRef.current?.onMouseMove(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      ((e.clientY - rect.top) / rect.height) * 2 - 1
    )
  }, [])

  // 点击 → 交互反馈
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (draggingRef.current) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const relY = (e.clientY - rect.top) / rect.height
    const zone = relY < 0.3 ? 'head' : relY < 0.7 ? 'face' : 'body' as const
    rendererRef.current?.onTap(zone)
    onTap?.(zone)
  }, [onTap])

  // 拖拽移窗
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    draggingRef.current = true
    offsetRef.current = { x: e.clientX, y: e.clientY }

    const onMouseMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return
      const dx = ev.clientX - offsetRef.current.x
      const dy = ev.clientY - offsetRef.current.y
      window.deskpet?.moveWindow(dx, dy)
      offsetRef.current = { x: ev.clientX, y: ev.clientY }
    }
    const onMouseUp = () => {
      draggingRef.current = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        width: CANVAS_W, height: CANVAS_H,
        position: 'absolute', bottom: 0, left: '50%',
        transform: 'translateX(-50%)',
        cursor: draggingRef.current ? 'grabbing' : 'grab',
        userSelect: 'none', WebkitUserSelect: 'none'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
    />
  )
}

export default React.memo(Pet)
