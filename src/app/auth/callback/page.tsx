'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AuthService } from '@/lib/authService'
import { normalizeOtpType } from '@/lib/authError'
import { PageLoading } from '@/components/PageLoading'
import { BackButton } from '@/components/BackButton'
import { logAuthDebug, correlationId } from '@/lib/authDebug'

type Status = 'processing' | 'error'

interface CallbackError {
  code: string | null
  message: string
}

/**
 * Handles auth redirects back to the app:
 *  - email confirmation links (implicit `#access_token` or PKCE `?code`)
 *  - Google OAuth web callback (`?code`)
 *
 * Finalizes the session so Supabase can mark the account confirmed, then
 * returns the user to the home page.
 */
export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('processing')
  const [error, setError] = useState<CallbackError | null>(null)
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    const cid = correlationId()

    async function handle() {
      try {
        const url = new URL(window.location.href)
        const query = url.searchParams
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))

        // AUTH-JOIN FIX: optional original-destination continuation. Google
        // OAuth now returns here with `?redirect=<path>`; forward it to the
        // home page's existing (param-stripping, player-validating) redirect
        // handler instead of dropping the user's intent.
        const nextParam = query.get('redirect')
        const safeNext = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null

        // Auth providers surface errors directly in the redirect URL.
        const urlError = query.get('error') || hash.get('error')
        const urlErrorDescription = query.get('error_description') || hash.get('error_description')
        const urlErrorCode = query.get('error_code') || hash.get('error_code')
        if (urlError || urlErrorDescription) {
          throw Object.assign(new Error(urlErrorDescription || urlError || 'Authentication error'), {
            code: urlErrorCode || urlError || null,
          })
        }

        // PKCE flow — OAuth/confirmation code in the query string.
        const code = query.get('code')
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          logAuthDebug({
            stage: 'callback:exchangeCodeForSession',
            correlationId: cid,
            authErrorCode: exchangeError?.code ?? null,
            authErrorMessage: exchangeError?.message ?? null,
          })
          if (exchangeError) throw exchangeError
          router.replace(safeNext ? `/?redirect=${encodeURIComponent(safeNext)}` : '/')
          return
        }

        // Server-side auth (PKCE token_hash) — verify the email token directly.
        const tokenHash = query.get('token_hash') || hash.get('token_hash')
        if (tokenHash) {
          const type = normalizeOtpType(query.get('type') || hash.get('type'))
          const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
          logAuthDebug({
            stage: 'callback:verifyOtp',
            correlationId: cid,
            authErrorCode: verifyError?.code ?? null,
            authErrorMessage: verifyError?.message ?? null,
          })
          if (verifyError) throw verifyError
          router.replace(safeNext ? `/?redirect=${encodeURIComponent(safeNext)}` : '/')
          return
        }

        // Implicit flow — session tokens in the URL fragment. getSession()
        // auto-detects and clears the hash, then persists the session.
        const session = await AuthService.getSession()
        logAuthDebug({
          stage: 'callback:getSession',
          correlationId: cid,
          hasSession: !!session,
          userId: session?.user?.id ?? null,
          emailConfirmedAt: session?.user?.email_confirmed_at ?? null,
        })

        router.replace(safeNext ? `/?redirect=${encodeURIComponent(safeNext)}` : '/')
      } catch (err) {
        logAuthDebug({
          stage: 'callback:error',
          correlationId: cid,
          authErrorCode: (err as { code?: string })?.code ?? null,
          authErrorMessage: err instanceof Error ? err.message : String(err),
        })
        setError({
          code: (err as { code?: string })?.code ?? null,
          message: err instanceof Error ? err.message : 'Authentication failed',
        })
        setStatus('error')
      }
    }

    handle()
  }, [router])

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[var(--color-page-bg)] text-white flex flex-col items-center justify-center p-4 pb-20">
        <div className="text-5xl mb-3">⚠️</div>
        <h1 className="text-xl font-bold mb-2">Couldn&apos;t confirm your email</h1>
        <p className="text-slate-400 text-sm mb-6 text-center max-w-xs">
          {error?.message || 'Something went wrong. Please try signing in again.'}
        </p>
        <button
          onClick={() => router.replace('/')}
          className="min-h-[44px] px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors"
        >
          Go to Sign In
        </button>
        <BackButton label="Go Home" onClick={() => router.replace('/')} />
      </div>
    )
  }

  return <PageLoading label="Confirming your email..." />
}
