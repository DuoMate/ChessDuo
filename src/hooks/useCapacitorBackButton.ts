'use client'

import { useEffect } from 'react'

type BackHandler = () => boolean

const handlerStack: BackHandler[] = []
let listenerRegistered = false

export function registerBackButtonListener(): void {
  if (listenerRegistered) return
  if (typeof window === 'undefined') return

  const isNative = typeof window !== 'undefined'
    && !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor?.isNativePlatform?.()

  if (!isNative) return
  listenerRegistered = true

  import('@capacitor/app').then(({ App }) => {
    App.addListener('backButton', () => {
      if (handlerStack.length > 0) {
        const handler = handlerStack[handlerStack.length - 1]
        const handled = handler()
        if (handled) return
      }
      App.exitApp()
    })
  }).catch(() => {
    // Capacitor not available — no-op on web
  })
}

export function useCapacitorBackButton(handler: BackHandler | null, active: boolean): void {
  useEffect(() => {
    if (!active || !handler) return

    handlerStack.push(handler)
    return () => {
      const idx = handlerStack.indexOf(handler)
      if (idx >= 0) handlerStack.splice(idx, 1)
    }
  }, [handler, active])
}
