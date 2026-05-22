'use client'

import { useState, useRef, useEffect } from 'react'

interface FriendActionsMenuProps {
  onDelete: () => void
  onMessage: () => void
  onChallenge: () => void
}

export function FriendActionsMenu({ onDelete, onMessage, onChallenge }: FriendActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/[0.05]"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-gray-800 border border-white/10 rounded-xl shadow-2xl z-50 py-1 overflow-hidden">
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete() }}
            className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2 min-h-[44px]"
          >
            🗑 Delete Friend
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onMessage() }}
            className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-white/[0.05] transition-colors flex items-center gap-2 min-h-[44px]"
          >
            💬 Send Message
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onChallenge() }}
            className="w-full text-left px-4 py-3 text-sm text-yellow-400 hover:bg-yellow-500/10 transition-colors flex items-center gap-2 min-h-[44px]"
          >
            ⚡ Challenge
          </button>
        </div>
      )}
    </div>
  )
}
