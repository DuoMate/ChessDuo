'use client'

import { History, BarChart3, MessageCircle, ChevronLeft, ChevronRight, Lock } from 'lucide-react'

export type BoardTab = 'moves' | 'game' | 'insights' | 'chat'

interface BoardBottomNavProps {
  activeTab: BoardTab
  onTabChange: (tab: BoardTab) => void
  onForward?: () => void
  onBackMove?: () => void
  onForwardMove?: () => void
  unreadChat?: number
  insightsLocked?: boolean
}

export function BoardBottomNav({ activeTab, onTabChange, onForward, onBackMove, onForwardMove, unreadChat, insightsLocked }: BoardBottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}
    >
      <div className="flex items-center justify-around h-14 w-[95%] max-w-md px-1 rounded-2xl border border-slate-200/60 bg-white/90 shadow-[0_8px_32px_rgba(2,6,23,0.12)] backdrop-blur-2xl dark:border-slate-700/50 dark:bg-[var(--color-page-bg)]/90 dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        {/* Moves */}
        <button
          type="button"
          onClick={() => onTabChange('moves')}
          className={`flex flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 transition-all min-h-[44px] min-w-[44px] flex-1 ${
            activeTab === 'moves' ? 'bg-blue-500/15 text-blue-300' : 'text-slate-400 hover:text-slate-300'
          }`}
          aria-label="Moves"
        >
          <History size={18} strokeWidth={activeTab === 'moves' ? 2.5 : 2} />
          <span className="text-xs font-bold leading-none">Moves</span>
        </button>

        {/* Chat */}
        <button
          type="button"
          onClick={() => onTabChange('chat')}
          className={`relative flex flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 transition-all min-h-[44px] min-w-[44px] flex-1 ${
            activeTab === 'chat' ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-400 hover:text-slate-300'
          }`}
          aria-label="Chat"
        >
          <MessageCircle size={18} strokeWidth={activeTab === 'chat' ? 2.5 : 2} />
          <span className="text-xs font-bold leading-none">Chat</span>
          {unreadChat && unreadChat > 0 && (
            <span className="absolute top-1 right-1 min-w-[14px] h-3.5 px-1 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center">
              {unreadChat > 9 ? '9+' : unreadChat}
            </span>
          )}
        </button>

        {/* Insights — premium graph icon */}
        <button
          type="button"
          onClick={() => onTabChange('insights')}
          className={`relative flex flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 transition-all min-h-[44px] min-w-[44px] flex-1 ${
            activeTab === 'insights'
              ? 'bg-blue-500/15 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.2)]'
              : 'text-slate-400 hover:text-slate-300 hover:bg-blue-500/5'
          }`}
          aria-label="Insights"
        >
          <div className="relative">
            <BarChart3 size={20} strokeWidth={activeTab === 'insights' ? 2.5 : 2} />
            {insightsLocked && (
              <span className="absolute -top-1.5 -right-2.5 flex items-center justify-center w-4 h-4 rounded-full bg-blue-500 text-white">
                <Lock size={8} strokeWidth={3} />
              </span>
            )}
          </div>
          <span className="text-xs font-bold leading-none">Insights</span>
        </button>

        {/* Back */}
        <button
          type="button"
          onClick={onBackMove}
          className="flex flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 transition-all min-h-[44px] min-w-[44px] flex-1 text-slate-400 hover:text-slate-200"
          aria-label="Previous move"
        >
          <ChevronLeft size={18} strokeWidth={2.5} />
          <span className="text-xs font-bold leading-none">Back</span>
        </button>

        {/* Forward */}
        <button
          type="button"
          onClick={onForwardMove}
          className="flex flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 transition-all min-h-[44px] min-w-[44px] flex-1 text-slate-400 hover:text-slate-200"
          aria-label="Next move"
        >
          <ChevronRight size={18} strokeWidth={2.5} />
          <span className="text-xs font-bold leading-none">Fwd</span>
        </button>
      </div>
    </nav>
  )
}
