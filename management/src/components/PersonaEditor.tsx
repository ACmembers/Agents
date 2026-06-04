import { useState, useCallback, useMemo } from 'react'
import {
  Save, RotateCcw, Play, MessageSquare, Sparkles, AlertCircle
} from 'lucide-react'
import { useDashboardStore, PHOEBE_DEFAULT_PROMPT } from '../stores/dashboardStore'

export default function PersonaEditor() {
  const { persona, setPersona, resetPersona } = useDashboardStore()
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>('idle')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewMsg, setPreviewMsg] = useState('')

  const handleSave = useCallback(() => {
    setSaveStatus('success')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }, [])

  // Ctrl+S
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    },
    [handleSave]
  )

  // 行号显示
  const lineCount = useMemo(() => persona.systemPrompt.split('\n').length, [persona.systemPrompt])

  const handlePreview = useCallback(() => {
    setPreviewMsg('*测试中...*')
    setTimeout(() => {
      setPreviewMsg('光芒照耀之处，必有希望萌芽 ✨\n\n你今天的努力我都看在眼里——每一份付出都值得被温柔以待。朋友，很高兴能陪你走过这段旅途。')
    }, 800)
  }, [])

  return (
    <div className="animate-fade-in space-y-6" onKeyDown={handleKeyDown}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slateblue-900">人设编辑器</h2>
          <p className="text-sm text-slateblue-400 mt-1">
            编辑菲比的 System Prompt，定义她的性格、语气和行为方式
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === 'success' && (
            <span className="text-xs text-emerald-600 animate-fade-in flex items-center gap-1">
              <Save className="w-3 h-3" /> 已保存
            </span>
          )}
          <button onClick={resetPersona} className="btn-ghost flex items-center gap-2 text-amber-600 hover:bg-amber-50">
            <RotateCcw className="w-4 h-4" /> 恢复默认
          </button>
          <button onClick={handleSave} className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" /> 保存 (Ctrl+S)
          </button>
        </div>
      </div>

      {/* 角色名称 */}
      <div className="glass-card p-5">
        <label className="text-sm font-medium text-slateblue-700 mb-2 block">角色名称</label>
        <input
          value={persona.name}
          onChange={(e) => setPersona({ ...persona, name: e.target.value })}
          className="input-field max-w-xs text-lg font-semibold"
        />
      </div>

      {/* System Prompt 编辑器 */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-3 border-b border-ivory-100 flex items-center justify-between">
          <span className="text-sm font-medium text-slateblue-700 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-phoebe-500" />
            System Prompt
          </span>
          <span className="text-[10px] text-slateblue-300">
            支持 Markdown 格式 · {persona.systemPrompt.length} 字符 · {lineCount} 行
          </span>
        </div>
        <div className="flex">
          {/* 行号 */}
          <div className="py-3 bg-ivory-50/80 select-none flex-shrink-0">
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i} className="line-numbers px-3 py-[0.3px] leading-relaxed">
                {i + 1}
              </div>
            ))}
          </div>
          {/* 编辑区 */}
          <textarea
            value={persona.systemPrompt}
            onChange={(e) => setPersona({ ...persona, systemPrompt: e.target.value })}
            rows={Math.max(16, lineCount + 2)}
            className="flex-1 p-3 font-mono text-xs leading-relaxed resize-y
                       bg-transparent border-0 outline-none focus:outline-none
                       text-slateblue-800 placeholder:text-slateblue-300"
            spellCheck={false}
          />
        </div>
      </div>

      {/* 说话风格 */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-medium text-slateblue-700 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-slateblue-400" />
          说话风格
        </h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <label className="text-xs font-medium text-slateblue-600 mb-1.5 block">
              每轮最多句数
            </label>
            <input
              type="number"
              min={1} max={10}
              value={persona.speakingStyle.maxSentences}
              onChange={(e) =>
                setPersona({
                  ...persona,
                  speakingStyle: { ...persona.speakingStyle, maxSentences: +e.target.value }
                })
              }
              className="input-field"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slateblue-600 mb-1.5 block">
              使用 Emoji
            </label>
            <button
              onClick={() =>
                setPersona({
                  ...persona,
                  speakingStyle: { ...persona.speakingStyle, useEmoji: !persona.speakingStyle.useEmoji }
                })
              }
              className={`toggle-switch`}
              data-on={persona.speakingStyle.useEmoji}
              aria-label="切换 Emoji"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slateblue-600 mb-1.5 flex items-center justify-between">
              <span>正式度</span>
              <span className="text-phoebe-600 font-mono text-[10px]">
                {persona.speakingStyle.formality.toFixed(1)}
              </span>
            </label>
            <input
              type="range"
              min="0" max="1" step="0.1"
              value={persona.speakingStyle.formality}
              onChange={(e) =>
                setPersona({
                  ...persona,
                  speakingStyle: { ...persona.speakingStyle, formality: +e.target.value }
                })
              }
              className="w-full h-2 bg-slateblue-100 rounded-lg appearance-none cursor-pointer accent-phoebe-500"
            />
            <div className="flex justify-between text-[10px] text-slateblue-300 mt-1">
              <span>亲切随和</span><span>恰到好处</span><span>庄重典雅</span>
            </div>
          </div>
        </div>
      </div>

      {/* 会话记忆 */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-medium text-slateblue-700">会话记忆</h3>
        <div className="grid grid-cols-2 gap-6">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs font-medium text-slateblue-600 mb-1.5">启用上下文记忆</p>
              <p className="text-[10px] text-slateblue-300">菲比会记住最近的对话内容</p>
            </div>
            <button
              onClick={() =>
                setPersona({
                  ...persona,
                  memory: { ...persona.memory, enabled: !persona.memory.enabled }
                })
              }
              className="toggle-switch"
              data-on={persona.memory.enabled}
              aria-label="切换记忆"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slateblue-600 mb-1.5 block">
              保留最近消息数
            </label>
            <input
              type="number"
              min={0} max={100}
              value={persona.memory.maxMessages}
              onChange={(e) =>
                setPersona({
                  ...persona,
                  memory: { ...persona.memory, maxMessages: +e.target.value }
                })
              }
              disabled={!persona.memory.enabled}
              className="input-field w-32"
            />
          </div>
        </div>
      </div>

      {/* 预览按钮 */}
      <div className="flex items-center gap-3">
        <button onClick={handlePreview} className="btn-ghost flex items-center gap-2">
          <Play className="w-4 h-4" /> 预览角色回复
        </button>
      </div>

      {previewMsg && (
        <div className="glass-card p-5 animate-slide-up space-y-3">
          <h4 className="text-xs font-medium text-slateblue-400 uppercase tracking-wide">预览: {persona.name} 的回复</h4>
          <div className="bg-ivory-50 rounded-xl px-4 py-3 text-sm text-slateblue-800 leading-relaxed whitespace-pre-line">
            {previewMsg}
          </div>
        </div>
      )}
    </div>
  )
}
