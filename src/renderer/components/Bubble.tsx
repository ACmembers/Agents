import React, { useState, useEffect, useCallback } from 'react'

interface BubbleProps {
  message: string
  onClose?: () => void
}

/**
 * 🚀 对话气泡 — 使用 CSS animation 驱动入场，避免 JS 重绘
 */
const Bubble: React.FC<BubbleProps> = ({ message, onClose }) => {
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    // 下一帧添加入场类，触发 CSS 动画
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const handleClick = useCallback(() => {
    onClose?.()
  }, [onClose])

  return (
    <div
      onClick={handleClick}
      className={entered ? 'bubble-enter' : ''}
      style={{
        position: 'absolute',
        top: -56,
        left: '50%',
        // ⭐ 使用 transform 做动画（GPU 合成），不用 top/opacity（CPU 布局）
        transform: entered
          ? 'translateX(-50%) translateY(0)'
          : 'translateX(-50%) translateY(10px)',
        maxWidth: 200,
        padding: '10px 14px',
        background: 'rgba(255,255,255,0.95)',
        borderRadius: 12,
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        cursor: 'pointer',
        opacity: entered ? 1 : 0,
        transition: 'opacity 0.2s ease, transform 0.25s ease',
        fontSize: 13,
        lineHeight: 1.5,
        color: '#333',
        wordBreak: 'break-word',
        // ⭐ GPU 合成层
        willChange: 'transform, opacity',
        transformStyle: 'preserve-3d',
        pointerEvents: 'auto'
      }}
    >
      {/* 三角指向 */}
      <div
        style={{
          position: 'absolute',
          bottom: -6,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: '6px solid rgba(255,255,255,0.95)'
        }}
      />
      {message}
    </div>
  )
}

export default React.memo(Bubble)
