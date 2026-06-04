<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:chessduo-conventions -->
# ChessDuo Architecture & Conventions

**Read the full bible**: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)

## Quick Reference — Mandatory Rules

### Adding a new game method
1. Add to `src/features/shared/GameInterface.ts`
2. Implement in BOTH `src/features/online/game/onlineGame.ts` AND `src/features/offline/game/localGame.ts`
3. Use in `Game.tsx` typed as `GameInterface` — **NEVER `as any`**

### New page routes
- Use `next/dynamic` with `ssr: false` for game components
- Wrap in `ErrorBoundary` 
- Handle loading + error + empty states
- Use `useNavigationGuard()` if the page has an active game

### Styling
- Always add `dark:` variants (no dark-only components)
- Touch targets ≥ 44×44px (`min-h-[44px] min-w-[44px]`)
- Font sizes ≥ 11px (`text-xs` or larger)
- No hardcoded hex colors, no `style={{}}` for static values

### Code
- No `require()` — ES imports only
- No `console.log` for user-facing messages — use `useGameToast()`
- Empty `catch {}` blocks must comment why silence is acceptable
- Magic numbers used 3+ times → `src/features/shared/gameConstants.ts`

### Pre-commit
```bash
npx tsc --noEmit   # must pass
npm test           # no new failures
```
<!-- END:chessduo-conventions -->
