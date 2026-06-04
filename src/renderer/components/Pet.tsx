import React, { useRef, useEffect, useCallback, useState } from 'react'
import { useAnimationFrame } from '../hooks/useAnimationFrame'
import { PetRenderer, PetAnim } from '../hooks/petRenderer'

/**
 * 🚀 Pet — Canvas 渲染宠物组件
 *
 * 使用 <canvas> + requestAnimationFrame 驱动，零 React 重绘开销。
 * 拖拽、动画状态切换全部操作 ref，不触发 setState。
 */

interface PetProps {
  animation?: PetAnim
  onDragStart?: () => void
  onDragEnd?: () => void
}

const CANVAS_W = 120
const CANVAS_H = 140

const Pet: React.FC<PetProps> = ({ animation, onDragStart, onDragEnd }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<PetRenderer | null>(null)
  const animRef = useRef<PetAnim>(animation || 'idle')
  const draggingRef = useRef(false)
  const offsetRef = useRef({ x: 0, y: 0 })

  // 追踪 props 变化到 ref（不触发重绘）
  useEffect(() => {
    if (animation) animRef.current = animation
  }, [animation])

  // 初始化渲染器
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // HiDPI 适配
    const dpr = window.devicePixelRatio || 1
    canvas.width = CANVAS_W * dpr
    canvas.height = CANVAS_H * dpr
    canvas.style.width = `${CANVAS_W}px`
    canvas.style.height = `${CANVAS_H}px`

    const renderer = new PetRenderer(canvas)
    renderer.setAnimation(animRef.current)
    rendererRef.current = renderer

    return () => {
      rendererRef.current = null
    }
  }, [])

  // 🚀 游戏循环 — 所有绘制走 Canvas，React 完全不知情
  useAnimationFrame((deltaMs) => {
    const r = rendererRef.current
    if (!r) return

    r.setAnimation(animRef.current)
    r.update(deltaMs)
    r.draw()
  }, true, 30)

  // 拖拽逻辑
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    draggingRef.current = true
    offsetRef.current = { x: e.clientX, y: e.clientY }
    animRef.current = 'dragging'
    onDragStart?.()

    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      // 通过 IPC 移动窗口
      window.deskpet?.savePetState({
        x: e.clientX - offsetRef.current.x,
        y: e.clientY - offsetRef.current.y,
        animation: 'dragging',
        mood: 50,
        energy: 80,
        isVisible: true
      })
      offsetRef.current = { x: e.clientX, y: e.clientY }
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
  }, [onDragStart, onDragEnd])

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={onMouseDown}
      style={{
        width: CANVAS_W,
        height: CANVAS_H,
        position: 'absolute',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        cursor: draggingRef.current ? 'grabbing' : 'grab',
        // ⭐ GPU 合成层 + 减少事件冒泡
        willChange: 'transform',
        touchAction: 'none'
      }}
    />
  )
}

export default React.memo(Pet)
