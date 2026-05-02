# ClashMate Game Log Format Specification

## Overview

This document defines the data format for storing ClashMate 2v2 team chess game history. The format captures both moves from each team turn, accuracy scores, and timing data to enable replay and analytics.

## Design Goals

- **Compact** - Flat array structure, minimal field names
- **Complete** - Stores both moves per turn (winner + loser)
- **Replay-ready** - Contains all data needed to reconstruct game state and animations
- **Analytics-friendly** - Enables team dynamics calculations (sync rate, accuracy)

---

## Game Log Format

### Structure

```json
[
  {"t":1,"team":"A","p":"A1","m":"e2e4","ts":2.1},
  {"t":1,"team":"A","p":"A2","m":"e2e4","ts":5.4},
  {"t":1,"team":"A","p":"F","m":"e2e4","ts":5.4,"a1":0.85,"a2":0.85,"w":"A1"},

  {"t":1,"team":"B","p":"B2","m":"c7c5","ts":1.3},
  {"t":1,"team":"B","p":"B1","m":"d7d5","ts":4.2},
  {"t":1,"team":"B","p":"F","m":"d7d5","ts":4.2,"a1":0.72,"a2":0.81,"w":"B2"}
]
```

### Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `t` | integer | Yes | Turn number (1, 2, 3...) |
| `team` | string | Yes | Team identifier (`A` = White, `B` = Black) |
| `p` | string | Yes | Player identifier (`A1`/`A2` = teammates, `F` = final/resolution) |
| `m` | string | Yes | Move in UCI format (`e2e4`, `g1f3`, `e7e8q`) |
| `ts` | float | Yes | Timestamp in seconds (when move was locked in) |
| `a1` | float | Only for F | Player 1 accuracy (0-1 scale, 1 = perfect) |
| `a2` | float | Only for F | Player 2 accuracy (0-1 scale, 1 = perfect) |
| `w` | string | Only for F | Winner (`A1` or `A2` - which player had higher accuracy) |

### Player Identifiers

- `A1` = Team A player 1
- `A2` = Team A player 2
- `B1` = Team B player 1
- `B2` = Team B player 2
- `F` = Final resolution entry (created after both players lock in)

### Move Format (UCI)

Uses UCI (Universal Chess Interface) format from Stockfish engine:
- Basic: `e2e4` (from-to)
- Promotion: `e7e8q` (from-to-promotion)
- Castling: `e1g1` (king rook-side), `e1c1` (queen-side)

### Turn Sequence Example

```
Turn 1 - Team A (White):
1. A1 submits move @ 2.1s
2. A2 submits move @ 5.4s  
3. F created @ 5.4s with accuracy scores and winner

Turn 1 - Team B (Black):
1. B2 submits move @ 1.3s
2. B1 submits move @ 4.2s
3. F created @ 4.2s with accuracy scores and winner
```

---

## Accuracy Calculation

### Formula

```
accuracy = 1 - ((centipawn_loss - 10) / 290)
```

Where:
- `centipawn_loss` = difference between player's move score and best engine move score
- Clamped: 100% if loss ≤ 10cp, 0% if loss ≥ 300cp

### Accuracy Fields in F Entry

```json
{"t":1,"team":"A","p":"F","m":"e2e4","ts":5.4,"a1":0.85,"a2":0.72,"w":"A1"}
```

- `a1: 0.85` = Player A1 had 85% accuracy (move selected)
- `a2: 0.72` = Player A2 had 72% accuracy (move rejected)
- `w: "A1"` = A1 won (higher accuracy)

---

## Sync Detection

When both teammates pick the same move:

```json
{"t":1,"team":"A","p":"A1","m":"e2e4","ts":2.1},
{"t":1,"team":"A","p":"A2","m":"e2e4","ts":5.4},
{"t":1,"team":"A","p":"F","m":"e2e4","ts":5.4,"a1":0.85,"a2":0.85,"w":"A1"}
```

Detected when `A1.move === A2.move`. In this case:
- Both accuracy values may differ (different timing, engine evaluation at different depths)
- Winner is first player by default (can also be random or time-based)

---

## Conflict Detection

When teammates pick different moves:

```json
{"t":1,"team":"B","p":"B2","m":"c7c5","ts":1.3},
{"t":1,"team":"B","p":"B1","m":"d7d5","ts":4.2},
{"t":1,"team":"B","p":"F","m":"d7d5","ts":4.2,"a1":0.72,"a2":0.81,"w":"B2"}
```

- B1 played `c7c5` (72% accuracy)
- B2 played `d7d5` (81% accuracy) - **WINNER**
- Conflict recorded for analytics

---

## Player Metadata File

Player information stored separately (linked by match_id):

```json
{
  "match_id": "abc123",
  "teams": {
    "A": [
      {"id": "A1", "name": "Alice", "elo": 1800, "avatar": "url"},
      {"id": "A2", "name": "Bob", "elo": 1750, "avatar": "url"}
    ],
    "B": [
      {"id": "B1", "name": "Charlie", "elo": 1820},
      {"id": "B2", "name": "Diana", "elo": 1790}
    ]
  }
}
```

**Benefits**:
- Update player info without modifying game logs
- Smaller game logs = faster processing
- GDPR: can delete player data while keeping game data

---

## Database Schema

### Matches Table (extend)

```sql
ALTER TABLE matches ADD COLUMN game_log JSONB;
```

### Indexes

```sql
CREATE INDEX idx_game_log_match ON matches USING GIN (game_log);
CREATE INDEX idx_game_log_turn ON matches USING GIN (game_log->>'t');
```

---

## Analytics Derived from Game Log

### Sync Rate

```
sync_count = number of turns where A1.move === A2.move (or B1 === B2)
total_turns = count of F entries
sync_rate = sync_count / total_turns
```

### Average Accuracy

```
avg_accuracy_A1 = sum(a1 from all F entries where team=A) / count(F entries where team=A)
```

### Conflict Rate

```
conflict_count = number of turns where A1.move !== A2.move
conflict_rate = conflict_count / total_turns
```

---

## Replay System

The game log enables full game replay:

1. **Load initial FEN** - Starting position
2. **Iterate through log entries** - In order
3. **For each turn**:
   - Show both moves as shadow overlays
   - Display accuracy comparison
   - Animate winner to final position
   - Fade loser back to origin
4. **At end** - Show final position + game result

### Replay Animation Data from Log

| Log Data | Animation Use |
|----------|---------------|
| `A1.m`, `A2.m` | Show both shadow moves |
| `A1.ts`, `A2.ts` | Timing of each submission |
| `F.m` | Winning move to apply |
| `F.a1`, `F.a2` | Accuracy comparison display |
| `F.w` | Which move won |

---

## Example Full Game

```json
{
  "match_id": "match_001",
  "started_at": "2025-05-02T12:00:00Z",
  "game_log": [
    {"t":1,"team":"A","p":"A1","m":"e2e4","ts":2.1},
    {"t":1,"team":"A","p":"A2","m":"e2e4","ts":5.4},
    {"t":1,"team":"A","p":"F","m":"e2e4","ts":5.4,"a1":0.85,"a2":0.85,"w":"A1"},
    {"t":1,"team":"B","p":"B2","m":"c7c5","ts":1.3},
    {"t":1,"team":"B","p":"B1","m":"d7d5","ts":4.2},
    {"t":1,"team":"B","p":"F","m":"d7d5","ts":4.2,"a1":0.72,"a2":0.81,"w":"B2"},
    {"t":2,"team":"A","p":"A1","m":"g1f3","ts":3.2},
    {"t":2,"team":"A","p":"A2","m":"b1c3","ts":6.8},
    {"t":2,"team":"A","p":"F","m":"g1f3","ts":6.8,"a1":0.92,"a2":0.88,"w":"A1"},
    // ... continues
  ],
  "outcome": "1-0",
  "reason": "checkmate"
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-05-02 | Initial specification |