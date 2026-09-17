'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AuthService } from '@/lib/authService'
import { normalizeOtpType, isPkceVerifierMissing } from '@/lib/authError'
import { PageLoading } from '@/components/PageLoading'
import { logAuthDebug, correlationId } from '@/lib/authDebug'
import { useCapacitorBackButton } from '@/hooks/useCapacitorBackButton'

type Status = 'processing' | 'error' | 'recovery'

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
  const [isOAuth, setIsOAuth] = useState(false)
  const ranRef = useRef(false)

  // Transient route with no layout HW handler. HW Back goes Home via replace
  // so the one-time code/token never stays in history; the in-flight exchange
  // is best-effort and the session restore continues on Home.
  useCapacitorBackButton(() => { router.replace('/'); return true }, true)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    const cid = correlationId()

    async function handle() {
      // Discriminator between the two flows that share this route:
      //  - OAuth (web Google) returns with `?flow=oauth` (always set by
      //    authenticateWithGoogleWeb) and optionally `?redirect=<dest>`.
      //  - Email-confirmation links use a bare `/auth/callback` (no flow, no
      //    redirect param).
      // Declared here (function scope) so the catch block can read it.
      let isOAuthFlow = false
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
        // `flow=oauth` is authoritative; `safeNext` is a fallback for in-flight
        // flows started before the marker existed.
        isOAuthFlow = query.get('flow') === 'oauth' || Boolean(safeNext)
        // Mirror into React state for the loading/error copy (this closure is
        // stale by the time the async exchange settles, so the state drives UI).
        setIsOAuth(isOAuthFlow)

        // Auth providers surface errors directly in the redirect URL.
        const urlError = query.get('error') || hash.get('error')
        const urlErrorDescription = query.get('error_description') || hash.get('error_description')
        const urlErrorCode = query.get('error_code') || hash.get('error_code')
        if (urlError || urlErrorDescription) {
          throw Object.assign(new Error(urlErrorDescription || urlError || 'Authentication error'), {
            code: urlErrorCode || urlError || null,
          })
        }

        // Capture the one-time values, then strip them from the address bar
        // BEFORE the async exchange. A refresh mid-exchange then re-enters
        // with a clean URL instead of replaying a consumed PKCE code.
        const code = query.get('code')
        const tokenHash = query.get('token_hash') || hash.get('token_hash')
        if (code || tokenHash) {
          query.delete('code')
          query.delete('token_hash')
          query.delete('type')
          hash.delete('token_hash')
          hash.delete('type')
          const remainingQuery = query.toString()
          const remainingHash = hash.toString()
          const cleanedUrl = `${url.origin}${url.pathname}${remainingQuery ? `?${remainingQuery}` : ''}${remainingHash ? `#${remainingHash}` : ''}`
          window.history.replaceState(null, '', cleanedUrl)
        }

        // PKCE flow — OAuth/confirmation code in the query string.
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            // RACE RECONCILIATION (browser OAuth regression): auth-js
            // auto-initialization (detectSessionInUrl, forced by
            // createBrowserClient) may have already exchanged this same
            // one-time code before this explicit exchange ran, consuming the
            // PKCE verifier. The session is the ground truth — if it exists,
            // sign-in genuinely completed, so route onward instead of showing
            // a failure over a valid session.
            if (isPkceVerifierMissing(exchangeError)) {
              // NOTE: AuthService (not supabase.auth directly) — enforced by
              // src/__tests__/architecture.test.ts. Same singleton/session.
              const session = await AuthService.getSession()
              if (session) {
                logAuthDebug({
                  stage: 'callback:race-reconciled',
                  correlationId: cid,
                  hasSession: true,
                })
                router.replace(safeNext ? `/?redirect=${encodeURIComponent(safeNext)}` : '/')
                return
              }
            }
            logAuthDebug({
              stage: 'callback:exchangeCodeForSession',
              correlationId: cid,
              authErrorCode: exchangeError?.code ?? null,
              authErrorMessage: exchangeError?.message ?? null,
            })
            throw exchangeError
          }
          logAuthDebug({
            stage: 'callback:exchangeCodeForSession',
            correlationId: cid,
            authErrorCode: null,
            authErrorMessage: null,
          })
          router.replace(safeNext ? `/?redirect=${encodeURIComponent(safeNext)}` : '/')
          return
        }

        // Server-side auth (PKCE token_hash) — verify the email token directly.
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
        // PKCE verifier missing ⇒ the link was completed in a different
        // browser/device than the one that signed up (or the code was
        // replayed). The email is already confirmed server-side at this
        // point — recover via normal sign-in instead of a raw SDK error.
        //
        // This recovery ONLY applies to email confirmation. For OAuth
        // (has ?redirect=), a missing code verifier is a genuine sign-in
        // failure — the session was never restored — so we must NOT show
        // the "Email confirmed" screen. Fall through to the error state.
        if (isPkceVerifierMissing(err) && !isOAuthFlow) {
          setStatus('recovery')
          return
        }
        setStatus('error')
      }
    }

    handle()
  }, [router])

  if (status === 'recovery') {
    return (
      <div className="min-h-screen bg-[var(--color-page-bg)] text-white flex flex-col items-center justify-center p-4 pb-20">
        <div className="text-5xl mb-3" aria-hidden="true">✅</div>
        <h1 className="text-xl font-bold mb-2">Email confirmed</h1>
        <p className="text-slate-400 text-sm mb-6 text-center max-w-xs">
          Your email address has been confirmed. For security, this sign-in link only works in the browser where you
          signed up. Please sign in with your email and password.
        </p>
        <button
          onClick={() => router.replace('/')}
          className="min-h-[44px] px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors"
        >
          Go to Sign In
        </button>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[var(--color-page-bg)] text-white flex flex-col items-center justify-center p-4 pb-20">
        <div className="text-5xl mb-3" aria-hidden="true">⚠️</div>
        <h1 className="text-xl font-bold mb-2">{isOAuth ? "Couldn't sign in" : "Couldn't confirm your email"}</h1>
        <p role="alert" className="text-slate-400 text-sm mb-4 text-center max-w-xs">
          {isOAuth
            ? "Google sign-in didn't complete. Please try again."
            : "This confirmation link didn't work. Request a new one or try signing in."}
        </p>
        {error?.message && (
          <details className="mb-6 max-w-xs text-center">
            <summary className="min-h-[44px] inline-flex items-center cursor-pointer text-xs text-slate-500 hover:text-slate-300">
              Technical details
            </summary>
            <p className="mt-1 break-words text-xs text-slate-500">{error.message}</p>
          </details>
        )}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="min-h-[44px] px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={() => router.replace('/')}
            className="min-h-[44px] px-6 py-2 text-sm text-slate-400 transition-colors hover:text-white"
          >
            Go to Sign In
          </button>
        </div>
      </div>
    )
  }

  return <PageLoading label={isOAuth ? 'Completing sign in...' : 'Confirming your email...'} />
}
