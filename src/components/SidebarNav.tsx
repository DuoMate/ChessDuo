'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { History, Users, User, Loader2 } from 'lucide-react'

interface SidebarNavProps {
  unreadMessages: number
}

export function SidebarNav({ unreadMessages }: SidebarNavProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null)

  const tabs = [
    { label: 'History', icon: History, path: '/history' },
    { label: 'Friends', icon: Users, path: '/friends' },
    { label: 'Profile', icon: User, path: '/profile' },
  ]

  const handleNavigate = (path: string) => {
    if (pathname === path) return
    if (navigatingTo) return
    setNavigatingTo(path)
    router.push(path)
  }

  useEffect(() => {
    if (navigatingTo && pathname === navigatingTo) {
      setNavigatingTo(null)
    }
  }, [pathname, navigatingTo])

  const isLoading = (path: string) => navigatingTo === path
  const active = (path: string) => pathname === path

  return (
    <nav
      aria-label="Primary navigation"
      className="hidden md:flex fixed left-0 top-0 bottom-0 z-30 w-20 lg:w-22 flex-col items-center justify-center border-r border-slate-200/60 bg-white/85 backdrop-blur-xl dark:border-slate-700/50 dark:bg-[var(--color-page-bg)]/90"
    >
      <div className="flex flex-col items-center gap-1.5 w-full px-2">
        {tabs.map(({ label, icon: Icon, path }) => {
          const badge = label === 'Friends' ? unreadMessages : 0
          const loading = isLoading(path)

          return (
            <button
              key={path}
              onClick={() => handleNavigate(path)}
              disabled={!!navigatingTo}
              aria-current={active(path) ? 'page' : undefined}
              className={`relative w-16 min-h-[56px] flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 transition-all ${
                active(path)
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
              } ${navigatingTo ? 'pointer-events-none' : ''}`}
            >
              <div className="relative">
                {loading ? (
                  <Loader2 size={22} className="animate-spin" strokeWidth={2.5} />
                ) : (
                  <Icon size={22} strokeWidth={active(path) ? 2.5 : 2} />
                )}
                {badge > 0 && !loading && (
                  <span className="absolute -top-1 -right-2 min-w-[16px] h-4 flex items-center justify-center bg-blue-500 text-white text-xs font-bold rounded-full px-1">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] leading-none font-medium">{label}</span>
            </button>
          )
        })}
      </div>

      {navigatingTo && (
        <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-blue-600/20">
          <div className="h-full bg-blue-500 animate-loading-bar" />
        </div>
      )}
    </nav>
  )
}
