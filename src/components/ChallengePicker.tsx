'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createChallenge } from '@/lib/challenges'
import { sendMessage } from '@/lib/messages'
import { Zap, Timer } from 'lucide-react'

interface ChallengePickerProps {
  currentUserId: string
  friendId: string
  friendName: string
  onClose: () => void
}

interface TimeOption {
  seconds: number
  label: string
}

const TIME_OPTIONS: TimeOption[] = [
  { seconds: 300, label: '5 min' },
  { seconds: 600, label: '10 min' },
  { seconds: 900, label: '15 min' },
  { seconds: 1800, label: '30 min' },
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
      <div className="w-full max-w-sm bg-game-surface border border-white/10 rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white mb-1">Challenge {friendName}</h3>
        <p className="text-gray-400 text-sm mb-4">Select game duration</p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {TIME_OPTIONS.map((opt) => (
            <button
              key={opt.seconds}
              onClick={() => setSelectedTime(opt.seconds)}
              className={`min-h-[60px] p-4 rounded-xl border text-center transition-all ${
                selectedTime === opt.seconds
                  ? 'border-amber-400 bg-amber-500/10'
                  : 'border-white/8 bg-white/[0.03] hover:border-white/15'
              }`}
            >
              <div className="mb-1 flex justify-center">
                {opt.seconds <= 600 ? (
                  <Zap size={24} className={selectedTime === opt.seconds ? 'text-amber-400' : 'text-gray-500'} />
                ) : (
                  <Timer size={24} className={selectedTime === opt.seconds ? 'text-amber-400' : 'text-gray-500'} />
                )}
              </div>
              <div className="text-sm font-bold text-white">{opt.label}</div>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex-1 min-h-[44px] px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-gray-900 font-bold rounded-xl hover:from-amber-400 hover:to-yellow-300 disabled:opacity-50 transition-all text-sm"
          >
            {creating ? 'Creating...' : 'Send Challenge'}
          </button>
          <button
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 bg-white/5 text-gray-300 rounded-xl hover:bg-white/10 transition-colors text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
