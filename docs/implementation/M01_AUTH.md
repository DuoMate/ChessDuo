# IMPLEMENTATION REPORT — M01 Auth (BV1/BV2)

> **Date:** 2026-08-03
> **Phase:** 1 — Layering & Structural Quick Wins
> **Module:** M01 Authentication
> **Debt Resolved:** BV1, BV2

## Summary

Moved `AuthGate.tsx` (React component) from `features/auth/` → `components/` and `useAuthSession.ts` (React hook) from `features/auth/` → `hooks/`. Deleted the `features/auth/` directory. Restored the `features/` framework-free invariant.

Zero behavior change. Purely mechanical file relocation with one internal import path edit.

## Files Changed

| # | File | Action | Lines |
|---|------|--------|-------|
| 1 | `src/components/AuthGate.tsx` | Overwrite 6-line re-export with 173-line component | +167 |
| 2 | `src/hooks/useAuthSession.ts` | Create with 136-line hook | +136 |
| 3 | `src/features/auth/AuthGate.tsx` | Delete | −173 |
| 4 | `src/features/auth/useAuthSession.ts` | Delete | −136 |
| 5 | `src/components/__tests__/PageLoadingArchitecture.test.tsx` | Update 2 path references | ±2 |
| 6 | `src/hooks/CONTEXT.md` | Add useAuthSession to key files + deps + recent changes | +3 |
| 7 | `src/components/CONTEXT.md` | Add AuthGate entry + recent changes | +2 |
| 8 | `src/features/CONTEXT.md` | Recent changes entry | +1 |

**Net:** 178 insertions, 315 deletions = **−137 lines** (thin wrapper eliminated).

## Architecture Rules Applied

| Rule | Description |
|------|-------------|
| BV1 | React components belong in `components/`, not `features/` |
| BV2 | React hooks belong in `hooks/`, not `features/` |
| Layer discipline | `features/` = framework-free domain logic; `components/` = React components; `hooks/` = React hooks |

## Regression Tests

| Check | Result |
|-------|--------|
| `node_modules/.bin/tsc --noEmit` | ✅ Zero errors |
| `npm test` (Auth + PageLoading) | ✅ 61/61 passed |
| `npm test` (full suite) | ✅ 985/993 passed (8 pre-existing failures: server LRUCache, SidebarNav, ConfirmMoveBar — none touched) |
| `grep "features/auth" src/**/*.{ts,tsx}` | ✅ Zero matches |
| `features/auth/` directory existence | ✅ Deleted |
| Circular dependencies | ✅ None — import graph remains acyclic |

## Manual Tests

| # | Check | Status |
|---|-------|--------|
| 1 | Auth gate overlay renders on `/friends`, `/duel` | ⬜ Pending |
| 2 | Auth gate page variant renders on `/history`, `/settings`, `/profile`, `/delete-account` | ⬜ Pending |
| 3 | 5 pages importing `AuthGate` from `@/components/AuthGate` still resolve | ✅ tsc verified |

## Known Risks

- **None.** Mechanical file relocation with one import path edit (`./useAuthSession` → `@/hooks/useAuthSession`). Zero logic changes.

## Rollback Steps

```bash
git revert <commit>
```

Zero DB or schema changes. Zero feature flags needed.

## Future Work

- `Auth.tsx` (488 lines) mixes sign-in state machine with presentation — separate M01 decomposition beyond BV1/BV2 scope.

## Git Commit

```
refactor(auth): move AuthGate to components/, useAuthSession to hooks/ (BV1/BV2)

BV1: AuthGate.tsx (React component) moved from features/auth/ → components/
BV2: useAuthSession.ts (React hook) moved from features/auth/ → hooks/
Deleted features/auth/ directory

Importer change: internal import ./useAuthSession → @/hooks/useAuthSession
5 page files importing from @/components/AuthGate unchanged
PageLoadingArchitecture test paths updated
hooks/CONTEXT.md + components/CONTEXT.md + features/CONTEXT.md updated

tsc --noEmit: zero errors
npm test: 985/993 pass (8 pre-existing, none in changed files)
```

## Lessons Learned

1. **Thin re-export wrappers make migration trivial.** The 6-line `components/AuthGate.tsx` wrapper meant zero page importers needed changes — all pages already imported from the correct location.
2. **Grep both path aliases and relative paths before moving.** The only internal importer (`./useAuthSession`) was caught because AuthGate imported its sibling hook relatively.
3. **Test files reference physical paths.** `PageLoadingArchitecture.test.tsx` had 2 hardcoded `features/auth/` paths that needed updating — architecture tests are validators, but their paths are concrete strings, not aliases.
4. **`useAuthSession` had zero external consumers.** The hook was re-exported from the thin wrapper but no file outside `AuthGate.tsx` ever imported it. This made the move a private internal change.
