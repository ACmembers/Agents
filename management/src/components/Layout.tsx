import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Box, Sparkles, Settings, MessageSquare, History,
  Wrench, Bot, Cpu
} from 'lucide-react'
import { useDashboardStore } from '../stores/dashboardStore'

const NAV_ITEMS = [
  { to: '/models', icon: Box, label: '模型管理' },
  { to: '/settings', icon: Cpu, label: 'API 配置' },
  { to: '/persona', icon: Sparkles, label: '人设编辑' },
  { to: '/skills', icon: Wrench, label: 'Skill 管理' },
  { to: '/history', icon: History, label: '对话历史' },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { connected, configPath } = useDashboardStore()

  return (
    <div className="flex h-full">
      {/* ===== 侧边栏 ===== */}
      <aside className="w-[220px] flex-shrink-0 bg-slateblue-950 text-white flex flex-col">
        {/* Logo */}
        <div className="px-5 py-6 flex items-center gap-3 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-phoebe-400 to-phoebe-600 flex items-center justify-center shadow-lg shadow-phoebe-500/30">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide">DeskPet</h1>
            <p className="text-[10px] text-slateblue-300">管理面板</p>
          </div>
        </div>

        {/* 导航 */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-white/10 text-white shadow-inner'
                    : 'text-slateblue-300 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* 底部状态 */}
        <div className="px-4 py-3 border-t border-white/10 text-[11px] text-slateblue-400 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400/50' : 'bg-slateblue-500'}`} />
            <span>{connected ? '已连接桌宠' : '未连接'}</span>
          </div>
          <p className="truncate opacity-60" title={configPath}>
            {configPath}
          </p>
        </div>
      </aside>

      {/* ===== 主内容区 ===== */}
      <main className="flex-1 overflow-y-auto bg-ivory-50">
        <div className="max-w-5xl mx-auto p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
