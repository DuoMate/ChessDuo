# ClashMate - Project Roadmap

## Overview

**ClashMate** is a real-time multiplayer chess game where two teams (2v2) compete. Each team has 2 players who simultaneously submit moves (hidden from each other), and a chess engine evaluates both moves to pick the winner.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14+ (App Router) + TypeScript |
| UI | Tailwind CSS + React |
| Chess Board | cm-chessboard (web) |
| Chess Logic | chess.js |
| Engine | Stockfish WASM (server-side) |
| Real-time | Supabase (Broadcast + Presence) |
| Auth | Supabase Auth |
| Mobile Bridge | Capacitor (future) |

---

## Development Phases

### Phase 1: Core Game - Local Play (Week 1-2)
**Goal**: Playable local 2v2 game with bot teammate in browser

- [x] 1.1 Setup Next.js project with TypeScript + Tailwind
- [x] 1.2 Integrate chess.js for move validation
- [x] 1.3 Integrate cm-chessboard for board UI
- [x] 1.4 Integrate Stockfish (server-side) for move evaluation
- [ ] 1.5 **Implement Parallel Model (CURRENT)**:
  - [ ] 10-second team timer
  - [ ] Human move applied immediately (prominent)
  - [ ] Bot move as greyed shadow
  - [ ] Both moves visible before resolution
  - [ ] Green/red highlight after accuracy check
  - [ ] Loser retracts to origin
- [ ] 1.6 Basic win/lose/draw detection

**Key Feature**: Human vs Bot teammate (bot plays blind, greyed shadow display)

**Deliverable**: Playable 2v2 local game with bot teammate

---

### Phase 2: Real-Time Multiplayer Infrastructure (Week 3-4)
**Goal**: Backend infrastructure for real-time multiplayer

- [ ] 2.1 Setup Supabase project
- [ ] 2.2 Implement user authentication (Supabase Auth)
- [ ] 2.3 Create game room system
- [ ] 2.4 Implement real-time sync (Supabase Broadcast)
- [ ] 2.5 Track player presence (connected, selecting, locked-in)
- [ ] 2.6 Match flow: team matchmaking, team formation
- [ ] 2.7 Handle disconnects/reconnects

**Deliverable**: Backend ready for real-time multiplayer

---

### Phase 3: Human Teammate (Week 5-6)
**Goal**: Replace bot teammate with real human player

- [ ] 3.1 Integrate Phase 2 infrastructure for teammate connection
- [ ] 3.2 Real human teammate instead of bot
- [ ] 3.3 Same parallel model:
  - Both see same board
  - Both lock moves (or timer expires)
  - Both moves revealed simultaneously
  - Accuracy evaluation and resolution
- [ ] 3.4 Bot opponent remains (for now)
- [ ] 3.5 Full 2v2 human multiplayer

**Key Feature**: Real human teammate via Supabase

**Deliverable**: True 2v2 human multiplayer game

---

### Phase 4: Game Polish (Week 7-8)
**Goal**: Complete game experience with animations and stats

- [ ] 4.1 Move conflict visualization (green/red arrows)
- [ ] 4.2 Losing move retraction animation
- [ ] 4.3 Accuracy display (centipawn loss, percentage)
- [ ] 4.4 Timer system improvements (visual warnings)
- [ ] 4.5 Turn indicator and game status UI
- [ ] 4.6 Team dynamics tracking (sync rate, conflicts)
- [ ] 4.7 Match summary and stats screen
- [ ] 4.8 Basic matchmaking queue

**Deliverable**: Polished, feature-complete game

---

### Phase 5: Launch Features (Week 9-10)
**Goal**: Features needed for public release

- [ ] 5.1 Match history and persistence
- [ ] 5.2 User profiles
- [ ] 5.3 Room codes (shareable game links)
- [ ] 5.4 Performance optimizations
- [ ] 5.5 Error handling and edge cases
- [ ] 5.6 Bot difficulty adjustment

**Deliverable**: Production-ready MVP

---

### Phase 6: Mobile Expansion (Week 11-14)
**Goal**: Native iOS + Android apps

- [ ] 6.1 Setup Capacitor project
- [ ] 6.2 Create mobile-compatible chess board component
- [ ] 6.3 Build mobile UI (responsive design)
- [ ] 6.4 Setup server-side Stockfish API (for mobile)
- [ ] 6.5 Compile mobile apps (iOS .ipa, Android .apk)
- [ ] 6.6 App store submission prep

**Deliverable**: Live iOS and Android apps

---

## Game Flow (Reference)

### Parallel Model Turn Flow

```
1. Match Start
   ├── White Team (Player A1 + Player A2)
   └── Black Team (Player B1 + Player B2)

2. White Team's Turn
   ├── 10-second team timer starts
   ├── Player A1 selects move → Applied to board (prominent)
   ├── Player A2 (teammate) commits → Greyed shadow appears
   ├── BOTH moves visible on board
   ├── Both lock in OR timer expires
   ├── Engine evaluates BOTH moves (blind from turn start)
   ├── Accuracy calculated
   ├── Winner: Green highlight, move stays
   ├── Loser: Red highlight, retracts to origin
   └── Turn passes to Black Team

3. Black Team's Turn
   └── Same process (Player B3 + Player B4)

4. Repeat until checkmate / draw

5. Match End
   ├── Display winner
   ├── Show stats (accuracy, sync rate)
   └── Option to rematch
```

### UI States During Turn

**During Selection:**
- Your move: Prominent piece on destination square
- Teammate's move: Greyed shadow on destination square

**After Resolution:**
- Winner: Green highlight/stay
- Loser: Red highlight → Animate back to origin

---

## Data Models

### Game State
- Board position (FEN)
- `turnStartFen` (position before any tentative moves)
- Current turn (white/black)
- `pendingMoves` (human + teammate moves)
- Timer state (team-level, 10 seconds)
- Move history
- Lock states

### Turn Resolution
```typescript
interface TurnResolution {
  humanMove: string;      // e.g., "e2e4"
  botMove: string;        // e.g., "g1f3"
  humanAccuracy: number;  // 0-100
  botAccuracy: number;   // 0-100
  winner: 'human' | 'bot';
  turnStartFen: string;  // For blind evaluation
}
```

### Match Statistics
- Accuracy per move (centipawn loss)
- Sync rate (same moves / total moves)
- Number of conflicts
- Win/loss/draw

### User Profile
- User ID
- Username
- Match history
- Win rate
- Average accuracy

---

## API Contracts (Phase 2+)

### Client → Server (Supabase)

| Event | Payload |
|-------|---------|
| `join_room` | `{ room_id, user_id }` |
| `select_move` | `{ room_id, move, player_id }` |
| `lock_move` | `{ room_id, player_id }` |
| `start_match` | `{ room_id }` |
| `pending_move_visible` | `{ room_id, player_id, move }` |

### Server → Client (Supabase Broadcast)

| Event | Payload |
|-------|---------|
| `player_joined` | `{ player_id, team }` |
| `move_selected` | `{ player_id }` (no move revealed) |
| `teammate_move_visible` | `{ player_id, move }` (greyed shadow) |
| `both_locked` | `{ move_a, move_b, scores }` |
| `move_applied` | `{ new_position, winner, accuracies }` |
| `game_over` | `{ result, stats }` |

---

## Future Extensions (Post-MVP)

- Voice chat between teammates
- Spectator mode
- Replay system with dual-move visualization
- Tournament mode
- Ranked matchmaking (ELO)
- Multiple game formats (blitz, rapid)
- Social features (friend lists, clans)

---

## Key Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "chess.js": "^1.4.0",
    "cm-chessboard": "^4.0.0",
    "@supabase/supabase-js": "^2.0.0",
    "@supabase/auth-helpers-nextjs": "^0.8.0"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "@testing-library/react": "^14.0.0"
  }
}
```

---

## Milestones

| Milestone | Target | Criteria |
|-----------|--------|----------|
| M1 | Week 2 | Local 2v2 playable with parallel model |
| M2 | Week 4 | Supabase infrastructure ready |
| M3 | Week 6 | True 2v2 human multiplayer |
| M4 | Week 8 | Full game with animations polished |
| M5 | Week 10 | MVP ready for launch |
| M6 | Week 14 | Mobile apps live |

---

## Implementation Notes

### Blind Evaluation (Critical)
- All accuracy calculations use `turnStartFen` (position BEFORE any tentative moves)
- This ensures fair evaluation: neither move influences the other
- Bot teammate plays "blind" - doesn't see human's tentative move

### Team Timer
- 10 seconds per team per turn
- Timer starts when turn begins
- If timer expires, current moves locked as-is
- Creates urgency and prevents stalling

### Bot vs Human Teammate
- Bot: Auto-generates move, appears as greyed shadow immediately
- Human: Move visible when THEY lock (via Supabase broadcast)

---

*Last Updated: 2026-04-11*