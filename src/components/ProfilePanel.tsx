'use client'

import { ProfileEditor } from './ProfileEditor'

interface ProfilePanelProps {
  playerId: string
  onViewHistory: () => void
}

export function ProfilePanel({ playerId, onViewHistory }: ProfilePanelProps) {
  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <ProfileEditor playerId={playerId} />
      </div>

      <button
        onClick={onViewHistory}
        className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:text-yellow-400 hover:border-gray-600 text-sm transition-colors"
      >
        📋 View Match History →
      </button>
    </div>
  )
}
