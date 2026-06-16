# Phase 5 — Frontend pass to match DESIGN.md

**Status:** reviewed via `/plan-eng-review` 2026-05-27, all 7 decisions resolved
**Target tag:** v0.7.0
**Branch:** `phase-5-design-system` (cut from main after PR #8 lands)
**Depends on:** `DESIGN.md` (committed in same PR or just before)
**Acceptance gate:** `/design-review` + `/qa-only` after final commit

---

## Goal

Bring the v0.6.0 frontend in line with `DESIGN.md` AND ship the Solver Eye
brand mechanic fully (toggle + ghost overlay + EV annotations). The
`/design-consultation` session defined Solver Eye as the differentiator that
makes "the smartest Rummikub" claim legible in the first screenshot, and
`/plan-eng-review` confirmed it belongs in v0.7.0 rather than being deferred.

## NOT in scope (deferred deliberately)

- **Marketing landing page** — bigger surface, deserves its own plan with
  routing decisions, copy work, and a hero-cube animation budget. Captured
  for v0.8.0.
- **WebSocket multiplayer** — already on the v1.0 list.
- **Drop animations / drag-preview ghost** — visual polish, defer to v0.7.1
  if Solver Eye work expands.
- **Light-mode theme** — DESIGN.md is dark-only at launch.
- **Self-hosting Geist and JetBrains Mono** — both load from Google Fonts
  which is reliable enough. Only Cabinet Grotesk needs to be self-hosted
  (sole Fontshare dependency, identity-critical).

## What already exists (reuse, do not rebuild)

- DESIGN.md as the locked visual system. No new design work needed.
- Cube grammar already correct in `Tile.tsx` and `Logo.tsx`. Only minor
  motion polish needed on Tile (hover lift `-8px` + `scale(1.04)`).
- `index.css` token system in place. Only values change, not the shape.
- DnD pipeline (`@dnd-kit/core`, drop zones, drag IDs) works fine.
  Solver Eye must layer on TOP without disturbing it.
- `localStorage` pattern (game_id key) already used for persistence.
- `api.suggest(state.id, useIlp)` already exists. Solver Eye reuses it.

---

## Acceptance criteria

1. Running `pnpm dev` from `frontend/` matches the in-game-mockup section of
   `/tmp/rumicube-design-preview.html` within eye-tolerance
2. `grep -r "Space Grotesk\|Inter\b" frontend/src` returns zero hits
3. `grep -rE "var\(--color-tile-(blue|orange|red|black)" frontend/src/App.tsx
   frontend/src/components/Board.tsx frontend/src/components/TileRack.tsx`
   returns hits ONLY on tile renders, never on buttons or borders
4. Pending strip uses `--color-accent` (lime), not `--color-tile-orange`
5. All buttons match `.btn` (ghost) or `.btn.primary` (lime), nothing else
6. Cube tilt stays `-22deg X, 18deg Y` everywhere (Tile, Logo, CompactTile,
   ghost overlay)
7. `tsc -b` clean after every commit
8. Solver Eye toggle works in all three game states (no play / play available
   / play committed) without breaking dnd
9. Manual QA checklist (below) signed off before merging
10. `/design-review` run after commit 7 returns no P1 findings

---

## Locked decisions (from /plan-eng-review)

| ID | Question | Decision |
|----|----------|----------|
| S0 | Solver Eye scope cut? | **Full Solver Eye in v0.7.0** (toggle + ghost overlay + EV annotations). Original task brief asked to "emphasize the solver" — that's the brand mechanic, ship it real. |
| A1 | Solver state flow? | **React Context.** New `SolverContext` provider in App.tsx wraps the game UI. Board and Sidebar both consume. Avoids prop drilling and keeps the surface clean. |
| A2 | Toggle ON behavior? | **Auto-fetch ILP suggestion** on toggle-on (if no fresh suggestion exists). No localStorage persistence — toggle defaults to off on page load. |
| C1 | CompactTile (2D) vs cube? | **Replace with real cube primitive at 28-32px** per DESIGN.md anti-slop rule 7. One cube grammar everywhere. |
| C2 | Cabinet Grotesk hosting? | **Self-host woff2** in `frontend/public/fonts/`. Cabinet Grotesk is the differentiator and identity-critical; can't depend on Fontshare uptime. |
| T1 | DnD regression coverage? | **Manual QA checklist** in PR template + `/design-review` + `/qa-only` post-implementation. No new test framework introduced. |
| P1 | Font payload? | **Ship only 4 weights actually used**: Cabinet Grotesk 800; Geist 400 + 500; JetBrains Mono 500. ~110KB total instead of 280KB. |

---

## File-by-file change spec

### 1. `frontend/public/fonts/` — NEW directory, self-hosted Cabinet Grotesk

Download from Fontshare (one-time, manual) the woff2 for **Cabinet Grotesk
800** only. License is free for personal + commercial use. Commit:

```
frontend/public/fonts/CabinetGrotesk-Extrabold.woff2
frontend/public/fonts/LICENSE-Cabinet-Grotesk.txt   (Fontshare license file)
```

Add a `@font-face` block at top of `index.css`:

```css
@font-face {
  font-family: 'Cabinet Grotesk';
  src: url('/fonts/CabinetGrotesk-Extrabold.woff2') format('woff2');
  font-weight: 800;
  font-display: swap;
  font-style: normal;
}
```

### 2. `frontend/src/index.css` — palette + fonts (rewrite the `@theme` block)

Replace the existing `@theme` block:

```css
@theme {
  /* Neutrals — substrate */
  --color-bg:         #0A0A0B;
  --color-bg-elev:    #0F0F11;
  --color-surface:    #141416;
  --color-surface-2:  #1A1A1D;
  --color-border:     #1F1F22;
  --color-border-hi:  #2A2A2F;

  /* Text — cream, not white */
  --color-text:       #F5F2EA;
  --color-text-dim:   #8C8B85;
  --color-text-mute:  #525153;

  /* Signature accent — single brand color */
  --color-accent:       #C7F23D;
  --color-accent-edge:  #8FB31E;
  --color-accent-glow:  rgba(199, 242, 61, 0.35);

  /* Tile colors — UNCHANGED, reserved for tiles */
  --color-tile-red:        #E53935;
  --color-tile-red-edge:   #8E1715;
  --color-tile-blue:       #1E88E5;
  --color-tile-blue-edge:  #0D4E8C;
  --color-tile-black:      #1A1A1A;
  --color-tile-black-edge: #050505;
  --color-tile-orange:     #FB8C00;
  --color-tile-orange-edge:#A45800;
  --color-tile-joker:      #B8A06B;
  --color-tile-joker-edge: #6E5D3A;
  --color-tile-face:       #F5F2EA;

  /* Typography */
  --font-display: 'Cabinet Grotesk', system-ui, sans-serif;
  --font-body:    'Geist', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', ui-monospace, monospace;
}
```

Replace the Google Fonts `@import` line with the minimal weight set:

```css
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500&family=JetBrains+Mono:wght@500&display=swap');
```

Delete `--color-bg-card`. All `--color-bg-card` references will be swept
to `--color-surface` in step 7. Keep `.cube-stage` perspective block.

### 3. `frontend/src/components/Tile.tsx` — motion polish

Two small changes only:

- Line ~70: change `hover:translate-y-[-3px]` to `hover:translate-y-[-8px]`
- Same line: add `hover:scale-[1.04]` after the translateY

Edge color logic, faces, bottom shadow, selected glow — all unchanged.

### 4. `frontend/src/components/Logo.tsx` — no code change

The `var(--font-display)` and `var(--font-mono)` tokens auto-resolve to
Cabinet Grotesk + JetBrains Mono after step 2. Visual verification only.

### 5. `frontend/src/components/Board.tsx` — chrome + ghost overlay

Chrome changes:

- Replace the diagonal-hash `repeating-linear-gradient` background with
  the isometric grid pattern:

```ts
backgroundImage:
  `linear-gradient(60deg, transparent 49.7%, rgba(255,255,255,0.025) 49.7%, rgba(255,255,255,0.025) 50.3%, transparent 50.3%),
   linear-gradient(-60deg, transparent 49.7%, rgba(255,255,255,0.025) 49.7%, rgba(255,255,255,0.025) 50.3%, transparent 50.3%)`,
backgroundSize: "28px 48px",
```

- `MeldDropZone` `isOver` state: replace `rgba(30, 136, 229, 0.18)` blue with
  `rgba(199, 242, 61, 0.18)` lime; outline becomes `1px solid var(--color-accent)`
- `MeldDropZone` `highlighted` (pending) state: replace `rgba(251, 140, 0, 0.08)`
  orange with `rgba(199, 242, 61, 0.05)` lime; outline `1px solid var(--color-accent)`
- `NewMeldDropZone` `isOver`: same lime swap
- Header pending-count badge: replace `var(--color-tile-orange)` with `var(--color-accent)`

Ghost overlay (NEW):

- Consume `useSolver()` context (defined in App.tsx, step 7) to read the
  current suggestion + `solverEyeOn` flag
- When `solverEyeOn && suggestion?.new_board`, render a second `<div>` layer
  absolutely positioned over the existing meld container with:
  - `pointer-events: none` (critical — dnd must keep working underneath)
  - `opacity: 0.55`
  - Diff each ghost meld against committed board: melds matching committed
    state render unchanged; melds with additions render with a lime outline
    and an annotation badge "+ N from hand"; entirely-new melds render with
    dashed lime outline labeled "new · {kind}" (run / group)
- Ghost tiles use `<Tile>` at default size (matches real tile alignment) but
  with `opacity: 0.55` to read as ghosts
- Empty-state fallback: when `solverEyeOn && !suggestion`, show a centered
  caption "no play found — drawing is the only option" in lime mono, 11px

### 6. `frontend/src/components/TileRack.tsx` — chrome

- `background: var(--color-bg-card)` → `var(--color-surface)`
- `isOver` blue → lime: `rgba(199, 242, 61, 0.12)` bg,
  `1px solid var(--color-accent)` border
- Edge fade gradients on left/right (`::before` and `::after`) — P2 polish,
  keep if it ships cleanly in commit 6

### 7. `frontend/src/components/ProbabilityPanel.tsx` — chrome

- All `var(--color-bg-card)` → `var(--color-surface)` (token swept)
- `KV` row when `can_open_now`: color `var(--color-tile-blue)` → `var(--color-accent)`
- Error state border stays `--color-tile-red` (semantic alias, allowed)
- Heatmap cells unchanged (legitimate tile-color usage)

### 8. `frontend/src/lib/SolverContext.tsx` — NEW

React Context provider for solver state. Replaces the prop-drilled pattern:

```tsx
interface SolverContextValue {
  suggestion: SuggestResponse | null;
  setSuggestion: (s: SuggestResponse | null) => void;
  solverEyeOn: boolean;
  setSolverEyeOn: (on: boolean) => void;
  loading: boolean;
}
```

Wraps the in-game UI tree. App.tsx hoists the existing `suggestion` state
into this provider. Board and the sidebar suggestion card both consume.

When `solverEyeOn` flips to `true` AND `suggestion == null`, the provider
auto-calls `api.suggest(state.id, true)` (ILP) once. While loading, the
ghost layer shows a small "computing..." caption in lime mono.

### 9. `frontend/src/components/Btn.tsx` — NEW (extracted from App.tsx)

Move the existing `Btn` definition from App.tsx into its own file. Behavior
changes:

- Default tone: transparent bg, `1px solid var(--color-border-hi)`,
  `var(--color-text-dim)` text, `4px` radius, JetBrains Mono ALL-CAPS
- Primary tone: `var(--color-accent)` bg, `#0F1A00` text, weight 700,
  `var(--color-accent-edge)` border
- Ghost tone: same as default but `var(--color-border)` edge (less prominent)
- New `sm` size: `8px/12px` padding, `11px` text
- Arrow suffix support: `<Btn>Submit play <span className="arrow">→</span></Btn>`,
  arrow animates `translateX(2px)` on hover

### 10. `frontend/src/components/Chip.tsx` — NEW (extracted)

Two variants. Used for "opened" indicator and "Solver Eye · on" indicator.

```tsx
<Chip>opened</Chip>             // neutral, --color-text-dim, border-hi
<Chip variant="lime">solver eye · on</Chip>   // accent bg + text + border
```

Replaces the inline chip JSX currently in App.tsx (lines 322-339).

### 11. `frontend/src/components/SolverEyeToggle.tsx` — NEW

Header-mounted toggle button. Reads/writes `solverEyeOn` from SolverContext.
Renders as a `<Chip variant="lime">solver eye · on</Chip>` when on,
`<Chip>solver eye · off</Chip>` when off, clickable. Loading shimmer when
the auto-fetch is in flight.

### 12. `frontend/src/App.tsx` — full chrome update

In order of file:

- Import `<SolverProvider>` and wrap the in-game tree
- Move `suggestion` state into the provider
- Add `<SolverEyeToggle>` to the header next to the stats
- Replace the inline `Btn` definition with the import from `./components/Btn`
- Replace inline opened-chip with `<Chip variant="lime">opened</Chip>`
- Pending strip (lines 280-303): orange tokens → lime, swap rgba
- Suggestion card (lines 396-451): orange tokens → lime; **replace CompactTile
  usage with a real `<Tile size={28}>`** per C1 decision
- Player active row (lines 470-491): blue rgba → lime rgba, add thin lime border
- Winner banner (lines 244-254): `--color-tile-orange` → `--color-accent` bg
- Delete the `CompactTile` function (lines 656-691) entirely
- Delete the inline `Btn` function (lines 531-564) after extraction commit

---

## Implementation order (atomic commits, each must `tsc -b` clean)

1. **Commit 1:** Add `frontend/public/fonts/` + `@font-face` in index.css.
   Verify font loads in browser via network panel.
2. **Commit 2:** `index.css` palette swap. Visual will look slightly off
   until subsequent commits land — expected.
3. **Commit 3:** Extract `Btn.tsx` + `Chip.tsx` from App.tsx (pure refactor,
   no behavior change).
4. **Commit 4:** `Tile.tsx` hover-lift + scale-1.04 polish.
5. **Commit 5:** `App.tsx` accent rollout (primary button → lime, pending
   strip, opened chip, suggestion card, active player, winner banner).
   Replace CompactTile usage with real Tile.
6. **Commit 6:** Delete CompactTile function + dead inline Btn. Run grep
   audits from acceptance criteria.
7. **Commit 7:** `Board.tsx` chrome (isometric grid, lime drop states).
8. **Commit 8:** `TileRack.tsx` + `ProbabilityPanel.tsx` chrome.
9. **Commit 9:** `SolverContext.tsx` + `SolverEyeToggle.tsx` + Board ghost
   overlay. The big Solver Eye commit. Manual QA checklist runs after this.
10. **Commit 10:** Run `/design-review` + `/qa-only`, address P1 findings.

---

## Manual QA checklist (PR template, run before merge)

Run all of these in Chrome AND Safari. Sign off in PR description.

**Chrome refresh:**
- [ ] Start game, board renders with isometric grid background (subtle)
- [ ] Cabinet Grotesk loads (block `api.fontshare.com` in devtools, confirm
  fallback to system-ui doesn't crash)
- [ ] Primary buttons are lime, not blue
- [ ] Pending state strip is lime, not orange
- [ ] "opened" chip is lime
- [ ] Active player row is lime-tinted
- [ ] Winner banner is lime (force win via dev: play winning move)
- [ ] Heatmap cells use tile colors (unchanged from v0.6.0)

**DnD regression with Solver Eye:**
- [ ] Solver Eye OFF: drag tile hand → board, works
- [ ] Solver Eye OFF: drag tile board → hand, works
- [ ] Solver Eye ON, no play found: empty-state caption visible, dnd still works
- [ ] Solver Eye ON, play available: ghost overlay renders, drag tile hand
  → board still works (overlay has `pointer-events: none`)
- [ ] Solver Eye ON, after committing play: ghost overlay clears
- [ ] Solver Eye toggle: visual lime chip when on
- [ ] Auto-fetch on toggle: clicking Solver Eye triggers ILP fetch without
  manual Suggest click

**Cross-browser:**
- [ ] Chrome: cube tilt renders correctly on tiles + logo
- [ ] Safari: cube tilt renders correctly (preserve-3d quirk check)

---

## Failure modes + handling

| Mode | Trigger | Test | Error handling | User sees |
|------|---------|------|----------------|-----------|
| Cabinet Grotesk woff2 fails to load | network error, 404 | manual: block /fonts/ | font-display: swap → system-ui | text in system-ui, still readable, brand weaker |
| Solver Eye ON but pool empty / no play | game state with no legal play | manual checklist | empty-state caption in overlay | "no play found — drawing is the only option" lime mono |
| Ghost overlay captures pointer events | pointer-events leak | manual checklist | `pointer-events: none` enforced + tested | dnd silently breaks — REGRESSION RISK, manual gate |
| ILP solver returns 500 (no pulp installed) | backend dependency error | `/health` already returns `ilp_available` | toggle disabled when `ilpAvailable === false`, show tooltip | tooltip "ILP solver requires pulp" |
| Slow ILP fetch (>500ms) on toggle | large game state | manual via slow network | ghost layer shows "computing..." caption | brief loading shimmer |

**Critical gap:** the ghost-overlay pointer-events leak is the only
failure mode where the user would see a SILENT regression (dnd stops
working with no error). Mitigated by the manual QA checklist + the
explicit `pointer-events: none` enforcement in CSS. If we see this in
production, add a Playwright e2e test in v0.7.1.

---

## Risk register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Fontshare hosting goes away mid-project | L | Self-hosted, no dependency |
| Color-token sweep misses an `--color-bg-card` | L | Grep audit in acceptance criteria + commit 6 |
| Tile colors leak into chrome in future PRs | M | DESIGN.md anti-slop rule + `/design-review` PR gate |
| Solver Eye ghost overlay breaks dnd | M | `pointer-events: none` + manual QA checklist (T1) |
| React Context re-renders thrash the board | L | Context value is stable; suggestions update rarely (per click) |
| Safari `preserve-3d` quirk on ghost overlay | L | Same primitive as existing tiles which ship at v0.6.0 |
| FOUT during font swap looks bad | L | `font-display: swap` is the right behavior; FOUT < 100ms in practice |
| Auto-fetch on every toggle hammers backend | L | Provider only auto-fetches if `suggestion == null`. Toggle off then on with stale suggestion does NOT re-fetch. |

---

## Worktree parallelization

Sequential implementation, no parallelization opportunity. Commits 1-10
all touch `frontend/src/` and share state (`index.css` tokens cascade into
every component). The atomic-commit-with-tsc-clean rule already gives
the right safety; parallel worktrees would add merge friction without
saving wall-clock time.

---

## Implementation Tasks

Synthesized from this review's findings. Each task derives from a specific
finding above. Run with Claude Code; checkbox as you ship.

- [ ] **T1 (P1, human: ~30min / CC: ~5min)** — fonts — Self-host Cabinet Grotesk woff2
  - Surfaced by: C2 decision
  - Files: `frontend/public/fonts/CabinetGrotesk-Extrabold.woff2`, `frontend/public/fonts/LICENSE-Cabinet-Grotesk.txt`, `frontend/src/index.css`
  - Verify: load in Chrome devtools network panel, confirm woff2 fetched from same origin
- [ ] **T2 (P1, human: ~45min / CC: ~10min)** — index.css — Palette swap + font @theme tokens
  - Surfaced by: Architecture review baseline (DESIGN.md alignment)
  - Files: `frontend/src/index.css`
  - Verify: `grep "color-bg-card" frontend/src` returns zero hits after sweep; dev server loads cleanly
- [ ] **T3 (P2, human: ~30min / CC: ~5min)** — components — Extract Btn.tsx + Chip.tsx from App.tsx
  - Surfaced by: Code quality (DRY)
  - Files: `frontend/src/components/Btn.tsx`, `frontend/src/components/Chip.tsx`, `frontend/src/App.tsx`
  - Verify: `tsc -b` clean, no behavior change in browser
- [ ] **T4 (P2, human: ~15min / CC: ~5min)** — tile — Hover lift `-8px` + scale 1.04
  - Surfaced by: DESIGN.md motion spec
  - Files: `frontend/src/components/Tile.tsx`
  - Verify: hover a tile in browser, lift visible, no rack clipping
- [ ] **T5 (P1, human: ~1.5h / CC: ~20min)** — App.tsx — Accent rollout + delete CompactTile
  - Surfaced by: C1 (anti-slop rule violation) + accent rollout across UI
  - Files: `frontend/src/App.tsx`
  - Verify: `grep -E "var\(--color-tile-(blue|orange)" frontend/src/App.tsx` returns zero hits; visual diff vs HTML preview
- [ ] **T6 (P2, human: ~1h / CC: ~15min)** — board — Chrome overhaul (iso grid, lime drop states)
  - Surfaced by: DESIGN.md alignment
  - Files: `frontend/src/components/Board.tsx`
  - Verify: drop a tile onto a meld, see lime outline; pending meld shows lime tint
- [ ] **T7 (P2, human: ~30min / CC: ~10min)** — sidebar — Chrome (TileRack + ProbabilityPanel)
  - Surfaced by: DESIGN.md alignment
  - Files: `frontend/src/components/TileRack.tsx`, `frontend/src/components/ProbabilityPanel.tsx`
  - Verify: `can_open_now` shows lime; rack background is `--color-surface`
- [ ] **T8 (P1, human: ~3h / CC: ~45min)** — solver — SolverContext + SolverEyeToggle + Board ghost overlay
  - Surfaced by: S0 + A1 + A2 decisions (full Solver Eye in scope)
  - Files: `frontend/src/lib/SolverContext.tsx`, `frontend/src/components/SolverEyeToggle.tsx`, `frontend/src/components/Board.tsx`, `frontend/src/App.tsx`
  - Verify: manual QA checklist (above) all checkboxes pass in Chrome + Safari
- [ ] **T9 (P1, human: ~30min / CC: ~10min)** — QA — Run /design-review + /qa-only, fix P1 findings
  - Surfaced by: T1 decision (visual regression strategy)
  - Files: any P1 findings
  - Verify: both skills return clean / no P1

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | not run | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | disabled (per user config) | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | **CLEAR (PLAN)** | 7 decisions resolved, 1 critical gap flagged + mitigated (pointer-events leak), 9 implementation tasks |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | not run | — |
| DX Review | `/plan-devex-review` | DX gaps | 0 | not run | — |

- **CROSS-MODEL:** N/A — Codex disabled per user config, single-model review
- **UNRESOLVED:** 0
- **VERDICT:** ENG CLEARED — ready to implement. Solver Eye in scope fully per S0. Cabinet Grotesk self-hosted. CompactTile replaced with cube primitive. Manual QA gates the dnd regression risk. No CEO/design review needed (chrome work, design system already locked in DESIGN.md).
