'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Crown, History, LogOut, Moon, Share2, ShieldCheck, Sun, User, Pencil } from 'lucide-react'
import { ProfileEditor } from './ProfileEditor'
import { getMatchHistory, CompletedGame } from '@/lib/matchHistory'
import { getProfileLink } from '@/lib/friends'
import { supabase } from '@/lib/supabase'
import { InitialsAvatar } from './InitialsAvatar'
import { SubscriptionService } from '@/features/billing'
import { useSettings } from '@/lib/settings'

interface ProfilePanelProps {
  playerId: string
  onViewHistory: () => void
  onSignOut?: () => void
  onClose?: () => void
}

export function ProfilePanel({ playerId, onViewHistory, onSignOut, onClose }: ProfilePanelProps) {
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [recentGames, setRecentGames] = useState<CompletedGame[]>([])
  const [profileCopied, setProfileCopied] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const [checkingPremium, setCheckingPremium] = useState(true)
  const [username, setUsername] = useState('')
  const [editingProfile, setEditingProfile] = useState(false)
  const { theme, setTheme } = useSettings()

  useEffect(() => {
    getMatchHistory(5, playerId).then(setRecentGames).catch(() => setRecentGames([]))
  }, [playerId])

  useEffect(() => {
    Promise.all([
      SubscriptionService.isPremium(),
      supabase
        .from('profiles')
        .select('username')
        .eq('id', playerId)
        .maybeSingle(),
    ]).then(([premium, profileResult]) => {
      setIsPremium(premium)
      if (profileResult.data?.username) setUsername(profileResult.data.username)
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
    <div className="flex flex-col h-full bg-[#0a0e1a] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <User size={18} className="text-white" />
          </div>
          <h2 className="text-lg font-bold text-white">Profile</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun size={20} className="text-amber-400" />
            ) : (
              <Moon size={20} className="text-sky-400" />
            )}
          </button>
          {onClose && (
            <button onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
              <span className="text-slate-400 text-lg">&times;</span>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Profile Card — compact row matching menu items */}
        {editingProfile ? (
          <div className="p-4 bg-slate-800/50 border border-white/5 rounded-2xl">
            <ProfileEditor playerId={playerId} />
            <button
              onClick={() => setEditingProfile(false)}
              className="mt-3 w-full min-h-[44px] text-sm text-slate-400 hover:text-white transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditingProfile(true)}
            className="w-full p-4 bg-slate-800/50 border border-white/5 rounded-2xl flex items-center gap-3 hover:bg-slate-800/70 transition-colors"
          >
            <InitialsAvatar username={username || 'U'} size="sm" premium={isPremium} />
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-semibold text-white truncate">{username || 'Player'}</p>
              <p className="text-xs text-slate-400">Tap to edit profile</p>
            </div>
            <Pencil size={16} className="text-slate-500 flex-shrink-0" />
          </button>
        )}

        {/* Menu Items */}
        <button
          onClick={copyProfileLink}
          className="w-full p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3 hover:bg-amber-500/15 transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Share2 size={20} className="text-amber-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-amber-400">{profileCopied ? 'Link copied!' : 'Share Profile'}</p>
            <p className="text-xs text-slate-400">Share your profile with friends</p>
          </div>
          <span className="text-slate-500">&rsaquo;</span>
        </button>

        {!checkingPremium && !isPremium && (
          <button
            onClick={() => router.push('/premium')}
            className="w-full p-4 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-2xl flex items-center gap-3 hover:from-purple-500/15 hover:to-indigo-500/15 transition-all"
          >
            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <Crown size={20} className="text-purple-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-purple-400">Upgrade to Premium</p>
              <p className="text-xs text-slate-400">Unlock powerful features</p>
            </div>
            <span className="text-slate-500">&rsaquo;</span>
          </button>
        )}

        <button
          onClick={onViewHistory}
          className="w-full p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl flex items-center gap-3 hover:bg-blue-500/10 transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <History size={20} className="text-blue-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-blue-400">View All Match History</p>
            <p className="text-xs text-slate-400">Check your past games</p>
          </div>
          <span className="text-slate-500">&rsaquo;</span>
        </button>

        <Link
          href="/delete-account"
          className="w-full p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl flex items-center gap-3 hover:bg-blue-500/10 transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <ShieldCheck size={20} className="text-blue-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-blue-400">Manage Account</p>
            <p className="text-xs text-slate-400">Security, privacy &amp; preferences</p>
          </div>
          <span className="text-slate-500">&rsaquo;</span>
        </Link>

        {onSignOut && (
          <button
            onClick={onSignOut}
            className="w-full p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 hover:bg-rose-500/15 transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-rose-500/20 flex items-center justify-center flex-shrink-0">
              <LogOut size={20} className="text-rose-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-rose-400">Sign Out</p>
              <p className="text-xs text-slate-400">Log out from your account</p>
            </div>
            <span className="text-slate-500">&rsaquo;</span>
          </button>
        )}
      </div>
    </div>
  )
}
