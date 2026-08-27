import { NextRequest, NextResponse } from 'next/server'
import { applyRateLimit } from '@/lib/rateLimit'
import { recordAppError } from '@/lib/appErrorStore'
import { recordGameTrace } from '@/lib/gameTraceStore'
import { isAllowedOrigin, sanitizeCrashPayload } from '@/lib/crashReportPolicy'

/**
 * CORS preflight for cross-origin crash reports (Capacitor WebView).
 * Returns the allowed origin back (never '*') and does not execute any
 * business logic.
 */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (origin && isAllowedOrigin(origin)) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }
  return new NextResponse(null, { status: 204 })
}

/**
 * Client error/crash ingestion (P0-2).
 *
 * Accepts reports from the web app AND the Capacitor Android WebView. The
 * Capacitor origin is `https://localhost` (see capacitor.config.ts
 * androidScheme), so the origin gate is an allowlist, not a single host.
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = applyRateLimit(request)
  if (rateLimitResponse) return rateLimitResponse

  const origin = request.headers.get('origin')
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json({ ok: false }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid body' }, { status: 400 })
  }

  // Game-lifecycle trace batches are routed to game_traces (append-only).
  if (body?.error_type === 'game_trace' && Array.isArray(body.trace)) {
    await recordGameTrace(body.trace)
    return NextResponse.json({ ok: true })
  }

  const payload = sanitizeCrashPayload(body)
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'missing required fields' }, { status: 400 })
  }

  // Always log a structured line (Cloudflare Worker logs remain a passive sink).
  console.error('[CrashReport]', JSON.stringify(payload))

  // Best-effort persistence into app_errors (append-only; see supabase.sql).
  await recordAppError(payload as unknown as Record<string, unknown>)

  return NextResponse.json({ ok: true })
}
