'use client'

import { useEffect, useRef } from 'react'
import { Timeline, stagger } from 'animejs'

export function EvaluatingLoader() {
  const leftPieceRef = useRef<HTMLSpanElement>(null)
  const rightPieceRef = useRef<HTMLSpanElement>(null)
  const swordRef = useRef<HTMLSpanElement>(null)
  const titleRef = useRef<HTMLParagraphElement>(null)
  const subtitleRef = useRef<HTMLParagraphElement>(null)
  const timelineRef = useRef<Timeline | null>(null)

  useEffect(() => {
    const tl = new Timeline({ loop: true, autoplay: true })
    timelineRef.current = tl

    tl.add(leftPieceRef.current!, { translateY: [0, -4, 0], scale: [1, 1.05, 1], duration: 1200, easing: 'easeInOutSine' }, 0)
    tl.add(rightPieceRef.current!, { translateY: [0, -4, 0], scale: [1, 1.05, 1], duration: 1200, easing: 'easeInOutSine' }, 300)
    tl.add(swordRef.current!, { rotate: [0, 360], scale: [1, 1.12, 1], duration: 2000, easing: 'linear' }, 0)
    tl.add(titleRef.current!, { color: [{ value: '#facc15' }, { value: '#fbbf24' }], duration: 3000, easing: 'easeInOutSine' }, 0)
    tl.add(subtitleRef.current!, { opacity: [0.35, 1, 0.35], duration: 2800, easing: 'easeInOutSine' }, 0)

    return () => {
      tl.pause()
      tl.seek(0)
    }
  }, [])

  return (
    <div className="w-full bg-gray-800/50 rounded-xl border border-yellow-500/20 p-5 text-center overflow-hidden">
      <div className="flex items-center justify-center gap-3 mb-3">
        <span
          ref={leftPieceRef}
          className="inline-block text-3xl select-none"
          style={{ filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.3))' }}
        >
          &#9813;
        </span>
        <span
          ref={swordRef}
          className="inline-block text-3xl select-none"
          style={{ filter: 'drop-shadow(0 0 8px rgba(250,204,21,0.4))' }}
        >
          &#9876;&#65039;
        </span>
        <span
          ref={rightPieceRef}
          className="inline-block text-3xl select-none"
          style={{ filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.5))' }}
        >
          &#9819;
        </span>
      </div>

      <p ref={titleRef} className="text-yellow-400 text-sm font-medium mb-1.5">
        Evaluating moves...
      </p>

      <p ref={subtitleRef} className="text-gray-500 text-xs mt-2">
        Who made the better choice?
      </p>
    </div>
  )
}
