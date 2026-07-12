'use client'

import { motion } from 'framer-motion'

interface TeamHexagonProps {
  value: number
  team: 'WHITE' | 'BLACK'
  size?: number
  className?: string
}

const FILL_BY_TEAM: Record<'WHITE' | 'BLACK', { from: string; to: string; text: string }> = {
  WHITE: { from: '#3b82f6', to: '#2563eb', text: '#dbeafe' },
  BLACK: { from: '#a855f7', to: '#7c3aed', text: '#f3e8ff' },
}

export function TeamHexagon({ value, team, size = 36, className = '' }: TeamHexagonProps) {
  const fill = FILL_BY_TEAM[team]
  const half = size / 2
  const r = half - 2
  const points = [
    [half, 2],
    [size - 2, half * 0.55],
    [size - 2, half * 1.45],
    [half, size - 2],
    [2, half * 1.45],
    [2, half * 0.55],
  ]
    .map(p => p.join(','))
    .join(' ')

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 18 }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`hex-grad-${team}-${value}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={fill.from} />
          <stop offset="100%" stopColor={fill.to} />
        </linearGradient>
      </defs>
      <polygon
        points={points}
        fill={`url(#hex-grad-${team}-${value})`}
        stroke={fill.from}
        strokeWidth={1}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fontSize={size * 0.45}
        fontWeight="800"
        fill={fill.text}
        fontFamily="ui-sans-serif, system-ui"
      >
        {value}
      </text>
    </motion.svg>
  )
}
