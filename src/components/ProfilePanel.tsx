'use client'

import { useState, useEffect } from 'react'
import { ProfileEditor } from './ProfileEditor'
import { getMatchHistory, CompletedGame } from '@/lib/matchHistory'
import { getProfileLink } from '@/lib/friends'

interface ProfilePanelProps {
  playerId: string
  onViewHistory: () => void
}

function RecentMatches({ games }: { games: CompletedGame[] }) {
  if (games.length === 0) return null

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-300">Recent Matches</h3>
      <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
        {games.slice(0, 5).map((game) => {
          const winnerIcon = game.winner === 'DRAW' ? '🤝' : game.winner === 'WHITE' ? '🏆' : '💀'
          const isOnline = game.is_online
          return (
            <div
              key={game.id}
              className="flex items-center justify-between px-3 py-2 bg-white/[0.03] rounded-lg border border-white/5 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span>{winnerIcon}</span>
                <span className="text-gray-300 truncate">{game.game_result}</span>
                {isOnline && <span className="text-[10px] text-yellow-500/70">online</span>}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-gray-500">{game.total_moves} moves</span>
                <span className="text-gray-600">{new Date(game.played_at).toLocaleDateString()}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ProfilePanel({ playerId, onViewHistory }: ProfilePanelProps) {
  const [recentGames, setRecentGames] = useState<CompletedGame[]>([])
  const [profileCopied, setProfileCopied] = useState(false)

  useEffect(() => {
    getMatchHistory(5).then(setRecentGames)
  }, [playerId])

  const copyProfileLink = () => {
    navigator.clipboard.writeText(getProfileLink(playerId))
    setProfileCopied(true)
    setTimeout(() => setProfileCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <ProfileEditor playerId={playerId} />
      </div>

      <button
        onClick={copyProfileLink}
        className="w-full min-h-[44px] p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400 text-sm font-medium hover:bg-yellow-500/20 transition-colors flex items-center justify-center gap-2"
      >
        📋 {profileCopied ? 'Link copied!' : 'Share Profile'}
      </button>

      {recentGames.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <RecentMatches games={recentGames} />
        </div>
      )}

      <button
        onClick={onViewHistory}
        className="w-full min-h-[44px] p-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:text-yellow-400 hover:border-gray-600 text-sm transition-colors flex items-center justify-center gap-2"
      >
        📋 View All Match History →
      </button>
    </div>
  )
}
