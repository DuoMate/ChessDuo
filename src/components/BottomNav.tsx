'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { History, Home, UserRound, Volume2, VolumeX } from 'lucide-react'

interface BottomNavProps {
  activeOverlay: 'none' | 'profile' | 'history'
  onProfileClick: () => void
  onHistoryClick: () => void
  onSoundToggle: () => void
  soundEnabled: boolean
}

export function BottomNav({
  activeOverlay,
  onProfileClick,
  onHistoryClick,
  onSoundToggle,
  soundEnabled,
}: BottomNavProps) {
  const router = useRouter()

  return (
    <motion.nav
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200/80 bg-white/85 backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/85 safe-area-bottom"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-14 px-2">
        <NavButton
          label="Profile"
          icon={UserRound}
          active={activeOverlay === 'profile'}
          onClick={onProfileClick}
        />
        <NavButton
          label="History"
          icon={History}
          active={activeOverlay === 'history'}
          onClick={onHistoryClick}
        />
        <NavButton
          label={soundEnabled ? 'Mute' : 'Sound'}
          icon={soundEnabled ? Volume2 : VolumeX}
          active={false}
          onClick={onSoundToggle}
        />
        <NavButton
          label="Home"
          icon={Home}
          active={false}
          onClick={() => router.push('/')}
        />
      </div>
    </motion.nav>
  )
}

function NavButton({
  label,
  icon: Icon,
  active,
  onClick,
  disabled = false,
}: {
  label: string
  icon: typeof Home
  active: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 rounded-2xl px-3 py-1.5 transition-all ${
        disabled
          ? 'cursor-not-allowed text-slate-400'
          : active
            ? 'bg-amber-500/10 text-amber-600 shadow-sm dark:text-amber-400'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
      }`}
    >
      <Icon size={18} strokeWidth={2} />
      <span className="text-[11px] leading-none">{label}</span>
    </motion.button>
  )
}
