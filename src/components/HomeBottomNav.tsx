'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { History, Users, User, Home as HomeIcon, Loader2 } from 'lucide-react'

interface HomeBottomNavProps {
  unreadMessages: number
}

export function HomeBottomNav({ unreadMessages }: HomeBottomNavProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null)

  const tabs = [
    { label: 'Home', icon: HomeIcon, path: '/' },
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

  // Clear loading state once navigation completes
  useEffect(() => {
    if (navigatingTo && pathname === navigatingTo) {
      setNavigatingTo(null)
    }
  }, [pathname, navigatingTo])

  const isLoading = (path: string) => navigatingTo === path
  const active = (path: string) => pathname === path

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex justify-center" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}>
        <div className="flex items-center h-14 w-[90%] max-w-xs px-2 rounded-2xl border border-slate-200/60 bg-white/90 shadow-[0_8px_32px_rgba(2,6,23,0.12)] backdrop-blur-2xl dark:border-slate-700/50 dark:bg-[var(--color-page-bg)]/90 dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          {tabs.map(({ label, icon: Icon, path }) => {
            const badge = label === 'Friends' ? unreadMessages : 0
            const loading = isLoading(path)

            return (
              <button
                key={path}
                onClick={() => handleNavigate(path)}
                disabled={!!navigatingTo}
                className={`relative flex-1 flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 transition-all min-h-[44px] min-w-[44px] ${
                  active(path)
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
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
                <span className="text-[11px] leading-none">{label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Navigation progress bar */}
      {navigatingTo && (
        <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-blue-600/20">
          <div className="h-full bg-blue-500 animate-loading-bar" />
        </div>
      )}
    </>
  )
}
