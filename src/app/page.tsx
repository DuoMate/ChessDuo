'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAvailableSkillLevels, SkillLevel } from '@/lib/botConfig'

export default function SetupPage() {
  const router = useRouter()
  const skillLevels = getAvailableSkillLevels()
  const [selectedLevel, setSelectedLevel] = useState<number>(4)

  const handleStartGame = () => {
    router.push(`/game?level=${selectedLevel}`)
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-3xl w-full">
        <h1 className="text-4xl font-bold text-center mb-2">ChessDuo</h1>
        <p className="text-gray-400 text-center mb-8">Select your opponent&apos;s skill level</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          {skillLevels.map((level: SkillLevel) => (
            <button
              key={level.level}
              onClick={() => setSelectedLevel(level.level)}
              className={`
                p-4 rounded-lg border-2 transition-all duration-200 text-center
                ${selectedLevel === level.level
                  ? 'border-yellow-500 bg-yellow-500/20 shadow-lg shadow-yellow-500/30'
                  : 'border-gray-600 bg-gray-800 hover:border-gray-400 hover:bg-gray-700'
                }
              `}
            >
              <div className="text-lg font-bold mb-1">{level.label}</div>
              <div className="text-sm text-gray-300">{level.description}</div>
            </button>
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={handleStartGame}
            className="px-8 py-3 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold rounded-lg text-lg transition-colors"
          >
            Start Game
          </button>
        </div>

        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>You will play as White (team of 2)</p>
          <p>Make moves with your teammate bot to outsmart the opponent</p>
        </div>
      </div>
    </div>
  )
}
