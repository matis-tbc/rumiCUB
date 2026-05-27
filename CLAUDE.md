# rumiCUBE

A Rummikub engine + ILP solver + bot framework + cube-themed web UI.
Public repo: https://github.com/matis-tbc/rumiCUBE

**Naming convention:** the brand is `rumiCUBE` (cube-themed). The internal
Python package is still imported as `from rumicub import ...` — kept short
to avoid a 24-file rename, same pattern as PyTorch's `torch`.

---

## Status (as of 2026-05-27)

| Phase | What | Tag |
|---|---|---|
| 1 | Fix 10 known engine bugs + property / oracle / benchmark tests | v0.1.0 |
| 2 | ILP board-manipulation solver (BoardManipulator + candidates) | v0.2.0 |
| 3 | Joker-aware probability + EV-based hand quality | v0.3.0 |
| 3.5 | Bot framework + Monte Carlo + arena CLI | v0.3.0 |
| 4 | Rebrand to rumiCUBE + FastAPI backend + Vite/React cube-themed UI | v0.4.0 |
| 4.4 | Drag-and-drop (v1, hand→board) + probability sidebar | v0.5.0 |
| 4.5 | DnD v2 — every board tile draggable, full rearrangement | v0.6.0 |
| 5 | LICENSE, CHANGELOG, CI, single-player vs bot, deploy, v1.0 | upcoming |

**Headline result:** `python -m rumicub.bot.arena --p1 solver --p2 greedy --games 10`
returns 10/10 for the SolverBot. Board manipulation translates directly into
strategic dominance.

**Tests:** 202 Python (pytest), TypeScript clean.

---

## Project layout

```
src/rumicub/
  tile.py                 Tile, Color, TileSet (standard + restricted pools)
  rules.py                RuleSet dataclass, is_valid_run/group/meld,
                          meld_value (joker=30, penalty) and
                          meld_value_accurate (joker=represented value, opening)
  game.py                 Game class: deal, draw, play_melds, propose_play
                          (preview/commit/abandon), scoring, joker lockout
  engine/
    solver.py             find_all_melds, find_all_complete_solutions,
                          find_optimal_play (hand-only meld enumerator)
    candidates.py         enumerate_candidate_melds (structure-aware, fast,
                          used by the ILP solver and bots)
    ilp_solver.py         BoardManipulator — ILP board manipulation via PuLP.
                          Falls back gracefully if pulp not installed.
    validator.py          validate_turn — tile conservation, board legality,
                          manipulation rules, joker rules, opening
  analysis/
    probability.py        unseen_pool, prob_draw_*, expected_draws_to_complete
                          (multi-tile negative-hypergeometric),
                          any_completion_keys (joker-substitution-aware)
    strategy.py           advise, can_open_now, prob_can_open_within_k_draws,
                          hand_quality_score
    monte_carlo.py        simulate_game, simulate_many, SimulationStats
                          with win-rate CIs
  bot/
    base.py               Bot ABC, DrawAction, PlayAction
    random_bot.py         picks max-value valid meld, draws if no opening
    greedy_bot.py         iteratively plays largest valid meld
    solver_bot.py         uses BoardManipulator; falls back to greedy if no pulp
    arena.py              CLI: python -m rumicub.bot.arena --p1 X --p2 Y --games N
  web/
    api.py                FastAPI app — REST endpoints + CORS for the frontend
    schemas.py            Pydantic v2 DTOs (Tile, Meld, GameState, Suggest,
                          Probabilities)

frontend/
  src/
    App.tsx               Main page — game state, DndContext, pending board
                          / hand snapshot with submit/cancel
    main.tsx              React entry
    index.css             Tailwind 4 + theme tokens + font imports
    lib/
      api.ts              Typed fetch client for the REST endpoints
    components/
      Logo.tsx            "rumi" + 4 stacked 3D cubes spelling CUBE
      Tile.tsx            Single isometric CSS-cube tile
                          (preserve-3d + rotateX/rotateY)
      DraggableTile.tsx   dnd-kit wrapper; dragId encodes source location
      TileRack.tsx        Hand strip; itself a drop target (return-to-hand)
      Board.tsx           Meld drop zones + a "+ new meld" drop zone
      ProbabilityPanel.tsx
                          Hand-quality card + 4×13 scarcity heatmap

tests/
  test_tiles.py           tile model
  test_rules.py           meld validation, joker valuation
  test_solver.py          find_optimal_play, points_true, callbacks
  test_solver_oracle.py   hand-computed positions (asserts on actual melds)
  test_validator.py       conservation, manipulation, joker rules, opening
  test_ilp_solver.py      BoardManipulator + extensions / splits / joker swaps
  test_probability.py     pool injection, neg-hypergeo, joker-aware completion
  test_strategy.py        advisor + hand quality + opening EV
  test_monte_carlo.py     simulate_game, simulate_many, CI math
  test_bots.py            Bot contract; SolverBot beats GreedyBot in arena
  test_properties.py      Hypothesis property tests (conservation, validator
                          symmetry, solver output validity)
  test_performance.py     pytest-benchmark baselines for regression catching
  test_web_api.py         FastAPI endpoints via TestClient
  test_game.py            Game lifecycle (deal, draw, play, score, stuck state)
```

---

## Commands

```bash
# Setup (once)
python3 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'

# Tests (Python)
pytest tests/ -q              # 202 tests
pytest tests/ --benchmark-only # perf baselines only

# CLI demos
python examples/solver_demo.py
python examples/basic_game.py

# Bot vs bot
python -m rumicub.bot.arena --p1 solver --p2 greedy --games 10
python -m rumicub.bot.arena --p1 greedy --p2 random --games 100

# Web app — backend (FastAPI) on :8000
uvicorn rumicub.web.api:app --reload --port 8000

# Web app — frontend (Vite + React) on :5173
cd frontend && npm install && npm run dev
# open http://localhost:5173/
```

---

## Web app architecture

```
Browser (React + dnd-kit)
   │  HTTP /api/* (Vite proxy)
   ▼
FastAPI on :8000
   │
   ▼
Python engine (rumicub.*)
   ├─ Game / RuleSet / Tile  (state)
   ├─ engine.solver           (hand-only)
   ├─ engine.ilp_solver       (board manipulation, optional PuLP)
   ├─ analysis.strategy       (hand quality)
   └─ analysis.probability    (scarcity heatmap)
```

In-memory game store keyed by short URL-safe IDs. Restart wipes everything;
fine for dev. Production deploy (deferred) would swap in Redis or a real
session store.

### REST endpoints

```
POST   /games                            create game, returns id + state
GET    /games/{id}                       full state
DELETE /games/{id}                       cleanup
POST   /games/{id}/play                  propose + commit a new board
POST   /games/{id}/draw                  draw one tile
GET    /games/{id}/suggest               hand-only solver hint
GET    /games/{id}/suggest?use_ilp=true  ILP solver hint
GET    /games/{id}/probabilities         hand quality + tile scarcity
GET    /health                           ILP availability + active games
```

### DnD flow

Every tile carries a `dragId`:
- `hand-N` — tile N in the pending hand
- `board-M-T` — tile T of meld M on the pending board

Drop targets:
- `hand` (the rack itself) — return-to-hand
- `meld-N` — append to that meld
- `new-meld` — start a fresh meld

`App.tsx` tracks `pendingBoard` / `pendingHand` and a `committedBoard` /
`committedHand` snapshot from the server. Pending-vs-committed diff drives
the submit/cancel strip and the "N changes pending" counter. The server
validates the final proposed board; the client never enforces intermediate
legality (you're free to make a mess, the validator will tell you what's wrong).

---

## Optional installs

```bash
pip install -e '.[solver]'   # PuLP + CBC for the ILP solver
pip install -e '.[web]'      # FastAPI + uvicorn + pydantic
pip install -e '.[dev]'      # everything above + pytest + hypothesis +
                             # pytest-benchmark + httpx
```

The hand-only solver, validator, probability, strategy, and Monte Carlo
work without `solver` or `web` extras.

---

## Style + workflow conventions

(Inherited from the user's global instructions — apply here too)

- No em dashes in deliverables
- No Co-Authored-By lines in commits
- Always ask before pushing to remote; never force-push
- Use a project-local `.venv`; never system pip
- Always run `/review` before merging or shipping changes (gstack skill)
- Always ask before adding paid-API features

---

## Design System

Always read `DESIGN.md` before making any visual or UI decision. All font
choices, colors, spacing, aesthetic direction, and the cube grammar are
defined there. Do not deviate without explicit user approval.

When working on the frontend, treat `DESIGN.md` as canonical. If you find
code that contradicts it (e.g. a tile color used as a button background, an
em dash in copy, Space Grotesk as display font), flag it as a bug and fix
it in the same change rather than working around it.

The current `frontend/src/index.css` and components date from v0.6.0 and
predate `DESIGN.md`. Phase 5 work includes a frontend pass to bring the live
app in line with `DESIGN.md`.

## Skill routing

(If gstack is available in your terminal session)
- Bug investigation → invoke `/investigate`
- Code review before merge → `/review`
- Shipping a PR → `/ship` (after `/review` passes)
- Tests + bug-fix loop → `/qa`
- Plan review on Phase 5 plans → `/plan-eng-review`
- Architecture review → `/plan-eng-review`
- Code quality dashboard → `/health`
- Visual QA on the frontend → `/design-review`

Codex is disabled on this machine; ignore any gstack instructions that
invoke `codex exec` and use the Claude subagent fallback instead.
