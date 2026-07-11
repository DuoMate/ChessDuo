# Context System

## Purpose

Module-level `CONTEXT.md` files give AI agents a quick understanding of a directory's
purpose, key files, and logic decisions — without reading every source file.

Agents read the **chain** from root to leaf:

```
CONTEXT/RULES.md (business rules)
  → apps/api/CONTEXT.md (module)
    → apps/api/src/routes/CONTEXT.md (submodule)
      → [then read actual source files]
```

## Where CONTEXT.md Lives

A `CONTEXT.md` lives in any directory that represents a **meaningful knowledge
boundary** for an AI agent. Two tiers:

### Module context
For directories with multiple files that collectively implement a module.
| Has CONTEXT.md | Does not |
|---|---|
| `apps/api/` | `apps/node_modules/` |
| `apps/api/src/routes/` | `apps/api/src/middleware/` (single file) |
| `apps/web/src/lib/` | `apps/web/static/` |
| `apps/web/src/routes/dashboard/` | build artifacts, config-only dirs |
| `packages/shared/` | — |

### Per-route page context
Every SvelteKit route directory that contains a `+page.svelte` gets its own
`CONTEXT.md` describing the page's logic, API calls, state management, and
UI behavior. This includes dynamic routes (`[id]`).

```
routes/dashboard/campaigns/       ← YES — per-page context
routes/dashboard/campaigns/new/   ← YES
routes/dashboard/campaigns/[id]/  ← YES
routes/login/                     ← YES
```

When in doubt, ask: *"Would a future agent save meaningful time by reading this file before editing?"* If no, skip it.

## Template

Every `CONTEXT.md` follows one of two shapes depending on whether it is a
parent (has subdirectories with their own `CONTEXT.md`) or a leaf.

### Parent template (has sub-modules)

```md
# Module: <name>

## Purpose
One paragraph explaining what lives here and why.

## Files at This Level
| File | Purpose |
|------|---------|
| `src/index.ts` | Entry point for this module |

## Sub-modules
| Module | Context |
|--------|---------|
| `src/routes/` | `src/routes/CONTEXT.md` — brief description |

## Logic & Decisions
- Architectural choices worth documenting.

## Dependencies
- Other modules or packages this depends on.

## Recent Changes
- `2026-06-19`: Added feature Z — short description.
```

### Leaf template (no sub-modules with CONTEXT.md)

```md
# Module: <name>

## Purpose
One paragraph explaining what lives here and why.

## Key Files
| File | Purpose |
|------|---------|
| `src/foo.ts` | Handles X |

## Logic & Decisions
- Architectural choices worth documenting.
- Why we did X instead of Y.

## Dependencies
- Other modules or packages this depends on.

## Recent Changes
- `2026-06-19`: Added feature Z — short description.
```

## Rules for Writing

1. **Keep it thin** — 20–50 lines max. If a section grows long, split into a dedicated doc in `docs/` and reference it.

2. **No implementation details** — describe *what* and *why*, not *how*. The source code is the source of truth for how.

3. **List every significant file** in Key Files. A "significant file" is one an agent would need to read to understand or modify the module. Tests, configs, and trivial helpers can be omitted.

4. **Update Recent Changes** when a user or agent modifies logic in the directory. One line per change. Old entries older than ~6 months can be pruned.

5. **No commit message noise** — Recent Changes entries are plain English, not `git log` output.

## Rules for Updating

Agents and humans must update `CONTEXT.md` when they:

- Add or remove a significant file.
- Change a module's responsibility or boundary.
- Make a non-obvious logic decision that future agents should know about.
- Add or change a dependency.

No update needed for:

- Bug fixes that don't change module semantics.
- Refactors with zero behavioral change.
- Dependency version bumps (unless they introduce a new integration).

## Delegation Rule

A parent `CONTEXT.md` only describes files at its own directory level.
If a subdirectory has its own `CONTEXT.md`, the parent references it
by path — never duplicates its file listings, logic, or decisions.

Leaf directories (no subdirectories with `CONTEXT.md`) carry the full
detail in their own `CONTEXT.md`.

## How Agents Use This

1. Before editing files in a directory, read its `CONTEXT.md`.
2. Walk the hierarchy: parent `CONTEXT.md` first, then child.
3. After making changes, update the relevant `CONTEXT.md` (at minimum: add a Recent Changes entry).
4. If a directory has business logic but no `CONTEXT.md`, create one.
