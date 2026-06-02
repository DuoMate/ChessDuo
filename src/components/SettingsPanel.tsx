'use client'

import { motion } from 'framer-motion'
import { useSettings } from '@/lib/settings'
import { ArrowLeft } from 'lucide-react'

interface SettingsPanelProps {
  onClose: () => void
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { autoQueen, lowTimeWarning, setAutoQueen, setLowTimeWarning } = useSettings()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-gray-400 hover:text-gray-300 transition-colors"
            style={{ minHeight: '44px' }}
          >
            <ArrowLeft size={16} />
            <span className="text-sm">Back</span>
          </button>
          <h2 className="text-sm font-semibold text-white">Settings</h2>
          <div className="w-16" />
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white font-medium">Auto-Queen</p>
              <p className="text-xs text-gray-500 mt-0.5">Automatically promote pawns to queen</p>
            </div>
            <button
              onClick={() => setAutoQueen(!autoQueen)}
              className={`w-12 h-7 rounded-full transition-colors relative ${autoQueen ? 'bg-yellow-500' : 'bg-gray-600'}`}
              style={{ minHeight: '44px', minWidth: '44px' }}
              aria-label="Toggle auto-queen"
            >
              <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${autoQueen ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="h-px bg-gray-700" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white font-medium">Low Time Warning</p>
              <p className="text-xs text-gray-500 mt-0.5">Sound alert when time is running low</p>
            </div>
            <button
              onClick={() => setLowTimeWarning(!lowTimeWarning)}
              className={`w-12 h-7 rounded-full transition-colors relative ${lowTimeWarning ? 'bg-yellow-500' : 'bg-gray-600'}`}
              style={{ minHeight: '44px', minWidth: '44px' }}
              aria-label="Toggle low time warning"
            >
              <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${lowTimeWarning ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
