'use client'

import { Crown, Activity } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getAvatarUrl, type HumanAvatar } from '@/features/shared/avatars'
import { Team } from '@/features/game-engine/gameState'
import { InitialsAvatar } from './InitialsAvatar'

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

  if (player.type === 'bot') {
    const imageSrc = getAvatarUrl(player.type, player.avatar)
    return (
      <div className="flex flex-col items-center gap-0.5 min-w-0">
        <div className={`relative w-10 h-10 rounded-xl overflow-hidden ring-2 ${ringClass} bg-slate-800/40`}>
          <img
            src={imageSrc}
            alt={player.label}
            className="w-full h-full object-contain p-0.5"
            loading="lazy"
            decoding="async"
          />
          {player.submitted && (
            <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full ${checkClass} flex items-center justify-center ring-2 ring-slate-900`}>
              <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6.5L5 9L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          )}
          {player.online !== false && !player.submitted && (
            <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ${dotClass} ring-2 ring-slate-900`} />
          )}
        </div>
        <span className="text-xs font-medium text-slate-300 truncate max-w-[60px]">
          {player.label}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-0.5 min-w-0">
      <div className="relative">
        <InitialsAvatar
          username={player.label}
          size="md"
          online={player.online}
          ringClass={ringClass}
        />
        {player.submitted && (
          <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full ${checkClass} flex items-center justify-center ring-2 ring-slate-900`}>
            <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6.5L5 9L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </div>
      <span className="text-xs font-medium text-slate-300 truncate max-w-[60px]">
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
    <>
      <div className="flex items-center justify-between gap-1 max-w-3xl mx-auto">
        {/* White team */}
        <div className="flex flex-col items-center gap-0.5 min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <Crown size={11} className="text-slate-200 shrink-0" />
            <span className="text-xs font-bold tracking-widest text-slate-200 uppercase">
              White
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {whitePlayers.slice(0, 2).map((p) => (
              <AvatarTile key={p.id} player={p} team="WHITE" />
            ))}
          </div>
        </div>

        {/* Center: timer */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex flex-col items-center justify-center px-2 py-1 rounded-xl border border-slate-700/70 bg-slate-900/60 min-w-[72px]">
            <div className="flex items-center gap-1 text-slate-300">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <polyline points="12 7 12 12 15 14" />
              </svg>
              <span className="font-mono text-sm font-bold">
                {Math.floor(matchTimeRemaining / 60)}:{(matchTimeRemaining % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>
        </div>

        {/* Black team */}
        <div className="flex flex-col items-center gap-0.5 min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold tracking-widest text-slate-200 uppercase">
              Black
            </span>
            <Crown size={11} className="text-slate-200 shrink-0" />
          </div>
          <div className="flex items-center gap-1.5">
            {blackPlayers.slice(0, 2).map((p) => (
              <AvatarTile key={p.id} player={p} team="BLACK" />
            ))}
          </div>
        </div>
      </div>
      <AnimatePresence mode="wait">
        {currentTurn && (
          <motion.div
            key={currentTurn}
            initial={{ opacity: 0, scale: 0.9, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -6 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="flex items-center justify-center mt-1"
          >
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${currentTurn === Team.WHITE ? 'border-blue-500/30 bg-blue-500/15' : 'border-purple-500/30 bg-purple-500/15'}`}>
              <span className={`text-sm leading-none ${currentTurn === Team.WHITE ? 'text-blue-300' : 'text-purple-300'}`}>
                {currentTurn === Team.WHITE ? '♔' : '♚'}
              </span>
              <span className={`text-xs font-bold uppercase tracking-wider ${currentTurn === Team.WHITE ? 'text-blue-300' : 'text-purple-300'}`}>
                {currentTurn === Team.WHITE ? 'White' : 'Black'} to move
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
