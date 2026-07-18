'use client'

import { History, BarChart3, MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react'

export type BoardTab = 'moves' | 'game' | 'insights' | 'chat'

interface BoardBottomNavProps {
  activeTab: BoardTab
  onTabChange: (tab: BoardTab) => void
  onBack?: () => void
  onForward?: () => void
  onBackMove?: () => void
  onForwardMove?: () => void
  unreadChat?: number
}

export function BoardBottomNav({ activeTab, onTabChange, onBack, onForward, onBackMove, onForwardMove, unreadChat }: BoardBottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex justify-center"
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}
    >
      <div className="flex items-center h-14 w-[95%] max-w-md px-2 rounded-2xl border border-slate-200/60 bg-white/90 shadow-[0_8px_32px_rgba(2,6,23,0.12)] backdrop-blur-2xl dark:border-slate-700/50 dark:bg-[#0a0e1a]/90 dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        {/* Moves tab */}
        <button
          type="button"
          onClick={() => onTabChange('moves')}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 transition-all min-h-[44px] min-w-[44px] ${
            activeTab === 'moves' ? 'bg-blue-500/15 text-blue-300' : 'text-slate-400 hover:text-slate-300'
          }`}
          aria-label="Moves"
        >
          <History size={18} strokeWidth={activeTab === 'moves' ? 2.5 : 2} />
          <span className="text-[10px] font-bold leading-none">Moves</span>
        </button>

        {/* Chat tab */}
        <button
          type="button"
          onClick={() => onTabChange('chat')}
          className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 transition-all min-h-[44px] min-w-[44px] ${
            activeTab === 'chat' ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-400 hover:text-slate-300'
          }`}
          aria-label="Chat"
        >
          <MessageCircle size={18} strokeWidth={activeTab === 'chat' ? 2.5 : 2} />
          <span className="text-[10px] font-bold leading-none">Chat</span>
          {unreadChat && unreadChat > 0 && (
            <span className="absolute top-1 right-1 min-w-[14px] h-3.5 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
              {unreadChat > 9 ? '9+' : unreadChat}
            </span>
          )}
        </button>

        {/* Insights — premium/featured button */}
        <button
          type="button"
          onClick={() => onTabChange('insights')}
          className={`flex flex-col items-center justify-center min-h-[44px] min-w-[52px] gap-0.5 rounded-xl px-3 transition-all ${
            activeTab === 'insights'
              ? 'bg-gradient-to-b from-purple-500/25 to-purple-600/20 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
              : 'bg-gradient-to-b from-purple-500/10 to-purple-600/5 text-purple-400 hover:from-purple-500/15 hover:to-purple-600/10 hover:text-purple-300'
          }`}
          aria-label="Insights"
        >
          <BarChart3 size={20} strokeWidth={activeTab === 'insights' ? 2.5 : 2} />
          <span className="text-[10px] font-bold leading-none">Insights</span>
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-slate-200/60 dark:bg-slate-700/50 mx-1" />

        {/* Back/Forward */}
        <button
          type="button"
          onClick={onBackMove}
          className="flex flex-col items-center justify-center min-h-[44px] min-w-[40px] gap-0.5 rounded-xl text-slate-400 hover:text-slate-200 transition-all"
          aria-label="Previous move"
        >
          <ChevronLeft size={18} strokeWidth={2.5} />
          <span className="text-[9px] font-bold leading-none">Back</span>
        </button>
        <button
          type="button"
          onClick={onForwardMove}
          className="flex flex-col items-center justify-center min-h-[44px] min-w-[40px] gap-0.5 rounded-xl text-slate-400 hover:text-slate-200 transition-all"
          aria-label="Next move"
        >
          <ChevronRight size={18} strokeWidth={2.5} />
          <span className="text-[9px] font-bold leading-none">Fwd</span>
        </button>
      </div>
    </nav>
  )
}
