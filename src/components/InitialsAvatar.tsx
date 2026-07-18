'use client'

import { useState } from 'react'

interface InitialsAvatarProps {
  username: string
  size?: 'sm' | 'md' | 'lg'
  src?: string | null
  online?: boolean
  premium?: boolean
  ringClass?: string
}

function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase()
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
}

export function InitialsAvatar({ username, size = 'md', src, online, premium, ringClass }: InitialsAvatarProps) {
  const [imgError, setImgError] = useState(false)
  const initials = getInitials(username)

  return (
    <div className="relative flex-shrink-0">
      {src && !imgError ? (
        <img
          src={src}
          alt={username}
          referrerPolicy="no-referrer"
          className={`${sizeClasses[size]} rounded-full object-cover ${ringClass ? `ring-2 ${ringClass}` : ''}`}
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white ${
            premium
              ? 'bg-gradient-to-br from-amber-400 to-amber-600'
              : 'bg-gradient-to-br from-blue-500 to-purple-600'
          } ${ringClass ? `ring-2 ${ringClass}` : ''}`}
        >
          {initials}
        </div>
      )}
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
            online ? 'bg-emerald-500' : 'bg-slate-600'
          }`}
        />
      )}
    </div>
  )
}
