import { useCallback, useRef } from 'react'

export function useTimer(isOnline: boolean, gameRef: React.MutableRefObject<any>, onlineGameRef: React.MutableRefObject<any>) {
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const startTimer = useCallback(() => {
    const g = isOnline ? onlineGameRef.current : gameRef.current
    if (!g) return

    if (timerRef.current) clearInterval(timerRef.current)

    g.setTeamTimer(10)

    timerRef.current = setInterval(() => {
      const currentTimer = g.getTeamTimer()
      if (currentTimer <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        g.setTimerActive(false)
        return
      }
      g.setTeamTimer(currentTimer - 1)
    }, 1000)
  }, [isOnline, gameRef, onlineGameRef])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const g = isOnline ? onlineGameRef.current : gameRef.current
    if (g) g.setTimerActive(false)
  }, [isOnline, gameRef, onlineGameRef])

  return { startTimer, stopTimer, timerRef }
}
