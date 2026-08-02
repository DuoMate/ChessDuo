'use client'

import { useEffect, useRef } from 'react'
import { Timeline } from 'animejs'
import ChessDuoLogo from '@/components/ChessDuoLogo'

export default function Loading() {
  const logoRef = useRef<HTMLDivElement>(null)
  const taglineRef = useRef<HTMLParagraphElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)
  const timelineRef = useRef<Timeline | null>(null)

  useEffect(() => {
    const tl = new Timeline({ loop: true, autoplay: true })
    timelineRef.current = tl

    tl.add(logoRef.current!, { scale: [1, 1.06, 1], duration: 2400, easing: 'spring(1, 80, 10, 0)' }, 0)
    tl.add(taglineRef.current!, { opacity: [0, 1], translateY: [6, 0], duration: 500, easing: 'outExpo' }, 300)
    tl.add(barRef.current!, { opacity: [0, 1], duration: 400, easing: 'outExpo' }, 600)
    tl.add(statusRef.current!, { opacity: [0.3, 1, 0.3], duration: 2500, easing: 'easeInOutSine' }, 0)

    return () => {
      tl.pause()
      tl.seek(0)
    }
  }, [])

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center min-h-screen w-screen bg-[var(--color-page-bg)] dark:bg-[var(--color-page-bg)] overflow-hidden">
      <div ref={logoRef}>
        <ChessDuoLogo size="xl" animate />
      </div>

      <p
        ref={taglineRef}
        className="font-sans text-[clamp(9px,2.5vw,11px)] text-slate-500 dark:text-slate-500 tracking-[0.2em] uppercase opacity-0"
      >
        Play Smarter, Together
      </p>

      <div ref={barRef} className="opacity-0">
        <div className="relative w-[min(200px,50vw)] h-[3px] rounded-full bg-white/[0.06] dark:bg-white/[0.06] mt-9 overflow-hidden">
          <div className="absolute inset-0 animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
        </div>
      </div>

      <p
        ref={statusRef}
        className="font-sans text-[clamp(10px,2.5vw,12px)] text-slate-600 dark:text-slate-600 mt-4 tracking-[0.05em]"
      >
        Preparing board...
      </p>

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .animate-shimmer {
          animation: shimmer 1.8s linear infinite;
        }
      `}</style>
    </div>
  )
}
