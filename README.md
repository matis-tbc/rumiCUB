# rumiCUB

A full Rummikub game engine written in Python, with:

- **Pluggable rule variants** — standard rules plus color restrictions, number exclusions, joker lockouts, opening thresholds, and more
- **Solver** — enumerate every valid meld from a tile set; find all complete tile partitions; find the optimal play in a single turn (maximise tiles played or points)
- **Validator** — verify any proposed board state is legal given the previous state, the player's hand, and the active rule set
- **Probability engine** — exact hypergeometric calculations for draw probabilities, expected turns to complete a partial meld, tile scarcity, and colour/number distributions
- **Strategy advisor** — combine the solver and probability engine to recommend the best action each turn, rank partial melds, and quantify hand flexibility

---

## Project layout

```
src/rumicub/
├── tile.py             Tile, Color, TileSet (standard & restricted pools)
├── rules.py            RuleSet dataclass + meld validation (run, group)
├── game.py             Game orchestration (deal, draw, play, score)
├── engine/
│   ├── solver.py       find_all_melds · find_all_complete_solutions · find_optimal_play
│   └── validator.py    validate_turn (tile conservation, board legality, opening rule)
└── analysis/
    ├── probability.py  unseen_pool · prob_draw_* · expected_draws_to_complete · tile_scarcity
    └── strategy.py     advise · rank_partial_melds · hand_flexibility
tests/
examples/
    solver_demo.py
    basic_game.py
```

---

## Quickstart

```bash
pip install -e ".[dev]"
pytest
python examples/solver_demo.py
```

---

## Rule variants

```python
from rumicub.rules import RuleSet
from rumicub.tile import Color

rules = RuleSet(
    initial_meld_min_points=40,       # harder opening threshold
    jokers_per_meld=2,                # allow two jokers in one meld
    joker_lockout_turns=2,            # joker can't be taken back for 2 turns
    allow_board_rearrange=False,      # no restructuring existing melds
    excluded_numbers=frozenset({13}), # remove 13s from legal melds
    allowed_color_combos=frozenset({  # only these 3-color group combos
        frozenset({Color.RED, Color.BLUE, Color.BLACK}),
    }),
)
```

---

## Solver

```python
from rumicub.engine.solver import find_all_melds, find_optimal_play

melds   = find_all_melds(hand)
optimal = find_optimal_play(hand, board, maximize="tiles_played")
print(optimal["tiles_played"], optimal["points"], optimal["hand_after"])
```

---

## Probability & strategy

```python
from rumicub.analysis.probability import expected_draws_to_complete
from rumicub.analysis.strategy import advise

e = expected_draws_to_complete(partial_meld, target_meld, known_tiles)
advice = advise(hand, board, has_opened=False)
print(advice.action, advice.reasoning)
```
