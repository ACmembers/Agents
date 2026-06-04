import { useState, useCallback } from 'react'
import {
  Eye, EyeOff, Save, Zap, CheckCircle, XCircle,
  ChevronDown, Globe
} from 'lucide-react'
import { useDashboardStore } from '../stores/dashboardStore'
import { PROVIDER_DEFAULTS, type ProviderId } from '../types'

const PROVIDER_OPTIONS: { id: ProviderId; label: string }[] = [
  { id: 'deepseek', label: 'Deepseek' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'qwen', label: '通义千问 (Qwen)' },
  { id: 'moonshot', label: 'Moonshot (Kimi)' },
  { id: 'zhipu', label: '智谱 (GLM)' },
  { id: 'custom', label: '自定义' },
]

export default function SettingsPage() {
  const { apiSettings, updateProvider, setActiveProvider } = useDashboardStore()
  const active = apiSettings.providers[apiSettings.activeProvider]
  const [showKey, setShowKey] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [testResult, setTestResult] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')

  const handleSave = useCallback(() => {
    setSaveStatus('saving')
    setTimeout(() => {
      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 2500)
    }, 400)
  }, [])

  const handleTest = useCallback(async () => {
    setTestResult('testing')
    try {
      const res = await fetch(`${active.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${active.apiKey}` }
      })
      setTestResult(res.ok ? 'ok' : 'fail')
    } catch {
      setTestResult('fail')
    }
    setTimeout(() => setTestResult('idle'), 3000)
  }, [active.baseUrl, active.apiKey])

  const handleProviderChange = useCallback(
    (id: ProviderId) => {
      setActiveProvider(id)
      const defaults = PROVIDER_DEFAULTS[id]
      updateProvider(id, {
        baseUrl: defaults.baseUrl,
        models: defaults.models,
        activeModel: defaults.models[0] || ''
      })
    },
    [setActiveProvider, updateProvider]
  )

  return (
    <div className="animate-fade-in space-y-8">
      {/* 页头 */}
      <div>
        <h2 className="text-2xl font-semibold text-slateblue-900">API 配置</h2>
        <p className="text-sm text-slateblue-400 mt-1">配置 AI 服务商连接参数，所有接口使用 OpenAI 兼容格式</p>
      </div>

      {/* 提供商切换 */}
      <div className="glass-card p-6 space-y-6">
        <div>
          <label className="text-sm font-medium text-slateblue-700 mb-2 block">AI 提供商</label>
          <div className="relative">
            <select
              value={apiSettings.activeProvider}
              onChange={(e) => handleProviderChange(e.target.value as ProviderId)}
              className="input-field appearance-none pr-10"
            >
              {PROVIDER_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slateblue-400 pointer-events-none" />
          </div>
        </div>

        {/* API Key */}
        <div>
          <label className="text-sm font-medium text-slateblue-700 mb-2 block">API Key</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={active.apiKey}
              onChange={(e) => updateProvider(apiSettings.activeProvider, { apiKey: e.target.value })}
              placeholder="sk-..."
              className="input-field pr-10 font-mono text-xs"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slateblue-400 hover:text-slateblue-600 transition-colors"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* API URL */}
        <div>
          <label className="text-sm font-medium text-slateblue-700 mb-2 flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-slateblue-400" />
            API URL
          </label>
          <input
            type="text"
            value={active.baseUrl}
            onChange={(e) => updateProvider(apiSettings.activeProvider, { baseUrl: e.target.value })}
            className="input-field font-mono text-xs"
          />
        </div>

        {/* 模型选择 */}
        <div>
          <label className="text-sm font-medium text-slateblue-700 mb-2 block">模型</label>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <select
                value={active.activeModel}
                onChange={(e) => updateProvider(apiSettings.activeProvider, { activeModel: e.target.value })}
                className="input-field appearance-none pr-10"
              >
                {active.models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
                {active.models.length === 0 && <option value="">— 手动输入 —</option>}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slateblue-400 pointer-events-none" />
            </div>
            {apiSettings.activeProvider === 'custom' && (
              <input
                type="text"
                value={active.activeModel}
                onChange={(e) => updateProvider(apiSettings.activeProvider, { activeModel: e.target.value })}
                placeholder="输入模型名"
                className="input-field flex-1"
              />
            )}
          </div>
        </div>

        {/* Temperature */}
        <div>
          <label className="text-sm font-medium text-slateblue-700 mb-2 flex items-center justify-between">
            <span>Temperature</span>
            <span className="text-phoebe-600 font-mono text-xs bg-phoebe-50 px-2 py-0.5 rounded">
              {active.temperature.toFixed(1)}
            </span>
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={active.temperature}
            onChange={(e) => updateProvider(apiSettings.activeProvider, { temperature: parseFloat(e.target.value) })}
            className="w-full h-2 bg-slateblue-100 rounded-lg appearance-none cursor-pointer
                       accent-phoebe-500 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                       [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md"
          />
          <div className="flex justify-between text-[10px] text-slateblue-300 mt-1">
            <span>精确</span><span>平衡</span><span>创意</span>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleTest} disabled={testResult === 'testing' || !active.apiKey} className="btn-ghost flex items-center gap-2">
            <Zap className="w-4 h-4" />
            {testResult === 'testing' ? '测试中...' : '测试连接'}
          </button>
          {testResult === 'ok' && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 animate-fade-in">
              <CheckCircle className="w-3.5 h-3.5" /> 连接成功
            </span>
          )}
          {testResult === 'fail' && (
            <span className="flex items-center gap-1 text-xs text-red-500 animate-fade-in">
              <XCircle className="w-3.5 h-3.5" /> 连接失败
            </span>
          )}
          <div className="flex-1" />
          <button onClick={handleSave} disabled={saveStatus === 'saving'} className="btn-primary flex items-center gap-2">
            {saveStatus === 'success' ? (
              <>
                <CheckCircle className="w-4 h-4" /> 已保存
              </>
            ) : saveStatus === 'error' ? (
              <>
                <XCircle className="w-4 h-4" /> 失败
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> 保存配置
              </>
            )}
          </button>
        </div>
      </div>

      {/* 连接信息卡片 */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-medium text-slateblue-700 mb-3">连接地址</h3>
        <code className="text-xs text-slateblue-500 bg-slateblue-50 px-3 py-2 rounded-lg block font-mono break-all">
          {active.baseUrl}/chat/completions
        </code>
        <p className="text-[11px] text-slateblue-300 mt-2">
          所有 OpenAI-compatible 接口均适用此地址格式
        </p>
      </div>
    </div>
  )
}
