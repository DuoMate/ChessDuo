'use client'

import { History, BarChart3, MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react'

export type BoardTab = 'moves' | 'game' | 'insights' | 'chat'

interface BoardBottomNavProps {
  activeTab: BoardTab
  onTabChange: (tab: BoardTab) => void
  onBack?: () => void
  onForward?: () => void
  unreadChat?: number
}

export function BoardBottomNav({ activeTab, onTabChange, onBack, onForward, unreadChat }: BoardBottomNavProps) {
  return (
    <nav
      className="w-full bg-slate-900/85 backdrop-blur-xl border-t border-white/5 px-2 pt-1.5 pb-2"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex items-center justify-between gap-1 max-w-3xl mx-auto">
        {/* Back button */}
        <button
          type="button"
          onClick={onBack}
          className="flex flex-col items-center justify-center min-h-[44px] min-w-[44px] gap-0.5 rounded-xl text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 transition-all"
          aria-label="Back"
        >
          <ChevronLeft size={18} strokeWidth={2} />
          <span className="text-[10px] font-bold leading-none">Back</span>
        </button>

        {/* Center tabs */}
        <div className="flex items-center gap-1 flex-1 justify-center">
          {[
            { tab: 'moves' as const, label: 'Moves', icon: History },
            { tab: 'insights' as const, label: 'Insights', icon: BarChart3 },
            { tab: 'chat' as const, label: 'Chat', icon: MessageCircle },
          ].map((t) => {
            const active = activeTab === t.tab
            const Icon = t.icon
            return (
              <button
                key={t.tab}
                type="button"
                onClick={() => onTabChange(t.tab)}
                className={`relative flex flex-col items-center justify-center min-h-[44px] min-w-[44px] gap-0.5 rounded-xl px-3 transition-all ${
                  active
                    ? 'bg-amber-500/10 text-amber-300'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
                aria-label={t.label}
              >
                <Icon size={16} strokeWidth={2} />
                <span className="text-[10px] font-bold leading-none">{t.label}</span>
                {t.tab === 'chat' && unreadChat && unreadChat > 0 ? (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadChat}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        {/* Forward button */}
        <button
          type="button"
          onClick={onForward}
          className="flex flex-col items-center justify-center min-h-[44px] min-w-[44px] gap-0.5 rounded-xl text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 transition-all"
          aria-label="Forward"
        >
          <ChevronRight size={18} strokeWidth={2} />
          <span className="text-[10px] font-bold leading-none">Forward</span>
        </button>
      </div>
    </nav>
  )
}
