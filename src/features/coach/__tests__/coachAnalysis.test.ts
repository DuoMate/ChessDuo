import { classifyLoss, buildSuggestion, buildFeedback, explainMove } from '../coachAnalysis'
import type { EngineMove } from '../coachEngine'

function move(uci: string, san: string, cp: number | null, mate: number | null): EngineMove {
  return { uci, san, cp, mate, pv: [uci] }
}

describe('coachAnalysis', () => {
  describe('classifyLoss', () => {
    it('maps centipawn loss to the correct verdict tier', () => {
      expect(classifyLoss(0)).toBe('best')
      expect(classifyLoss(10)).toBe('best')
      expect(classifyLoss(30)).toBe('great')
      expect(classifyLoss(70)).toBe('good')
      expect(classifyLoss(150)).toBe('inaccuracy')
      expect(classifyLoss(300)).toBe('mistake')
      expect(classifyLoss(301)).toBe('blunder')
    })
  })

  describe('buildSuggestion', () => {
    it('returns the top 3 moves with player-perspective score labels', () => {
      const top = [
        move('e2e4', 'e4', 30, null),
        move('d2d4', 'd4', 20, null),
        move('g1f3', 'Nf3', 10, null),
        move('c2c4', 'c4', 0, null),
      ]
      const suggestion = buildSuggestion(top)
      expect(suggestion.bestMoveSan).toBe('e4')
      expect(suggestion.topMoves).toHaveLength(3)
      expect(suggestion.topMoves[0]).toEqual({ san: 'e4', uci: 'e2e4', display: '+0.3' })
      expect(suggestion.topMoves[1].display).toBe('+0.2')
      expect(suggestion.evaluationDisplay).toBe('+0.3')
    })

    it('handles mate scores in the evaluation label', () => {
      const suggestion = buildSuggestion([move('e2e4', 'e4', null, 2)])
      expect(suggestion.evaluationDisplay).toBe('M2')
    })

    it('returns an empty suggestion when no moves are provided', () => {
      const suggestion = buildSuggestion([])
      expect(suggestion.topMoves).toHaveLength(0)
      expect(suggestion.bestMoveSan).toBeNull()
      expect(suggestion.evaluationDisplay).toBe('—')
    })
  })

  describe('buildFeedback', () => {
    it('flags a perfect/best move with zero loss', () => {
      const feedback = buildFeedback({
        playerMoveSan: 'e4',
        playerMoveUci: 'e2e4',
        beforeTop: [move('e2e4', 'e4', 30, null)],
        chosen: move('e2e4', 'e4', 30, null),
        afterBest: move('e7e5', 'e5', -10, null),
      })
      expect(feedback.verdict).toBe('best')
      expect(feedback.centipawnLoss).toBe(0)
      expect(feedback.isBlunder).toBe(false)
      expect(feedback.missedBetterMove).toBe(false)
    })

    it('detects an inaccuracy and a missed better move', () => {
      const feedback = buildFeedback({
        playerMoveSan: 'a3',
        playerMoveUci: 'a2a3',
        beforeTop: [move('e2e4', 'e4', 120, null)],
        chosen: move('a2a3', 'a3', 20, null),
        afterBest: move('e7e5', 'e5', -30, null),
      })
      expect(feedback.centipawnLoss).toBe(100)
      expect(feedback.verdict).toBe('inaccuracy')
      expect(feedback.missedBetterMove).toBe(true)
      expect(feedback.isBlunder).toBe(false)
      expect(feedback.bestMoveSan).toBe('e4')
    })

    it('detects a blunder with a large loss', () => {
      const feedback = buildFeedback({
        playerMoveSan: 'Qh5',
        playerMoveUci: 'd1h5',
        beforeTop: [move('e2e4', 'e4', 500, null)],
        chosen: move('d1h5', 'Qh5', -100, null),
        afterBest: move('e7e5', 'e5', -300, null),
      })
      expect(feedback.centipawnLoss).toBe(600)
      expect(feedback.verdict).toBe('blunder')
      expect(feedback.isBlunder).toBe(true)
      expect(feedback.missedBetterMove).toBe(true)
    })

    it('treats a missed mate as a blunder', () => {
      const feedback = buildFeedback({
        playerMoveSan: 'h3',
        playerMoveUci: 'h2h3',
        beforeTop: [move('d8h4', 'Qh4#', null, 1)],
        chosen: move('h2h3', 'h3', 0, null),
        afterBest: move('e7e5', 'e5', -30, null),
      })
      expect(feedback.isBlunder).toBe(true)
      expect(feedback.verdict).toBe('blunder')
    })

    it('renders the after-move evaluation from the player perspective', () => {
      const feedback = buildFeedback({
        playerMoveSan: 'e4',
        playerMoveUci: 'e2e4',
        beforeTop: [move('e2e4', 'e4', 30, null)],
        chosen: move('e2e4', 'e4', 30, null),
        // after the move, opponent is to move at -40 (opponent worse) → player +40
        afterBest: move('e7e5', 'e5', -40, null),
      })
      expect(feedback.evaluationDisplay).toBe('+0.4')
    })
  })

  describe('explainMove', () => {
    it('produces natural-language coaching for each verdict', () => {
      expect(explainMove({ verdict: 'best', playerMoveSan: 'e4', bestMoveSan: 'e4', centipawnLoss: 0 })).toContain('top choice')
      expect(explainMove({ verdict: 'blunder', playerMoveSan: 'Qh5', bestMoveSan: 'e4', centipawnLoss: 600 })).toContain('blunder')
      expect(explainMove({ verdict: 'mistake', playerMoveSan: 'a3', bestMoveSan: 'e4', centipawnLoss: 200 })).toContain('mistake')
    })
  })
})
