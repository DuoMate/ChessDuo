import { COACH_MOVE_RANKS, getCoachRank, toCoachHighlights } from '../coachMoveRanks'

describe('coachMoveRanks', () => {
  test('defines 3 ranks with number + text labels (never color-only)', () => {
    expect(COACH_MOVE_RANKS).toHaveLength(3)
    expect(COACH_MOVE_RANKS[0]).toMatchObject({ rank: 1, label: 'Best' })
    expect(COACH_MOVE_RANKS[1]).toMatchObject({ rank: 2 })
    expect(COACH_MOVE_RANKS[2]).toMatchObject({ rank: 3 })
    for (const r of COACH_MOVE_RANKS) {
      expect(r.label.length).toBeGreaterThan(0)
      expect(r.shortLabel.length).toBeGreaterThan(0)
    }
  })

  test('getCoachRank returns metadata per index', () => {
    expect(getCoachRank(0).rank).toBe(1)
    expect(getCoachRank(1).rank).toBe(2)
    expect(getCoachRank(2).rank).toBe(3)
  })

  test('toCoachHighlights maps topMoves UCI to from/to/rank', () => {
    const out = toCoachHighlights([
      { san: 'e4', uci: 'e2e4', display: '+0.2' },
      { san: 'Nf3', uci: 'g1f3', display: '+0.1' },
      { san: 'd4', uci: 'd2d4', display: '+0.0' },
    ])
    expect(out).toEqual([
      { from: 'e2', to: 'e4', rank: 1 },
      { from: 'g1', to: 'f3', rank: 2 },
      { from: 'd2', to: 'd4', rank: 3 },
    ])
  })

  test('toCoachHighlights skips malformed UCI without crashing', () => {
    const out = toCoachHighlights([{ san: 'x', uci: 'bad', display: '' }])
    expect(out).toEqual([])
  })
})
