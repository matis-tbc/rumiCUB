# rumiCUBE

A Rummikub engine + ILP solver + bot framework + cube-themed web UI.
Public repo: https://github.com/matis-tbc/rumiCUBE

**Naming convention**: brand is `rumiCUBE` (cube-themed). The internal
Python package is still imported as `from rumicub import ...` (kept short
to avoid a 24-file rename; same pattern as `torch` for PyTorch).

## Status (as of 2026-05-26)

Phases 1, 2, 3, 3.5 all merged and tagged.

| Phase | What | Tag |
|---|---|---|
| 1 | Fix 10 known engine bugs + property/oracle/benchmark tests (155 tests) | v0.1.0 |
| 2 | ILP board-manipulation solver (BoardManipulator + candidates) | v0.2.0 |
| 3 | Joker-aware probability + EV-based hand quality | v0.3.0 |
| 3.5 | Bot framework + Monte Carlo + arena CLI | v0.3.0 |
| 4 | Frontend rename to rumiCUBE + React+FastAPI cube UI | **in progress** |
| 5 | LICENSE, CHANGELOG, CI, v1.0 | upcoming |

**Headline result**: `python -m rumicub.bot.arena --p1 solver --p2 greedy --games 10`
returns 10/10 for the solver — board manipulation translates directly into
strategic dominance.

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
                          find_optimal_play (HAND-ONLY, no board manipulation)
    validator.py          validate_turn — tile conservation, board legality,
                          rearrange, joker rules, opening
  analysis/
    probability.py        unseen_pool, prob_draw_*, expected_draws_to_complete
                          (currently single-tile only), tile_scarcity
    strategy.py           advise (CURRENTLY BROKEN on jokers — see Phase 1)
tests/                    pytest suite, 109 tests, all green
examples/                 solver_demo.py, basic_game.py (CLI demos)
```

## Commands

```bash
# Setup (once)
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# Tests
pytest tests/ -v

# Quick demos
python examples/solver_demo.py
python examples/basic_game.py
```

## Known critical bugs (verified empirically, NOT YET FIXED)

### C1 — Strategy advisor recommends invalid opening melds
`analysis/strategy.advise()` uses `find_optimal_play` results scored with
`meld_value()` (joker=30). For `[JOKER, R2, R3]` it claims `points=35` and
recommends opening, but the validator rejects it (true value = 9 < 30).
Fix: use `meld_value_accurate()` for opening check; thread through solver.

### C2 — "Solver" cannot do board manipulation
`engine/solver.find_optimal_play` explicitly leaves existing board melds
untouched (see docstring). It misses meld extensions, splits, joker
retrievals — i.e. most intermediate Rummikub strategy. With hand `[R7]` and
board `[[B7,BK7,O7]]`, the solver returns 0 tiles played; obvious play is
to extend the group to 4 tiles.

### C3 — `allow_board_rearrange=False` blocks legal meld extension
The validator treats any change to an existing meld signature as a
"rearrangement," including adding one tile to extend a run/group from hand.
That's too strict — extending an existing meld is a basic legal move
regardless of full rearrangement permission.

### C4 — `expected_draws_to_complete` is wrong for multi-tile completion
Uses `(N+1)/(K+1)`, which is the negative-hypergeometric expectation for the
*first* useful draw. For partials needing 2+ tiles, this dramatically
understates expected time-to-complete. Used by `rank_partial_melds`.

### C5 — Probability engine hardcoded to `TileSet.standard()`
`unseen_pool()` always reconstructs the 106-tile standard set. Games
constructed with restricted pools (excluded numbers/colors, different copy
counts) get wrong probabilities.

### M1 — A player can "pass" with no-op play
`propose_play([])` validates (no tiles changed → conservation holds → all
checks pass). Official rule: every turn must place ≥1 tile OR draw.

### M2 — No winner declared when pool empties + no one can play
Game.draw() returns "pool empty, game over" but `winner()` returns `None`
unless someone has an empty hand. Official rule: lowest hand-value penalty
wins in stuck states.

### M3 — Joker representation isn't tracked
Joker value is re-inferred from meld structure each turn. Breaks joker
retrieval rules (must give back the represented tile) and any house rule
about not re-aiming a joker mid-turn.

### M4 — `maximize="points"` uses joker=30 inflation
Solver's "points" mode prefers joker-containing melds because it counts
joker as 30 even when accurate value is single digits. Should use
`meld_value_accurate`.

### M5 — Joker retrieval doesn't check the replacement matches
Validator allows swapping a joker out for any tile, not specifically the
tile the joker was representing.

### M6 — No timer, no win bonus, no manipulation-revert-and-penalty
Official tournament: if you start rearranging the board and can't make it
legal in 2 min, your changes revert AND you draw 3 penalty tiles. Not
modeled.

## Forward plan (decisions locked 2026-05-25, autoplan-reviewed 2026-05-26)

Chosen direction: **maximum ambition, all three use cases**
- Solver / study tool (engine + probability + analysis)
- Playable game (web UI, multiplayer-capable)
- AI self-play benchmark (bot framework, simulation stats)
- ILP-based board-manipulation solver (Phase 2 = core)
- Web frontend: React on Vercel + FastAPI on Fly.io
- Tournament-strict rule fidelity + pluggable variants
- Repo: public at https://github.com/matis-tbc/rumiCUB

### Architecture target (post-Phase 4)

```
src/rumicub/
  tile.py, rules.py, game.py
  engine/
    hand_solver.py      ← current solver.py renamed
    candidates.py       ← NEW Phase 2: enumerate all valid melds for an ILP run
    ilp_solver.py       ← NEW Phase 2: BoardManipulator class
    validator.py        ← existing
  analysis/
    probability.py      ← Phase 1 C5, C4 fixes; Phase 3 joker substitution
    strategy.py         ← Phase 1 C1, M4 fixes; Phase 3 rebuild
    monte_carlo.py      ← NEW Phase 3: opponent sim, win-prob estimation
  bot/                  ← NEW (AI self-play benchmark)
    random_bot.py
    greedy_bot.py
    solver_bot.py
    arena.py            ← bot-vs-bot tournaments + stats
  web/                  ← NEW Phase 4
    api.py              ← FastAPI app
    schemas.py          ← Pydantic models
tests/
  test_*.py             ← existing unit tests
  test_solver_oracle.py ← NEW: hand-computed positions, asserts on specific melds
  test_performance.py   ← NEW: pytest-benchmark perf assertions
  fixtures/positions.py ← NEW: 10-20 known puzzles
```

### Phase 1 — Fix what's broken (1–2 days)
Ordered by dependency. Goal: every README claim true, no hollow recs.

1. **C5** — `unseen_pool(known, full_pool=None)` accepts injected pool;
   `Game` passes its actual pool. Touches every probability function.
2. **C4** — `expected_draws_to_complete` uses negative-hypergeometric for
   *N* successes (exact summation). Depends on C5.
3. **C1** — strategy advisor uses `meld_value_accurate` for opening check;
   add `points_true` field to `find_optimal_play` result. Depends on C4
   ordering of probability fixes.
4. **C3** — rename `allow_board_rearrange` → `allow_board_manipulation`;
   permit meld extension (add-tile-to-meld) and meld merging even when
   flag is off; only block splits, joker-swaps, full re-grouping.
5. **M4** — solver `maximize="points"` uses `meld_value_accurate`.
6. **M1** — every turn must be `tiles_played > 0` OR `draw()`; reject
   no-op proposals.
7. **M2** — declare winner by lowest hand penalty when pool exhausts +
   no player can play (stuck state).
8. **Solver oracle tests** — `tests/fixtures/positions.py` with 10-20
   hand-computed puzzles; assertions on specific melds.
9. **Property-based tests** — Hypothesis: tile conservation, validator
   symmetry, joker substitution legality.
10. **Benchmark suite** — `tests/test_performance.py` with
    pytest-benchmark; baseline numbers for solver, validator, probability.

### Phase 2 — Board-manipulation ILP solver (1 week)

The CLAUDE.md previously cited a specific paper title that the original
session may have hallucinated. **Build from first principles instead.**
The technique below is standard 0-1 ILP for tile-placement problems;
implementations and writeups exist in the open-source Rummikub community
(verify any specific paper before citing).

**Approach (pre-enumeration + exact MIP):**
1. **Enumerate candidate melds** — generate every valid run + group that
   can be formed from `hand + board_tiles` (with joker substitution).
   Practical size: a 14-hand + 30-board game produces ~5k-20k candidates.
   Module: `engine/candidates.py`.
2. **Decision variables** — binary `x_m` per candidate meld m (1 if used).
3. **Constraints:**
   - Tile conservation: for each tile t, `sum(x_m for m containing t) ≤ count(t in pool)`
   - Joker conservation: same but for jokers (≤2 typically)
   - Board legality: every board tile from `board_before` must appear in
     exactly one selected meld (unless rearrangement is disabled — then
     existing meld signatures must be preserved)
4. **Objective:**
   - Primary: `max sum(tiles_from_hand_used * x_m)`
   - Tie-break: `max sum(meld_value_accurate * x_m)`
5. **Library:** `pulp` (free, CBC solver bundled, simple API). Re-evaluate
   `python-mip` if performance becomes an issue.
6. **Validation oracle:** every solver output piped through the existing
   `validate_turn()` to catch model bugs.

**Public API:**
```python
from rumicub.engine.ilp_solver import BoardManipulator
result = BoardManipulator(rules).solve(hand, board)
# returns: {board_after, tiles_played, points_true, melds_changed, solve_time_ms}
```

**Performance budget:** 14-hand + 30-board mid-game in <500 ms (CBC, no
warm start). Document fallback to hand-only solver if budget blown.

**Keep:** current `hand_solver.find_all_melds` / `find_all_complete_solutions`
for tutorials and small-position exploration. They're the "naive" reference
implementation that the ILP must match on hand-only positions.

### Phase 3 — Strategy + probability rebuild (3–4 days)
- Joker-substitution-aware completion sets: `any_completion(partial)`
  returns sets of accepted draws (joker OR specific naturals).
- Multi-tile negative-hypergeometric (depends on Phase 1 C4 done).
- `analysis/monte_carlo.py`: opponent sim (1000+ games against random
  and greedy baselines) for honest win-probability estimates.
- Opening EV: P(can open within K draws) given current pool.
- Replace `hand_flexibility` with EV(hand) under optimal play.

### Phase 3.5 — Bot framework (2-3 days, can interleave with Phase 3)
- `bot/random_bot.py` — plays first valid meld or draws.
- `bot/greedy_bot.py` — plays the result of `find_optimal_play`.
- `bot/solver_bot.py` — plays the result of `BoardManipulator.solve` if
  available, else greedy.
- `bot/arena.py` — runs N games between any pair of bots, returns
  win-rate stats with confidence intervals. CLI: `python -m rumicub.bot.arena
  --p1 greedy --p2 solver --games 1000`.

### Phase 4 — Frontend (1–2 weeks)

**Stack:** React + Vite + TypeScript on Vercel; FastAPI on Fly.io.
**Style:** leverage the portfolio's tactical/industrial design system as
starting point (concrete neutrals, restrained color semantics, 2-4px radii).

**REST API shape (lock now, freezes Phase 2 contract):**
```
POST   /games                      → {id, rules}    create game
GET    /games/{id}                 → full game state
POST   /games/{id}/play            → propose + commit a play
POST   /games/{id}/draw            → draw a tile
GET    /games/{id}/suggest         → solver: optimal play
GET    /games/{id}/all-plays       → solver: every valid play (capped at N)
GET    /games/{id}/probabilities   → distribution analysis
GET    /games/{id}/history         → turn-by-turn replay
```

**Multiplayer:** WebSocket at `/games/{id}/ws` for live updates between
players. Auth: session token in cookie, no accounts for v1 (anonymous
play, game-ID-as-shareable-URL).

**UI surface:**
- Tile rack with drag-and-drop
- Board view with meld grouping
- "Suggest play" → animate solver's proposed melds
- "Show all completions" highlight
- Probability sidebar (tile scarcity heatmap, P(draw useful))
- Game replay mode

### Phase 5 — Polish + 1.0 (1 day)
- LICENSE (MIT), CHANGELOG.md, GitHub Actions running pytest on push
- Tag v0.1.0 after Phase 1; v0.2.0 after Phase 2; v0.3.0 after Phase 3+3.5;
  v1.0 after Phase 4 deployed.
- README rewrite reflecting full feature surface.

## Style + workflow conventions

(Inherited from the user's global instructions — apply here too)

- No em dashes in deliverables
- No Co-Authored-By lines in commits
- Always ask before pushing to remote; never force-push
- Use a project-local `.venv`; never system pip
- Always run `/review` before merging or shipping changes (gstack skill)
- Always ask before adding paid-API features

## Skill routing

(If gstack is available in your terminal session)
- Bug investigation → invoke `/investigate`
- Code review before merge → `/review`
- Shipping a PR → `/ship` (after `/review` passes)
- Tests + bug-fix loop → `/qa`
- Plan review on Phase 2/4 plans → `/plan-eng-review`
- Architecture review → `/plan-eng-review`
- Code quality dashboard → `/health`

Codex is disabled on this machine; ignore any gstack instructions that
invoke `codex exec` and use the Claude subagent fallback instead.
