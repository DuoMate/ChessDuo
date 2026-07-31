'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Timeline } from 'animejs'
import { Copy, Share2, CheckCircle2, User, Loader2 } from 'lucide-react'
import ChessDuoLogo from '@/components/ChessDuoLogo'
import { useIsMobile } from '@/hooks/useIsMobile'
import { Spinner } from '@/components/Spinner'
import { shareLink } from '@/lib/share'

interface GameLobbyProps {
  roomCode?: string
  inviteUrl?: string
  isLoading: boolean
  username?: string
}

export function GameLobby({ roomCode, inviteUrl, isLoading, username }: GameLobbyProps) {
  const iconRef = useRef<HTMLDivElement>(null)
  const dot1Ref = useRef<HTMLDivElement>(null)
  const dot2Ref = useRef<HTMLDivElement>(null)
  const dot3Ref = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<Timeline | null>(null)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const linkCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const isMobile = useIsMobile()

  const crownSize = isMobile ? 64 : 80

  useEffect(() => {
    const tl = new Timeline({ loop: true, autoplay: true })
    timelineRef.current = tl

    tl.add(iconRef.current!, { scale: [1, 1.08, 1], duration: 2000, easing: 'spring(1, 80, 10, 0)' }, 0)
    tl.add(dot1Ref.current!, { translateY: [0, -8, 0], opacity: [0.5, 1, 0.5], duration: 600 }, 0)
    tl.add(dot2Ref.current!, { translateY: [0, -8, 0], opacity: [0.5, 1, 0.5], duration: 600 }, 150)
    tl.add(dot3Ref.current!, { translateY: [0, -8, 0], opacity: [0.5, 1, 0.5], duration: 600 }, 300)

    return () => {
      tl.pause()
      tl.seek(0)
    }
  }, [])

  useEffect(() => {
    return () => {
      clearTimeout(copiedTimerRef.current)
      clearTimeout(linkCopiedTimerRef.current)
    }
  }, [])

  const handleCopyCode = () => {
    if (!roomCode) return
    navigator.clipboard.writeText(roomCode)
    setCopied(true)
    clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyLink = () => {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl)
    setLinkCopied(true)
    clearTimeout(linkCopiedTimerRef.current)
    linkCopiedTimerRef.current = setTimeout(() => setLinkCopied(false), 2000)
  }

  const handleShare = async () => {
    if (!inviteUrl || !roomCode) return
    const result = await shareLink({
      title: 'ChessDuo \u2014 Join my game!',
      text: `Join my ChessDuo game! Room code: ${roomCode}`,
      url: inviteUrl,
      nativeUrl: `chessduo://?code=${roomCode}`,
    })
    if (result === 'copied') {
      setLinkCopied(true)
      clearTimeout(linkCopiedTimerRef.current)
      linkCopiedTimerRef.current = setTimeout(() => setLinkCopied(false), 2000)
    }
  }

  const phase = isLoading ? 'joining' : 'waiting'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-page-bg)] p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-md overflow-hidden rounded-[24px] border border-white/[0.06] bg-[var(--color-surface-alt)] p-6 shadow-[0_20px_80px_rgba(2,6,23,0.5)] sm:p-8"
      >
        <div className="flex flex-col items-center">

          {/* Crown with glow */}
          <div className="mb-5">
            <motion.div
              ref={iconRef}
              className="relative inline-block"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ChessDuoLogo showText={false} size={crownSize >= 80 ? 'xl' : 'lg'} />
            </motion.div>
            <div className="mx-auto mt-1 w-16 h-[3px] rounded-full bg-blue-500/80 shadow-[0_0_14px_rgba(59,130,246,0.5)]" />
          </div>

          {/* Title */}
          <h1 className="mb-2 text-center text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            READY <span className="text-amber-400">TO PLAY?</span>
          </h1>
          <p className="mb-5 text-center text-sm text-slate-400">
            Invite your teammate and start your match
          </p>

          {/* Joining phase */}
          {phase === 'joining' && (
            <>
              <div className="mb-3 flex items-center gap-3">
                <motion.div ref={dot1Ref} className="h-3 w-3 rounded-full bg-amber-500" />
                <motion.div ref={dot2Ref} className="h-3 w-3 rounded-full bg-amber-500" />
                <motion.div ref={dot3Ref} className="h-3 w-3 rounded-full bg-amber-500" />
              </div>
              <p className="mb-4 text-base text-slate-400">Connecting to room...</p>
            </>
          )}

          {/* Waiting phase */}
          {phase === 'waiting' && (
            <>
              {/* Connected badge */}
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1">
                <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                <span className="text-sm font-medium text-emerald-400">Connected</span>
              </div>

              {/* Player status row */}
              <div className="mb-5 flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
                    <User size={12} className="text-amber-400" />
                  </div>
                  <span className="text-sm font-medium text-white">{username || 'You'}</span>
                </div>
                <span className="text-sm text-slate-500">{'\u2192'}</span>
                <div className="flex items-center gap-1.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-600/40 bg-slate-700/30">
                    <Spinner size="sm" />
                  </div>
                  <span className="text-sm text-slate-500">Waiting for your teammate</span>
                </div>
              </div>
            </>
          )}

          {/* Dotted separator */}
          {roomCode && (
            <div className="mb-5 w-full border-t border-dashed border-slate-700/60" />
          )}

          {/* Room code */}
          {roomCode && (
            <>
              <p className="mb-3 w-full text-center text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                Send this code to your friend to join
              </p>

              <div className="mb-4 w-full overflow-hidden rounded-2xl border border-amber-500/30 bg-[#151c2e] p-4">
                <div className="flex items-center justify-between min-h-[44px]">
                  <p className="select-all font-mono text-2xl font-extrabold tracking-[0.2em] text-amber-400 sm:text-3xl">
                    {roomCode}
                  </p>
                  <button
                    onClick={handleCopyCode}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-xl border border-slate-700/60 bg-slate-800/60 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-amber-500/30 hover:bg-slate-700/60 hover:text-amber-400"
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 size={14} className="text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* OR divider */}
          {inviteUrl && roomCode && (
            <div className="mb-4 flex w-full items-center gap-3">
              <div className="h-px flex-1 bg-slate-700/50" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Or</span>
              <div className="h-px flex-1 bg-slate-700/50" />
            </div>
          )}

          {/* Share link */}
          {inviteUrl && (
            <>
              <p className="mb-3 w-full text-center text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                Or share the invite link
              </p>

              <div className="w-full overflow-hidden rounded-2xl border border-slate-700/40 bg-[#151c2e] p-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleShare}
                    className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/15"
                  >
                    <Share2 size={15} /> Share Invite Link
                  </button>
                  <button
                    onClick={handleCopyLink}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-700/60 bg-slate-800/60 text-slate-400 transition-colors hover:border-slate-600 hover:bg-slate-700/60 hover:text-white"
                    title={linkCopied ? 'Copied' : 'Copy link'}
                  >
                    {linkCopied ? <CheckCircle2 size={15} className="text-emerald-400" /> : <Copy size={15} />}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Info card */}
          <div className="mt-5 w-full rounded-2xl border border-purple-500/15 bg-purple-500/[0.06] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-500/15">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">Your friend can join using</p>
                <p className="text-xs text-slate-400">the code or the invite link</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
