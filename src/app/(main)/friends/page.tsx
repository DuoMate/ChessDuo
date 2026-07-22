'use client'

import { useState } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { FriendsPanel } from '@/components/FriendsPanel'
import { BackButton } from '@/components/BackButton'
import { useBadgeCount } from '@/hooks/useBadgeCount'
import { useCapacitorBackButton } from '@/hooks/useCapacitorBackButton'
import { useRouter } from 'next/navigation'
import { AuthGate } from '@/components/AuthGate'

export default function FriendsPage() {
  const router = useRouter()

  useCapacitorBackButton(() => { router.push('/'); return true }, true)

  return (
    <AuthGate variant="page" pageTitle="Friends" pageEmoji="👥" subtitle="Sign in to view your friends" onBack={() => router.push('/')}>
      {(playerId) => <FriendsContent playerId={playerId} />}
    </AuthGate>
  )
}

function FriendsContent({ playerId }: { playerId: string }) {
  const router = useRouter()
  const { unreadBySender } = useBadgeCount(playerId)

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[var(--color-page-bg)] text-white p-4 pb-20">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Friends</h1>
            <BackButton alwaysFallback />
          </div>
          <FriendsPanel
            playerId={playerId}
            unreadBySender={unreadBySender}
            onClose={() => router.push('/')}
          />
        </div>
      </div>
    </ErrorBoundary>
  )
}