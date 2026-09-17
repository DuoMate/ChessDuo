'use client'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[var(--color-page-bg)] text-slate-900 dark:text-slate-100 px-4">
      <div role="alert" className="flex flex-col items-center gap-2 max-w-md text-center">
        <h2 className="text-lg font-bold">Something went wrong</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          The page ran into a problem. Try again, or head home — your games are safe.
        </p>
      </div>
      <div className="flex gap-3 mt-2">
        <button
          onClick={reset}
          className="focus-ring min-h-[44px] min-w-[44px] px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-colors"
        >
          Try again
        </button>
        <a
          href="/"
          className="focus-ring min-h-[44px] min-w-[44px] px-6 rounded-xl bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-700 text-sm font-bold flex items-center justify-center transition-colors dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700/60 dark:text-slate-200"
        >
          Go Home
        </a>
      </div>
    </div>
  )
}
