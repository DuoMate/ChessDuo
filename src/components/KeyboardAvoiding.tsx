'use client'

import { useEffect, useState } from 'react'

export function KeyboardAvoiding({ children }: { children: React.ReactNode }) {
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const handleResize = () => {
      const height = window.innerHeight
      const visibleHeight = viewport.height
      const diff = height - visibleHeight
      setKeyboardHeight(diff > 100 ? diff : 0)
    }

    viewport.addEventListener('resize', handleResize)
    return () => viewport.removeEventListener('resize', handleResize)
  }, [])

  if (keyboardHeight === 0) return <>{children}</>

  return (
    <div style={{ paddingBottom: keyboardHeight, transition: 'padding-bottom 0.1s ease-out' }}>
      {children}
    </div>
  )
}
