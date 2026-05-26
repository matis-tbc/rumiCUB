"""
Hand-computed Rummikub positions with their known optimal hand-only plays.

Each fixture is a Position dataclass. The oracle test asserts:
  - solver tiles_played matches expected_tiles
  - solver points_true matches expected_points
  - solver melds_to_place matches ONE OF the entries in expected_melds
    (some positions have multiple equally-optimal plays).

These oracles are the safety net for the solver: if any change to
find_optimal_play breaks one of these, the regression is loud and the
exact mismatch is easy to read.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import FrozenSet

from rumicub.tile import Tile, Color, JOKER

R, B, BK, O = Color.RED, Color.BLUE, Color.BLACK, Color.ORANGE


def t(n: int, c: Color) -> Tile:
    return Tile(number=n, color=c)


def _key(tile: Tile) -> tuple:
    return (tile.number, tile.color, tile.is_joker)


def meld_key(meld: list[Tile]) -> FrozenSet:
    """Order-independent key for a meld (multiset of tile keys)."""
    from collections import Counter
    return frozenset(Counter(_key(t) for t in meld).items())


def _melds(*melds: list[Tile]) -> frozenset:
    return frozenset(meld_key(m) for m in melds)


def _any(*meld_sets: frozenset) -> tuple:
    """Bundle multiple equally-optimal meld-sets for ambiguous positions."""
    return tuple(meld_sets)


@dataclass(frozen=True)
class Position:
    name: str
    hand: tuple
    board: tuple
    has_opened: bool
    expected_tiles: int
    expected_points: int
    expected_melds: tuple   # tuple of frozensets (acceptable solutions)
    notes: str = ""


# Build the run-split alternatives for the full 13-tile run programmatically:
# any partition into contiguous chunks of size >=3 is equally optimal under
# maximize="tiles_played" since they all play 13 tiles.
def _full_13_blue_alternatives() -> tuple:
    tiles = [t(n, B) for n in range(1, 14)]
    alts = []
    # Single 13-run
    alts.append(_melds(tiles))
    # 3+3+3+4 (1-3, 4-6, 7-9, 10-13)
    alts.append(_melds(tiles[0:3], tiles[3:6], tiles[6:9], tiles[9:13]))
    # 3+3+4+3 (1-3, 4-6, 7-10, 11-13)
    alts.append(_melds(tiles[0:3], tiles[3:6], tiles[6:10], tiles[10:13]))
    # 3+4+3+3 (1-3, 4-7, 8-10, 11-13)
    alts.append(_melds(tiles[0:3], tiles[3:7], tiles[7:10], tiles[10:13]))
    # 4+3+3+3 (1-4, 5-7, 8-10, 11-13)
    alts.append(_melds(tiles[0:4], tiles[4:7], tiles[7:10], tiles[10:13]))
    return tuple(alts)


POSITIONS: list[Position] = [
    Position(
        name="simple_run",
        hand=(t(1, R), t(2, R), t(3, R), t(9, O)),
        board=(),
        has_opened=True,
        expected_tiles=3,
        expected_points=6,
        expected_melds=_any(_melds([t(1, R), t(2, R), t(3, R)])),
        notes="Trivial run. Should leave O9 in hand.",
    ),
    Position(
        name="run_plus_group",
        hand=(t(1, R), t(2, R), t(3, R), t(7, R), t(7, B), t(7, BK)),
        board=(),
        has_opened=True,
        expected_tiles=6,
        expected_points=6 + 21,
        expected_melds=_any(_melds(
            [t(1, R), t(2, R), t(3, R)],
            [t(7, R), t(7, B), t(7, BK)],
        )),
        notes="Both melds simultaneously.",
    ),
    Position(
        name="joker_extends_run_high",
        hand=(t(11, R), t(12, R), JOKER),
        board=(),
        has_opened=True,
        expected_tiles=3,
        expected_points=11 + 12 + 13,
        expected_melds=_any(_melds([t(11, R), t(12, R), JOKER])),
        notes="Joker extends to 13 (max value). Accurate=36.",
    ),
    Position(
        name="joker_fills_gap",
        hand=(t(5, B), JOKER, t(7, B)),
        board=(),
        has_opened=True,
        expected_tiles=3,
        expected_points=5 + 6 + 7,
        expected_melds=_any(_melds([t(5, B), JOKER, t(7, B)])),
        notes="Joker fills the gap as B6. Accurate=18.",
    ),
    Position(
        name="full_thirteen_run",
        hand=tuple(t(n, B) for n in range(1, 14)),
        board=(),
        has_opened=True,
        expected_tiles=13,
        expected_points=sum(range(1, 14)),
        expected_melds=_full_13_blue_alternatives(),
        notes="Max-length run, 13 tiles. Several valid partitions all play 13.",
    ),
    Position(
        name="prefer_more_tiles_over_fewer_high_value",
        hand=(t(11, R), t(12, R), t(13, R), t(1, B), t(2, B), t(3, B)),
        board=(),
        has_opened=True,
        expected_tiles=6,
        expected_points=36 + 6,
        expected_melds=_any(_melds(
            [t(11, R), t(12, R), t(13, R)],
            [t(1, B), t(2, B), t(3, B)],
        )),
        notes="tiles_played mode plays both runs.",
    ),
    Position(
        name="no_valid_meld",
        hand=(t(1, R), t(3, R), t(5, R), t(7, R)),
        board=(),
        has_opened=True,
        expected_tiles=0,
        expected_points=0,
        expected_melds=_any(_melds()),
        notes="Gaps of 2; no valid run, no group possible.",
    ),
    Position(
        name="group_of_four",
        hand=(t(8, R), t(8, B), t(8, BK), t(8, O)),
        board=(),
        has_opened=True,
        expected_tiles=4,
        expected_points=32,
        expected_melds=_any(_melds([t(8, R), t(8, B), t(8, BK), t(8, O)])),
        notes="All four colours of 8, full group.",
    ),
    Position(
        name="board_existing_unchanged",
        hand=(t(1, R), t(2, R), t(3, R)),
        board=([t(4, B), t(5, B), t(6, B)],),
        has_opened=True,
        expected_tiles=3,
        expected_points=6,
        expected_melds=_any(_melds([t(1, R), t(2, R), t(3, R)])),
        notes="Existing board meld stays untouched; hand-only solver.",
    ),
    Position(
        name="empty_hand",
        hand=(),
        board=(),
        has_opened=True,
        expected_tiles=0,
        expected_points=0,
        expected_melds=_any(_melds()),
        notes="Nothing to play.",
    ),
    Position(
        name="two_jokers_one_each_meld",
        hand=(JOKER, t(2, R), t(3, R), JOKER, t(5, B), t(5, BK)),
        board=(),
        has_opened=True,
        expected_tiles=6,
        expected_points=9 + 15,
        expected_melds=_any(_melds(
            [JOKER, t(2, R), t(3, R)],
            [JOKER, t(5, B), t(5, BK)],
        )),
        notes="Default rules allow 1 joker per meld; two melds, one joker each.",
    ),
]
