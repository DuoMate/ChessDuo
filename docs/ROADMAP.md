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
| Engine | stockfish.wasm (client-side) |
| Real-time | Supabase (Broadcast + Presence) |
| Auth | Supabase Auth |
| Mobile Bridge | Capacitor (future) |

---

## Development Phases

### Phase 1: Core Game (Weeks 1-2)
**Goal**: Playable local 2v2 game in browser

- [ ] 1.1 Setup Next.js project with TypeScript + Tailwind
- [ ] 1.2 Integrate chess.js for move validation
- [ ] 1.3 Integrate cm-chessboard for board UI
- [ ] 1.4 Integrate stockfish.wasm for move evaluation
- [ ] 1.5 Implement game state machine (turns, moves, lock-in)
- [ ] 1.6 Implement move comparison logic (engine scores)
- [ ] 1.7 Local game flow: both players pick → engine picks winner
- [ ] 1.8 Basic win/lose/draw detection

**Deliverable**: Playable 2v2 local game in browser

---

### Phase 2: Real-Time Multiplayer (Weeks 3-4)
**Goal**: Two players on different computers can play together

- [ ] 2.1 Setup Supabase project
- [ ] 2.2 Implement user authentication (Supabase Auth)
- [ ] 2.3 Create game room system
- [ ] 2.4 Implement real-time sync (Supabase Broadcast)
- [ ] 2.5 Track player presence (connected, selecting, locked-in)
- [ ] 2.6 Match flow: team matchmaking, team formation
- [ ] 2.7 Handle disconnects/reconnects

**Deliverable**: Real-time 2v2 multiplayer over the internet

---

### Phase 3: Game Polish (Weeks 5-6)
**Goal**: Complete game experience with animations and stats

- [ ] 3.1 Move conflict visualization (blue/red arrows)
- [ ] 3.2 Losing move "shatter" animation
- [ ] 3.3 Accuracy display (centipawn loss)
- [ ] 3.4 Timer system (10s per move)
- [ ] 3.5 Turn indicator and game status UI
- [ ] 3.6 Team dynamics tracking (sync rate, conflicts)
- [ ] 3.7 Match summary and stats screen
- [ ] 3.8 Basic matchmaking queue

**Deliverable**: Polished, feature-complete game

---

### Phase 4: Launch Features (Weeks 7-8)
**Goal**: Features needed for public release

- [ ] 4.1 Bot mode (play vs AI with teammate)
- [ ] 4.2 Match history and persistence
- [ ] 4.3 User profiles
- [ ] 4.4 Room codes (shareable game links)
- [ ] 4.5 Performance optimizations
- [ ] 4.6 Error handling and edge cases

**Deliverable**: Production-ready MVP

---

### Phase 5: Mobile Expansion (Weeks 9-12)
**Goal**: Native iOS + Android apps

- [ ] 5.1 Setup Capacitor project
- [ ] 5.2 Create mobile-compatible chess board component
- [ ] 5.3 Build mobile UI (responsive design)
- [ ] 5.4 Setup server-side Stockfish API (for mobile)
- [ ] 5.5 Compile mobile apps (iOS .ipa, Android .apk)
- [ ] 5.6 App store submission prep

**Deliverable**: Live iOS and Android apps

---

## Game Flow (Reference)

```
1. Match Start
   ├── White Team (Player A1 + Player A2)
   └── Black Team (Player B1 + Player B2)

2. White Team's Turn
   ├── Both teammates see same board
   ├── Both independently select a move (hidden)
   ├── Timer counts down (10s)
   ├── Both lock in moves
   ├── Engine evaluates both moves
   ├── Winning move applied to board
   └── Losing move destroyed (animation)

3. Black Team's Turn
   └── Same process (steps 2a-2f)

4. Repeat until checkmate / draw

5. Match End
   ├── Display winner
   ├── Show stats (accuracy, sync rate)
   └── Option to rematch
```

---

## Data Models

### Game State
- Board position (FEN)
- Current turn (white/black)
- Player selections (hidden until both locked)
- Timer state
- Move history

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

## API Contracts

### Client → Server (Supabase)

| Event | Payload |
|-------|---------|
| `join_room` | `{ room_id, user_id }` |
| `select_move` | `{ room_id, move, player_id }` |
| `lock_move` | `{ room_id, player_id }` |
| `start_match` | `{ room_id }` |

### Server → Client (Supabase Broadcast)

| Event | Payload |
|-------|---------|
| `player_joined` | `{ player_id, team }` |
| `move_selected` | `{ player_id }` (no move revealed) |
| `both_locked` | `{ move_a, move_b, scores }` |
| `move_applied` | `{ new_position, winner }` |
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
    "stockfish.wasm": "^0.10.0",
    "@supabase/supabase-js": "^2.0.0",
    "@supabase/auth-helpers-nextjs": "^0.8.0"
  }
}
```

---

## Milestones

| Milestone | Target | Criteria |
|-----------|--------|----------|
| M1 | Week 2 | Local 2v2 playable |
| M2 | Week 4 | Real-time multiplayer works |
| M3 | Week 6 | Full game with animations |
| M4 | Week 8 | MVP ready for launch |
| M5 | Week 12 | Mobile apps live |

---

*Last Updated: 2026-03-27*
