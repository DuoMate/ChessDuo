/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

describe('GET /api/creem/return', () => {
  let route: typeof import('../route')
  const SITE_URL = 'https://chessduo.workers.dev'

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_SITE_URL = SITE_URL
    route = await import('../route')
  })

  it('returns an HTML bridge that redirects to the /premium App Link', async () => {
    const request = new NextRequest(`${SITE_URL}/api/creem/return?session_id=sess-1`)
    const res = await route.GET(request)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    const html = await res.text()
    expect(html).toContain(`${SITE_URL}/premium?session_id=sess-1`)
    expect(html).not.toContain('chessduo://')
  })

  it('still bridges to /premium when session_id is missing', async () => {
    const request = new NextRequest(`${SITE_URL}/api/creem/return`)
    const res = await route.GET(request)
    const html = await res.text()
    expect(html).toContain(`${SITE_URL}/premium`)
    expect(html).not.toContain('chessduo://')
  })
})
