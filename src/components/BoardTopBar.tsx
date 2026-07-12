'use client'

import { Crown } from 'lucide-react'
import { motion } from 'framer-motion'
import { getAvatarUrl, type HumanAvatar } from '@/features/shared/avatars'
import { Team } from '@/features/game-engine/gameState'

export interface BoardTopBarPlayer {
  id: string
  label: string
  type: 'human' | 'bot'
  avatar?: HumanAvatar
  profileImageUrl?: string | null
  isYou?: boolean
  isHost?: boolean
  online?: boolean
  submitted?: boolean
}

interface BoardTopBarProps {
  whitePlayers: BoardTopBarPlayer[]
  blackPlayers: BoardTopBarPlayer[]
  matchTimeRemaining: number
  matchTimerActive: boolean
  totalMatchSeconds: number
  roundLabel?: string
  currentTurn: Team
}

function AvatarTile({ player, team }: { player: BoardTopBarPlayer; team: 'WHITE' | 'BLACK' }) {
  const isWhite = team === 'WHITE'
  const ringClass = isWhite
    ? 'ring-blue-500/70'
    : 'ring-purple-500/70'
  const dotClass = isWhite
    ? 'bg-blue-400'
    : 'bg-purple-400'
  const checkClass = isWhite
    ? 'bg-emerald-500 text-white'
    : 'bg-emerald-500 text-white'

  const useProfileImage = !!player.profileImageUrl
  const imageSrc = useProfileImage
    ? player.profileImageUrl!
    : getAvatarUrl(player.type, player.avatar)

  return (
    <div className="flex flex-col items-center gap-1 min-w-0">
      <div className={`relative w-14 h-14 rounded-2xl overflow-hidden ring-2 ${ringClass} bg-slate-800/40`}>
        <img
          src={imageSrc}
          alt={player.label}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
          onError={(e) => {
            const target = e.currentTarget
            if (target.src !== getAvatarUrl(player.type, player.avatar)) {
              target.src = getAvatarUrl(player.type, player.avatar)
            }
          }}
        />
        {player.submitted && (
          <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${checkClass} flex items-center justify-center ring-2 ring-slate-900`}>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6.5L5 9L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
        {player.online !== false && !player.submitted && (
          <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ${dotClass} ring-2 ring-slate-900`} />
        )}
      </div>
      <span className="text-[11px] font-medium text-slate-300 truncate max-w-[68px]">
        {player.label}
      </span>
    </div>
  )
}

export function BoardTopBar({
  whitePlayers,
  blackPlayers,
  matchTimeRemaining,
  matchTimerActive,
  totalMatchSeconds,
  roundLabel,
  currentTurn,
}: BoardTopBarProps) {
  return (
    <div className="w-full bg-[#0a0e1a] border-b border-white/5 px-3 py-3">
      <div className="flex items-center justify-between gap-2 max-w-3xl mx-auto">
        {/* White team — label above avatars */}
        <div className="flex flex-col items-center gap-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Crown size={14} className="text-slate-200 shrink-0" />
            <span className="text-[11px] font-bold tracking-widest text-slate-200 uppercase">
              White Team
            </span>
          </div>
          <div className="flex items-center gap-2">
            {whitePlayers.slice(0, 2).map((p) => (
              <AvatarTile key={p.id} player={p} team="WHITE" />
            ))}
          </div>
        </div>

        {/* Center: timer card only */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex flex-col items-center justify-center px-3 py-1.5 rounded-xl border border-slate-700/70 bg-slate-900/60 min-w-[88px]">
            <div className="flex items-center gap-1.5 text-slate-300">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <polyline points="12 7 12 12 15 14" />
              </svg>
              <span className="font-mono text-sm font-bold">
                {Math.floor(matchTimeRemaining / 60)}:{(matchTimeRemaining % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>
        </div>

        {/* Black team — label above avatars */}
        <div className="flex flex-col items-center gap-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold tracking-widest text-slate-200 uppercase">
              Black Team
            </span>
            <Crown size={14} className="text-slate-200 shrink-0" />
          </div>
          <div className="flex items-center gap-2">
            {blackPlayers.slice(0, 2).map((p) => (
              <AvatarTile key={p.id} player={p} team="BLACK" />
            ))}
          </div>
        </div>
      </div>
      {currentTurn && (
        <motion.div
          key={currentTurn}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-[10px] mt-1.5 text-slate-400"
        >
          <span className={currentTurn === Team.WHITE ? 'text-blue-400' : 'text-purple-400'}>
            {currentTurn === Team.WHITE ? 'White' : 'Black'} team active
          </span>
        </motion.div>
      )}
    </div>
  )
}
