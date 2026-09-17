'use client'

import { memo, useEffect, useRef, useState } from 'react'
import { Star } from 'lucide-react'
import { openPlayListing } from '@/lib/rateApp'

/**
 * Shared "Rate ChessDuo" menu row — single source of truth for both
 * profile surfaces (`ProfilePanel` slide-over + `/profile` full page).
 * User-initiated Play Store rating entry point; best-effort, never throws.
 */
function RateChessDuoRowInner() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [openingStore, setOpeningStore] = useState(false)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleRateApp = async () => {
    setOpeningStore(true)
    try {
      await openPlayListing()
    } finally {
      // Brief feedback like the Share row's "Link copied!" — the Play
      // Store app now owns the flow, so always reset the label.
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setOpeningStore(false), 2000)
    }
  }

  return (
    <button
      onClick={handleRateApp}
      className="w-full min-h-[44px] p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3 hover:bg-amber-500/15 transition-colors"
    >
      <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
        <Star size={20} className="text-amber-400" />
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="text-sm font-semibold text-amber-400 truncate">{openingStore ? 'Opening Play Store…' : 'Rate ChessDuo'}</p>
        <p className="text-xs text-slate-400 truncate">Enjoying the game? Leave us a rating</p>
      </div>
      <span className="text-slate-500 shrink-0" aria-hidden="true">&rsaquo;</span>
    </button>
  )
}

export const RateChessDuoRow = memo(RateChessDuoRowInner)
