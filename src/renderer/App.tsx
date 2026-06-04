import React, { useState, useEffect, useCallback } from 'react'
import Pet from './components/Pet'
import Bubble from './components/Bubble'
import Settings from './components/Settings'
import { chat } from './api/deepseek'
import type { PetAnim } from './hooks/petRenderer'

const App: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false)
  const [bubbleMessage, setBubbleMessage] = useState('')
  const [petAnim, setPetAnim] = useState<PetAnim>('idle')

  // 监听主进程的「打开设置」事件
  useEffect(() => {
    const cleanup = (window as any).deskpet?.onOpenSettings(() => {
      setShowSettings(true)
    })
    return cleanup
  }, [])

  // 拖拽回调 — 只改 ref 不触发渲染，所以此处只是占位
  const handleDragStart = useCallback(() => {
    setPetAnim('dragging')
  }, [])

  const handleDragEnd = useCallback(() => {
    setPetAnim('idle')
  }, [])

  // 双击触发对话
  const handleDoubleClick = useCallback(async () => {
    setPetAnim('speaking')
    setBubbleMessage('稍等，让我想想… 🤔')

    try {
      const reply = await chat('今天过得怎么样呀？陪我聊聊天吧！')
      setBubbleMessage(reply)
    } catch {
      setBubbleMessage('唔… 我好像卡住了 (._.)')
    }

    setPetAnim('idle')
  }, [])

  // 关闭气泡
  const handleBubbleClose = useCallback(() => {
    setBubbleMessage('')
  }, [])

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background: 'transparent'
      }}
    >
      {/* 宠物主体 — Canvas 渲染 */}
      <div
        onDoubleClick={handleDoubleClick}
        style={{ width: '100%', height: '100%', position: 'relative' }}
      >
        <Pet
          animation={petAnim}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />
      </div>

      {/* 对话气泡 */}
      {bubbleMessage && (
        <Bubble message={bubbleMessage} onClose={handleBubbleClose} />
      )}

      {/* 设置面板 */}
      {showSettings && (
        <Settings onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}

export default App
