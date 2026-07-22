'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[var(--color-page-bg)] text-slate-100 px-4">
      <div className="flex flex-col items-center gap-2 max-w-md text-center">
        <h2 className="text-lg font-bold">Something went wrong</h2>
        <p className="text-sm text-slate-400">
          {error.message || 'An unexpected error occurred.'}
        </p>
      </div>
      <div className="flex gap-3 mt-2">
        <button
          onClick={reset}
          className="min-h-[44px] min-w-[44px] px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-colors"
        >
          Try again
        </button>
        <a
          href="/"
          className="min-h-[44px] min-w-[44px] px-6 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-200 text-sm font-bold flex items-center justify-center transition-colors"
        >
          Go Home
        </a>
      </div>
    </div>
  )
}
