# Changelog

All notable changes to rumiCUBE are documented here.
Format roughly follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [SemVer](https://semver.org/).

## v0.6.0 — 2026-05-27

### Added
- **DnD v2:** every tile on the board (not just hand-sourced ones) is now
  draggable. `dragId` encodes source as `hand-N` or `board-M-T`. Drop
  targets unchanged (`hand`, `meld-N`, `new-meld`). Players can revert
  individual placements, move tiles between melds, split or merge melds,
  pull jokers around. Validation stays server-side on submit.
- Empty melds auto-prune from the pending board so the UI doesn't leave
  zero-tile placeholders after a tile is dragged away.
- Pending-changes count derived from canonical meld-key multiset diff
  between proposed and committed board snapshots.

### Refactored
- `pendingTileIds` set replaced with `committedBoard` / `committedHand`
  snapshots — cleaner cancel-revert and per-meld highlight derivation.
- `App.onDragEnd` split into composable `takeTile` + `placeTile` +
  `pruneEmptyMelds` helpers.

## v0.5.0 — 2026-05-26

### Added
- **DnD v1 (hand → board):** drag hand tiles onto existing melds or the
  "+ new meld" zone. Submit/cancel strip with server-side validation.
- **Probability sidebar:**
  - `GET /games/{id}/probabilities` returns `hand_quality_score` + per
    tile-type scarcity.
  - `ProbabilityPanel` renders the hand-quality card + a 4×13 scarcity
    heatmap where cell opacity scales with seen-fraction (darker = harder
    to draw).
- New schemas: `HandQualityDTO`, `ScarcityEntry`, `ProbabilitiesResponse`.

### Fixed
- ILP solver falls back to the input board on Infeasible / Undefined
  status rather than returning an empty board (which would lose existing
  board tiles via downstream validator failure).
- `simulate_game` raises `ValueError` if both bots share a `name`
  (would silently collide in name-keyed scoring).
- Added `Game.current_player_index` so `monte_carlo` no longer reads
  `_current_idx` (private).
- Heatmap label collision: Blue/Black both produced "B" via
  `tile_scarcity`. API now uses raw counts + explicit BL/BK prefixes.

## v0.4.0 — 2026-05-26

### Added
- **Rebrand** to `rumiCUBE` (brand-only — Python package stays `rumicub`).
- **FastAPI backend** (`src/rumicub/web/`):
  - `POST /games`, `GET/DELETE /games/{id}`
  - `POST /games/{id}/{play,draw}`
  - `GET /games/{id}/suggest` (with `?use_ilp=true`)
  - `GET /health`
  - In-memory game store, CORS for Vite dev + Vercel.
- **Vite + React + TypeScript frontend** (`frontend/`):
  - Tailwind 4, custom theme tokens, web fonts.
  - `Tile` component: real 3D cube via `transform-style: preserve-3d`
    with front/top/right faces + grounded shadow.
  - `Logo`: "rumi" + 4 stacked 3D cubes spelling CUBE in red/blue/
    orange/black.
  - `App`: game lifecycle, suggest-and-play flow, localStorage-backed
    resume.
- `pulp` moved to optional `[solver]` extra; FastAPI/uvicorn in `[web]`
  extra; both bundled into `[dev]`.

## v0.3.0 — 2026-05-26

### Added
- **Joker-aware probability:** `any_completion_keys`,
  `prob_complete_with_any_draw`, `expected_draws_to_any_completion`.
- **EV-based hand quality:** `can_open_now`, `prob_can_open_within_k_draws`
  (Monte Carlo sampled), `hand_quality_score`.
- **Monte Carlo simulator** (`analysis/monte_carlo.py`): `simulate_game`,
  `simulate_many`, `SimulationStats` with win-rate CI.
- **Bot framework** (`bot/`): `Bot` ABC, `RandomBot`, `GreedyBot`,
  `SolverBot` (graceful pulp fallback).
- **Arena CLI**: `python -m rumicub.bot.arena --p1 X --p2 Y --games N`.

### Fixed
- `find_all_melds` + `_backtrack` cap subset enumeration at
  `max_run_size` — prevents exponential blow-up on grown hands.
- Strategy advisor uses `meld_value_accurate` for opening check (no longer
  recommends invalid jokered openings).
- `prob_can_open_within_k_draws` returns 0.0 when unseen pool < k.

### Headline result
`python -m rumicub.bot.arena --p1 solver --p2 greedy --games 10`
returns 10/10 for SolverBot.

## v0.2.0 — 2026-05-26

### Added
- **Board-manipulation ILP solver** (`engine/ilp_solver.py`):
  `BoardManipulator` using PuLP/CBC.
  - Pre-enumerates candidate melds via `engine/candidates.py`.
  - Binary decision variables per candidate; tile-conservation +
    board-reuse constraints; objective maximises hand tiles placed,
    tiebroken by accurate value.
  - Pipes output through the existing validator as an oracle.
- 11 ILP tests including the headline case `test_ilp_naive_solver_misses_extensions`.

## v0.1.0 — 2026-05-26

### Fixed (10 critical / major bugs)
- C1 Strategy advisor opening check uses true joker value
- C3 `allow_board_rearrange` → `allow_board_manipulation`; meld extension always legal
- C4 `expected_draws_to_complete` uses negative-hypergeometric for *N* tiles
- C5 Probability engine respects custom pools (restricted variants)
- M1 No-op turn rejected; must play or draw
- M2 Stuck-state winner declared by lowest hand penalty
- M4 Solver `maximize="points"` uses true value, not joker=30 inflation
- Added `points_true` field to `find_optimal_play` result
- Added 11 oracle test positions (asserts on specific melds)
- Added 6 Hypothesis property tests (conservation, validator symmetry)
- Added 8 pytest-benchmark performance baselines
