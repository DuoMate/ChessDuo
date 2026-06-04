'use client'

import { useEffect, useRef, useState } from 'react'
import { Timeline } from 'animejs'
import { Crown, Copy, Share2, CheckCircle2, User, Loader2 } from 'lucide-react'
import { useIsMobile } from '@/hooks/useIsMobile'

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

  const handleCopyCode = () => {
    if (!roomCode) return
    navigator.clipboard.writeText(roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyLink = () => {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
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
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f1119] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="flex flex-col items-center">

          {/* Crown icon */}
          <div className={`relative ${crownMb}`}>
            <div ref={iconRef} className="inline-block">
              <Crown size={crownSize} className="text-amber-400 drop-shadow-lg" strokeWidth={1.5} />
            </div>
            <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 ${glowWidth} h-1 bg-amber-500 rounded-full shadow-[0_0_12px_rgba(251,191,36,0.4)]`} />
          </div>

          {/* Joining phase */}
          {phase === 'joining' && (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div ref={dot1Ref} className="w-3 h-3 bg-amber-500 rounded-full" />
                <div ref={dot2Ref} className="w-3 h-3 bg-amber-500 rounded-full" />
                <div ref={dot3Ref} className="w-3 h-3 bg-amber-500 rounded-full" />
              </div>
              <p className={`text-gray-500 dark:text-gray-400 ${statusTextSize} mb-4`}>Connecting to room...</p>
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
                  <span className="text-sm text-gray-500">Waiting for teammate</span>
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

              <div className="w-full px-5 py-4 bg-gray-50 dark:bg-white/[0.04] rounded-2xl border border-gray-200 dark:border-white/8 text-center mb-3">
                <p className={`font-mono font-bold text-amber-400 tracking-[0.2em] select-all mb-3 ${codeTextSize}`}>
                  {roomCode}
                </p>
                <button
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors min-h-[44px] px-4 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
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

          {/* Share link — always visible */}
          {inviteUrl && (
            <>
              <p className="text-xs text-gray-500 tracking-[0.15em] uppercase mb-2">
                Or share the invite link
              </p>

              <div className="w-full px-5 py-4 bg-gray-50 dark:bg-white/[0.04] rounded-2xl border border-gray-200 dark:border-white/8 text-center">
                <div className="flex gap-2">
                  <button
                    onClick={handleShare}
                    className="flex-1 min-h-[44px] rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 font-medium text-sm transition-colors inline-flex items-center justify-center gap-1.5"
                  >
                    <Share2 size={15} /> Share link
                  </button>
                  <button
                    onClick={handleCopyLink}
                    className="min-h-[44px] min-w-[44px] rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors inline-flex items-center justify-center"
                    title={linkCopied ? 'Copied' : 'Copy link'}
                  >
                    {linkCopied ? <CheckCircle2 size={15} className="text-emerald-400" /> : <Copy size={15} />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
