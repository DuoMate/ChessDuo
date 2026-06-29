'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Timeline } from 'animejs'
import { Crown, Copy, Share2, CheckCircle2, User, Loader2, Sparkles } from 'lucide-react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { BotEloSelector } from './BotEloSelector'

interface GameLobbyProps {
  roomCode?: string
  inviteUrl?: string
  isLoading: boolean
  username?: string
  botEloLevel?: number
  onBotEloSelect?: (level: number) => void
}

export function GameLobby({ roomCode, inviteUrl, isLoading, username, botEloLevel = 4, onBotEloSelect }: GameLobbyProps) {
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
  const crownMb = isMobile ? 'mb-4' : 'mb-6'
  const glowWidth = isMobile ? 'w-12' : 'w-16'
  const statusTextSize = isMobile ? 'text-base' : 'text-lg'
  const codeTextSize = isMobile ? 'text-xl' : 'text-2xl'

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

  const handleShare = () => {
    if (!inviteUrl || !roomCode) return
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: 'ChessDuo \u2014 Join my game!',
        text: `Join my ChessDuo game! Room code: ${roomCode}`,
        url: inviteUrl,
      }).catch(() => {})
    } else {
      handleCopyLink()
    }
  }

  const phase = isLoading ? 'joining' : 'waiting'

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(99,102,241,0.16),_transparent_24%)] p-4 dark:bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.16),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(129,140,248,0.18),_transparent_24%)]">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-md overflow-hidden rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.14)] backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/80 dark:shadow-[0_20px_80px_rgba(2,6,23,0.36)] sm:p-8"
      >
        <div className="flex flex-col items-center">

          <div className={`relative ${crownMb}`}>
            <motion.div
              ref={iconRef}
              className="inline-block"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Crown size={crownSize} className="text-amber-400 drop-shadow-lg" strokeWidth={1.5} />
            </motion.div>
            <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 ${glowWidth} h-1 rounded-full bg-amber-500 shadow-[0_0_12px_rgba(251,191,36,0.4)]`} />
          </div>

          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-700 shadow-sm dark:text-amber-300">
            <Sparkles size={12} />
            Ready to play?
          </div>

          {/* Joining phase */}
          {phase === 'joining' && (
            <>
              <div className="mb-3 flex items-center gap-3">
                <motion.div ref={dot1Ref} className="h-3 w-3 rounded-full bg-amber-500" />
                <motion.div ref={dot2Ref} className="h-3 w-3 rounded-full bg-amber-500" />
                <motion.div ref={dot3Ref} className="h-3 w-3 rounded-full bg-amber-500" />
              </div>
              <p className={`mb-4 text-slate-500 dark:text-slate-400 ${statusTextSize}`}>Connecting to room...</p>
            </>
          )}

          {/* Waiting phase */}
          {phase === 'waiting' && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                <span className="text-emerald-400 text-sm font-medium">Connected</span>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                    <User size={10} className="text-amber-600 dark:text-amber-400" />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">{username || 'You'}</span>
                </div>
                <div className="text-gray-600 text-xs font-mono">{'\u2192'}</div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center">
                    <Loader2 size={10} className="text-gray-500 animate-spin" />
                  </div>
                  <span className="text-sm text-gray-500">Waiting for your teammate</span>
                </div>
              </div>
            </>
          )}

          {/* Room code — always visible */}
          {roomCode && (
            <>
              <p className="text-xs text-gray-500 tracking-[0.15em] uppercase mb-2">
                Send this code to your friend to join
              </p>

              <div className="mb-3 w-full rounded-[24px] border border-slate-200/80 bg-slate-50/80 px-5 py-4 text-center shadow-sm dark:border-slate-700/70 dark:bg-slate-800/70">
                <p className={`mb-3 select-all font-mono font-bold tracking-[0.2em] text-amber-500 ${codeTextSize}`}>
                  {roomCode}
                </p>
                <button
                  onClick={handleCopyCode}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-2xl px-4 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-amber-600 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-amber-400"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 size={13} className="text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>Copy code</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {/* Bot ELO selector — always visible so players can choose before or after teammate joins */}
          {onBotEloSelect && (
            <div className="mb-4">
              <BotEloSelector selectedLevel={botEloLevel} onSelect={onBotEloSelect} />
            </div>
          )}

          {/* Share link — always visible */}
          {inviteUrl && (
            <>
              <p className="text-xs text-gray-500 tracking-[0.15em] uppercase mb-2">
                Or share the invite link
              </p>

              <div className="w-full rounded-[24px] border border-slate-200/80 bg-slate-50/80 px-5 py-4 text-center shadow-sm dark:border-slate-700/70 dark:bg-slate-800/70">
                <div className="flex gap-2">
                  <button
                    onClick={handleShare}
                    className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-sm font-medium text-amber-600 transition-colors hover:bg-amber-500/20 dark:text-amber-400"
                  >
                    <Share2 size={15} /> Share link
                  </button>
                  <button
                    onClick={handleCopyLink}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 dark:hover:text-white"
                    title={linkCopied ? 'Copied' : 'Copy link'}
                  >
                    {linkCopied ? <CheckCircle2 size={15} className="text-emerald-400" /> : <Copy size={15} />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
