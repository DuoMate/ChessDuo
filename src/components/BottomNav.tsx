'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

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
      className="fixed bottom-0 left-0 right-0 z-30 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 safe-area-bottom"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-14 px-2">
        <NavButton
          label="Profile"
          icon="👤"
          active={activeOverlay === 'profile'}
          onClick={onProfileClick}
        />
        <NavButton
          label="History"
          icon="📋"
          active={activeOverlay === 'history'}
          onClick={onHistoryClick}
        />
        <NavButton
          label={soundEnabled ? 'Mute' : 'Sound'}
          icon={soundEnabled ? '🔊' : '🔇'}
          active={false}
          onClick={onSoundToggle}
        />
        <NavButton
          label="Home"
          icon="🏠"
          active={false}
          onClick={() => router.push('/')}
        />
      </div>
    </motion.nav>
  )
}

function NavButton({
  label,
  icon,
  active,
  onClick,
  disabled = false,
}: {
  label: string
  icon: string
  active: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] rounded-lg transition-colors ${
        disabled
          ? 'text-gray-600 cursor-not-allowed'
          : active
            ? 'text-yellow-400 bg-yellow-400/10'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      <span className="text-lg leading-none">{icon}</span>
      <span className="text-[10px] leading-none">{label}</span>
    </button>
  )
}
