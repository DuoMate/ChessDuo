'use client'

import { Crown } from 'lucide-react'
import { motion } from 'framer-motion'
import { MatchTimer } from './MatchTimer'
import { TeamHexagon } from './TeamHexagon'
import { getAvatarUrl, type HumanAvatar } from '@/features/shared/avatars'
import { Team } from '@/features/game-engine/gameState'

export interface BoardTopBarPlayer {
  id: string
  label: string
  type: 'human' | 'bot'
  avatar?: HumanAvatar
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

  return (
    <div className="flex flex-col items-center gap-1 min-w-0">
      <div className={`relative w-11 h-11 rounded-xl overflow-hidden ring-2 ${ringClass} bg-slate-800/40`}>
        <img
          src={getAvatarUrl(player.type, player.avatar)}
          alt={player.label}
          className="w-full h-full object-contain"
          loading="lazy"
          decoding="async"
        />
        {player.online !== false && (
          <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ${dotClass} ring-2 ring-slate-900`} />
        )}
      </div>
      <span className="text-[10px] font-semibold text-slate-200 truncate max-w-[60px]">
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
    <div className="w-full bg-slate-900/70 backdrop-blur-xl border-b border-white/5 px-3 py-2">
      <div className="flex items-center justify-between gap-2 max-w-3xl mx-auto">
        {/* White team */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Crown size={14} className="text-amber-400 shrink-0" />
          <span className="text-[10px] font-bold tracking-widest text-slate-300 uppercase shrink-0">
            White
          </span>
          <div className="flex items-center gap-2 min-w-0">
            {whitePlayers.slice(0, 2).map((p) => (
              <AvatarTile key={p.id} player={p} team="WHITE" />
            ))}
          </div>
        </div>

        {/* Center: decorative hexagons + timer */}
        <div className="flex items-center gap-1.5 shrink-0">
          <TeamHexagon value={1} team="WHITE" size={28} />
          <div className="flex flex-col items-center px-1">
            <MatchTimer
              seconds={matchTimeRemaining}
              isActive={matchTimerActive}
              totalSeconds={totalMatchSeconds}
            />
            {roundLabel && (
              <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mt-0.5">
                {roundLabel}
              </span>
            )}
          </div>
          <TeamHexagon value={2} team="BLACK" size={28} />
        </div>

        {/* Black team */}
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
          <div className="flex items-center gap-2 min-w-0 justify-end">
            {blackPlayers.slice(0, 2).map((p) => (
              <AvatarTile key={p.id} player={p} team="BLACK" />
            ))}
          </div>
          <span className="text-[10px] font-bold tracking-widest text-slate-300 uppercase shrink-0">
            Black
          </span>
          <Crown size={14} className="text-slate-500 shrink-0" />
        </div>
      </div>
      {currentTurn && (
        <motion.div
          key={currentTurn}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-[10px] mt-1 text-slate-400"
        >
          <span className={currentTurn === Team.WHITE ? 'text-blue-400' : 'text-purple-400'}>
            {currentTurn === Team.WHITE ? 'White' : 'Black'} team active
          </span>
        </motion.div>
      )}
    </div>
  )
}
