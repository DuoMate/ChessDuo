import type { TraceEvent } from '../gameTrace'

describe('gameTrace', () => {
  beforeEach(() => {
    // Force the trace on so events are captured regardless of env.
    ;(process.env as Record<string, string>)['NEXT_PUBLIC_CHESSDUO_TRACE'] = 'true'
    jest.resetModules()
  })

  afterEach(() => {
    delete (process.env as Record<string, string>)['NEXT_PUBLIC_CHESSDUO_TRACE']
  })

  it('emits a deterministic trace event with all required fields', async () => {
    const mod = await import('../gameTrace')
    mod.emitTrace('GAME_CREATED', {
      roomId: 'room-1',
      playerId: 'p1',
      team: 'WHITE',
      color: 'white',
    })

    const buf = mod.getTraceBuffer()
    expect(buf.length).toBeGreaterThanOrEqual(1)
    const evt = buf[buf.length - 1]
    expect(evt.stage).toBe('GAME_CREATED')
    expect(evt.roomId).toBe('room-1')
    expect(evt.playerId).toBe('p1')
    expect(evt.team).toBe('WHITE')
    expect(evt.color).toBe('white')
    expect(evt.eventId).toBeTruthy()
    expect(evt.timestamp).toBeTruthy()
    // Stockfish fields default to null/false when absent.
    expect(evt.stockfish.durationMs).toBeNull()
    expect(evt.stockfish.timeout).toBe(false)
  })

  it('includes stockfish timing/fallback fields when provided', async () => {
    const mod = await import('../gameTrace')
    mod.emitTrace('STOCKFISH_COMPLETED', {
      roomId: 'room-1',
      stockfish: {
        evaluationStartTime: 1000,
        evaluationEndTime: 4000,
        durationMs: 3000,
        fallbackUsed: true,
      },
    })
    const evt = mod.getTraceBuffer()[mod.getTraceBuffer().length - 1]
    expect(evt.stage).toBe('STOCKFISH_COMPLETED')
    expect(evt.stockfish.durationMs).toBe(3000)
    expect(evt.stockfish.fallbackUsed).toBe(true)
  })

  it('assigns a monotonically increasing eventId across emissions', async () => {
    const mod = await import('../gameTrace')
    mod.emitTrace('GAME_STARTED', {})
    mod.emitTrace('TURN_STARTED', {})
    const buf = mod.getTraceBuffer()
    const ids = buf.slice(-2).map((e: TraceEvent) => Number(e.eventId.split('-')[1]))
    expect(ids[1]).toBe(ids[0] + 1)
  })

  it('is a no-op when tracing is disabled', async () => {
    delete (process.env as Record<string, string>)['NEXT_PUBLIC_CHESSDUO_TRACE']
    ;(process.env as Record<string, string>)['NEXT_PUBLIC_CHESSDUO_DIAGNOSTICS'] = 'false'
    const mod = await import('../gameTrace')
    mod.emitTrace('TURN_RESOLVED', {})
    expect(mod.getTraceBuffer().length).toBe(0)
    delete (process.env as Record<string, string>)['NEXT_PUBLIC_CHESSDUO_DIAGNOSTICS']
  })
})
