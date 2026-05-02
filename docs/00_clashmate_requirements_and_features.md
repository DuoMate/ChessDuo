# ♟️ ClashMate (Working Name)
ClashMate is Multiplayer Strategy Gaming where the game redefines 1-1 chess games to group, multiplayer, fun filled gaming experience.

## 🧠 Product Segment

### 🎯 Primary Segment
**Multiplayer Strategy Gaming (Real-time + Social + Competitive)**

ClashMate sits at the intersection of:
- ♟️ Online Chess Platforms
- 🎮 Real-time Multiplayer Games
- 🤝 Cooperative Strategy Games
- ⚔️ Competitive Decision-Based Gameplay

---

### 🧩 Sub-Segments

#### 1. Social / Co-op Gaming
- Players collaborate in real-time
- Emphasis on teamwork and communication
- Comparable to co-op puzzle or strategy games

#### 2. Competitive Skill-Based Gaming
- Accuracy-based decision making
- Skill differentiation via engine evaluation
- Ranked gameplay potential (ELO/MMR)

#### 3. Spectator-Friendly / Streaming Content
- High drama (move clashes)
- Visual conflict (animations, reveals)
- Replayable and shareable moments

---

### 👥 Target Audience

- Casual chess players
- Competitive chess players
- Friends playing together
- Streamers & content creators
- Mobile-first gaming audience

---

## 🚀 Core Features

### 1. ♟️ Team Chess Gameplay
- Two teams compete against each other
- Each team has 2 players (teammates)
- One shared chessboard per match
- Each player independently selects a move (hidden from teammate)
- When it's your team's turn, both teammates submit moves simultaneously

---

### 2. ⚡ Simultaneous Move Submission
- Both players submit moves at the same time
- Moves are hidden until both are locked in
- Creates tension and unpredictability

---

### 3. 🧠 Engine-Based Decision System
- Moves evaluated using Stockfish
- Each move receives an accuracy score
- System selects the best move automatically

---

### 4. ⚔️ Conflict Visualization System
- Display both teammate moves using arrows (hidden until both locked in)
  - Teammate 1 → Blue
  - Teammate 2 → Red
- Show accuracy comparison before resolution
- Highlight winning move
- The "conflict" is within your team (teammates disagreeing), not between teams

---

### 5. 💥 Losing Move Animation (Signature Feature)
- Losing move is visually destroyed
- Particle-based "shatter" animation
- Enhances emotional impact and feedback

---

### 5.1 🎭 Shadow Move Animation System

During a team's turn, both players' moves are visible on the board simultaneously:

| Move Type | Visual | Opacity |
|-----------|--------|---------|
| My move (as the logged-in player) | SOLID piece | 1.0 |
| Teammate's move | SHADOW piece | 0.4 |

**Trigger Points:**

1. **During Turn Selection** (WHITE team's turn):
   - When a player broadcasts their move via real-time event
   - The moving piece appears as a shadow animation on the board
   - My move shows solid (opacity 1.0)
   - Teammate's move shows as shadow (opacity 0.4)

2. **After Resolution** (accuracy comparison completes):
   - Winning move stays as the final move on the board (via `lastMove`)
   - Losing move shows retraction animation (fades back to origin)
   - All shadow overlays are cleared
   - Only the resolved move remains visible

**Perspective-Based Behavior:**
- The system determines which move is SOLID vs SHADOW based on your player ID
- Player 1 logged in: Player 1's move = SOLID, Player 2's move = SHADOW
- Player 2 logged in: Player 2's move = SOLID, Player 1's move = SHADOW
- This ensures each player sees their own move as primary

**Technical Implementation:**
- `myPendingOverlay`: Shows your own pending move (opacity 1.0)
- `pendingOverlay`: Shows teammate's pending move (opacity 0.4)
- `lastMove`: The resolved winning move after accuracy comparison
- State change callback triggers overlay updates when teammates broadcast moves

---

### 6. ⏱️ Real-Time Timer System
- Fixed time per move (e.g., 10 seconds)
- Forces quick decision-making
- Prevents stalling

---

### 7. 🔄 Match Flow System
1. Current team's turn begins
2. Both teammates simultaneously select moves (hidden from each other)
3. Both players lock in their moves
4. Engine evaluates both moves
5. Accuracy is shown
6. Winning (most accurate) move is applied to board
7. Losing move is destroyed with animation
8. Turn passes to opposing team
9. Repeat until checkmate or draw

---

### 8. 🌐 Multiplayer & Matchmaking
- Queue-based matchmaking
- Pair with teammate
- Match against another team

---

### 9. 📊 Performance Tracking
- Accuracy per move
- Number of winning decisions
- Blunders and mistakes
- Match history

---

### 10. 🧑‍🤝‍🧑 Team Dynamics Layer (Unique)
- Tracks disagreement between teammates on the same team
- Measures:
  - Sync rate (how often teammates pick the same move)
  - Conflict frequency (how often teammates disagree)
- Adds a psychological gameplay dimension
- Helps teams improve communication and strategy

---

### 11. 🤖 Bot Mode (Onboarding)
- Play with a teammate against AI
- Adjustable difficulty
- Ideal for new users

---

### 12. 📈 Accuracy Display System
- Shows **after WHITE turn resolves** (when winner is decided)
- Displays **WHITE team's move comparison** (both players on WHITE team)
- **Remains visible** through entire BLACK turn
- **Clears** when next WHITE turn starts (before moves are locked)
- **NEVER shows** BLACK team accuracy (only WHITE team)

#### Display Timing Table
| Game State | Accuracy Shown? | Which Team |
|-----------|-----------------|-------------|
| WHITE turn playing | ❌ No | - |
| WHITE turn resolved | ✅ Yes | WHITE |
| BLACK turn playing | ✅ Yes | WHITE |
| Next WHITE starts | ❌ No (cleared) | - |

---

## 💡 Unique Value Proposition

> "ClashMate transforms chess from a solo strategy game into a real-time battle of ideas between teammates."

Key Differentiators:
- Team vs Team gameplay (2v2)
- Simultaneous decision-making within your team
- Engine-driven move selection
- Visual conflict resolution (teammate vs teammate)
- Strong social + competitive hybrid

---

## 🔮 Future Extensions

- Voice chat between teammates
- Spectator mode
- Replay system with dual-move visualization
- Tournament mode
- Esports-ready ranked ladder

---
