# ChessDuo Stockfish Server

Server-side Stockfish evaluation API for ChessDuo.

## Why Server-Side?

| Approach | Speed | Pros | Cons |
|----------|-------|------|------|
| Browser WASM (frontend) | 4-6s | No server needed | Slow, browser throttling |
| **Server-side (this)** | **~100ms** | Fast, consistent | Server costs |

## Quick Start

### Local Development

```bash
cd server
npm install
npm run dev
```

### Docker

```bash
docker-compose up
```

### Manual

```bash
# Install Stockfish
sudo apt-get install stockfish

# Start server
npm start
```

## API Endpoints

### Health Check
```bash
GET /health
```

### Evaluate Single Position
```bash
POST /evaluate
Content-Type: application/json

{
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "depth": 15
}
```

Response:
```json
{
  "fen": "...",
  "score": 35,
  "depth": 15,
  "timeMs": 87
}
```

### Evaluate Multiple Positions
```bash
POST /evaluate-batch
Content-Type: application/json

{
  "positions": [
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2"
  ],
  "depth": 15
}
```

## Deployment

### Render (Recommended - Free Tier)

1. Create account at [render.com](https://render.com)
2. Connect your GitHub repo
3. Create a new Web Service
4. Set:
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Add environment variable `PORT=3001`

### Railway

1. Create account at [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Select this repo, set root to `server`

### Docker Hub

```bash
docker build -t yourusername/chessduo-stockfish .
docker push yourusername/chessduo-stockfish
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `STOCKFISH_PATH` | `stockfish` | Path to Stockfish binary |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Express Server                        │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Stockfish Pool (1 worker)          │    │
│  │                                                  │    │
│  │   Process  ───►  UCI Protocol  ───►  stdin    │    │
│  │                              ◄──────── stdout  │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

- Single Stockfish instance with UCI protocol
- Async evaluation with 3s timeout
- Persistent connection (no spawn overhead per request)