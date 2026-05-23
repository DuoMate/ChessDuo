'use client'

import { useState, useEffect } from 'react'

const MOBILE_BREAKPOINT = 768

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const check = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }

    check()

    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    mq.addEventListener('change', check)
    return () => mq.removeEventListener('change', check)
  }, [])

  return isMobile
}
