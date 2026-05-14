const requestCounts = new Map<string, { count: number; resetAt: number }>()

const WINDOW_MS = 60_000
const DEFAULT_MAX = 60

const ENDPOINT_LIMITS: Record<string, number> = {
  '/api/healthz': 300,
  '/api/test-supabase': 30,
}

export function checkRateLimit(identifier: string, maxRequests: number = DEFAULT_MAX): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  const entry = requestCounts.get(identifier)

  if (!entry || now > entry.resetAt) {
    requestCounts.set(identifier, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, remaining: maxRequests - 1, resetIn: WINDOW_MS }
  }

  entry.count++

  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, resetIn: entry.resetAt - now }
  }

  return { allowed: true, remaining: maxRequests - entry.count, resetIn: entry.resetAt - now }
}

export function applyRateLimit(request: Request): Response | null {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
  const path = new URL(request.url).pathname

  const max = ENDPOINT_LIMITS[path] || DEFAULT_MAX
  const result = checkRateLimit(`${ip}:${path}`, max)

  if (!result.allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(result.resetIn / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  return null
}
