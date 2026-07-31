/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

describe('GET /api/creem/return', () => {
  let route: typeof import('../route')

  beforeAll(async () => {
    route = await import('../route')
  })

  it('returns an HTML bridge that redirects to the chessduo:// deep link', async () => {
    const request = new NextRequest('https://chessduo.workers.dev/api/creem/return?session_id=sess-1')
    const res = await route.GET(request)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    const html = await res.text()
    expect(html).toContain('chessduo://premium?session_id=sess-1')
  })

  it('still bridges to the app when session_id is missing', async () => {
    const request = new NextRequest('https://chessduo.workers.dev/api/creem/return')
    const res = await route.GET(request)
    const html = await res.text()
    expect(html).toContain('chessduo://premium')
  })
})
