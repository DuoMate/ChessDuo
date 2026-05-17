'use client'

import { useEffect, useRef } from 'react'
import { Timeline } from 'animejs'

export default function Loading() {
  const logoRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLParagraphElement>(null)
  const taglineRef = useRef<HTMLParagraphElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)
  const timelineRef = useRef<Timeline | null>(null)

  useEffect(() => {
    const tl = new Timeline({ loop: true, autoplay: true })
    timelineRef.current = tl

    tl.add(logoRef.current!, { scale: [1, 1.06, 1], duration: 2400, easing: 'spring(1, 80, 10, 0)' }, 0)
    tl.add(titleRef.current!, { opacity: [0, 1], translateY: [8, 0], duration: 600, easing: 'outExpo' }, 100)
    tl.add(taglineRef.current!, { opacity: [0, 1], translateY: [6, 0], duration: 500, easing: 'outExpo' }, 300)
    tl.add(barRef.current!, { opacity: [0, 1], duration: 400, easing: 'outExpo' }, 600)
    tl.add(statusRef.current!, { opacity: [0.3, 1, 0.3], duration: 2500, easing: 'easeInOutSine' }, 0)

    return () => {
      tl.pause()
      tl.seek(0)
    }
  }, [])

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        background: '#0f1119',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        overflow: 'hidden',
      }}
    >
      <div
        ref={logoRef}
        style={{
          width: 'min(280px, 60vw)',
          height: 'auto',
          aspectRatio: '1/1',
          backgroundImage: 'url(/loading/logo.png)',
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
        }}
      />

      <p
        ref={titleRef}
        style={{
          fontFamily: 'inherit',
          fontSize: 'clamp(18px, 5vw, 26px)',
          fontWeight: 800,
          color: '#facc15',
          letterSpacing: '0.1em',
          marginTop: '20px',
          marginBottom: '4px',
          opacity: 0,
        }}
      >
        ChessDuo
      </p>
      <p
        ref={taglineRef}
        style={{
          fontFamily: 'inherit',
          fontSize: 'clamp(9px, 2.5vw, 11px)',
          color: '#6b7280',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          opacity: 0,
        }}
      >
        Play Smarter, Together
      </p>

      <div ref={barRef} style={{ opacity: 0 }}>
        <div
          style={{
            width: 'min(200px, 50vw)',
            height: '3px',
            borderRadius: '9999px',
            background: 'rgba(255,255,255,0.06)',
            marginTop: '36px',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, transparent 0%, #facc15 50%, transparent 100%)',
              animation: 'shimmer 1.8s linear infinite',
              backgroundSize: '200% 100%',
            }}
          />
        </div>
      </div>

      <p
        ref={statusRef}
        style={{
          fontFamily: 'inherit',
          fontSize: 'clamp(10px, 2.5vw, 12px)',
          color: '#4b5563',
          marginTop: '16px',
          letterSpacing: '0.05em',
          opacity: 1,
        }}
      >
        Preparing board...
      </p>

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  )
}
