'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Crown, History, LogOut, Share2, Sparkles, ShieldCheck } from 'lucide-react'
import { ProfileEditor } from './ProfileEditor'
import { getMatchHistory, CompletedGame } from '@/lib/matchHistory'
import { getProfileLink } from '@/lib/friends'
import { supabase } from '@/lib/supabase'

interface ProfilePanelProps {
  playerId: string
  onViewHistory: () => void
  onSignOut?: () => void
}

function RecentMatches({ games }: { games: CompletedGame[] }) {
  if (games.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <History size={14} className="text-amber-600 dark:text-amber-400" />
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Recent Matches</h3>
      </div>
      <div className="max-h-[180px] space-y-2 overflow-y-auto">
        {games.slice(0, 5).map((game) => {
          const winnerIcon = game.winner === 'DRAW' ? '🤝' : game.winner === 'WHITE' ? '🏆' : '💀'
          const isOnline = game.is_online
          return (
            <div
              key={game.id}
              className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white/70 px-3 py-2 text-xs shadow-sm dark:border-slate-700/70 dark:bg-slate-800/70"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span>{winnerIcon}</span>
                <span className="truncate text-slate-700 dark:text-slate-200">{game.game_result}</span>
                {isOnline && <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">online</span>}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-slate-500 dark:text-slate-400">{game.total_moves} moves</span>
                <span className="text-slate-500 dark:text-slate-400">{new Date(game.played_at).toLocaleDateString()}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ProfilePanel({ playerId, onViewHistory, onSignOut }: ProfilePanelProps) {
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [recentGames, setRecentGames] = useState<CompletedGame[]>([])
  const [profileCopied, setProfileCopied] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const [checkingPremium, setCheckingPremium] = useState(true)

  useEffect(() => {
    getMatchHistory(5, playerId).then(setRecentGames).catch(() => setRecentGames([]))
  }, [playerId])

  useEffect(() => {
    supabase
      .from('profiles')
      .select('is_premium')
      .eq('id', playerId)
      .maybeSingle()
      .then((result) => {
        if (result.data?.is_premium) setIsPremium(true)
        setCheckingPremium(false)
      }).catch(() => {
        setCheckingPremium(false)
      })
  }, [playerId])

  useEffect(() => {
    return () => clearTimeout(timerRef.current)
  }, [])

  const copyProfileLink = () => {
    navigator.clipboard.writeText(getProfileLink(playerId))
    setProfileCopied(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setProfileCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-slate-200/70 bg-white/80 p-4 shadow-sm backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/80">
        <ProfileEditor playerId={playerId} />
      </div>

      <button
        onClick={copyProfileLink}
        className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-300"
      >
        <Share2 size={15} /> {profileCopied ? 'Link copied!' : 'Share Profile'}
      </button>

      {!checkingPremium && !isPremium && (
        <button
          onClick={() => router.push('/premium')}
          className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 to-indigo-500/15 p-3 text-sm font-semibold text-amber-700 transition-all hover:-translate-y-0.5 hover:from-amber-500/25 hover:to-indigo-500/25 dark:text-amber-300"
        >
          <Crown size={15} /> Upgrade to Premium
        </button>
      )}

      {recentGames.length > 0 && (
        <div className="rounded-[24px] border border-slate-200/70 bg-white/80 p-4 shadow-sm backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/80">
          <RecentMatches games={recentGames} />
        </div>
      )}

      <button
        onClick={onViewHistory}
        className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 text-sm text-slate-700 transition-colors hover:border-amber-500/30 hover:text-amber-700 dark:border-slate-700/70 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:text-amber-400"
      >
        <History size={15} /> View All Match History
      </button>

      <div className="border-t border-slate-200/70 pt-2 dark:border-slate-700/70">
        <Link
          href="/delete-account"
          className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 text-sm text-slate-600 transition-colors hover:border-rose-400/40 hover:text-rose-600 dark:border-slate-700/70 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:text-rose-400"
        >
          <ShieldCheck size={15} /> Manage Account
        </Link>
      </div>

      {onSignOut && (
        <button
          onClick={onSignOut}
          className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-600 transition-colors hover:bg-rose-500/20 dark:text-rose-400"
        >
          <LogOut size={15} /> Sign Out
        </button>
      )}
    </div>
  )
}
