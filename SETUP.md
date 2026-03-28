# ChessDuo Setup Guide

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

## If You Encounter Build Errors

If you see CSS/JSON parsing errors, try:

```bash
# Clean reinstall (recommended)
npm run reinstall

# Or manually:
rm -rf node_modules .next package-lock.json
npm install
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests |
| `npm run clean` | Clean build artifacts |
| `npm run reinstall` | Full clean reinstall |

## Troubleshooting

### "SyntaxError: Expected double-quoted property name"
This usually means node_modules is corrupted. Run:
```bash
npm run reinstall
```

### Port 3000 in use
```bash
# Kill existing process
pkill -f "next dev"
# Then run again
npm run dev
```
