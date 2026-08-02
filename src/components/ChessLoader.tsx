'use client'

import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { motion, useMotionValue, useAnimationControls } from 'framer-motion'

// ─── Node grid ────────────────────────────────────────────────────────────────

type NodeName =
  | 'center'
  | 'top'
  | 'topRight'
  | 'right'
  | 'bottomRight'
  | 'bottom'
  | 'bottomLeft'
  | 'left'
  | 'topLeft'

const NODE_GRID: Record<NodeName, [number, number]> = {
  center:     [0, 0],
  top:        [0, -1],
  topRight:   [1, -1],
  right:      [1, 0],
  bottomRight:[1, 1],
  bottom:     [0, 1],
  bottomLeft: [-1, 1],
  left:       [-1, 0],
  topLeft:    [-1, -1],
}

const NODE_NAMES: NodeName[] = [
  'center', 'top', 'topRight', 'right', 'bottomRight',
  'bottom', 'bottomLeft', 'left', 'topLeft', 'center',
]

const NODE_DISPLAY_ORDER: NodeName[] = [
  'topLeft', 'top', 'topRight',
  'left', 'center', 'right',
  'bottomLeft', 'bottom', 'bottomRight',
]

// ─── Phases ───────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'highlight' | 'jump' | 'land' | 'pause'

const PHASE_DURATIONS: Record<Phase, number> = {
  idle: 150,
  highlight: 80,
  jump: 180,
  land: 70,
  pause: 120,
}

const ARC_HEIGHT = -12

function getRotation(from: NodeName, to: NodeName): number {
  const [fx, fy] = NODE_GRID[from]
  const [tx, ty] = NODE_GRID[to]
  const dx = tx - fx
  if (dx > 0) return 4
  if (dx < 0) return -4
  return 0
}

// ─── LoadingText ──────────────────────────────────────────────────────────────

function LoadingText() {
  const [dots, setDots] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setDots((prev) => (prev + 1) % 4), 400)
    return () => clearInterval(id)
  }, [])

  const text = 'Loading' + '.'.repeat(dots)

  return (
    <p className="mt-6 font-sans text-xs text-slate-500 dark:text-slate-500 tracking-[0.15em] uppercase select-none">
      {text}
    </p>
  )
}

// ─── GridNode ─────────────────────────────────────────────────────────────────

interface GridNodeProps {
  highlighted: boolean
  pulsing: boolean
}

const GridNode = memo(function GridNode({ highlighted, pulsing }: GridNodeProps) {
  return (
    <div className="flex items-center justify-center w-10 h-10">
      <span
        className={`block rounded-full w-[10px] h-[10px] transition-all duration-200 ${
          highlighted
            ? 'bg-[#4DA3FF] scale-125 shadow-[0_0_8px_rgba(77,163,255,0.6)]'
            : pulsing
            ? 'bg-[#4DA3FF]/40 scale-110 shadow-[0_0_6px_rgba(77,163,255,0.3)]'
            : 'bg-white/20'
        }`}
      />
    </div>
  )
})

// ─── KnightShadow ─────────────────────────────────────────────────────────────

interface KnightShadowProps {
  isJumping: boolean
}

const KnightShadow = memo(function KnightShadow({ isJumping }: KnightShadowProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <motion.div
        className="rounded-full bg-white/10"
        style={{ width: 40, height: 12 }}
        animate={
          isJumping
            ? { scale: [1, 0.7, 1], opacity: [0.25, 0.12, 0.25] }
            : { scale: 1, opacity: 0.25 }
        }
        transition={
          isJumping
            ? { duration: 0.18, ease: 'easeInOut' }
            : { duration: 0.15 }
        }
      />
    </div>
  )
})

// ─── ChessLoader ──────────────────────────────────────────────────────────────

const SPRING_CONFIG = { type: 'spring' as const, stiffness: 220, damping: 20, mass: 0.6 }

export default function ChessLoader() {
  const [sequenceIndex, setSequenceIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [highlightedNode, setHighlightedNode] = useState<NodeName | null>(null)
  const [pulsingNode, setPulsingNode] = useState<NodeName | null>(null)
  const [isJumping, setIsJumping] = useState(false)
  const controls = useAnimationControls()
  const [gridSpace, setGridSpace] = useState(40)

  const mountedRef = useRef(true)
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    mountedRef.current = true
    
    const updateGridSpace = () => {
      const w = window.innerWidth
      if (w < 480) setGridSpace(36)
      else if (w < 768) setGridSpace(40)
      else setGridSpace(44)
    }
    updateGridSpace()
    window.addEventListener('resize', updateGridSpace)
    return () => {
      mountedRef.current = false
      window.removeEventListener('resize', updateGridSpace)
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current)
    }
  }, [])

  const advancePhase = useCallback(() => {
    if (!mountedRef.current) return

    setPhase((prev) => {
      switch (prev) {
        case 'idle':
          const nextIdx = sequenceIndex + 1
          const nextName = NODE_NAMES[nextIdx % NODE_NAMES.length]
          setHighlightedNode(nextName)
          return 'highlight'

        case 'highlight':
          return 'jump'

        case 'jump':
          setPulsingNode(highlightedNode)
          setHighlightedNode(null)
          setIsJumping(true)
          return 'land'

        case 'land':
          setIsJumping(false)
          setPulsingNode(null)
          
          const newIdx = (sequenceIndex + 1) % NODE_NAMES.length
          setSequenceIndex(newIdx)
          return 'pause'

        case 'pause':
          return 'idle'

        default:
          return 'idle'
      }
    })
  }, [sequenceIndex, highlightedNode])

  useEffect(() => {
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current)
    phaseTimerRef.current = setTimeout(advancePhase, PHASE_DURATIONS[phase])
    return () => {
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current)
    }
  }, [phase, advancePhase])

  const currentName = NODE_NAMES[sequenceIndex]
  const current = NODE_GRID[currentName]
  const px = current[0] * gridSpace
  const py = current[1] * gridSpace

  const targetName = sequenceIndex + 1 < NODE_NAMES.length
    ? NODE_NAMES[sequenceIndex + 1]
    : NODE_NAMES[0]
  const rotation = getRotation(currentName, targetName)

  useEffect(() => {
    if (phase === 'jump') {
      controls.start({
        x: px,
        y: [0, ARC_HEIGHT, 0],
        scale: [1, 1.08, 1],
        rotate: [0, rotation, 0],
        transition: {
          x: SPRING_CONFIG,
          y: { duration: 0.18, ease: [0.34, 1.56, 0.64, 1] },
          scale: { duration: 0.18, ease: 'easeInOut' },
          rotate: { duration: 0.18, ease: 'easeInOut' },
        },
      })
    } else if (phase === 'idle' && sequenceIndex === 0) {
      controls.set({ x: 0, y: 0, scale: 1, rotate: 0 })
    }
  }, [phase, px, py, rotation, controls, sequenceIndex])

  useEffect(() => {
    if (phase === 'idle') {
      controls.start({
        scale: [1, 1.02, 1],
        transition: { duration: 0.15, ease: 'easeInOut' },
      })
    }
  }, [phase, controls])

  const knightSize = gridSpace >= 44 ? 40 : gridSpace >= 40 ? 36 : 32

  return (
    <div className="flex flex-col items-center justify-center py-12 select-none">
      <img
        src="/logo.png"
        alt="ChessDuo"
        width={48}
        height={48}
        className="mb-8 shrink-0"
      />

      <div
        className="relative"
        style={{
          width: gridSpace * 2 + knightSize + 16,
          height: gridSpace * 2 + knightSize + 16,
        }}
      >
        {/* Node Grid */}
        <div
          className="absolute inset-0 grid grid-cols-3 grid-rows-3 items-center justify-items-center"
        >
          {NODE_DISPLAY_ORDER.map((name) => (
            <GridNode
              key={name}
              highlighted={highlightedNode === name}
              pulsing={pulsingNode === name}
            />
          ))}
        </div>

        {/* Knight Piece */}
        <motion.div
          animate={controls}
          className="absolute flex items-center justify-center pointer-events-none"
          style={{
            width: knightSize,
            height: knightSize,
            left: '50%',
            top: '50%',
            marginLeft: -knightSize / 2,
            marginTop: -knightSize / 2,
            zIndex: 10,
          }}
          initial={{ x: 0, y: 0, scale: 1, rotate: 0 }}
        >
          <img
            src="/logo.png"
            alt="Knight"
            width={knightSize}
            height={knightSize}
            className="shrink-0"
            style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' }}
          />
        </motion.div>
      </div>

      <LoadingText />
    </div>
  )
}
