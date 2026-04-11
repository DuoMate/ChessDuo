# Phase 1 Implementation: Move Evaluation & Best Move Selection

## Overview

This document describes the implementation of the move evaluation and best move selection system for ChessDuo/ClashMate using the **Parallel Model**.

## Core Concept: True Simultaneous Decision Making

In the parallel model:
- **No sequential waiting** - Human and teammate (bot or human) make decisions simultaneously
- **Both moves visible** - Once teammate commits, both moves appear on the board
- **Blind evaluation** - Accuracy calculated from original position (before any tentative moves)
- **Fair scoring** - Each move judged independently against optimal, not against each other

---

## Turn Flow

### Human + Bot Teammate Turn (WHITE Team)

```
TURN START (10-second team timer begins)
    │
    ├── Human selects move (e.g., e4)
    │   └── Move IS applied to board immediately (prominent piece)
    │
    ├── Bot generates move (blind to human's move)
    │   └── Move appears as greyed shadow on board (Nf3)
    │
    ├── BOTH moves now visible on board:
    │   ├── Human's move: Prominent (dark/colored)
    │   └── Teammate's move: Greyed shadow
    │
    ├── Both locked OR Timer expires
    │
    ├── ENGINE EVALUATION (Blind - from original position):
    │   ├── Get optimal move/score from original FEN
    │   ├── Evaluate human's move against optimal → accuracy
    │   └── Evaluate bot's move against optimal → accuracy
    │
    ├── RESOLUTION:
    │   ├── Higher accuracy wins
    │   ├── Winner: Green highlight, move stays
    │   └── Loser: Red highlight, retracts to origin
    │
    └── Turn passes to BLACK team
```

### Human + Human Teammate Turn (WHITE Team) - Phase 3

```
TURN START (10-second team timer begins)
    │
    ├── Player 1 (You): Select move → Applied to YOUR board (prominent)
    │
    ├── Player 2 (Teammate): Select move → Greyed shadow on YOUR board
    │   └── (You don't see their move until THEY commit/lock)
    │
    ├── Both locked OR Timer expires
    │
    ├── ENGINE EVALUATION (Same as above)
    │
    ├── RESOLUTION (Same as above)
    │
    └── Turn passes to BLACK team
```

### Opponent Team Turn (BLACK Team) - Bot Only

```
TURN START
    │
    ├── Opponent Bot (Player 3): Generates move (blind)
    ├── Opponent Bot (Player 4): Same move → Auto-locked
    │
    ├── Moves resolved (same evaluation process)
    │
    └── Turn passes to WHITE team
```

---

## Key Components

### 1. Human Move (player1)
- Selects move → **Applied to board immediately (prominent)**
- Move is visible to human right away
- Can be changed until locked

### 2. Teammate Move (player2)
- **Greyed shadow overlay** - visible but "tentative"
- Bot: Appears when bot generates move
- Human: Appears when teammate locks their move

### 3. Blind Evaluation System
- **CRITICAL**: All evaluation uses `turnStartFen` (position BEFORE any tentative moves)
- Neither move influences the evaluation of the other
- Fair comparison: each move vs optimal from same position

### 4. 10-Second Team Timer
- **Per-team timer**: 10 seconds total for the entire team per turn
- Both players must lock before timer expires
- If timer expires: current moves locked as-is
- Creates urgency and prevents stalling

### 5. Resolution & Animation
```
Both locked (or timer=0)
    │
    ├── Accuracy calculated:
    │   ├── Your move: X% (green if winner)
    │   └── Teammate move: Y%
    │
    ├── Winner: Green highlight, stays on board
    │
    └── Loser: Red highlight → Animates back to origin square
```

---

## Accuracy Formula

### Lichess Hyperbolic Formula
```typescript
accuracy = Math.max(0, 100 * 200 / (centipawnLoss + 200))

// At 0cp loss:   100% accuracy (perfect)
// At 10cp loss:  95% accuracy
// At 50cp loss:  80% accuracy
// At 100cp loss: 67% accuracy
// At 200cp loss: 50% accuracy
// At 500cp loss: 29% accuracy (blunder)
```

### Centipawn Loss Calculation
```typescript
centipawnLoss = Math.abs(optimalScore - moveScore)
```

### Why Blind Evaluation Matters
- If human plays e4 (centipawn +100), and bot counters with Nf3
- **Old model**: Bot's move evaluated against position AFTER e4
- **New model**: Both moves evaluated against original position
- **Fair**: Bot doesn't get credit for "countering" human's move

---

## ELO-Based Bot Selection

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

  if (Math.random() < bestMoveChance) {
    return evaluatedMoves[0].move  // Best move
  }

  const topMovesCount = Math.min(Math.ceil(5 / skillLevel) + 1, evaluatedMoves.length)
  const randomIndex = Math.floor(Math.random() * topMovesCount)
  return evaluatedMoves[randomIndex].move
}
```

---

## UI Specifications

### During Selection Phase
```
┌─────────────────────────────────────┐
│  WHITE TEAM's Turn     [Timer: 8s]  │
├─────────────────────────────────────┤
│                                     │
│         [Chess Board]                │
│    ♞ (you, prominent) on e4        │  ← Your move (applied)
│    ♞ (grey shadow) on f3           │  ← Teammate's move (greyed)
│                                     │
├─────────────────────────────────────┤
│  Your move: e4 (pending)           │
│  Teammate: Nf3 (pending)           │
└─────────────────────────────────────┘
```

### After Resolution
```
┌─────────────────────────────────────┐
│  WHITE TEAM's Turn     [Timer: 0s]  │
├─────────────────────────────────────┤
│                                     │
│         [Chess Board]               │
│    e4: ♞ [GREEN] ← Winner          │
│    f3: ♞ [RED] ← Retracting        │
│                                     │
├─────────────────────────────────────┤
│  Your move: e4 (♚ 83%)    [WINNER]  │
│  Teammate: Nf3 (♚ 71%)   [LOSER]   │
│                                     │
│         ✓ You won this turn!        │
└─────────────────────────────────────┘
```

### Move Visualization
| Element | Description |
|---------|-------------|
| Your piece | Prominent, dark/colored |
| Teammate's piece | Greyed shadow overlay |
| Winner highlight | Green trace/stay on square |
| Loser highlight | Red trace → Animate to origin |

---

## Files to Modify

### src/lib/gameState.ts
- Add `pendingMoves` tracking (human + teammate)
- Add `turnStartFen` storage
- Add `teamTimer` and timer methods
- Modify `lockMove()` for parallel locking

### src/lib/localGame.ts
- Add `startPendingTurn()` - store original FEN
- Add `submitPendingMove(player, move)` - set tentative move
- Add `lockPendingMove(player)` - lock player's move
- Add `resolvePendingMoves()` - evaluate and resolve
- Change `lockAndResolve()` to use blind evaluation

### src/lib/chessBot.ts
- Ensure bot receives `turnStartFen` (blind)
- Bot does NOT see human's tentative move

### src/components/Game.tsx
- Implement parallel turn flow
- Add team timer UI (10-second countdown)
- Show greyed shadow for teammate's move
- Show green/red resolution animation

### src/components/Timer.tsx (New)
- 10-second countdown display
- Visual warning under 3 seconds

---

## Verification

### Unit Tests
- [ ] Test accuracy formula with various centipawn losses
- [ ] Test blind evaluation (both moves evaluated from same position)
- [ ] Test winner selection (higher accuracy wins)
- [ ] Test loser retraction logic
- [ ] Test team timer expiration
- [ ] Test mate score handling

### Manual Testing
1. Set Master level (6)
2. Human makes obvious blunder (hang a queen)
3. Teammate bot should NOT hang queen (greyed shadow)
4. System should pick teammate's better move
5. Check logs for correct accuracy percentages
6. Verify loser piece retracts to origin

### Expected Logs
```
[Turn Start] fen: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
[Pending] Player1: e2e4 (applied to board)
[Pending] Player2: g1f3 (greyed shadow)
[Lock] Both locked - resolving...
[Evaluate] OriginalFen: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
[Evaluate] Optimal score: 25
[Accuracy] Player1: Qxd5 loss=250 acc=29%
[Accuracy] Player2: Nf3 loss=10 acc=83%
[Result] Player2 wins (83% > 29%)
[Animation] Player1: Red → Retract to e2
[Animation] Player2: Green → Stay on f3
```

---

## Next Phases

### Phase 2: Real-Time Multiplayer
- Supabase integration for real-time sync
- Replace local state with broadcasted moves
- Real human teammate instead of bot

### Phase 3: Human Teammate
- Replace bot teammate with human player
- Same evaluation and selection logic
- Real-time collaboration via Supabase
- Timer still per-team

### Phase 4: Advanced Features
- Post-game analysis
- Move history with annotations
- Multi-game statistics
- Voice chat between teammates

### Phase 5: Mobile Expansion
- Native iOS + Android apps
- Capacitor integration
- Server-side Stockfish for mobile