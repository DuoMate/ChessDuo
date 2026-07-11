# Module: Stockfish Evaluation Server

## Purpose
Standalone Express server that wraps Stockfish for HTTP-accessible move evaluation. Deployed separately on Render via Docker.

## Files at This Level
| File | Purpose |
|------|---------|
| `package.json` | Server dependencies (express, stockfish, typescript) |
| `tsconfig.json` | TypeScript config |
| `Dockerfile` | Docker build for Render deployment |
| `docker-compose.yml` | Local Docker development |
| `render.yaml` | Render Blueprint config |

## Sub-modules
| Module | Context |
|--------|---------|
| `src/` | Source code |
| `__tests__/` | Server tests |

### Key Source Files (`src/`)
| File | Purpose |
|------|---------|
| `index.ts` | Express entry point — mounts evaluation endpoint |
| `engine.ts` | Stockfish engine wrapper (spawns binary, communicates via UCI) |
| `polyglot.ts` | Polyglot opening book reader |

## Logic & Decisions
- Single endpoint: `POST /evaluate` — accepts FEN, returns top N moves with scores.
- Engine spawned as child process, communicates via stdin/stdout (UCI protocol).
- Opening book provides book moves in early positions.
- Dockerized for Render deployment — Stockfish binary included in image.
- Separate from Next.js app — no coupling to ChessDuo frontend framework.

## Dependencies
- `stockfish` npm package (bundles Stockfish binary), Express, TypeScript
