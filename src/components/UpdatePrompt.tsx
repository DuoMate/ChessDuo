'use client'

import { memo } from 'react'
import { ArrowUpCircle, RefreshCw } from 'lucide-react'

interface UpdatePromptProps {
  open: boolean
  notes?: string
  flowState?: 'idle' | 'downloading' | 'downloaded' | 'installing' | 'installed' | 'failed' | 'canceled' | 'pending' | 'unknown'
  onUpdate: () => void
  onRestart?: () => void
  onLater: () => void
}

/**
 * Optional native-update prompt. Rendered only when useAppUpdate reports
 * `optional` outside games/auth flows. Matches existing modal styling.
 *
 * With the native Google Play In-App Update flow, "Update" starts the official
 * flexible download (Play owns the download UI); once the install listener
 * reports DOWNLOADED the dialog switches to "Restart to update", which calls
 * `completeUpdate()`. "Later" and Play's own cancellation are normal user
 * choices and keep the app fully usable.
 */
function UpdatePromptInner({
  open,
  notes,
  flowState = 'idle',
  onUpdate,
  onRestart,
  onLater,
}: UpdatePromptProps) {
  if (!open) return null

  const downloaded = flowState === 'downloaded' || flowState === 'installing'
  const inProgress =
    flowState === 'downloading' || flowState === 'installing' || flowState === 'pending'

  const body = downloaded ? (
    <>
      <h2
        id="app-update-title"
        className="text-base font-bold text-slate-900 dark:text-white"
      >
        Update ready to install
      </h2>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        ChessDuo has been downloaded. Restart to install the new version.
      </p>
    </>
  ) : (
    <>
      <h2
        id="app-update-title"
        className="text-base font-bold text-slate-900 dark:text-white"
      >
        New version available
      </h2>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {inProgress
          ? 'Downloading the update in the background…'
          : 'ChessDuo has been updated with improvements and fixes.'}
      </p>
    </>
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-update-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-950/60 dark:bg-black/70"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-500/15 flex items-center justify-center flex-shrink-0">
            <ArrowUpCircle size={22} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">{body}</div>
        </div>

        {!downloaded && !inProgress && notes ? (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 line-clamp-3">
            {notes}
          </p>
        ) : null}

        <div className="mt-4 flex gap-2">
          <button
            onClick={onLater}
            className="focus-ring flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            Later
          </button>
          {downloaded ? (
            <button
              onClick={onRestart}
              className="focus-ring flex-1 min-h-[44px] rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              {flowState === 'installing' ? (
                'Installing…'
              ) : (
                <>
                  <RefreshCw size={14} className="mr-1 inline" aria-hidden="true" />
                  Restart
                </>
              )}
            </button>
          ) : (
            <button
              onClick={onUpdate}
              disabled={inProgress}
              className="focus-ring flex-1 min-h-[44px] rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              Update
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export const UpdatePrompt = memo(UpdatePromptInner)
