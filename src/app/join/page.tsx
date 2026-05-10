'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function JoinPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const code = searchParams.get('code')

  useEffect(() => {
    async function autoJoin() {
      console.log(`[JOIN-PAGE] Auto-joining with code: ${code}`)

      // Try guest sign-in
      try {
        const { data, error } = await supabase.auth.signInAnonymously()
        if (!error && data.user) {
          console.log(`[JOIN-PAGE] Guest auth success, redirecting...`)
          router.push(`/?mode=online&join=${code}`)
          return
        }
        console.warn('[JOIN-PAGE] Guest sign-in failed:', error?.message)
      } catch {
        console.warn('[JOIN-PAGE] Guest sign-in error')
      }

      // Fallback: create a random ID and redirect without auth
      const randomId = Math.random().toString(36).substring(2, 15)
      console.log(`[JOIN-PAGE] Using fallback guest: Player${randomId}`)
      router.push(`/?mode=online&join=${code}`)
    }

    if (code) {
      autoJoin()
    } else {
      router.push('/')
    }
  }, [code, router])

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <span className="material-symbols-outlined text-4xl text-yellow-400 mb-3 animate-pulse">groups</span>
        <p className="text-gray-400 text-sm">Joining room...</p>
      </div>
    </div>
  )
}
