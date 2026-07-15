'use client'

import { useEffect } from 'react'

let lockCount = 0
let savedOverflow = ''

export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return

    lockCount++
    if (lockCount === 1) {
      savedOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }

    return () => {
      lockCount--
      if (lockCount === 0) {
        document.body.style.overflow = savedOverflow
      }
    }
  }, [locked])
}
