"""
Rule set definitions and meld validation for rumiCUB.

Two value functions exist intentionally:
  meld_value()          – face value, joker=30 (used for end-game penalty scoring).
  meld_value_accurate() – joker counts as the tile it represents (used for opening-meld threshold).
"""
from __future__ import annotations
from dataclasses import dataclass, field
from itertools import combinations
from typing import Optional, FrozenSet

from .tile import Tile, Color, MIN_NUMBER, MAX_NUMBER


@dataclass
class RuleSet:
    # ── Opening ───────────────────────────────────────────────────────────
    initial_meld_min_points: int = 30
    opening_hand_only: bool = True       # first meld must use only hand tiles, not board tiles

    # ── Meld structure ────────────────────────────────────────────────────
    min_meld_size: int = 3
    max_group_size: int = 4
    max_run_size: int = 13

    # ── Joker rules ───────────────────────────────────────────────────────
    jokers_per_meld: int = 1
    joker_lockout_turns: int = 0         # turns a placed joker is protected from retrieval
    joker_replacement_allowed: bool = True

    # ── Board manipulation ────────────────────────────────────────────────
    # Allows splitting existing melds, merging two melds into one, joker-swap
    # retrieval, and full regrouping. Extending an existing meld with a
    # hand tile is ALWAYS legal regardless of this flag — that's not
    # manipulation, it's placing a tile onto an existing meld.
    allow_board_manipulation: bool = True

    # ── Color/number restrictions ─────────────────────────────────────────
    allowed_color_combos: Optional[FrozenSet[FrozenSet[Color]]] = None
    excluded_numbers: FrozenSet[int] = field(default_factory=frozenset)

    # ── Scoring / penalties ───────────────────────────────────────────────
    penalize_unplayed: bool = True
    joker_penalty: int = 30              # penalty value for joker held at end of game

    # ── Misc variants ─────────────────────────────────────────────────────
    must_play_if_possible: bool = False  # forbid drawing when a valid play exists


STANDARD_RULES = RuleSet()


# ── Joker value helpers ────────────────────────────────────────────────────────

def joker_values_in_meld(meld: list[Tile]) -> list[int]:
    """
    Return the face value each joker represents in this meld.

    Group → joker = the shared number.
    Run   → jokers fill gaps (low-to-high) first; remaining jokers extend the
            high end then the low end (maximising value for threshold checking).
    Returns one int per joker in the meld; returns [] if there are no jokers.
    """
    non_jokers = [t for t in meld if not t.is_joker]
    joker_count = sum(1 for t in meld if t.is_joker)
    if joker_count == 0 or not non_jokers:
        return []

    # Group: all non-jokers share the same number
    nums_set = {t.number for t in non_jokers}
    if len(nums_set) == 1:
        return [next(iter(nums_set))] * joker_count

    # Run: assign jokers to maximise total value
    sorted_nums = sorted(t.number for t in non_jokers)  # type: ignore[misc]
    gap_values: list[int] = []
    for i in range(len(sorted_nums) - 1):
        gap_values.extend(range(sorted_nums[i] + 1, sorted_nums[i + 1]))

    joker_vals: list[int] = []
    remaining = joker_count

    # Fill gaps first (ordering: lowest gap first)
    for g in gap_values:
        if remaining > 0:
            joker_vals.append(g)
            remaining -= 1

    # Extend high end (higher value), then low end
    hi, lo = sorted_nums[-1], sorted_nums[0]
    while remaining > 0:
        if hi + 1 <= MAX_NUMBER:
            hi += 1
            joker_vals.append(hi)
            remaining -= 1
        elif lo - 1 >= MIN_NUMBER:
            lo -= 1
            joker_vals.insert(0, lo)
            remaining -= 1
        else:
            break  # valid meld can't have more jokers than fit

    return joker_vals


def meld_value(meld: list[Tile]) -> int:
    """Face value sum — joker counts as 30 (used for end-game penalty)."""
    return sum(t.value() for t in meld)


def meld_value_accurate(meld: list[Tile]) -> int:
    """
    True value sum — joker counts as the tile it represents.
    Use this for the opening-meld 30-point threshold check.
    """
    non_joker_total = sum(t.number for t in meld if not t.is_joker)  # type: ignore[misc]
    return non_joker_total + sum(joker_values_in_meld(meld))


# ── Meld validation ────────────────────────────────────────────────────────────

def is_valid_run(tiles: list[Tile], rules: RuleSet = STANDARD_RULES) -> bool:
    """
    Run: 3–max_run_size consecutive numbers, all the same color.
    At most `jokers_per_meld` jokers; jokers fill any gap or extend either end.
    Numbers stay within [1, 13]; no duplicate numbers allowed.
    """
    n = len(tiles)
    if n < rules.min_meld_size or n > rules.max_run_size:
        return False

    non_jokers = [t for t in tiles if not t.is_joker]
    jokers = [t for t in tiles if t.is_joker]

    if len(jokers) > rules.jokers_per_meld:
        return False
    if not non_jokers:
        return False

    colors = {t.color for t in non_jokers}
    if len(colors) != 1:
        return False

    numbers = sorted(t.number for t in non_jokers)  # type: ignore[misc]

    # No duplicate numbers
    if len(numbers) != len(set(numbers)):
        return False

    if any(num in rules.excluded_numbers for num in numbers):
        return False

    lo, hi = numbers[0], numbers[-1]
    if lo < MIN_NUMBER or hi > MAX_NUMBER:
        return False

    span = hi - lo + 1
    gaps = span - len(non_jokers)

    # Gaps must be fillable by available jokers; span must fit in `n` tiles
    if gaps < 0 or gaps > len(jokers):
        return False
    if span > n:
        return False

    return True


def is_valid_group(tiles: list[Tile], rules: RuleSet = STANDARD_RULES) -> bool:
    """
    Group: 3–max_group_size tiles of the same number in distinct colors.
    At most `jokers_per_meld` jokers; joker color is inferred from context when
    colour restrictions apply — any valid colour assignment makes the group legal.
    """
    n = len(tiles)
    if n < rules.min_meld_size or n > rules.max_group_size:
        return False

    non_jokers = [t for t in tiles if not t.is_joker]
    jokers = [t for t in tiles if t.is_joker]

    if len(jokers) > rules.jokers_per_meld:
        return False
    if not non_jokers:
        return False

    numbers = {t.number for t in non_jokers}
    if len(numbers) != 1:
        return False

    num = next(iter(numbers))
    if num in rules.excluded_numbers:
        return False

    non_joker_colors = [t.color for t in non_jokers]
    if len(non_joker_colors) != len(set(non_joker_colors)):
        return False  # duplicate colours

    if rules.allowed_color_combos is not None:
        non_joker_color_set = frozenset(non_joker_colors)
        if not jokers:
            if non_joker_color_set not in rules.allowed_color_combos:
                return False
        else:
            # Try every valid colour assignment for the jokers
            available = [c for c in Color if c not in non_joker_color_set]
            found = any(
                (non_joker_color_set | frozenset(extra)) in rules.allowed_color_combos
                for extra in combinations(available, len(jokers))
            )
            if not found:
                return False

    return True


def is_valid_meld(tiles: list[Tile], rules: RuleSet = STANDARD_RULES) -> bool:
    return is_valid_run(tiles, rules) or is_valid_group(tiles, rules)


def board_is_valid(board: list[list[Tile]], rules: RuleSet = STANDARD_RULES) -> bool:
    return all(is_valid_meld(meld, rules) for meld in board)
