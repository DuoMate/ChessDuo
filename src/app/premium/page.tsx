'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function PremiumPage() {
  const router = useRouter()
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [isPremium, setIsPremium] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setPlayerId(session.user.id)
      }
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!playerId) return
    supabase
      .from('profiles')
      .select('is_premium')
      .eq('id', playerId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.is_premium) setIsPremium(true)
      })
  }, [playerId])

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">✨ Premium</h1>
          <button
            onClick={() => router.push('/')}
            className="text-gray-400 hover:text-yellow-400 text-sm"
          >
            ← Home
          </button>
        </div>

        {isPremium ? (
          <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-6 text-center">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-xl font-bold text-green-400 mb-2">You're Premium!</h2>
            <p className="text-gray-400 text-sm">
              Enjoy unlimited move insights, AI analysis, and all premium features.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-gray-800 border border-yellow-400/30 rounded-lg p-6 text-center mb-6">
              <div className="text-3xl mb-3">♟️</div>
              <h2 className="text-xl font-bold text-yellow-400 mb-2">ChessDuo Premium</h2>
              <p className="text-gray-400 text-sm mb-4">
                Take your game to the next level with AI-powered analysis.
              </p>

              <div className="grid gap-3 mb-6">
                <FeatureRow icon="🔍" title="Unlimited Move Insights" desc="See why a move won or lost — every turn" />
                <FeatureRow icon="🤖" title="AI Position Analysis" desc="Stockfish-powered positional breakdown" />
                <FeatureRow icon="📊" title="Advanced Stats" desc="Per-player accuracy trends, ELO estimates" />
                <FeatureRow icon="🎯" title="Best Move Suggestions" desc="Engine-recommended alternatives" />
                <FeatureRow icon="♾️" title="No Reveal Limits" desc="Unlimited insights, every game" />
              </div>

              <div className="text-center text-gray-500 text-sm">
                <p>Coming soon — contact us for early access</p>
                <p className="text-xs mt-1">chessduo@proton.me</p>
              </div>
            </div>

            <div className="text-center text-xs text-gray-600">
              Currently offering 3 free insights per account.
            </div>
          </>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/profile')}
            className="text-gray-500 hover:text-yellow-400 text-sm"
          >
            👤 Profile
          </button>
        </div>
      </div>
    </div>
  )
}

function FeatureRow({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 text-left p-2 rounded-lg bg-gray-700/50">
      <span className="text-lg flex-shrink-0">{icon}</span>
      <div>
        <p className="text-white text-sm font-medium">{title}</p>
        <p className="text-gray-500 text-xs">{desc}</p>
      </div>
    </div>
  )
}
