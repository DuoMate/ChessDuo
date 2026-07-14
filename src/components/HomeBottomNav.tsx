'use client'

import { useRouter } from 'next/navigation'
import { History, Users, User, Home as HomeIcon } from 'lucide-react'

interface HomeBottomNavProps {
  onProfile: () => void
  onHistory: () => void
  onFriends: () => void
  unreadMessages: number
}

export function HomeBottomNav({ onProfile, onHistory, onFriends, unreadMessages }: HomeBottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex justify-center" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}>
      <div className="flex items-center justify-around h-14 px-3 w-[90%] max-w-xs rounded-2xl border border-slate-200/60 bg-white/90 shadow-[0_8px_32px_rgba(2,6,23,0.12)] backdrop-blur-2xl dark:border-slate-700/50 dark:bg-[#0a0e1a]/90 dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <NavButton label="Home" icon={HomeIcon} active onClick={() => {}} />
        <NavButton label="History" icon={History} onClick={onHistory} />
        <NavButton label="Friends" icon={Users} onClick={onFriends} badge={unreadMessages} />
        <NavButton label="Profile" icon={User} onClick={onProfile} />
      </div>
    </nav>
  )
}

function NavButton({
  label,
  icon: Icon,
  active = false,
  onClick,
  badge = 0,
}: {
  label: string
  icon: typeof HomeIcon
  active?: boolean
  onClick: () => void
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 transition-all min-h-[44px] min-w-[44px] ${
        active
          ? 'text-blue-600 dark:text-blue-400'
          : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
      }`}
    >
      <div className="relative">
        <Icon size={22} strokeWidth={active ? 2.5 : 2} />
        {badge > 0 && (
          <span className="absolute -top-1 -right-2 min-w-[16px] h-4 flex items-center justify-center bg-blue-500 text-white text-[10px] font-bold rounded-full px-1">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      <span className="text-[11px] leading-none">{label}</span>
    </button>
  )
}
