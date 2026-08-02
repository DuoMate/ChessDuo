'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { History, Users, User, Home as HomeIcon, Loader2 } from 'lucide-react'
import ChessDuoLogo from './ChessDuoLogo'

interface DesktopSidebarProps {
  unreadMessages: number
}

export function DesktopSidebar({ unreadMessages }: DesktopSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null)
  const navigatingSinceRef = useRef<number>(0)

  const tabs = [
    { label: 'Home', icon: HomeIcon, path: '/' },
    { label: 'History', icon: History, path: '/history' },
    { label: 'Friends', icon: Users, path: '/friends' },
    { label: 'Profile', icon: User, path: '/profile' },
  ]

  const handleNavigate = (path: string) => {
    if (pathname === path) return
    if (navigatingTo) return
    navigatingSinceRef.current = Date.now()
    setNavigatingTo(path)
    router.push(path)
  }

  useEffect(() => {
    if (navigatingTo && pathname === navigatingTo) {
      const elapsed = Date.now() - navigatingSinceRef.current
      const remaining = Math.max(0, 400 - elapsed)
      if (remaining === 0) {
        setNavigatingTo(null)
      } else {
        const timer = setTimeout(() => setNavigatingTo(null), remaining)
        return () => clearTimeout(timer)
      }
    }
  }, [pathname, navigatingTo])

  const isLoading = (path: string) => navigatingTo === path
  const active = (path: string) => pathname === path

  return (
    <nav
      aria-label="Primary navigation"
      className="hidden md:flex fixed left-0 top-0 bottom-0 z-30 w-[220px] lg:w-[240px] flex-col border-r border-slate-200/60 bg-white/85 backdrop-blur-xl dark:border-slate-700/50 dark:bg-[var(--color-page-bg)]/90"
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <ChessDuoLogo size="md" />
      </div>

      {/* Navigation Items */}
      <div className="flex-1 flex flex-col gap-1 px-3">
        {tabs.map(({ label, icon: Icon, path }) => {
          const badge = label === 'Friends' ? unreadMessages : 0
          const loading = isLoading(path)

          return (
            <button
              key={path}
              onClick={() => handleNavigate(path)}
              disabled={!!navigatingTo}
              aria-current={active(path) ? 'page' : undefined}
              className={`relative w-full min-h-[48px] flex items-center gap-3 rounded-xl px-4 py-3 transition-all ${
                active(path)
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
              } ${navigatingTo ? 'pointer-events-none' : ''}`}
            >
              <div className="relative">
                {loading ? (
                  <Loader2 size={20} className="animate-spin" strokeWidth={2.5} />
                ) : (
                  <Icon size={20} strokeWidth={active(path) ? 2.5 : 2} />
                )}
                {badge > 0 && !loading && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 flex items-center justify-center bg-blue-500 text-white text-xs font-bold rounded-full px-1">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>
              <span className="text-sm">{label}</span>
            </button>
          )
        })}
      </div>

      {/* Tagline */}
      <div className="px-5 pb-6">
        <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
          <span className="text-blue-500 dark:text-blue-400">Play.</span>
          <span className="text-purple-500 dark:text-purple-400">Team up.</span>
          <span className="text-amber-500 dark:text-amber-400">Outsmart.</span>
        </div>
      </div>

      {/* Loading Bar */}
      {navigatingTo && (
        <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-blue-600/20">
          <div className="h-full bg-blue-500 animate-loading-bar" />
        </div>
      )}
    </nav>
  )
}
