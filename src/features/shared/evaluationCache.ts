/**
 * Move evaluation cache keyed by FEN
 * Avoids redundant Stockfish HTTP calls for same position
 */

class EvaluationCache {
  private cache: Map<string, Map<string, number>> = new Map()
  private accessOrder: string[] = []
  private readonly MAX_FENS = 100

  getScore(fen: string, move: string): number | null {
    const moveScores = this.cache.get(fen)
    if (moveScores && moveScores.has(move)) {
      const score = moveScores.get(move)!
      this.touch(fen)
      console.log(`[CACHE] Hit for FEN ${fen.substring(0, 30)}... move ${move}=${score}`)
      return score
    }
    return null
  }

  setScores(fen: string, scores: Array<{ move: string; score: number }>): void {
    if (!this.cache.has(fen)) {
      if (this.cache.size >= this.MAX_FENS) {
        const oldest = this.accessOrder.shift()
        if (oldest) {
          this.cache.delete(oldest)
          console.log(`[CACHE] Evicted oldest FEN: ${oldest.substring(0, 30)}...`)
        }
      }
      this.cache.set(fen, new Map())
    }

    const moveScores = this.cache.get(fen)!
    for (const { move, score } of scores) {
      moveScores.set(move, score)
    }
    this.touch(fen)
    console.log(`[CACHE] Stored ${scores.length} scores for FEN ${fen.substring(0, 30)}...`)
  }

  private touch(fen: string): void {
    const idx = this.accessOrder.indexOf(fen)
    if (idx > -1) this.accessOrder.splice(idx, 1)
    this.accessOrder.push(fen)
  }

  clear(): void {
    this.cache.clear()
    this.accessOrder = []
    console.log('[CACHE] Cleared all entries')
  }

  get size(): number {
    return this.cache.size
  }
}

export const evaluationCache = new EvaluationCache()
