# ChessDuo - Multiplayer Chess Game

A real-time 2v2 chess game where teammates make simultaneous moves and compete against an opposing team.

## Architecture

| Service | URL | Description | Config |
|---------|-----|-------------|--------|
| **Frontend** | https://chessduo-frontend.onrender.com | Next.js FE | `render.yaml` |
| **Backend** | https://chessduo-bllo.onrender.com | Stockfish Server | `Dockerfile` |
| **Database** | Supabase | Auth & Room Storage | `supabase/tables.sql` |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 + TypeScript |
| UI | Tailwind CSS + React |
| Chess Board | cm-chessboard |
| Chess Logic | chess.js |
| Engine | Stockfish (server-side) |
| Real-time | Supabase |
| Auth | Supabase Auth |
| Deployment | Render |

## Deployment

### Two Separate Render Services

This project uses **two separate Render services** for BE and FE:

#### 1. Backend (Stockfish Server)
- **Service**: chessduo-bllo
- **URL**: https://chessduo-bllo.onrender.com
- **Config**: Uses `Dockerfile` in root (`buildContext: .`)
- **Root**: `server/` directory
- **How it works**: Docker builds the Stockfish server from `/server` folder

```bash
# Render auto-deploys on push to main/develop
# Dockerfile handles: npm install, npm run build, Stockfish binary
```

#### 2. Frontend (Next.js App)
- **Service**: chessduo-frontend
- **URL**: https://chessduo-frontend.onrender.com
- **Config**: Uses `render.yaml` in root
- **Root**: `/` (root directory)
- **How it works**: Standard Next.js build + start

```yaml
# render.yaml for FE
rootDirectory: /
buildCommand: npm run build
startCommand: npm start
```

### Environment Variables

#### FE (Frontend) - Add in Render Dashboard

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://kyojsrllyczlpjvqnlpa.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `NEXT_PUBLIC_STOCKFISH_SERVER_URL` | `https://chessduo-bllo.onrender.com` |
| `PORT` | `3000` |

#### BE (Backend) - Add in Render Dashboard

| Variable | Value |
|----------|-------|
| `PORT` | `3001` |

## Local Development

```bash
# Install dependencies
npm install
cd server && npm install

# Run FE
npm run dev

# Run BE (separate terminal)
cd server && npm run dev
```

## Game Modes

### Offline Mode
- Play vs Bot teammate (AI)
- Opponent: Bot (AI)
- No internet required

### Online Mode  
- Create room → Share code with friend
- Real human teammate
- Opponent: Bot (AI)
- Requires Supabase

## Required Setup

### 1. Supabase Database

Run `supabase/tables.sql` in Supabase SQL Editor:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create rooms table  
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'waiting',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create room_players table
CREATE TABLE IF NOT EXISTS room_players (
  room_id UUID,
  player_id TEXT NOT NULL,
  team TEXT NOT NULL,
  slot INTEGER NOT NULL,
  status TEXT DEFAULT 'waiting',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (room_id, player_id)
);
```

### 2. Supabase Auth Settings

- Enable Email Auth in Supabase Dashboard → Authentication → Providers
- Enable Anonymous Sign-ins if using guest mode

## Project Structure

```
ChessDuo/
├���─ src/
│   ├── app/              # Next.js pages
│   ├── components/       # React components
│   │   ├── Auth.tsx    # Login/signup
│   │   ├── Room.tsx    # Create/join room
│   │   ├── Game.tsx    # Main game
│   │   ├── ChessBoard.tsx
│   │   └── ...
│   └── lib/
│       ├── supabase.ts  # Supabase client
│       ├── onlineGame.ts # Real-time game
│       ├── localGame.ts # Offline game
│       └── ...
├── server/                 # Stockfish backend
│   ├── src/
│   │   ├── index.ts   # Express server
│   │   └── engine.ts # Stockfish wrapper
│   └── package.json
├── docs/                   # Design docs
├── render.yaml             # FE Render config
├── Dockerfile             # BE Render config
└── supabase/
    └── tables.sql       # DB setup
```

## License

MIT