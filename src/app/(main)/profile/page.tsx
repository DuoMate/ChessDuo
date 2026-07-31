'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { RoomService } from '@/lib/roomService'
import { fetchProfile } from '@/lib/profileService'
import { RealtimeService } from '@/lib/realtimeService'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ProfileEditor } from '@/components/ProfileEditor'
import { BackButton } from '@/components/BackButton'
import { InitialsAvatar } from '@/components/InitialsAvatar'
import { Spinner } from '@/components/Spinner'
import { SubscriptionService } from '@/features/billing'
import { useSettings } from '@/lib/settings'
import { getProfileLink } from '@/lib/friends'
import { shareLink } from '@/lib/share'
import { motion } from 'framer-motion'
import { Crown, History, LogOut, Moon, Share2, ShieldCheck, Sun, Pencil, Lock } from 'lucide-react'
import type { SubscriptionInfo } from '@/features/billing'
import { AuthGate } from '@/components/AuthGate'
import { useCapacitorBackButton } from '@/hooks/useCapacitorBackButton'

export default function ProfilePage() {
  const router = useRouter()
  useCapacitorBackButton(() => { router.push('/'); return true }, true)

  return (
    <AuthGate variant="page" pageTitle="Profile" pageEmoji="👤" subtitle="Sign in to view your profile" onBack={() => router.push('/')}>
      {(playerId) => <ProfileContent playerId={playerId} />}
    </AuthGate>
  )
}

function ProfileContent({ playerId }: { playerId: string }) {
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileCopied, setProfileCopied] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const [checkingPremium, setCheckingPremium] = useState(true)
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionInfo | null>(null)
  const { theme, setTheme } = useSettings()
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    Promise.all([
      SubscriptionService.getStatus(),
      fetchProfile(playerId),
    ]).then(([statusResult, profileResult]) => {
      if (!mountedRef.current) return
      setIsPremium(statusResult.isPremium)
      setSubscriptionStatus(statusResult)
      if (profileResult?.username) setUsername(profileResult.username)
      if (profileResult?.avatar_url) setAvatarUrl(profileResult.avatar_url)
      setCheckingPremium(false)
    }).catch(() => {
      if (mountedRef.current) setCheckingPremium(false)
    })

    const channel = RealtimeService.subscribeToTable('profiles', 'UPDATE', `id=eq.${playerId}`, async () => {
      const [statusResult, profileResult] = await Promise.all([
        SubscriptionService.getStatus(),
        fetchProfile(playerId),
      ])
      if (mountedRef.current) {
        setIsPremium(statusResult.isPremium)
        setSubscriptionStatus(statusResult)
        if (profileResult?.username) setUsername(profileResult.username)
        if (profileResult?.avatar_url) setAvatarUrl(profileResult.avatar_url)
      }
    })

    return () => { RealtimeService.cleanupChannel(channel) }
  }, [playerId])

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  const copyProfileLink = async () => {
    const url = getProfileLink(playerId)
    const result = await shareLink({
      title: 'ChessDuo Invite',
      text: 'Play ChessDuo with me!',
      url,
    })
    if (result === 'copied') {
      setProfileCopied(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setProfileCopied(false), 2000)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    try { localStorage.removeItem('chessduo_history') } catch { /* quota exceeded */ }
    try { localStorage.removeItem('chessduo_settings') } catch { /* quota exceeded */ }
    router.replace('/')
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[var(--color-page-bg)] text-white p-4 pb-20">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Profile</h1>
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
              <BackButton alwaysFallback />
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {/* Profile Card */}
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
                <InitialsAvatar username={username || 'U'} size="sm" src={avatarUrl} premium={isPremium} />
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{username || 'Player'}</p>
                  <p className="text-xs text-slate-400">Tap to edit profile</p>
                </div>
                <Pencil size={16} className="text-slate-500 flex-shrink-0" />
              </button>
            )}

            {/* Share Profile */}
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

            {/* Upgrade to Premium */}
            {checkingPremium ? (
              <div className="w-full p-4 bg-slate-800/30 border border-white/5 rounded-2xl flex justify-center">
                <Spinner size="sm" />
              </div>
            ) : !isPremium ? (
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
            ) : (
              <div className="w-full p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Crown size={20} className="text-amber-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-amber-400">Premium Active</p>
                  <p className="text-xs text-slate-400">
                    {subscriptionStatus?.subscriptionPlan === 'yearly' ? 'Annual plan' : 'Monthly plan'}
                    {subscriptionStatus?.subscriptionExpiryDate && (
                      <> · Renews {new Date(subscriptionStatus.subscriptionExpiryDate).toLocaleDateString()}</>
                    )}
                  </p>
                </div>
                {subscriptionStatus?.subscriptionProvider === 'CREEM' && (
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Lock size={10} />
                    Creem
                  </div>
                )}
              </div>
            )}

            {/* View All Match History */}
            <button
              onClick={() => router.push('/history')}
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

            {/* Settings */}
            <button
              onClick={() => router.push('/settings')}
              className="w-full p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl flex items-center gap-3 hover:bg-blue-500/10 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={20} className="text-blue-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-blue-400">Settings</p>
                <p className="text-xs text-slate-400">Sound, theme &amp; preferences</p>
              </div>
              <span className="text-slate-500">&rsaquo;</span>
            </button>

            {/* Manage Account */}
            <button
              onClick={() => router.push('/delete-account')}
              className="w-full p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl flex items-center gap-3 hover:bg-blue-500/10 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={20} className="text-blue-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-blue-400">Manage Account</p>
                <p className="text-xs text-slate-400">Security, privacy &amp; delete</p>
              </div>
              <span className="text-slate-500">&rsaquo;</span>
            </button>

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
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
          </motion.div>
        </div>
      </div>
    </ErrorBoundary>
  )
}