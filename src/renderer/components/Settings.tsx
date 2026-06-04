import React, { useState, useEffect } from 'react'

interface SettingsProps {
  onClose: () => void
}

const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('deepseek-chat')
  const [temperature, setTemperature] = useState(0.7)

  useEffect(() => {
    // 加载已有配置
    window.deskpet?.getSettings().then((config) => {
      if (config.apiKey) setApiKey(config.apiKey)
      if (config.model) setModel(config.model)
      if (config.temperature) setTemperature(config.temperature)
    })
  }, [])

  const handleSave = async () => {
    await window.deskpet?.setSettings({ apiKey, model, temperature })
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100
      }}
    >
      <div
        style={{
          width: 320,
          background: '#fff',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
        }}
      >
        <h2 style={{ margin: '0 0 20px', fontSize: 18, color: '#333' }}>
          ⚙️ 设置
        </h2>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 4 }}>
            Deepseek API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: 8,
              fontSize: 14,
              outline: 'none'
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 4 }}>
            模型
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: 8,
              fontSize: 14,
              outline: 'none',
              background: '#fff'
            }}
          >
            <option value="deepseek-chat">deepseek-chat</option>
            <option value="deepseek-reasoner">deepseek-reasoner</option>
            <option value="deepseek-v4-pro">deepseek-v4-pro 🚀</option>
          </select>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 4 }}>
            温度 ({(temperature).toFixed(1)})
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              border: '1px solid #ddd',
              borderRadius: 8,
              background: '#fff',
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '8px 20px',
              border: 'none',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #f5af19, #f12711)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

export default React.memo(Settings)
