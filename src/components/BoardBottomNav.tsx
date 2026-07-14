'use client'

import { motion } from 'framer-motion'
import { History, BarChart3, MessageCircle, Flag, LayoutGrid } from 'lucide-react'

export type BoardTab = 'moves' | 'game' | 'surrender' | 'insights' | 'chat'

interface BoardBottomNavProps {
  activeTab: BoardTab
  onTabChange: (tab: BoardTab) => void
  onSurrender?: () => void
  unreadChat?: number
}

const TAB_DEFS: Array<{
  tab: BoardTab
  label: string
  icon: typeof History
  isCenter?: boolean
}> = [
  { tab: 'moves', label: 'Moves', icon: History },
  { tab: 'game', label: 'Game', icon: LayoutGrid },
  { tab: 'surrender', label: 'Surrender', icon: Flag, isCenter: true },
  { tab: 'insights', label: 'Insights', icon: BarChart3 },
  { tab: 'chat', label: 'Chat', icon: MessageCircle },
]

export function BoardBottomNav({ activeTab, onTabChange, onSurrender, unreadChat }: BoardBottomNavProps) {
  return (
    <nav
      className="w-full bg-slate-900/85 backdrop-blur-xl border-t border-white/5 px-2 pt-1.5 pb-2"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="grid grid-cols-5 gap-1 max-w-3xl mx-auto">
        {TAB_DEFS.map((t) => {
          const isCenter = !!t.isCenter
          const active = activeTab === t.tab
          const Icon = t.icon
          return (
            <button
              key={t.tab}
              type="button"
              onClick={() => {
                if (t.tab === 'surrender' && onSurrender) {
                  onSurrender()
                } else {
                  onTabChange(t.tab)
                }
              }}
              className={`relative flex flex-col items-center justify-center min-h-[44px] gap-0.5 rounded-xl transition-all ${
                isCenter
                  ? active
                    ? 'bg-rose-500/15 text-rose-300'
                    : 'bg-slate-100 text-slate-900 hover:bg-white'
                  : active
                    ? 'bg-amber-500/10 text-amber-300'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
              aria-label={t.label}
            >
              <Icon size={isCenter ? 18 : 16} strokeWidth={isCenter ? 2.4 : 2} />
              <span className={`text-[10px] font-bold leading-none ${isCenter ? 'text-[11px]' : ''}`}>
                {t.label}
              </span>
              {t.tab === 'chat' && unreadChat && unreadChat > 0 ? (
                <span className="absolute top-1 right-2 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadChat}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
