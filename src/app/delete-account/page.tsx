'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function DeleteAccountPage() {
  const router = useRouter()
  const [step, setStep] = useState<'info' | 'confirm' | 'loading' | 'done' | 'error'>('info')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleDelete() {
    setStep('loading')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setErrorMsg('You must be signed in to delete your account')
        setStep('error')
        return
      }
      const { error: rpcError } = await supabase.rpc('delete_my_account')
      if (rpcError) {
        setErrorMsg(rpcError.message || 'Something went wrong')
        setStep('error')
        return
      }
      await supabase.auth.signOut()
      setStep('done')
    } catch {
      setErrorMsg('Network error — please try again')
      setStep('error')
    }
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="max-w-lg mx-auto px-4 py-12">
        <Link
          href="/"
          className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 text-sm mb-6 inline-block"
        >
          ← Back to ChessDuo
        </Link>

        {step === 'info' && (
          <>
            <h1 className="text-3xl font-bold mb-2">Delete Account</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-8">
              This will permanently delete your ChessDuo account and all associated data.
            </p>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-8 ring-1 ring-gray-200 dark:ring-gray-700">
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
              className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
            >
              Delete My Account
            </button>
          </>
        )}

        {step === 'confirm' && (
          <>
            <h1 className="text-2xl font-bold mb-2">Are you sure?</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-8">
              This cannot be undone. All your data will be permanently erased.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleDelete}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
              >
                Yes, Permanently Delete Everything
              </button>
              <button
                onClick={() => setStep('info')}
                className="w-full py-3 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold transition-colors"
              >
                No, Keep My Account
              </button>
            </div>
          </>
        )}

        {step === 'loading' && (
          <div className="text-center py-20">
            <div className="animate-spin w-10 h-10 border-4 border-yellow-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Deleting your account...</p>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl text-green-600">✓</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Account Deleted</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-8">
              Your account and all associated data have been permanently removed.
            </p>
            <Link
              href="/"
              className="inline-block py-3 px-6 rounded-xl bg-yellow-600 hover:bg-yellow-700 text-white font-semibold transition-colors"
            >
              Return Home
            </Link>
          </div>
        )}

        {step === 'error' && (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl text-red-600">✕</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-4">{errorMsg}</p>
            <p className="text-sm text-gray-400 mb-8">
              You can also email chessdoubles27@gmail.com to request manual deletion.
            </p>
            <button
              onClick={() => setStep('info')}
              className="inline-block py-3 px-6 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold transition-colors"
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
