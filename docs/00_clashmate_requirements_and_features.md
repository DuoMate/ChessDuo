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

### 14. 👥 Friend System

- **Friend Requests**: Send via invite link, accept/reject in friends panel
- **Friend List**: Shows all accepted friends with online status (green dot via Supabase Presence)
- **Search**: Find friends by name or username in friends panel
- **Block/Unblock**: Blocked users cannot message, challenge, or send friend requests
- **Invite Link**: Shareable URL that prompts sign-in, then sends friend request
- **Share Profile**: Copy profile link button to share with others

#### Database: `friendships`
| Column | Type | Description |
|--------|------|-------------|
| `sender_id` | TEXT | User who sent the request |
| `receiver_id` | TEXT | User who receives the request |
| `status` | ENUM | `pending` / `accepted` / `blocked` |
| `created_at` | TIMESTAMPTZ | When request was sent |
| `updated_at` | TIMESTAMPTZ | When status last changed |

#### RLS Policies
- Users can only see friendships where they are sender or receiver
- Users can create friend requests (sender_id = auth.uid())
- Users can update requests sent to them (receiver_id = auth.uid())
- Users can delete their own friendships

---

### 15. 💬 In-App Messaging

- **Real-time**: Messages delivered via Supabase Broadcast channel `messages:{user_id}`
- **Persistence**: All messages stored in `messages` table
- **Unread tracking**: `read` boolean column; badge count on friends icon
- **Access**: Only between accepted friends; blocked users cannot send messages

#### Database: `messages`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `sender_id` | TEXT | Message sender |
| `receiver_id` | TEXT | Message recipient |
| `content` | TEXT | Message body |
| `read` | BOOLEAN | Whether recipient has read it |
| `created_at` | TIMESTAMPTZ | When message was sent |

#### Chat Panel
- Opens from three-dots menu on a friend → "Send message"
- Real-time subscription to `messages:{user_id}` for live updates
- Auto-scrolls to latest message
- Responsive: adapts to available height; keyboard-aware on mobile

---

### 16. ⚡ Challenge Link System

- **Creation**: From three-dots menu on a friend → "Challenge" → pick mode + timer
- **Challenge Link**: Encodes game mode and time settings in a short shareable code
- **Auto-Create Room**: When recipient clicks link, room is auto-created:
  - Challenger = WHITE team
  - Recipient = BLACK team
- **Zero Friction**: Navigates directly to `/game` — no room code needed
- **Expiry**: Challenge links expire after 24 hours

#### Database: `challenge_links`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `creator_id` | TEXT | User who created the challenge |
| `game_mode` | TEXT | `offline` / `online` / `quickmatch` |
| `time_seconds` | INTEGER | Game duration in seconds |
| `code` | TEXT | 8-char shareable code |
| `created_at` | TIMESTAMPTZ | When challenge was created |
| `expires_at` | TIMESTAMPTZ | 24h after creation |
| `is_active` | BOOLEAN | Whether challenge is still valid |

#### Challenge History
- Track past challenges between friend pairs
- Stored by linking `completed_games.challenge_id` to `challenge_links.id`
- Shows: challenger, recipient, game mode, time, result, date

---

### 17. 🏠 Home Page Layout Redesign

#### Top Bar (always visible on home page)
| Position | Element | Action |
|----------|---------|--------|
| **Top-Left** | Profile icon (👤) | Opens profile panel (slide-over from left) |
| **Top-Right** | Friends icon (👥) + badge | Opens friends panel (slide-over from right) |

#### Profile Panel (left slide-over)
- Profile details (username, player ID, member since)
- "Share Profile" button (copies profile link)
- Recent matches section (last 5 games from history)
- "View All History" link → navigates to /history

#### Friends Panel (right slide-over)
- Search bar ("Search by name or username")
- Invite friend link + copy button at top
- Friend requests section (pending incoming/outgoing)
- Friend list with:
  - Online status indicator (🟢 green dot)
  - Username
  - Three-dots menu per friend
- Three-dots menu options:
  - **Delete Friend** — removes friendship
  - **Send Message** — opens chat panel
  - **Challenge** — opens challenge creation flow

#### Responsive Behavior
| Screen | Profile Panel | Friends Panel |
|--------|---------------|---------------|
| Web (>768px) | Slide-over from left, max-w-sm | Slide-over from right, max-w-sm |
| Mobile (≤768px) | Full-screen overlay | Full-screen overlay |

---

### 18. 📱 Responsive Design Requirements

All social components must work on both web and Capacitor mobile:
- **Touch Targets**: Minimum 44×44px for all interactive elements
- **Font Sizes**: Legible on small screens (min 14px for body text)
- **Panels**: Full-screen overlays on mobile, slide-overs on desktop
- **Chat**: Keyboard-aware height adjustment on mobile
- **Search**: Input fields support mobile keyboard focus/blur
- **Challenge Picker**: Modal with large mode selection buttons for touch
- **Badge**: Friends icon badge visible and tappable on mobile

---
