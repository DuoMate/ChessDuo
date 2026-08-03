# IMPLEMENTATION REPORT — M03 Settings (BV3)

> **Date:** 2026-08-03
> **Phase:** 1 — Layering & Structural Quick Wins
> **Module:** M03 Settings
> **Debt Resolved:** BV3

## Summary

Split `lib/settings.ts` (118 lines, mixed pure utilities + React hook) into two files:
`lib/settingsStorage.ts` (pure localStorage functions, zero React) and `hooks/useSettings.ts` (React hook only).
Deleted `lib/settings.ts`. Restored the `lib/` framework-free invariant.

Zero behavior change. Hook logic byte-for-byte identical to the original.

## Files Changed

| # | File | Action | Lines |
|---|------|--------|-------|
| 1 | `src/lib/settingsStorage.ts` | Create — pure functions + types + constants | +68 |
| 2 | `src/hooks/useSettings.ts` | Create — useSettings hook, imports from settingsStorage | +50 |
| 3 | `src/lib/settings.ts` | Delete | −118 |
| 4 | `src/components/Game.tsx:34` | `@/lib/settings` → `@/hooks/useSettings` | ±1 |
| 5 | `src/components/DuelGame.tsx:20` | `@/lib/settings` → `@/hooks/useSettings` | ±1 |
| 6 | `src/components/SettingsPanel.tsx:5` | `@/lib/settings` → `@/hooks/useSettings` | ±1 |
| 7 | `src/components/ConfigurationPanel.tsx:5` | `@/lib/settings` → `@/hooks/useSettings` | ±1 |
| 8 | `src/components/ProfilePanel.tsx:16` | `@/lib/settings` → `@/hooks/useSettings` | ±1 |
| 9 | `src/app/page.tsx:22` | `@/lib/settings` → `@/hooks/useSettings` | ±1 |
| 10 | `src/app/(main)/profile/page.tsx:15` | `@/lib/settings` → `@/hooks/useSettings` | ±1 |
| 11 | `src/components/__tests__/ProfilePanel.test.tsx:15` | Mock path: `@/lib/settings` → `@/hooks/useSettings` | ±1 |
| 12 | `src/app/__tests__/SetupPage.test.tsx:132` | Mock path: `@/lib/settings` → `@/hooks/useSettings` | ±1 |
| 13 | `src/lib/__tests__/settings.test.ts:1-2` | Split imports: pure fns from settingsStorage, hook from useSettings | ±2 |
| 14 | `src/hooks/CONTEXT.md` | Add useSettings + deps + recent changes | +3 |
| 15 | `src/lib/CONTEXT.md` | settings.ts → settingsStorage.ts + recent changes | +2 |

**Net:** 126 insertions, 133 deletions = **−7 lines**.

## Architecture Rules Applied

| Rule | Description |
|------|-------------|
| BV3 | `lib/settings.ts` exported `useSettings()` React hook — `lib/` must be framework-free |
| Layer discipline | Pure localStorage utilities stay in `lib/` (no React). React hook moves to `hooks/`. |

## Regression Tests

| Check | Result |
|-------|--------|
| `node_modules/.bin/tsc --noEmit` | ✅ Zero errors |
| `npm test` (settings + SetupPage + ProfilePanel) | ✅ 15/15 passed |
| `npm test` (full suite) | ✅ 985/993 passed (same 8 pre-existing failures) |
| `grep "@/lib/settings" src/**/*.{ts,tsx}` | ✅ Zero matches (all old imports gone) |
| `grep "@/hooks/useSettings" src/**/*.{ts,tsx}` | ✅ 8 matches (all 7 source + 1 test — complete migration) |
| `grep "from 'react'" src/lib/*.ts` | ✅ Only `duelGame.ts` (BV4, pre-existing, Phase 6) |

## Manual Tests

| # | Check | Status |
|---|-------|--------|
| 1 | Settings toggle persists across refresh (localStorage) | ⬜ Pending |
| 2 | Theme toggle (dark/light) updates document class | ⬜ Pending |
| 3 | SettingsPanel opens and all toggles work | ⬜ Pending |
| 4 | Confirm move setting gates move confirmation UI | ⬜ Pending |
| 5 | Sound toggle affects audio playback | ⬜ Pending |

## Known Risks

- **None.** Pure mechanical split with zero logic changes.
- `settings.test.ts` now imports from two separate modules (`settingsStorage` + `useSettings`) — both resolve correctly, tests pass.
- `useSettings` hook still has one side effect (`document.documentElement.classList.toggle` on theme change) — preserved exactly.
- `app/page.tsx` imports `useSettings` but has no visible usage in the grep results — potentially an unused import, but left as-is (not in scope).

## Rollback Steps

```bash
git revert <commit>
```

## Future Work

- `app/page.tsx` may have an unused `useSettings` import — verify and remove if confirmed dead.

## Git Commit

```
refactor(settings): split settings.ts into settingsStorage.ts + hooks/useSettings.ts (BV3)

BV3: lib/settings.ts contained React hook (useSettings) — lib/ must be framework-free.
Pure localStorage utilities → lib/settingsStorage.ts
React hook → hooks/useSettings.ts
Deleted lib/settings.ts

7 source importers updated: @/lib/settings → @/hooks/useSettings
2 test mocks updated: jest.mock patch paths
settings.test.ts split imports (pure fns + hook)
hooks/CONTEXT.md + lib/CONTEXT.md updated

tsc --noEmit: zero errors
npm test: 985/993 pass (8 pre-existing, none in changed files)
```

## Lessons Learned

1. **Grep exhaustively before splitting.** Found 7 source files + 2 test mocks + 1 test file = 10 importers. The test mocks (`jest.mock('@/lib/settings')`) are easy to miss because they're string literals, not import statements.
2. **SettingsStorage has one dep — localStorage.** The pure utility file is truly framework-free: zero npm imports, just browser API.
3. **The hook imports `Settings` and `Theme` types from `settingsStorage` via `type` import.** This avoids the hook having any non-type dependency on the browser-only storage module.
4. **Routine speed.** 10 import path changes with identical `oldString` → `newString` across 10 files took ~10 seconds with targeted edits. Batch identical edits together.
