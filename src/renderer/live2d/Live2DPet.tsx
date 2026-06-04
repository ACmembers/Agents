/**
 * Live2D 宠物 React 组件
 *
 * 替换原来的 Pet.tsx (Canvas 2D 渲染)。
 * 使用 PixiJS + pixi-live2d-display 渲染 Live2D 模型。
 */
import React, { useRef, useEffect, useCallback } from 'react'
import { Live2DPetRenderer, type PetAnim } from './Live2DPetRenderer'

interface PetProps {
  animation?: PetAnim
  onDragStart?: () => void
  onDragEnd?: () => void
  onTap?: (zone: 'head' | 'face' | 'body') => void
  modelUrl?: string
}

const CANVAS_W = 320
const CANVAS_H = 400

const Pet: React.FC<PetProps> = ({
  animation,
  onDragStart,
  onDragEnd,
  onTap,
  modelUrl
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<Live2DPetRenderer | null>(null)
  const animRef = useRef<PetAnim>('idle')
  const draggingRef = useRef(false)
  const offsetRef = useRef({ x: 0, y: 0 })

  // 同步 props → ref
  useEffect(() => {
    if (animation) {
      animRef.current = animation
      rendererRef.current?.setAnimation(animation)
    }
  }, [animation])

  // 初始化渲染器
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    const renderer = new Live2DPetRenderer()

    renderer.init(container, CANVAS_W, CANVAS_H).then(() => {
      if (cancelled) { renderer.destroy(); return }

      rendererRef.current = renderer

      // 加载默认模型
      if (modelUrl) {
        renderer.loadModel(modelUrl).catch((err) => {
          console.warn('[Live2DPet] 默认模型加载失败，将显示占位:', err)
        })
      }
    })

    return () => {
      cancelled = true
      renderer.destroy()
      rendererRef.current = null
    }
  }, []) // 仅挂载时初始化

  // 模型 URL 变化时重新加载
  useEffect(() => {
    if (!modelUrl || !rendererRef.current) return
    rendererRef.current.loadModel(modelUrl).catch((err) => {
      console.warn('[Live2DPet] 模型切换失败:', err)
    })
  }, [modelUrl])

  // 鼠标位置 → 眼神跟踪
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1   // -1..1
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1    // -1..1
    rendererRef.current?.onMouseMove(nx, ny)
  }, [])

  // 点击 → 交互反馈
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // 如果是拖拽则跳过
      if (draggingRef.current) return

      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const relY = (e.clientY - rect.top) / rect.height

      let zone: 'head' | 'face' | 'body'
      if (relY < 0.3) zone = 'head'
      else if (relY < 0.7) zone = 'face'
      else zone = 'body'

      rendererRef.current?.onTap(zone)
      onTap?.(zone)
    },
    [onTap]
  )

  // 拖拽开始
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      draggingRef.current = true
      offsetRef.current = { x: e.clientX, y: e.clientY }
      animRef.current = 'idle'
      onDragStart?.()

      const onMouseMove = (ev: MouseEvent) => {
        if (!draggingRef.current) return
        const dx = ev.clientX - offsetRef.current.x
        const dy = ev.clientY - offsetRef.current.y
        window.deskpet?.moveWindow(dx, dy)
        offsetRef.current = { x: ev.clientX, y: ev.clientY }
      }

      const onMouseUp = () => {
        draggingRef.current = false
        animRef.current = 'idle'
        onDragEnd?.()
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [onDragStart, onDragEnd]
  )

  // 双击 → 触发对话
  const handleDoubleClick = useCallback(() => {
    // 由父组件处理（App.tsx 已处理）
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        width: CANVAS_W,
        height: CANVAS_H,
        position: 'absolute',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        cursor: draggingRef.current ? 'grabbing' : 'grab',
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    />
  )
}

export default React.memo(Pet)
