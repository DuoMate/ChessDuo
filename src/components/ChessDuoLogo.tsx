'use client'

import Image from 'next/image'

interface ChessDuoLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  animate?: boolean
  className?: string
}

const sizeConfig = {
  sm: 20,
  md: 28,
  lg: 36,
  xl: 48,
}

export default function ChessDuoLogo({
  size = 'md',
  showText = true,
  animate = false,
  className = '',
}: ChessDuoLogoProps) {
  const px = sizeConfig[size]

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src="/logo.png"
        alt="ChessDuo"
        width={px}
        height={px}
        className={`shrink-0 ${animate ? 'animate-pulse' : ''}`}
      />
      {showText && (
        <h1 className={`text-${size === 'sm' ? 'lg' : size === 'md' ? '2xl' : size === 'lg' ? '3xl' : '4xl'} font-black tracking-tight`}>
          <span className="text-slate-900 dark:text-white">Chess</span>
          <span className="text-blue-600 dark:text-blue-500">Duo</span>
        </h1>
      )}
    </div>
  )
}
