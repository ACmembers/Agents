import React, { useState, useEffect, useCallback } from 'react'
import { Live2DPet } from './live2d'
import type { PetAnim } from './live2d/Live2DPetRenderer'
import Bubble from './components/Bubble'
import Settings from './components/Settings'
import { chat } from './api/deepseek'

const App: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false)
  const [bubbleMessage, setBubbleMessage] = useState('')
  const [petAnim, setPetAnim] = useState<PetAnim>('idle')
  const [tapZone, setTapZone] = useState<string>('')

  useEffect(() => {
    const cleanup = (window as any).deskpet?.onOpenSettings(() => {
      setShowSettings(true)
    })
    return cleanup
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

  // 点击交互反馈
  const handleTap = useCallback((zone: 'head' | 'face' | 'body') => {
    setTapZone(zone)
    const messages: Record<string, string> = {
      head: '诶嘿~ 别摸头啦 ✨',
      face: '别戳啦... 会害羞的',
      body: '嗯？怎么啦？'
    }
    setBubbleMessage(messages[zone] || '嗯？')
    setTimeout(() => setBubbleMessage(''), 3000)
  }, [])

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
      <div
        onDoubleClick={handleDoubleClick}
        style={{ width: '100%', height: '100%', position: 'relative' }}
      >
        <Live2DPet
          animation={petAnim}
          onTap={handleTap}
        />
      </div>

      {bubbleMessage && (
        <Bubble message={bubbleMessage} onClose={handleBubbleClose} />
      )}

      {showSettings && (
        <Settings onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}

export default App
