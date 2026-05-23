'use client'

import { useState } from 'react'

interface FriendActionsMenuProps {
  onDelete: () => void
  onMessage: () => void
  onChallenge: () => void
}

export function FriendActionsMenu({ onDelete, onMessage, onChallenge }: FriendActionsMenuProps) {
  const [open, setOpen] = useState(false)

  const handleAction = (action: () => void) => {
    setOpen(false)
    action()
  }

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/[0.05]"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] bg-black/50" onClick={() => setOpen(false)}>
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 bg-gray-800 border border-white/10 rounded-2xl shadow-2xl py-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => handleAction(onDelete)}
              className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2 min-h-[44px]"
            >
              🗑 Delete Friend
            </button>
            <button
              onClick={() => handleAction(onMessage)}
              className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-white/[0.05] transition-colors flex items-center gap-2 min-h-[44px]"
            >
              💬 Send Message
            </button>
            <button
              onClick={() => handleAction(onChallenge)}
              className="w-full text-left px-4 py-3 text-sm text-yellow-400 hover:bg-yellow-500/10 transition-colors flex items-center gap-2 min-h-[44px]"
            >
              ⚡ Challenge
            </button>
          </div>
        </div>
      )}
    </>
  )
}
