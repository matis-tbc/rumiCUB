# rumiCUB

A Rummikub game engine with a board-manipulation solver, strategy advisor,
and probability analysis. Public repo: https://github.com/matis-tbc/rumiCUB

## Status (as of 2026-05-25)

Initial engine extracted from a prior web session. 109/109 tests pass.
A deep review identified critical bugs and structural gaps; the engine works
for hand-only play and basic validation but the headline "solver" claim is
overstated and several rules are mis-modeled. See **Forward plan** below.

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

## Forward plan (decisions locked 2026-05-25)

Chosen direction: **maximum ambition** —
- ILP-based board-manipulation solver (Phase 2 = core focus)
- Web frontend: React + FastAPI bridge to the Python engine
- Tournament-strict rule fidelity + keep pluggable variants
- Repo extracted to its own public repo (DONE — you're in it)

### Phase 1 — Fix what's broken (1–2 days)
Goal: every claim in the README is true; no hollow recommendations.
- [ ] C1: rewrite advisor to use `meld_value_accurate` for opening check;
  add `points_true` field to optimal-play result
- [ ] C3: rename `allow_board_rearrange` → `allow_board_manipulation`;
  permit meld extension and meld merging even when the flag is off; only
  block splits, joker-swaps, regrouping
- [ ] C4: rewrite `expected_draws_to_complete` using negative-hypergeometric
  for *N* successes (exact via summation)
- [ ] C5: `unseen_pool(known, full_pool=None)` — accept injected pool,
  Game passes its actual pool
- [ ] M1: every turn must be a play with `tiles_played > 0` OR a draw —
  reject no-op proposals
- [ ] M2: declare winner by lowest hand penalty when game ends via pool
  exhaustion + stuck players
- [ ] M4: solver `maximize="points"` uses `meld_value_accurate`
- [ ] Property-based tests with Hypothesis: tile conservation, validator
  symmetry, joker substitution legality
- [ ] Solver output tests assert the actual melds, not just counts

### Phase 2 — Real solver (1 week)
Implement Hertog & Hulshof ILP for board-manipulation optimal play.
- Use `pulp` (free, CBC bundled) or `mip` (`python-mip`)
- Binary vars per (tile, candidate-meld-position)
- Constraints: every meld valid, every tile used ≤1 time, hand tiles only
  flow into the board (not reverse, unless rearrangement allowed)
- Objective: maximize tiles placed (configurable)
- Keep current `find_all_melds` etc. as `find_simple_melds` for tutorials
- New `BoardManipulator.solve(hand, board, rules) → new_board`
- Pipe solver output through existing validator to catch model bugs
- Benchmark: 14-hand + 30-board mid-game in <500 ms

References to consult before coding:
- Hertog & Hulshof 2006, "Solving Rummikub Problems by Integer Linear
  Programming"
- D. Eppstein 2017 notes on Rummikub complexity (NP-hard for general
  optimal play; tractable in practice with ILP for realistic sizes)

### Phase 3 — Strategy + probability rebuild (3–4 days)
- Joker-substitution-aware completion sets: `any_completion(partial)`
  returns sets of accepted draws (joker OR specific naturals)
- Negative-hypergeometric for multi-tile completion (depends on Phase 1 C4)
- Monte Carlo opponent sim (1000 games against random/simple-bot baselines)
  to give honest win-probability estimates
- Opening EV: P(can open within K draws) given current pool
- Replace `hand_flexibility` with EV(hand) under optimal play

### Phase 4 — Frontend (1–2 weeks)
React + FastAPI:
- FastAPI exposes the Python engine over HTTP (one module: `web/api.py`)
- React app: drag-and-drop tile rack, board view with meld grouping,
  "Suggest play" button calling the solver, "Show all completions"
  highlight, probability sidebar (tile scarcity heatmap, P(draw useful))
- Game replay mode for studying past games
- Style: leverage portfolio's tactical/industrial design system as a
  starting point (concrete neutrals, restrained color semantics)

### Phase 5 — Polish + 1.0 (half day)
- LICENSE (MIT), CHANGELOG, GitHub Actions for pytest on push
- Tag v0.1.0 after Phase 1 lands; v0.2.0 after Phase 2; v1.0 after Phase 4

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
