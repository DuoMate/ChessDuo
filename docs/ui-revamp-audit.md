# ChessDuo UI/UX Revamp Audit

Branch: `UI-UX-refactoring` · Date: 2026-09-17 · Scope: presentation only, functionality frozen.

This is the PHASE 1-2 deliverable for the major UI/UX revamp (§2 of the revamp brief).
Companion doc: `docs/ui-theme-audit.md` (color/theme system detail).

## 1. Current UI architecture

* Next.js 16 App Router (`src/app/`), React 19, Tailwind v4 CSS-first (no config file).
* Root: `layout.tsx` (server, fonts + `theme-init.js` FOUC guard) → `providers.tsx`
  (Toast + Network + Suspense + Premium + Splash, no theme provider) → routes.
* Game pages lazy: `next/dynamic ssr:false` + `<Suspense>` + `ErrorBoundary`
  (`/game` → `Game`, `/duel` → `DuelGame`, `/replay` → `ReplayView`,
  `/coach` → `CoachGame`, `/four-player` → `FourPlayerLobby`).
* Non-game pages in `(main)/` share layout (`DesktopSidebar` + `HomeBottomNav` + slide-overs).
* Deep links (`/invite`, `/challenge`, `/replay`) at root level for static export.
* Universal loader: `PageLoading` (all `loading.tsx` use it); global `error.tsx` + per-route errors.
* Theme: `.dark` class on `<html>`, tokens in `src/app/globals.css`, default dark,
  persisted in `chessduo_settings` via `useSettings` ↔ `settingsStorage`.

## 2. Shared components

No dedicated `ui/` kit — de-facto shared surface is `src/components/*.tsx`:

* Primitives/layout: `PageLoading`, `Spinner`, `Toast`, `SlideOver`, `ErrorBoundary`,
  `InitialsAvatar`, `ChessDuoLogo`, `BackButton`, `DesktopSidebar` (+ legacy `SidebarNav`),
  `BottomNav` (legacy) / `HomeBottomNav` / `BoardBottomNav`, `MobileStatusBar`,
  `NetworkOverlay`, `KeyboardAvoiding`.
* Game shell: `Game`, `DuelGame`, `ChessBoard`, `MobileChessBoard`, `GameSections`
  (memoized top-board sections), `BoardTopBar`, `PendingMovesRow`, `ConfirmMoveBar`,
  `MoveResolvedInline`, `MoveComparison`, `AccuracyBottomSheet` (legacy),
  `RoundHistorySidebar`, `TeamHexagon`, `TeamTimer`, `MatchTimer`, `IsolatedMatchTimer`,
  `TurnStatusArea`, `GameMenu`, `GameLobby`, `GameLoading`, `GameOverModal`,
  `ResignConfirmModal`, `LeaveConfirmModal`, `PromotionModal`, `MovePlayback`, `MoveInsights`.
* Panels/forms: `SettingsPanel`, `ProfilePanel`, `HistoryPanel`, `FriendsPanel`,
  `ChatPanel`, `Auth`, `AuthGate`, `ChooseUsername`, `WelcomeDisclaimer`, `ColorPicker`,
  `BotEloSelector`, `ChallengePicker`, `InsightsGate`, `Coach/*`, ad slots, `RateChessDuoRow`.
* `GameModeCard`, `TimePills`, `BotDifficultySelector`, `HeaderBar` are **local functions
  in `src/app/page.tsx`** — not shared files (revamp should extract presentation only).

## 3. Screens/views

| Route | Shell | Notes |
|---|---|---|
| `/` Home | `HomeBottomNav` + `DesktopSidebar`, local mode cards | Sub-views: mode setup, duel friend picker, offline skill grid, `ChooseUsername`, `Auth` overlay |
| `/game` 2v2 | `BoardTopBar` + pending row + confirm bar + inline resolution + `BoardBottomNav` | Full Duo shell |
| `/duel` 1v1 | Same sections minus pending/inline | `IsolatedMatchTimer`, simplified nav |
| `/coach` | Custom header, direct `ChessBoard` | No `BoardTopBar`; inline game-over modal |
| `/replay` | `BoardTopBar` + `MovePlayback` | Read-only scrub |
| `(main)/history|friends|profile|settings|premium|four-player|privacy|terms|delete-account` | `(main)` layout shell | History/Profile/Friends panels double as slide-overs |
| `/invite`, `/challenge`, `/welcome`, `/auth/callback` | Minimal/no nav | Invite/challenge have own cards; welcome is instruction route |

Flows: Home → `/welcome` → `/game|/duel|/coach`; join-by-code → game/four-player;
duel picker → `/duel`; history → `/replay`; profile ↔ premium ↔ settings;
`/auth/callback` → `/?redirect=`; in-game → `GameOverModal` → `/`.

## 4. Major UX inconsistencies

1. Page backgrounds split 4 ways (`white` vs `gray-50` vs `page-bg` vs `page-bg-alt`,
   plus dark-only surfaces with no light variant).
2. Icon language split: emoji (`⚔️👥⚠️🔒✅🤝✉️⚡🔗⏰`) in empty/error states vs Lucide elsewhere.
3. Back navigation copy/behavior split (`Back`/`Back to History`/`Go Home`/custom buttons,
   `push` vs `replace`, `alwaysFallback` vs `fallbackHref`).
4. Four nav implementations (`HomeBottomNav` pill vs `BoardBottomNav` 5-tab vs legacy
   `BottomNav`/`SidebarNav` still shipped vs `DesktopSidebar`).
5. Board screen divergence (Game full shell vs Duel simplified vs Replay read-only vs Coach custom).
6. Seven loader variants (`PageLoading` vs `GameLoading` vs `Spinner` vs `EvaluatingLoader`
   vs `AnalyzingIndicator` vs skeletons vs `Loader2`); timeout guards differ (10s/15s/60s/none).
7. Error/empty copy multiplicity (`Something went wrong` vs `Couldn't load…` vs Duo mapper
   errors; 4+ different empty-state voices).
8. Four auth entry paths (home overlay vs `AuthGate` vs inline invite/challenge vs coach gate).
9. CTA hierarchy split (amber Play vs green gradient Play vs amber `Got it!` vs blue primaries
   vs emerald/blue premium cards vs red delete vs yellow return-home).
10. Premium as one-off design system (only screen with `ErrorDetailModal`, dual ad slots,
    `Best Value` pill, divergent post-purchase navigation).

## 5. Visual inconsistencies

* Radius: `full / xl / lg / 2xl / [22px] / [24px] / [30px] / [32px] / md (2 uses)` — no scale.
* Buttons: 3+ primary treatments, heights `44/48/52/56/64px`, radius `2xl vs xl vs lg`.
* Cards: glass vs legacy gray vs dark-only (breaks light mode in 6+ panels).
* Modals: shell `2xl vs [30px]` vs full-screen sheet; 5 backdrop values; 3 title styles;
  emoji `⚠` vs Lucide `Flag` for the same confirm pattern; two promotion shells.
* Badges/pills: 3 variants for won/lost; `text-[11px]` vs `text-xs`; count badges in 3 sizes.
* Tabs/navs: active hue amber vs blue vs blue+emerald; labels `11px vs 12px-bold vs 14px`.
* Timers: 4 implementations (circular SVG vs 2× duplicated rect vs bare text).
* Typography: `text-[11px]` vs `text-xs` vs `text-[12px]` for the same 11-12px tier;
  `font-mono` vs `font-game` split undocumented; display sizes ad-hoc (`42px`/`4xl`/`2xl`).
* Shadows/borders: `sm/md/lg/xl/2xl` + arbitrary `24px/20px/8px` + 2 token glows used of 7 defined;
  borders `white/70 vs gray-200 vs slate-200/80 vs white/5|8|10`; `border` vs `border-2` ad-hoc.
* Hardcoded hex outside tokens: `TeamHexagon` gradients, `AccuracyBottomSheet` eval colors,
  `ChessBoard` retraction reds, `MoveResolvedInline` string-compared hex map.
* `style={{}}` for statics (safe-areas via 2 mechanisms, board widths, filters/positions).

## 6. Components to modernize

Tokens first, then: Button, Card, Input, Modal/SlideOver, Badge/Pill, Avatar, Timer
(unify 4 → 1 skin, logic frozen), PlayerCard, GameModeCard (extract from `page.tsx`),
Tabs, BottomSheet, Header, `BoardTopBar`, `PendingMovesRow`, `ConfirmMoveBar`,
`MoveResolvedInline`, `GameOverModal`, `HistoryPanel`, `FriendsPanel`, `ChatPanel`,
Coach panels, Premium/Auth presentation, focus-visible states everywhere.

## 7. Components that must remain untouched (behavior)

Routing/layouts/route files, `providers.tsx`, auth (`Auth` logic, `AuthGate` logic,
`ChooseUsername` flow, callback, session hooks), realtime/channels, `OnlineGame`/`LocalGame`/
`DuelGameEngine`, Stockfish/evaluators, `accuracy.ts`/`chessUtils.ts` math, billing/purchase,
ad slots + preload, push/notifications, persistence/matchmaking/room/friends/messages/profile
services, timer **logic** (skins ok), `useNavigationGuard` behavior, `settingsStorage` mechanism,
`cm-chessboard` vendored CSS (override via tokens only), Google "G" brand SVG.

## 8. Mobile-specific problems

* `min-h-screen` everywhere (URL-bar jump); only Coach uses `min-h-dvh`.
* `useIsMobile` breakpoint 768px vs docs 640px (drift); initial `false` causes one-frame
  desktop-shell flash on phones.
* Safe-area gaps: `DuelGame` waiting screen, `FourPlayerLobby` outer card.
* Board caps diverge (`720 vs 600 vs 560px`); `PendingMovesRow max-w-3xl` wider than board.
* `pb-20 vs pb-24 vs pb-16`; ConfirmBar assumes exactly 56px nav; fixed home CTA at `84px`.
* `backdrop-blur-2xl` on full-screen overlays (GPU cost); 80-90px shadows.
* Small-phone (320-360px) ConfirmBar/nav edge collision risk.

## 9. Desktop-specific problems

* Sidebar offset string-duplicated (`page.tsx` + `(main)/layout.tsx`); legacy `SidebarNav`
  (80px) still ships alongside `DesktopSidebar` (220/240px) — remove legacy.
* Chat `60vh` breaks on short landscape; ultrawide `max-w-5xl` leaves dead gutters
  (dock history/insights beside board on `lg:` instead).
* Desktop `ChallengePicker` modal still uses `vh` (mobile uses `svh`).

## 10. Accessibility issues (safe to improve, behavior unchanged)

* Focus: no `focus-visible:` on any button/nav/tab (biggest gap) — add shared ring token.
* Board pointer-only: no keyboard move entry / square labels / move announcements (needs design;
  do not fake semantics — document as known limitation for now).
* Timers `aria-live="off"`/missing; low-time is sound-only — add threshold announcer (60s/30s),
  never per-second.
* Toasts lack `role="status"`/live region; dropdowns lack `menu` roles/`aria-expanded`/focus return.
* Landmarks: no `<main>`; history/friend rows are `div`s not list/table semantics.
* Contrast risks (light): `slate-400/500` 12px labels (~2.8:1), `yellow-400` on white,
  chat `yellow-100 on yellow-500/20`, `11px slate-300` sub-copy borderline.
* Touch: keep ≥44px (fix `MovePlayback` text buttons, 16px welcome checkboxes).
* No `prefers-reduced-motion` handling anywhere — add `motion-reduce:` guards.
* Never convey Duo/AI/game-state meaning by color alone (icon + label + border + position).

## 11. Performance risks

* `backdrop-blur-2xl` + 80-90px shadows + body dual radial-gradient (repaint on scroll).
  Rule: `blur-2xl` for small pills/modals only; opaque surfaces for full overlays.
* `Game.tsx` (~3000 lines) + `ChessBoard` (648) mitigations exist (memo sections, move caches,
  gated re-renders, timer-tick filters) — revamp must not pass fresh literals into memo'd
  sections or remove render gates (`RoundHistorySidebar`, `CoachGame`, `CoachPanel`).
* Dual 1Hz intervals (`BoardTopBar` avatar countdown + `IsolatedMatchTimer`) — unify display source.
* Provider-level `Suspense` fallback is full-takeover (`fixed inset-0 z-[9999]`) — scope narrower.
* Animations isolated from clocks today (springs/pulses never touch timer state) — keep it so;
  never delay game events for animation.

## 12. Presentation/logic separation

* `Game.tsx`: preserve props, `GameInterface` typing (never `as any`), all hooks wiring
  (`useSettings`, `useNavigationGuard`, back-button, toast, sounds), refs/guards, all callbacks/
  effects (`updateState`, `tickMatchTimer`, `checkAndResolve`, `executeMove/BotMove`,
  promotion/resign/leave/resolution/save flows), child contracts. Restyle shells/copy/layout only.
* `DuelGame.tsx`: preserve engine + clock-tick filter + timer polling + save flow. Restyle only.
* `ChessBoard.tsx`: preserve constructor/destroy, orientation, marker **types**, chess.js legality,
  input-event flow, geometry. Container skin + marker **colors** (same types) tunable.
* `GameSections`: keep prop list + `timerNode` stability; restyle freely.
* Hooks/services/features: contracts frozen (see §7); only panel skins change, always via
  existing getters (`isPremium()`, settings setters, toast methods).

## Validation performed (audit phase)

* Read-only exploration: 3 subagent sweeps (theme architecture, game colors, component
  consistency) + route/responsive/logic-separation sweeps; `globals.css`, `DESIGN.md`,
  `ARCHITECTURE.md` read; `git status` clean on `UI-UX-refactoring`.
* No functionality changed in this phase (docs only).
