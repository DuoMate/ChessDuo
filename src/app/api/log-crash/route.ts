import { NextRequest, NextResponse } from 'next/server'
import { applyRateLimit } from '@/lib/rateLimit'

const ALLOWED_ORIGIN = 'https://chessduo.navron.org'

export async function POST(request: NextRequest) {
  const rateLimitResponse = applyRateLimit(request)
  if (rateLimitResponse) return rateLimitResponse

  const origin = request.headers.get('origin')
  if (origin !== ALLOWED_ORIGIN) {
    return NextResponse.json({ ok: false }, { status: 403 })
  }

  try {
    const body = await request.json()
    if (!body.message || !body.stack) {
      return NextResponse.json({ ok: false, error: 'missing required fields' }, { status: 400 })
    }
    console.error('[CrashReport]', JSON.stringify(body, null, 2))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}
