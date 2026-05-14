import { applyRateLimit } from '@/lib/rateLimit'

export function GET(request: Request) {
  const rateLimitResponse = applyRateLimit(request)
  if (rateLimitResponse) return rateLimitResponse

  return Response.json({ status: 'ok' })
}
