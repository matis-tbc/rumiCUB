"""
Candidate-meld enumerator for the ILP solver.

Given an available tile pool (hand + board), enumerate every distinct valid
meld (run or group) that COULD be formed from those tiles. The ILP then picks
which of these candidates to use, subject to tile-conservation constraints.

Key design point: candidates are TILE LISTS, not abstract "meld types." Two
runs `[R1, R2, R3]` are the same candidate if the multiset of tile types
matches; the solver doesn't distinguish between the two physical copies of R1.

Joker handling:
    Jokers can substitute for any tile in a meld. We generate runs/groups
    with 0, 1, ..., k jokers (up to `rules.jokers_per_meld`). The joker's
    "represented" tile is implicit in the meld's structure — we never tag a
    joker with a specific identity in the candidate list (the validator and
    accurate-value functions infer this from context).
"""
from __future__ import annotations
from collections import Counter
from itertools import combinations
from typing import Iterator

from ..tile import Tile, Color, JOKER, MIN_NUMBER, MAX_NUMBER
from ..rules import RuleSet, STANDARD_RULES, is_valid_meld


def enumerate_candidate_melds(
    available: list[Tile],
    rules: RuleSet = STANDARD_RULES,
) -> list[list[Tile]]:
    """
    Every valid meld that could be assembled from `available` tiles
    (each tile used at most `count(tile in available)` times across all
    candidates — but the ILP enforces that, not this function).

    Deduplicated by meld signature (multiset of tile keys), so identical
    runs/groups appear only once.
    """
    seen: set[tuple] = set()
    out: list[list[Tile]] = []

    counts = _tile_counts(available)
    joker_count = counts.get(_JOKER_KEY, 0)
    max_jokers_per_meld = min(joker_count, rules.jokers_per_meld)

    for meld in _enumerate_runs(counts, max_jokers_per_meld, rules):
        sig = _meld_sig(meld)
        if sig not in seen and is_valid_meld(meld, rules):
            seen.add(sig)
            out.append(meld)

    for meld in _enumerate_groups(counts, max_jokers_per_meld, rules):
        sig = _meld_sig(meld)
        if sig not in seen and is_valid_meld(meld, rules):
            seen.add(sig)
            out.append(meld)

    return out


# ── Run enumeration ──────────────────────────────────────────────────────────

def _enumerate_runs(
    counts: dict[tuple, int],
    max_jokers: int,
    rules: RuleSet,
) -> Iterator[list[Tile]]:
    """
    Every valid run: same colour, consecutive numbers (with possible joker
    substitutions), length 3..max_run_size.
    """
    for color in Color:
        # Numbers of this color that are actually available
        avail_nums = {
            n for n in range(MIN_NUMBER, MAX_NUMBER + 1)
            if counts.get((n, color, False), 0) > 0
            and n not in rules.excluded_numbers
        }
        if not avail_nums:
            continue

        for length in range(rules.min_meld_size, rules.max_run_size + 1):
            # Window of `length` consecutive positions: numbers lo..lo+length-1
            for lo in range(MIN_NUMBER, MAX_NUMBER - length + 2):
                window = list(range(lo, lo + length))
                if any(n in rules.excluded_numbers for n in window):
                    continue
                present = [n for n in window if n in avail_nums]
                missing = [n for n in window if n not in avail_nums]
                missing_count = len(missing)
                if missing_count > max_jokers:
                    continue
                # Build the meld: present tiles + `missing_count` jokers
                meld = [Tile(number=n, color=color) for n in present]
                meld.extend([JOKER] * missing_count)
                yield meld

                # Also enumerate variants where additional jokers REPLACE
                # tiles that are present (e.g. [R1, J, R3] AND [R1, R2, J])
                # but only when at least one "present" tile could be swapped
                # AND the meld remains valid. This is more variants but matches
                # how a player can choose to use a joker even when the natural
                # tile is available.
                if missing_count < max_jokers:
                    yield from _runs_with_extra_jokers(
                        present, missing_count, max_jokers, color, length, lo
                    )


def _runs_with_extra_jokers(
    present_nums: list[int],
    base_jokers: int,
    max_jokers: int,
    color: Color,
    length: int,
    lo: int,
) -> Iterator[list[Tile]]:
    """
    Generate runs where extra jokers substitute for present tiles.

    Example: window 1..3 with R1, R2, R3 all present. base_jokers=0.
    With max_jokers=1: yield [J, R2, R3], [R1, J, R3], [R1, R2, J].
    """
    extra = max_jokers - base_jokers
    if extra <= 0 or not present_nums:
        return
    # Use at most one extra joker (per-meld joker cap covers it, and more
    # extras explode the candidate space without much benefit since they're
    # all variants of the same underlying play).
    for jokers_extra in range(1, extra + 1):
        if jokers_extra > len(present_nums):
            break
        for which_replace in combinations(present_nums, jokers_extra):
            meld = []
            for n in range(lo, lo + length):
                if n in present_nums and n not in which_replace:
                    meld.append(Tile(number=n, color=color))
                else:
                    meld.append(JOKER)
            yield meld


# ── Group enumeration ────────────────────────────────────────────────────────

def _enumerate_groups(
    counts: dict[tuple, int],
    max_jokers: int,
    rules: RuleSet,
) -> Iterator[list[Tile]]:
    """
    Every valid group: same number, distinct colours (with possible joker
    substitutions), size 3..max_group_size.
    """
    for number in range(MIN_NUMBER, MAX_NUMBER + 1):
        if number in rules.excluded_numbers:
            continue
        avail_colors = [
            c for c in Color if counts.get((number, c, False), 0) > 0
        ]
        if not avail_colors and max_jokers == 0:
            continue

        for size in range(rules.min_meld_size, rules.max_group_size + 1):
            # Choose how many naturals vs jokers
            for n_jokers in range(0, min(size, max_jokers) + 1):
                n_naturals = size - n_jokers
                if n_naturals > len(avail_colors):
                    continue
                if n_naturals == 0:
                    # All jokers — invalid (need at least one natural to set
                    # the number).
                    continue
                for colors in combinations(avail_colors, n_naturals):
                    meld = [Tile(number=number, color=c) for c in colors]
                    meld.extend([JOKER] * n_jokers)
                    yield meld


# ── Helpers ──────────────────────────────────────────────────────────────────

_JOKER_KEY = (None, None, True)


def _tile_counts(tiles: list[Tile]) -> dict[tuple, int]:
    """Map each (number, color, is_joker) key to its count."""
    out: dict[tuple, int] = {}
    for t in tiles:
        key = (t.number, t.color, t.is_joker)
        out[key] = out.get(key, 0) + 1
    return out


def _meld_sig(meld: list[Tile]) -> tuple:
    """Canonical, order-independent meld signature."""
    def _norm(tile: Tile) -> tuple:
        n = tile.number if tile.number is not None else -1
        c = tile.color.value if tile.color is not None else ""
        return (n, c, tile.is_joker)
    items = sorted(Counter(_norm(t) for t in meld).items())
    return tuple(items)
