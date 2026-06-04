import { useState, useCallback, useMemo } from 'react'
import {
  Search, Download, Trash2, Calendar, User, Bot,
  MessageSquare, AlertTriangle, X, FileJson, FileText,
  ChevronLeft, ChevronRight
} from 'lucide-react'
import type { ChatMessage } from '../types'
import { useDashboardStore } from '../stores/dashboardStore'

// 模拟对话数据
const MOCK_CONVERSATIONS: Record<string, ChatMessage[]> = {
  '2026-06-04': [
    { role: 'assistant', content: '早安～新的一天，光芒与你同在 ✨', timestamp: Date.now() - 3600000 * 3 },
    { role: 'user', content: '今天好累啊...', timestamp: Date.now() - 3600000 * 2 },
    { role: 'assistant', content: '辛苦了呢...不过每一次疲惫，都是前进的证明。要不要先休息一下，喝杯水？☕', timestamp: Date.now() - 3600000 * 1.9 },
    { role: 'user', content: '项目做完了！', timestamp: Date.now() - 3600000 },
    { role: 'assistant', content: '太棒了！我就知道你可以的 ✨ 完成一项工作后的感觉，就像圣堂的钟声一样让人心安呢。', timestamp: Date.now() - 3599999 },
  ],
  '2026-06-03': [
    { role: 'assistant', content: '下午好，今天有什么有趣的事情吗？', timestamp: Date.now() - 86400000 },
    { role: 'user', content: '我在想人生的意义', timestamp: Date.now() - 86400000 + 600000 },
    { role: 'assistant', content: '心若宁静，万物皆明。人生的意义不在于找到一个确定的答案，而在于旅途中所遇见的每一道光。你愿意和我分享你的想法吗？🌟', timestamp: Date.now() - 86400000 + 660000 },
  ],
  '2026-06-02': [
    { role: 'user', content: '晚安菲比', timestamp: Date.now() - 172800000 },
    { role: 'assistant', content: '晚安，愿你梦里有星辰 ✨ 明天见～', timestamp: Date.now() - 172800000 + 30000 },
  ],
}

const SORTED_DATES = Object.keys(MOCK_CONVERSATIONS).sort().reverse()

export default function ConversationHistory() {
  const [search, setSearch] = useState('')
  const [selectedDate, setSelectedDate] = useState<string | null>(SORTED_DATES[0] || null)
  const [showClear, setShowClear] = useState(false)
  const [showExport, setShowExport] = useState(false)

  const conversations = useMemo(() => {
    if (!selectedDate) return []
    const msgs = MOCK_CONVERSATIONS[selectedDate] || []
    if (!search.trim()) return msgs
    const q = search.toLowerCase()
    return msgs.filter((m) => m.content.toLowerCase().includes(q))
  }, [selectedDate, search])

  const filteredDates = useMemo(() => {
    if (!search.trim()) return SORTED_DATES
    const q = search.toLowerCase()
    return SORTED_DATES.filter((d) =>
      (MOCK_CONVERSATIONS[d] || []).some((m) => m.content.toLowerCase().includes(q))
    )
  }, [search])

  const handleExport = useCallback((format: 'json' | 'txt') => {
    let content: string
    let filename: string
    if (format === 'json') {
      content = JSON.stringify(MOCK_CONVERSATIONS, null, 2)
      filename = 'deskpet-conversations.json'
    } else {
      content = Object.entries(MOCK_CONVERSATIONS)
        .map(([date, msgs]) =>
          `\n=== ${date} ===\n\n${msgs.map((m) => `[${m.role === 'user' ? '用户' : '菲比'}] ${m.content}`).join('\n\n')}`
        )
        .join('\n')
      filename = 'deskpet-conversations.txt'
    }
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
    setShowExport(false)
  }, [])

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slateblue-900">对话历史</h2>
          <p className="text-sm text-slateblue-400 mt-1">浏览和搜索与菲比的对话记录</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setShowExport(!showExport)} className="btn-ghost flex items-center gap-2">
              <Download className="w-4 h-4" /> 导出
            </button>
            {showExport && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-ivory-100 py-1 z-10 animate-scale-in min-w-[140px]">
                <button onClick={() => handleExport('json')} className="w-full px-4 py-2 text-sm text-left hover:bg-ivory-50 flex items-center gap-2 transition-colors">
                  <FileJson className="w-4 h-4 text-slateblue-400" /> JSON 格式
                </button>
                <button onClick={() => handleExport('txt')} className="w-full px-4 py-2 text-sm text-left hover:bg-ivory-50 flex items-center gap-2 transition-colors">
                  <FileText className="w-4 h-4 text-slateblue-400" /> 纯文本格式
                </button>
              </div>
            )}
          </div>
          <button onClick={() => setShowClear(true)} className="btn-ghost flex items-center gap-2 text-red-500 hover:bg-red-50">
            <Trash2 className="w-4 h-4" /> 清除
          </button>
        </div>
      </div>

      {/* 搜索 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slateblue-300" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索对话内容..."
          className="input-field pl-10"
        />
      </div>

      <div className="flex gap-6">
        {/* 日期列表 */}
        <div className="w-[220px] flex-shrink-0 glass-card p-3 max-h-[500px] overflow-y-auto space-y-1">
          <h4 className="text-[10px] font-medium text-slateblue-400 uppercase tracking-wide px-2 mb-2">
            按日期浏览
          </h4>
          {filteredDates.length === 0 && (
            <p className="text-xs text-slateblue-300 px-2 py-4 text-center">暂无对话记录</p>
          )}
          {filteredDates.map((date) => (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                selectedDate === date
                  ? 'bg-phoebe-50 text-phoebe-700 font-medium'
                  : 'text-slateblue-600 hover:bg-ivory-50'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{date}</span>
              <span className="text-[10px] text-slateblue-300 ml-auto">
                {MOCK_CONVERSATIONS[date]?.length || 0}条
              </span>
            </button>
          ))}
        </div>

        {/* 对话内容 */}
        <div className="flex-1 min-h-[400px]">
          {!selectedDate ? (
            <div className="glass-card p-12 text-center">
              <MessageSquare className="w-12 h-12 text-slateblue-200 mx-auto mb-3" />
              <p className="text-sm text-slateblue-400">选择一个日期查看对话</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Search className="w-12 h-12 text-slateblue-200 mx-auto mb-3" />
              <p className="text-sm text-slateblue-400">没有匹配的对话</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {conversations.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 animate-slide-up ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-phoebe-400 to-phoebe-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-phoebe-500 text-white rounded-br-md'
                        : 'bg-white border border-ivory-200 shadow-sm rounded-bl-md text-slateblue-800'
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-slateblue-200 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-slateblue-500" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 清除确认弹窗 */}
      {showClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-[400px] p-6 space-y-4 animate-scale-in">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold">确认清除</h3>
                <p className="text-xs text-slateblue-400">此操作不可撤销</p>
              </div>
            </div>
            <p className="text-sm text-slateblue-600">
              确定要删除所有对话历史吗？删除后将无法恢复。
            </p>
            <div className="flex items-center gap-3 justify-end pt-2">
              <button onClick={() => setShowClear(false)} className="btn-ghost">取消</button>
              <button
                onClick={() => { setShowClear(false) }}
                className="btn-danger flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> 确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
