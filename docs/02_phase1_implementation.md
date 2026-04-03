# Phase 1 Implementation: Move Evaluation & Best Move Selection

## Overview

This document describes the current phase implementation of the move evaluation and best move selection system for ChessDuo/ClashMate.

## Turn Flow

```
TURN N (White Team - Human + Teammate):
┌─────────────────────────────────────────────────────────────┐
│ 1. Human makes tentative move (player1)                     │
│ 2. Teammate bot generates move independently (player2)     │
│    - Uses Stockfish with lookahead                          │
│    - Locked ELO level determines move quality                │
│    - NOT aware of human's tentative move (blind generation) │
│ 3. System evaluates:                                        │
│    - Get Stockfish optimal score for current position       │
│    - Evaluate human move: centipawn loss from optimal      │
│    - Evaluate teammate move: centipawn loss from optimal    │
│    - Calculate accuracy using Lichess hyperbolic formula    │
│ 4. Best move wins:                                          │
│    - Higher accuracy = closer to optimal = wins             │
│    - Winner's move stays, loser retracts                    │
│ 5. Opponent (Black Team) responds to final resolved move   │
└─────────────────────────────────────────────────────────────┘

TURN N+1 (Black Team - Opponent Bot):
┌─────────────────────────────────────────────────────────────┐
│ 1. Opponent bot generates move at selected ELO level        │
│ 2. Move is applied directly (no evaluation needed)         │
│ 3. Turn passes back to White Team                          │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Human Move (player1)
- Makes the first tentative move
- Can be any legal chess move
- Move is visible on the board immediately
- May be "overwritten" if teammate's move is better

### 2. Teammate Bot Move (player2)
- Generates move independently (blind to human's move)
- Uses Stockfish with the selected ELO level
- Has lookahead capability (minimax with depth)
- Locked ELO determines move quality:
  - Level 1 (~1500 ELO): 30% best move chance
  - Level 2 (~1600 ELO): 45% best move chance
  - Level 3 (~1700 ELO): 60% best move chance
  - Level 4 (~1800 ELO): 80% best move chance
  - Level 5 (~1900 ELO): 92% best move chance
  - Level 6 (~2000+ ELO): 99% best move chance

### 3. Move Evaluation System
- Uses Stockfish for accurate position evaluation
- Compares each move against the optimal move from ALL legal moves
- Calculates centipawn loss: `|optimalScore - moveScore|`
- Uses Lichess hyperbolic accuracy formula

### 4. Winner Selection
- Winner = move with higher accuracy (lower centipawn loss)
- Winning move stays on the board
- Losing move is discarded/retracted
- Tie-breaker: random selection (edge case)

### 5. Opponent Bot (Black Team)
- Plays after the winning move is resolved
- Uses separate ELO configuration (same as teammate)
- Sees only the final resolved move

## Accuracy Formula

### Old Formula (Too Generous)
```typescript
accuracy = 100 - (centipawnLoss / 10)
// At 100cp loss: 90% accuracy (too generous)
// At 500cp loss: 50% accuracy (blunder shows as mediocre)
```

### New Formula (Lichess Hyperbolic)
```typescript
accuracy = Math.max(0, 100 * centipawnLoss / (centipawnLoss + 200))
// At 10cp loss:  83% accuracy
// At 50cp loss:  71% accuracy
// At 100cp loss: 67% accuracy
// At 500cp loss: 29% accuracy (blunder = blunder)
```

### Why This Matters
- A 500 centipawn loss (hanging a minor piece) should be ~0-10% accuracy, not 50%
- The old formula made blunders look like good moves
- The new formula aligns with how Lichess calculates accuracy

## ELO-Based Selection (applyEloBasedSelection)

The bot uses `bestMoveChance` to determine how often it plays the objectively best move:

| Level | ELO | bestMoveChance | Behavior |
|-------|-----|----------------|----------|
| 1 | ~1500 | 30% | Often makes mistakes, picks from top 5 |
| 2 | ~1600 | 45% | Moderate mistakes, picks from top 4 |
| 3 | ~1700 | 60% | Occasional mistakes, picks from top 3 |
| 4 | ~1800 | 80% | Rare mistakes, picks from top 3 |
| 5 | ~1900 | 92% | Very rare mistakes, picks from top 2 |
| 6 | ~2000+ | 99% | Near-optimal play, usually best |

### Implementation
```typescript
private applyEloBasedSelection(evaluatedMoves): Move {
  const bestMoveChance = skillConfig.bestMoveChance
  
  // Roll for best move
  if (Math.random() < bestMoveChance) {
    return evaluatedMoves[0].move  // Best move
  }
  
  // Otherwise pick from top N based on skill level
  const topMovesCount = Math.min(Math.ceil(5 / skillLevel) + 1, evaluatedMoves.length)
  const randomIndex = Math.floor(Math.random() * topMovesCount)
  return evaluatedMoves[randomIndex].move
}
```

## Files Modified

### src/lib/localGame.ts
- **Accuracy Calculation**: Changed to Lichess hyperbolic formula
- **Winner Selection**: Compare moves against optimal, not against each other
- Added proper centipawn loss calculation

### src/lib/chessBot.ts
- **applyEloBasedSelection**: Fixed to properly use bestMoveChance
- **Top N Selection**: Dynamically calculated based on skill level
- Added detailed logging for move selection

### src/lib/moveEvaluator.ts
- Mate score handling for checkmate positions
- Proper depth/time settings per skill level
- Stockfish Skill Level UCI parameter for blunder control

### src/components/Game.tsx
- Flow already implements the described turn order
- UI shows move comparison and accuracy after each turn
- Handles promotion pieces correctly

## Verification

### Unit Tests
- Test accuracy formula with various centipawn losses
- Test winner selection when one move is clearly better
- Test tie-breaker behavior
- Test mate score handling

### Manual Testing
1. Set Master level (6)
2. Human makes obvious blunder (hang a queen)
3. Teammate should NOT hang queen
4. System should pick teammate's better move
5. Check logs for correct accuracy percentages

### Expected Logs
```
[Accuracy] Player1: Qxd5 loss=250 acc=29%
[Accuracy] Player2: Nf3 loss=10 acc=83%
[Accuracy] Best: Nf3 score=25
[Select] Player2 wins (83% > 29%)
```

## Next Phases

### Phase 2: Human Teammate
- Replace bot teammate with human player
- Same evaluation and selection logic
- Real-time collaboration interface

### Phase 3: Advanced Features
- Post-game analysis
- Move history with annotations
- Multi-game statistics
