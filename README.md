# rumiCUBE

```
   ┌───┐ ┌───┐ ┌───┐ ┌───┐
   │ r │ │ u │ │ m │ │ i │
   └───┘ └───┘ └───┘ └───┘╲
                          ╲
              ┌───┐ ┌───┐ ┌───┐ ┌───┐
              │ C │ │ U │ │ B │ │ E │
              └───┘ └───┘ └───┘ └───┘
```

A Rummikub engine + ILP solver + bot framework + cube-themed web UI.

- **Pluggable rule variants** — color restrictions, number exclusions, joker
  lockouts, opening thresholds, custom tile pools
- **Hand-only meld enumerator** — every valid meld constructible from a hand
- **ILP board-manipulation solver** — proper integer programming that finds
  extensions, splits, joker swaps, full rearrangements. Beats the naive
  greedy strategy 10/10 in seeded self-play
- **Validator** — verify any proposed board state is legal given the prior
  state, the player's hand, and the active rule set
- **Probability engine** — exact hypergeometric draw probabilities,
  joker-substitution-aware completion sets, multi-tile negative-hypergeometric
- **Strategy advisor** — combines the solver + probability engine into per-turn
  recommendations + hand-quality EV scores
- **Bot framework** — RandomBot / GreedyBot / SolverBot, plus a Monte Carlo
  simulator for win-rate comparisons
- **Web frontend (in progress)** — isometric CSS-cube tile rack, drag-and-drop,
  live solver hints, probability sidebar

---

## Project layout

```
src/rumicub/
├── tile.py             Tile, Color, TileSet (standard & restricted pools)
├── rules.py            RuleSet dataclass + meld validation
├── game.py             Game orchestration (deal, draw, play, score, propose)
├── engine/
│   ├── solver.py       find_all_melds · find_all_complete_solutions ·
│   │                   find_optimal_play (hand-only)
│   ├── candidates.py   enumerate_candidate_melds (structure-aware, fast)
│   ├── ilp_solver.py   BoardManipulator — ILP board manipulation
│   └── validator.py    validate_turn
├── analysis/
│   ├── probability.py  pool-aware draw probabilities + joker-aware completions
│   ├── strategy.py     advise · hand_quality_score · prob_can_open_within_k_draws
│   └── monte_carlo.py  simulate_game · simulate_many · SimulationStats
└── bot/
    ├── base.py         Bot ABC
    ├── random_bot.py   plays highest-value valid meld (baseline)
    ├── greedy_bot.py   iteratively plays largest valid meld
    ├── solver_bot.py   uses BoardManipulator for optimal play
    └── arena.py        CLI: python -m rumicub.bot.arena --p1 ... --p2 ...
```

---

## Quickstart

```bash
# Core only (hand-only solver, validator, probability):
pip install -e .

# With ILP solver (PuLP + CBC):
pip install -e '.[solver]'

# Dev install (tests, benchmarks, hypothesis):
pip install -e '.[dev]'

pytest tests/                  # 202 tests
python examples/solver_demo.py
python -m rumicub.bot.arena --p1 solver --p2 greedy --games 10
```

---

## Rule variants

```python
from rumicub.rules import RuleSet
from rumicub.tile import Color

rules = RuleSet(
    initial_meld_min_points=40,         # harder opening threshold
    jokers_per_meld=2,                  # allow two jokers in one meld
    joker_lockout_turns=2,              # joker can't be retrieved for N turns
    allow_board_manipulation=False,     # no splits / regroupings (extension still allowed)
    excluded_numbers=frozenset({13}),   # drop 13s from the pool
    allowed_color_combos=frozenset({    # only these 3-color group combos
        frozenset({Color.RED, Color.BLUE, Color.BLACK}),
    }),
)
```

---

## Hand-only solver

```python
from rumicub.engine.solver import find_optimal_play

best = find_optimal_play(hand, board, maximize="tiles_played")
print(best["tiles_played"], best["points_true"], best["melds_to_place"])
```

`points_true` uses accurate joker valuation (joker = represented value);
`points` is the end-game penalty scale (joker = 30). Use `points_true` for
opening-threshold checks.

---

## ILP board-manipulation solver

```python
from rumicub.engine.ilp_solver import BoardManipulator

result = BoardManipulator(rules).solve(hand, board)
if result.status == "Optimal":
    print(f"played {result.tiles_played} tiles in {result.solve_time_ms:.0f}ms")
    game.play_melds(result.board_after)
```

This is the proper solver — it can extend an existing `[B7, BK7, O7]` group
with your `[R7]` to a 4-tile group, split runs to free a tile your hand can
use, retrieve and re-place jokers, etc. The naive `find_optimal_play` cannot
do any of these.

---

## Probability + strategy

```python
from rumicub.analysis.probability import (
    any_completion_keys, prob_complete_with_any_draw, expected_draws_to_any_completion,
)
from rumicub.analysis.strategy import hand_quality_score, advise

advice = advise(hand, board, has_opened=False)
quality = hand_quality_score(hand, known_tiles=hand)
# {'can_open_now': bool, 'best_play_value': int, 'prob_open_in_3': float,
#  'penalty_if_loss': int, 'partial_count': int, ...}
```

---

## Bot vs bot

```bash
python -m rumicub.bot.arena --p1 solver --p2 greedy --games 10
# → solver: 10/10 wins. ILP-driven manipulation > hand-only greed.
```

Or programmatically:

```python
from rumicub.bot import SolverBot, GreedyBot
from rumicub.analysis.monte_carlo import simulate_many

stats = simulate_many(SolverBot(), GreedyBot(), n_games=100)
print(stats.win_counts, stats.win_rate_ci("solver"))
```

---

## Status

| Phase | What | Status |
|---|---|---|
| 1 | Fix 10 known engine bugs, add property + oracle + benchmark tests | done (v0.1.0) |
| 2 | ILP board-manipulation solver | done (v0.2.0) |
| 3 | Joker-aware probability + EV-based hand quality | done (v0.3.0) |
| 3.5 | Bot framework + Monte Carlo + arena CLI | done (v0.3.0) |
| 4 | Rebrand to rumiCUBE + FastAPI backend + Vite/React cube-themed UI | done (v0.4.0) |
| 4.4 | Drag-and-drop (hand→board) + probability sidebar | done (v0.5.0) |
| 4.5 | DnD v2 — every board tile draggable, full rearrangement | done (v0.6.0) |
| 5 | LICENSE, CHANGELOG, CI, single-player vs bot, deploy, v1.0 release | upcoming |
