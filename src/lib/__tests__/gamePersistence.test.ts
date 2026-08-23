import { saveGameState, loadGameState } from '../gamePersistence'

// ---------------------------------------------------------------------------
// Schema-drift resilience: the FE may deploy before the DB migration lands
// (exactly what happened with games.last_human_resolution / ADR-005). When a
// column is missing server-side (PGRST204), the WHOLE query fails — which used
// to freeze the games row at its starting FEN and silently disable every
// authoritative re-sync ("No saved state for room"). These tests pin the
// contract: board-critical columns must persist and load even pre-migration.
// ---------------------------------------------------------------------------

interface ExistingRowResult { data: unknown; error: unknown }
let existingRowResult: ExistingRowResult = { data: null, error: null }
let fullSelectResult: ExistingRowResult = { data: null, error: null }
let coreSelectResult: ExistingRowResult = { data: null, error: null }
let upsertQueue: Array<ExistingRowResult> = []
const upsertPayloads: Array<Record<string, unknown>> = []

function makeGamesTable() {
  let currentUpsertResult: ExistingRowResult = { data: null, error: null }
  const table = {
    select: jest.fn((columns: string) => {
      if (columns === 'move_history, match_started_at') {
        return { eq: jest.fn(() => ({ maybeSingle: jest.fn(() => Promise.resolve(existingRowResult)) })) }
      }
      if (columns === 'id') {
        // Post-upsert RETURNING id
        return { single: jest.fn(() => Promise.resolve(currentUpsertResult)) }
      }
      const isFullRead = columns.includes('last_human_resolution')
      return {
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(() => Promise.resolve(isFullRead ? fullSelectResult : coreSelectResult)),
        })),
      }
    }),
    upsert: jest.fn((payload: Record<string, unknown>) => {
      upsertPayloads.push(payload)
      currentUpsertResult = upsertQueue.shift() ?? { data: null, error: null }
      return table
    }),
  }
  return table
}

jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn((table: string) => {
      if (table === 'games') return makeGamesTable()
      return { select: jest.fn(), upsert: jest.fn() }
    }),
  },
}))

jest.mock('../debug', () => ({ DEBUG: false }))

jest.mock('@/features/shared/gameTrace', () => ({
  emitTrace: jest.fn(),
}))

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

beforeEach(() => {
  existingRowResult = { data: null, error: null }
  fullSelectResult = { data: null, error: null }
  coreSelectResult = { data: null, error: null }
  upsertQueue = []
  upsertPayloads.length = 0
})

describe('saveGameState schema-drift fallback', () => {
  it('retries once WITHOUT optional resolution columns when PGRST204 hits', async () => {
    upsertQueue.push(
      { data: null, error: { code: 'PGRST204', message: "Could not find the 'last_human_resolution' column of 'games' in the schema cache" } },
      { data: { id: 'game-1' }, error: null },
    )

    const gameId = await saveGameState(
      'room-1', START_FEN, 'WHITE',
      { team: 'WHITE', move: 'e4', fen_before: START_FEN, fen_after: 'e4-after', timestamp: new Date().toISOString() },
      'PLAYING', undefined, undefined, 1, 'player-1',
      'e4', // lastResolvedMove — optional column
      { player1Move: 'e4' }, // lastHumanResolution — optional column
    )

    expect(gameId).toBe('game-1')
    expect(upsertPayloads).toHaveLength(2)

    // First attempt carries everything; retry strips ONLY the optional pair.
    expect(upsertPayloads[0]).toHaveProperty('last_human_resolution')
    expect(upsertPayloads[0]).toHaveProperty('last_resolved_move')
    expect(upsertPayloads[1]).not.toHaveProperty('last_human_resolution')
    expect(upsertPayloads[1]).not.toHaveProperty('last_resolved_move')

    // Board-critical state survives the strip.
    expect(upsertPayloads[1]).toEqual(expect.objectContaining({
      room_id: 'room-1',
      fen: START_FEN,
      turn_number: 1,
      coordinator_id: 'player-1',
    }))
  })

  it('throws loudly when even the stripped retry fails', async () => {
    upsertQueue.push(
      { data: null, error: { code: 'PGRST204', message: "Could not find the 'turn_number' column of 'games'" } },
      { data: null, error: { code: 'PGRST204', message: "Could not find the 'turn_number' column of 'games'" } },
    )
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      saveGameState('room-1', START_FEN, 'WHITE', null, 'PLAYING'),
    ).rejects.toThrow('Game upsert failed')

    errorSpy.mockRestore()
  })

  it('does not retry when the failure is not schema drift', async () => {
    upsertQueue.push({ data: null, error: { code: '42501', message: 'row-level security policy' } })
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      saveGameState('room-1', START_FEN, 'WHITE', null, 'PLAYING'),
    ).rejects.toThrow('Game upsert failed')

    expect(upsertPayloads).toHaveLength(1)
    errorSpy.mockRestore()
  })
})

describe('loadGameState schema-drift fallback', () => {
  it('retries with core columns when the full-column read hits PGRST204', async () => {
    fullSelectResult = {
      data: null,
      error: { code: 'PGRST204', message: "Could not find the 'last_human_resolution' column of 'games' in the schema cache" },
    }
    coreSelectResult = {
      data: {
        id: 'game-1',
        fen: START_FEN,
        current_turn: 'BLACK',
        move_history: [{ team: 'WHITE', move: 'e4', fen_before: START_FEN, fen_after: 'x', timestamp: 't' }],
        status: 'PLAYING',
        match_started_at: null,
        match_time_limit_seconds: 600,
        turn_number: 1,
        coordinator_id: 'player-1',
      },
      error: null,
    }

    const saved = await loadGameState('room-1')

    // Authoritative FEN/turn sync still works on an unmigrated schema.
    expect(saved).toEqual(expect.objectContaining({
      gameId: 'game-1',
      fen: START_FEN,
      currentTurn: 'BLACK',
      turnNumber: 1,
      coordinatorId: 'player-1',
    }))
    expect(saved?.lastHumanResolution).toBeNull()
  })

  it('reports QUERY_ERROR vs NO_VISIBLE_ROW distinctly (RLS-filtered rows return null,null)', async () => {
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {})

    fullSelectResult = { data: null, error: null }
    await loadGameState('room-rls-filtered')
    expect(debugSpy).toHaveBeenCalledWith(
      '[PERSIST] No saved state for room:',
      'room-rls-filtered',
      expect.stringContaining('NO_VISIBLE_ROW'),
    )

    fullSelectResult = {
      data: null,
      error: { code: '42P01', message: 'relation "games" does not exist' },
    }
    await loadGameState('room-broken')
    expect(debugSpy).toHaveBeenCalledWith(
      '[PERSIST] No saved state for room:',
      'room-broken',
      expect.stringContaining('QUERY_ERROR'),
    )
    debugSpy.mockRestore()
  })
})
