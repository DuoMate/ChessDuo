'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createChallenge } from '@/lib/challenges'
import { sendMessage } from '@/lib/messages'

interface ChallengePickerProps {
  currentUserId: string
  friendId: string
  friendName: string
  onClose: () => void
}

interface TimeOption {
  seconds: number
  label: string
  icon: string
}

const TIME_OPTIONS: TimeOption[] = [
  { seconds: 300, label: '5 min', icon: '⚡' },
  { seconds: 600, label: '10 min', icon: '⏱' },
  { seconds: 900, label: '15 min', icon: '🕐' },
  { seconds: 1800, label: '30 min', icon: '🕒' },
]

export function ChallengePicker({ currentUserId, friendId, friendName, onClose }: ChallengePickerProps) {
  const router = useRouter()
  const [selectedTime, setSelectedTime] = useState(600)
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    setCreating(true)
    const { data, roomId, roomCode, error } = await createChallenge(currentUserId, 'online', selectedTime, friendId)
    if (data && roomId && roomCode) {
      await sendMessage(
        currentUserId,
        friendId,
        JSON.stringify({ type: 'challenge', roomId, roomCode, time: selectedTime }),
        'challenge'
      )
      router.push(`/duel?room=${roomId}&code=${roomCode}&team=WHITE&playerId=${currentUserId}&time=${selectedTime}`)
    }
    setCreating(false)
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-gray-800 border border-white/10 rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white mb-1">Challenge {friendName}</h3>
        <p className="text-gray-400 text-sm mb-4">Select game duration</p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {TIME_OPTIONS.map((opt) => (
            <button
              key={opt.seconds}
              onClick={() => setSelectedTime(opt.seconds)}
              className={`min-h-[60px] p-4 rounded-xl border text-center transition-all ${
                selectedTime === opt.seconds
                  ? 'border-yellow-500 bg-yellow-500/10'
                  : 'border-white/8 bg-white/[0.03] hover:border-white/15'
              }`}
            >
              <div className="text-2xl mb-1">{opt.icon}</div>
              <div className="text-sm font-bold text-white">{opt.label}</div>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex-1 min-h-[44px] px-4 py-2 bg-yellow-500 text-gray-900 font-bold rounded-xl hover:bg-yellow-400 disabled:opacity-50 transition-colors text-sm"
          >
            {creating ? 'Creating...' : 'Send Challenge'}
          </button>
          <button
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600 transition-colors text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
