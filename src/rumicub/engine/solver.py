"""
Core solver: enumerate all valid melds and find the optimal play for a turn.

find_optimal_play() operates on hand tiles only.  Board rearrangement (the hard
NP-complete case) is validated by the validator but is not solved automatically
here — when allow_board_rearrange=True the player proposes the full board state
and the validator checks its legality.  The solver finds the best play assuming
the existing board melds remain untouched.

Optimisation goal (maximize parameter):
  "tiles_played" – place the most tiles from hand (default, classic strategy)
  "points"       – maximise the total point value of placed tiles
"""
from __future__ import annotations
from itertools import combinations
from typing import Callable

from ..tile import Tile
from ..rules import RuleSet, STANDARD_RULES, is_valid_meld, meld_value


# ── Enumeration ────────────────────────────────────────────────────────────────

def find_all_melds(tiles: list[Tile], rules: RuleSet = STANDARD_RULES) -> list[list[Tile]]:
    """Return every valid meld constructible from `tiles` (each tile used at most once)."""
    result: list[list[Tile]] = []
    n = len(tiles)
    for size in range(rules.min_meld_size, n + 1):
        for indices in combinations(range(n), size):
            subset = [tiles[i] for i in indices]
            if is_valid_meld(subset, rules):
                result.append(subset)
    return result


def find_all_complete_solutions(
    tiles: list[Tile],
    rules: RuleSet = STANDARD_RULES,
) -> list[list[list[Tile]]]:
    """
    Find all ways to partition `tiles` into valid melds (every tile used exactly once).
    Returns a list of solutions; each solution is a list of melds.
    Anchors on the first tile at each level to avoid duplicate orderings.
    """
    solutions: list[list[list[Tile]]] = []
    _partition(list(range(len(tiles))), tiles, [], solutions, rules)
    return solutions


def _partition(
    remaining: list[int],
    tiles: list[Tile],
    current: list[list[Tile]],
    out: list[list[list[Tile]]],
    rules: RuleSet,
):
    if not remaining:
        out.append([m[:] for m in current])
        return
    anchor = remaining[0]
    rest = remaining[1:]
    for size in range(rules.min_meld_size, len(remaining) + 1):
        for extras in combinations(rest, size - 1):
            subset = [tiles[anchor]] + [tiles[i] for i in extras]
            if is_valid_meld(subset, rules):
                used = {anchor} | set(extras)
                new_remaining = [i for i in remaining if i not in used]
                current.append(subset)
                _partition(new_remaining, tiles, current, out, rules)
                current.pop()


# ── Optimal play finder ────────────────────────────────────────────────────────

def find_optimal_play(
    hand: list[Tile],
    board: list[list[Tile]],
    rules: RuleSet = STANDARD_RULES,
    maximize: str = "tiles_played",
    on_new_best: Callable[[dict], None] | None = None,
) -> dict:
    """
    Find the best set of new melds the current player can lay from their hand,
    leaving the existing board melds intact.

    Returns a dict with:
        melds_to_place  – new melds formed entirely from hand tiles
        board_after     – full board state after the play (existing + new melds)
        hand_after      – tiles remaining in hand
        tiles_played    – number of hand tiles placed
        points          – sum of the placed hand tiles' accurate face values
    """
    best: dict = {
        "melds_to_place": [],
        "board_after": list(board),
        "hand_after": hand[:],
        "tiles_played": 0,
        "points": 0,
    }

    if not hand:
        return best

    _backtrack(
        remaining=hand[:],
        current_melds=[],
        best=best,
        board=board,
        rules=rules,
        maximize=maximize,
        on_new_best=on_new_best,
    )
    return best


def _score(melds: list[list[Tile]]) -> tuple[int, int]:
    """Return (tiles_played, points) for a set of melds."""
    tp = sum(len(m) for m in melds)
    pts = sum(meld_value(m) for m in melds)
    return tp, pts


def _backtrack(
    remaining: list[Tile],
    current_melds: list[list[Tile]],
    best: dict,
    board: list[list[Tile]],
    rules: RuleSet,
    maximize: str,
    on_new_best: Callable[[dict], None] | None,
):
    tp, pts = _score(current_melds)
    best_tp, best_pts = best["tiles_played"], best["points"]

    is_better = (
        tp > best_tp if maximize == "tiles_played"
        else (pts > best_pts or (pts == best_pts and tp > best_tp))
    )

    if is_better:
        best["melds_to_place"] = [m[:] for m in current_melds]
        best["board_after"] = list(board) + [m[:] for m in current_melds]
        best["hand_after"] = remaining[:]
        best["tiles_played"] = tp
        best["points"] = pts
        if on_new_best:
            on_new_best(dict(best))

    n = len(remaining)
    for size in range(rules.min_meld_size, n + 1):
        for combo in combinations(range(n), size):
            subset = [remaining[i] for i in combo]
            if is_valid_meld(subset, rules):
                new_remaining = [remaining[i] for i in range(n) if i not in set(combo)]
                current_melds.append(subset)
                _backtrack(new_remaining, current_melds, best, board, rules, maximize, on_new_best)
                current_melds.pop()
