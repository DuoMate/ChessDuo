import { reportError } from '../errorReporter'

const ORIGINAL_FETCH = global.fetch

function readRequestBody(): Record<string, unknown> {
  const fetchMock = global.fetch as jest.Mock
  const body = fetchMock.mock.calls[0][1].body
  return JSON.parse(body)
}

describe('errorReporter', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true })
    process.env.NEXT_PUBLIC_APP_VERSION = '1.0.328'
    jest.resetModules()
  })

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH
    delete process.env.NEXT_PUBLIC_APP_VERSION
  })

  it('posts a structured payload to /api/log-crash', async () => {
    await reportError({
      message: 'boom',
      stack: 'at x',
      errorType: 'window_error',
      ctx: { gameId: 'g1', roomId: 'r1', turnNumber: 3 },
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(String(url)).toContain('/api/log-crash')
    expect(init.headers['Content-Type']).toBe('application/json')

    const payload = readRequestBody()
    expect(payload.message).toBe('boom')
    expect(payload.stack).toBe('at x')
    expect(payload.error_type).toBe('window_error')
    expect(payload.platform).toBe('web')
    expect(payload.app_version).toBe('1.0.328')
    expect(payload.route).toBeTruthy()
    expect(payload.game_id).toBe('g1')
    expect(payload.room_id).toBe('r1')
    expect(payload.turn_number).toBe(3)
    expect(payload.timestamp).toBeTruthy()
    expect(payload.session_id).toBeTruthy()
  })

  it('never captures sensitive fields in the payload', async () => {
    await reportError({
      message: 'boom',
      userId: 'real-user-id',
    })

    const payload = readRequestBody()
    // user_id must be hashed/redacted, never the raw id.
    expect(payload.user_id).not.toBe('real-user-id')
    expect(typeof payload.user_id).toBe('string')
    // The payload must not contain any credential-carrying field.
    const payloadKeys = Object.keys(payload).join(',')
    expect(payloadKeys).not.toMatch(/token|password|secret|authorization|refresh/i)
  })

  it('rate-limits to avoid a crash-loop flooding the API', async () => {
    // Fire more than the per-window cap.
    for (let i = 0; i < 25; i++) {
      await reportError({ message: `err ${i}` })
    }
    const calls = (global.fetch as jest.Mock).mock.calls.length
    expect(calls).toBeLessThanOrEqual(21) // cap 20 + possible window edge
    expect(calls).toBeLessThan(25)
  })
})
