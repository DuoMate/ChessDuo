'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AuthService } from '@/lib/authService'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { BackButton } from '@/components/BackButton'
import { Spinner } from '@/components/Spinner'
import { AuthGate } from '@/components/AuthGate'
import { useCapacitorBackButton } from '@/hooks/useCapacitorBackButton'

export default function DeleteAccountPage() {
  const router = useRouter()
  useCapacitorBackButton(() => { router.push('/'); return true }, true)

  return (
    <AuthGate variant="page" pageTitle="Delete Account" pageEmoji="⚠️" subtitle="Sign in to manage your account" onBack={() => router.push('/')}>
      {() => <DeleteAccountContent />}
    </AuthGate>
  )
}

function DeleteAccountContent() {
  const router = useRouter()
  const [step, setStep] = useState<'info' | 'confirm' | 'loading' | 'done' | 'error'>('info')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleDelete() {
    setStep('loading')
    try {
      const session = await AuthService.getSession()
      if (!session?.user) {
        setErrorMsg('You must be signed in to delete your account')
        setStep('error')
        return
      }
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      })
      const result = await response.json()
      if (!response.ok) {
        setErrorMsg(result.error || 'Something went wrong')
        setStep('error')
        return
      }
      await supabase.auth.signOut()
      setStep('done')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error — please try again'
      setErrorMsg(message)
      setStep('error')
    }
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 dark:bg-[var(--color-page-bg)] text-gray-900 dark:text-white">
        <div className="max-w-lg mx-auto px-4 py-12 pb-20">
          <div className="mb-6">
            <BackButton label="Back to ChessDuo" />
          </div>

          {step === 'info' && (
            <>
              <h1 className="text-3xl font-bold mb-2">Delete Account</h1>
              <p className="text-gray-500 dark:text-slate-400 mb-8">
                This will permanently delete your ChessDuo account and all associated data.
              </p>

              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 mb-8 ring-1 ring-gray-200 dark:ring-gray-700">
                <h2 className="font-semibold mb-3">What will be deleted:</h2>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">✕</span>
                    Profile information (username, stats)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">✕</span>
                    Game history and match records
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">✕</span>
                    Friend list and chat messages
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">✕</span>
                    Active rooms and challenges
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">✕</span>
                    Duel game records
                  </li>
                </ul>
                <p className="text-xs text-gray-400 mt-4">
                  This action is irreversible. Your data cannot be recovered.
                </p>
              </div>

              <button
                onClick={() => setStep('confirm')}
                className="w-full min-h-[44px] py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
              >
                Delete My Account
              </button>
            </>
          )}

          {step === 'confirm' && (
            <>
              <h1 className="text-2xl font-bold mb-2">Are you sure?</h1>
              <p className="text-gray-500 dark:text-slate-400 mb-8">
                This cannot be undone. All your data will be permanently erased.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleDelete}
                  className="w-full min-h-[44px] py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
                >
                  Yes, Permanently Delete Everything
                </button>
                <button
                  onClick={() => setStep('info')}
                  className="w-full min-h-[44px] py-3 rounded-xl bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 font-semibold transition-colors"
                >
                  No, Keep My Account
                </button>
              </div>
            </>
          )}

          {step === 'loading' && (
            <div className="text-center py-20">
              <Spinner size="lg" />
              <p className="text-gray-500 dark:text-slate-400">Deleting your account...</p>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl text-green-600">✓</span>
              </div>
              <h1 className="text-2xl font-bold mb-2">Account Deleted</h1>
              <p className="text-gray-500 dark:text-slate-400 mb-8">
                Your account and all associated data have been permanently removed.
              </p>
              <button
                onClick={() => router.push('/')}
                className="inline-block min-h-[44px] py-3 px-6 rounded-xl bg-yellow-600 hover:bg-yellow-700 text-white font-semibold transition-colors"
              >
                Return Home
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl text-red-600">✕</span>
              </div>
              <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
              <p className="text-gray-500 dark:text-slate-400 mb-4">{errorMsg}</p>
              <p className="text-sm text-gray-400 mb-8">
                You can also email chessdoubles27@gmail.com to request manual deletion.
              </p>
              <button
                onClick={() => setStep('info')}
                className="inline-block min-h-[44px] py-3 px-6 rounded-xl bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 font-semibold transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  )
}