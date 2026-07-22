'use client'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SettingsPanel } from '@/components/SettingsPanel'
import { BackButton } from '@/components/BackButton'
import { useCapacitorBackButton } from '@/hooks/useCapacitorBackButton'
import { useRouter } from 'next/navigation'
import { AuthGate } from '@/components/AuthGate'

export default function SettingsPage() {
  const router = useRouter()
  useCapacitorBackButton(() => { router.push('/'); return true }, true)

  return (
    <AuthGate variant="page" pageTitle="Settings" pageEmoji="⚙️" subtitle="Sign in to access your settings" onBack={() => router.push('/')}>
      {() => <SettingsContent />}
    </AuthGate>
  )
}

function SettingsContent() {
  const router = useRouter()

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[var(--color-page-bg)] text-white p-4 pb-20">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Settings</h1>
            <BackButton alwaysFallback />
          </div>
          <SettingsPanel onClose={() => router.push('/')} />
        </div>
      </div>
    </ErrorBoundary>
  )
}