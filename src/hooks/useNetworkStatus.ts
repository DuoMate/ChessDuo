'use client'

import { useState, useEffect, useCallback } from 'react'

interface NetworkStatus {
  online: boolean
}

export function useNetworkStatus(): NetworkStatus {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  const handleOnline = useCallback(() => setOnline(true), [])
  const handleOffline = useCallback(() => setOnline(false), [])

  useEffect(() => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [handleOnline, handleOffline])

  return { online }
}
