import { NextRequest, NextResponse } from 'next/server'
import { applyRateLimit } from '@/lib/rateLimit'

export async function POST(request: NextRequest) {
  const rateLimitResponse = applyRateLimit(request)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json()
    console.error('[CrashReport]', JSON.stringify(body, null, 2))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}
