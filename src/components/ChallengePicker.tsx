'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { createChallenge } from '@/lib/challenges'
import { sendMessage } from '@/lib/messages'
import { notifyGameInvite } from '@/features/push-notifications'
import { Sparkles, Timer, Zap } from 'lucide-react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useScrollLock } from '@/hooks/useScrollLock'

interface ChallengePickerProps {
  currentUserId: string
  friendId: string
  friendName: string
  currentUserName: string
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

export function ChallengePicker({ currentUserId, friendId, friendName, currentUserName, onClose }: ChallengePickerProps) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [selectedTime, setSelectedTime] = useState(600)
  const [creating, setCreating] = useState(false)

  useEscapeKey(onClose)
  useScrollLock(true)

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
      // The invite deep link must carry the RECEIVER's identity (friendId) and the
      // BLACK team so the friend's /duel page session check passes — the challenger
      // is already WHITE in the pre-created room.
      notifyGameInvite(friendId, currentUserId, currentUserName, roomId, roomCode, friendId, 'BLACK')
      router.push(`/duel?room=${roomId}&code=${roomCode}&team=WHITE&playerId=${currentUserId}&time=${selectedTime}`)
    }
    setCreating(false)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 z-[60] flex bg-slate-950/70 ${isMobile ? 'items-end' : 'items-center justify-center'} p-4 backdrop-blur-sm`}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          className={`w-full ${isMobile ? 'max-w-full rounded-t-[28px] max-h-[92svh] overflow-y-auto' : 'max-w-sm rounded-[28px] max-h-[90vh] overflow-y-auto'} border border-white/70 bg-white/90 p-6 shadow-[0_24px_90px_rgba(2,6,23,0.25)] backdrop-blur-2xl dark:border-slate-700/70 dark:bg-slate-900/90`}
          onClick={(e) => e.stopPropagation()}
          style={isMobile ? { paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' } : undefined}
        >
          <div className="mb-4 flex items-center gap-2">
            <div className="shrink-0 rounded-full border border-amber-500/20 bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
              <Sparkles size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-bold text-slate-900 dark:text-white" title={`Challenge ${friendName}`}>Challenge {friendName}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Select game duration</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            {TIME_OPTIONS.map((opt) => (
              <motion.button
                whileTap={{ scale: 0.97 }}
                key={opt.seconds}
                onClick={() => setSelectedTime(opt.seconds)}
                className={`min-h-[60px] rounded-2xl border p-4 text-center transition-all ${
                  selectedTime === opt.seconds
                    ? 'border-amber-400 bg-amber-500/10 shadow-sm'
                    : 'border-slate-200/80 bg-slate-50/80 hover:border-slate-300 dark:border-slate-700/70 dark:bg-slate-800/70 dark:hover:border-slate-600'
                }`}
              >
                <div className="mb-1 flex justify-center">
                  {opt.seconds <= 600 ? (
                    <Zap size={24} className={selectedTime === opt.seconds ? 'text-amber-400' : 'text-gray-500'} />
                  ) : (
                    <Timer size={24} className={selectedTime === opt.seconds ? 'text-amber-400' : 'text-gray-500'} />
                  )}
                </div>
                <div className="text-sm font-bold text-gray-900 dark:text-white">{opt.label}</div>
              </motion.button>
            ))}
          </div>

          <div className="flex gap-3">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleCreate}
              disabled={creating}
              className="flex-1 min-h-[44px] rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-bold text-slate-950 transition-all hover:-translate-y-0.5 hover:from-amber-400 hover:to-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? 'Creating...' : 'Send Challenge'}
            </motion.button>
            <button
              onClick={onClose}
              className="min-h-[44px] rounded-2xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
