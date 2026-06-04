import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Save, RotateCcw, Play, Plus, Trash2,
  ToggleLeft, ToggleRight, ChevronDown, X, AlertCircle
} from 'lucide-react'
import { useDashboardStore } from '../stores/dashboardStore'
import type { Skill, SkillTrigger } from '../types'

const TRIGGER_OPTIONS: { value: SkillTrigger; label: string }[] = [
  { value: 'timer', label: '定时触发' },
  { value: 'keyword', label: '关键词触发' },
  { value: 'manual', label: '手动触发' },
  { value: 'startup', label: '启动时触发' },
]

const TRIGGER_COLORS: Record<SkillTrigger, string> = {
  timer: 'tag-timer',
  keyword: 'tag-keyword',
  manual: 'tag-manual',
  startup: 'tag-startup'
}

function generateId(): string {
  return `skill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function emptySkill(): Skill {
  return {
    id: generateId(),
    name: '新技能',
    description: '',
    trigger: 'timer',
    config: { interval: 3600, randomVariance: 300 },
    promptInjection: '',
    enabled: false,
    cooldown: 60
  }
}

export default function SkillEditor() {
  const { skills, updateSkill, deleteSkill, addSkill } = useDashboardStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [newSkill, setNewSkill] = useState<Skill>(emptySkill())
  const [saveMsg, setSaveMsg] = useState('')

  const editing = editingId ? skills.find((s) => s.id === editingId) : null

  const handleToggle = useCallback(
    (id: string, enabled: boolean) => {
      updateSkill(id, { enabled })
    },
    [updateSkill]
  )

  const saveEdit = useCallback(() => {
    if (!editing || !editingId) return
    updateSkill(editingId, editing)
    setEditingId(null)
    setSaveMsg('已保存')
    setTimeout(() => setSaveMsg(''), 2000)
  }, [editing, editingId, updateSkill])

  const handleNew = useCallback(() => {
    if (!newSkill.name.trim()) return
    addSkill({ ...newSkill, id: generateId() })
    setNewSkill(emptySkill())
    setShowNew(false)
    setSaveMsg('技能已添加')
    setTimeout(() => setSaveMsg(''), 2000)
  }, [newSkill, addSkill])

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slateblue-900">Skill 管理</h2>
          <p className="text-sm text-slateblue-400 mt-1">
            管理桌宠的主动行为 — 定时提醒、关键词响应、自定义动作
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveMsg && (
            <span className="text-xs text-emerald-600 animate-fade-in flex items-center gap-1">
              <Save className="w-3 h-3" /> {saveMsg}
            </span>
          )}
          <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> 新建 Skill
          </button>
        </div>
      </div>

      {/* Skill 列表 */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ivory-100">
                <th className="text-left text-xs font-medium text-slateblue-400 px-5 py-3 w-10">#</th>
                <th className="text-left text-xs font-medium text-slateblue-400 px-5 py-3">名称</th>
                <th className="text-left text-xs font-medium text-slateblue-400 px-5 py-3">触发</th>
                <th className="text-left text-xs font-medium text-slateblue-400 px-5 py-3">描述</th>
                <th className="text-center text-xs font-medium text-slateblue-400 px-5 py-3 w-20">启用</th>
                <th className="text-right text-xs font-medium text-slateblue-400 px-5 py-3 w-24">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ivory-50">
              {skills.map((skill, i) => (
                <tr
                  key={skill.id}
                  onClick={() => setEditingId(skill.id)}
                  className={`hover:bg-ivory-50/50 transition-colors cursor-pointer ${
                    editingId === skill.id ? 'bg-phoebe-50/50' : ''
                  }`}
                >
                  <td className="px-5 py-3 text-xs text-slateblue-300 font-mono">{i + 1}</td>
                  <td className="px-5 py-3 text-sm font-medium text-slateblue-800">{skill.name}</td>
                  <td className="px-5 py-3">
                    <span className={`tag ${TRIGGER_COLORS[skill.trigger]}`}>
                      {TRIGGER_OPTIONS.find((t) => t.value === skill.trigger)?.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slateblue-400 max-w-[240px] truncate">
                    {skill.description}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggle(skill.id, !skill.enabled) }}
                      className="text-slateblue-400 hover:text-phoebe-500 transition-colors"
                    >
                      {skill.enabled ? (
                        <ToggleRight className="w-6 h-6 text-phoebe-500" />
                      ) : (
                        <ToggleLeft className="w-6 h-6" />
                      )}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSkill(skill.id) }}
                      className="p-1.5 text-slateblue-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 编辑面板 — 点击行展开 */}
      {editing && (
        <div className="glass-card p-6 animate-slide-up space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slateblue-900">编辑: {editing.name}</h3>
            <button
              onClick={() => setEditingId(null)}
              className="p-1.5 text-slateblue-400 hover:text-slateblue-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slateblue-600 mb-1.5 block">名称</label>
              <input
                value={editing.name}
                onChange={(e) => updateSkill(editing.id, { name: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slateblue-600 mb-1.5 block">触发类型</label>
              <select
                value={editing.trigger}
                onChange={(e) => {
                  const t = e.target.value as SkillTrigger
                  let config: any = editing.config
                  if (t === 'timer') config = { interval: 3600, randomVariance: 300 }
                  if (t === 'keyword') config = { keywords: [], matchMode: 'contains' }
                  if (t === 'manual') config = { label: '' }
                  if (t === 'startup') config = { delay: 3 }
                  updateSkill(editing.id, { trigger: t, config } as Partial<Skill>)
                }}
                className="input-field"
              >
                {TRIGGER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slateblue-600 mb-1.5 block">描述</label>
            <input
              value={editing.description}
              onChange={(e) => updateSkill(editing.id, { description: e.target.value })}
              className="input-field"
              placeholder="简短描述这个 Skill 的作用..."
            />
          </div>

          {/* 动态配置 */}
          {editing.trigger === 'timer' && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-slateblue-600 mb-1.5 block">间隔（秒）</label>
                <input
                  type="number"
                  value={(editing.config as any).interval ?? 3600}
                  onChange={(e) => updateSkill(editing.id, { config: { ...editing.config, interval: +e.target.value } } as Partial<Skill>)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slateblue-600 mb-1.5 block">随机偏差（±秒）</label>
                <input
                  type="number"
                  value={(editing.config as any).randomVariance ?? 300}
                  onChange={(e) => updateSkill(editing.id, { config: { ...editing.config, randomVariance: +e.target.value } } as Partial<Skill>)}
                  className="input-field"
                />
              </div>
            </div>
          )}

          {editing.trigger === 'keyword' && (
            <div>
              <label className="text-xs font-medium text-slateblue-600 mb-1.5 block">关键词（逗号分隔）</label>
              <input
                value={(editing.config as any).keywords?.join(', ') ?? ''}
                onChange={(e) =>
                  updateSkill(editing.id, {
                    config: { ...editing.config, keywords: e.target.value.split(',').map((k: string) => k.trim()).filter(Boolean) }
                  } as Partial<Skill>)
                }
                className="input-field"
                placeholder="难过, 不开心, 累..."
              />
              <div className="flex flex-wrap gap-1 mt-2">
                {(editing.config as any).keywords?.map((kw: string) => (
                  <span key={kw} className="tag tag-keyword">{kw}</span>
                ))}
              </div>
            </div>
          )}

          {editing.trigger === 'manual' && (
            <div>
              <label className="text-xs font-medium text-slateblue-600 mb-1.5 block">菜单标签</label>
              <input
                value={(editing.config as any).label ?? ''}
                onChange={(e) => updateSkill(editing.id, { config: { ...editing.config, label: e.target.value } } as Partial<Skill>)}
                className="input-field"
                placeholder="右键菜单显示的标签..."
              />
            </div>
          )}

          {editing.trigger === 'startup' && (
            <div>
              <label className="text-xs font-medium text-slateblue-600 mb-1.5 block">启动后延迟（秒）</label>
              <input
                type="number"
                value={(editing.config as any).delay ?? 3}
                onChange={(e) => updateSkill(editing.id, { config: { ...editing.config, delay: +e.target.value } } as Partial<Skill>)}
                className="input-field w-48"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slateblue-600 mb-1.5 flex items-center gap-2">
              <AlertCircle className="w-3 h-3 text-phoebe-400" />
              Prompt 注入内容
            </label>
            <textarea
              value={editing.promptInjection}
              onChange={(e) => updateSkill(editing.id, { promptInjection: e.target.value })}
              rows={3}
              className="input-field font-mono text-xs leading-relaxed resize-y"
              placeholder="这个 Skill 触发时，注入到 System Prompt 的内容..."
            />
            <p className="text-[10px] text-slateblue-300 mt-1">这段内容会在 Skill 触发时追加到 System Prompt 中</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-slateblue-600 mb-1.5 block">冷却时间（秒）</label>
              <input
                type="number"
                value={editing.cooldown}
                onChange={(e) => updateSkill(editing.id, { cooldown: +e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button onClick={saveEdit} className="btn-primary flex items-center gap-2">
              <Save className="w-4 h-4" /> 保存修改
            </button>
            <button onClick={() => setEditingId(null)} className="btn-ghost">取消</button>
          </div>
        </div>
      )}

      {/* 新建 Skill 弹窗 */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-[520px] max-h-[80vh] overflow-y-auto p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slateblue-900">新建 Skill</h3>
              <button onClick={() => setShowNew(false)} className="p-1 text-slateblue-400 hover:text-slateblue-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slateblue-600 mb-1.5 block">名称 *</label>
                <input
                  value={newSkill.name}
                  onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
                  className="input-field"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slateblue-600 mb-1.5 block">触发类型</label>
                <select
                  value={newSkill.trigger}
                  onChange={(e) => {
                    const t = e.target.value as SkillTrigger
                    let config: any = {}
                    if (t === 'timer') config = { interval: 3600, randomVariance: 300 }
                    if (t === 'keyword') config = { keywords: [], matchMode: 'contains' }
                    if (t === 'manual') config = { label: '' }
                    if (t === 'startup') config = { delay: 3 }
                    setNewSkill({ ...newSkill, trigger: t, config })
                  }}
                  className="input-field"
                >
                  {TRIGGER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slateblue-600 mb-1.5 block">描述</label>
              <input
                value={newSkill.description}
                onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })}
                className="input-field"
              />
            </div>

            {newSkill.trigger === 'timer' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slateblue-600 mb-1.5 block">间隔（秒）</label>
                  <input type="number" value={(newSkill.config as any).interval ?? 3600}
                    onChange={(e) => setNewSkill({ ...newSkill, config: { ...newSkill.config, interval: +e.target.value } })}
                    className="input-field" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slateblue-600 mb-1.5 block">随机偏差（±秒）</label>
                  <input type="number" value={(newSkill.config as any).randomVariance ?? 300}
                    onChange={(e) => setNewSkill({ ...newSkill, config: { ...newSkill.config, randomVariance: +e.target.value } })}
                    className="input-field" />
                </div>
              </div>
            )}

            {newSkill.trigger === 'keyword' && (
              <div>
                <label className="text-xs font-medium text-slateblue-600 mb-1.5 block">关键词（逗号分隔）</label>
                <input
                  value={(newSkill.config as any).keywords?.join(', ') ?? ''}
                  onChange={(e) =>
                    setNewSkill({ ...newSkill, config: { ...newSkill.config, keywords: e.target.value.split(',').map((k: string) => k.trim()).filter(Boolean) } })
                  }
                  className="input-field"
                  placeholder="难过, 开心, 累..."
                />
              </div>
            )}

            {newSkill.trigger === 'manual' && (
              <div>
                <label className="text-xs font-medium text-slateblue-600 mb-1.5 block">菜单标签</label>
                <input
                  value={(newSkill.config as any).label ?? ''}
                  onChange={(e) => setNewSkill({ ...newSkill, config: { ...newSkill.config, label: e.target.value } })}
                  className="input-field"
                />
              </div>
            )}

            {newSkill.trigger === 'startup' && (
              <div>
                <label className="text-xs font-medium text-slateblue-600 mb-1.5 block">启动后延迟（秒）</label>
                <input type="number" value={(newSkill.config as any).delay ?? 3}
                  onChange={(e) => setNewSkill({ ...newSkill, config: { ...newSkill.config, delay: +e.target.value } })}
                  className="input-field w-48" />
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-slateblue-600 mb-1.5 block">Prompt 注入</label>
              <textarea
                value={newSkill.promptInjection}
                onChange={(e) => setNewSkill({ ...newSkill, promptInjection: e.target.value })}
                rows={3}
                className="input-field font-mono text-xs resize-y"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slateblue-600 mb-1.5 block">冷却时间（秒）</label>
              <input type="number" value={newSkill.cooldown}
                onChange={(e) => setNewSkill({ ...newSkill, cooldown: +e.target.value })}
                className="input-field w-48" />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button onClick={handleNew} className="btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" /> 添加 Skill
              </button>
              <button onClick={() => setShowNew(false)} className="btn-ghost">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
