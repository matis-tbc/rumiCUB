"""
Probability engine for rumiCUB.

All calculations assume the unknown tiles are uniformly distributed among the
remaining (unseen) pool.  Pass `known_tiles` = hand + all visible board tiles.
"""
from __future__ import annotations
from collections import defaultdict
from fractions import Fraction
from math import comb

from ..tile import Tile, Color, TileSet, MIN_NUMBER, MAX_NUMBER
from ..rules import RuleSet, STANDARD_RULES


# ── Pool helpers ───────────────────────────────────────────────────────────────

def unseen_pool(known_tiles: list[Tile]) -> list[Tile]:
    """Return tiles not yet observed (hand + board)."""
    pool = TileSet.standard()
    seen = list(known_tiles)
    result = []
    for tile in pool:
        key = (tile.number, tile.color, tile.is_joker)
        found = next(
            (i for i, s in enumerate(seen) if (s.number, s.color, s.is_joker) == key), None
        )
        if found is not None:
            seen.pop(found)
        else:
            result.append(tile)
    return result


# ── Single-draw probabilities ──────────────────────────────────────────────────

def prob_draw_specific(target: Tile, known_tiles: list[Tile]) -> Fraction:
    """P(next draw == target) given known tiles."""
    pool = unseen_pool(known_tiles)
    if not pool:
        return Fraction(0)
    matching = sum(
        1 for t in pool
        if t.number == target.number and t.color == target.color and t.is_joker == target.is_joker
    )
    return Fraction(matching, len(pool))


def prob_draw_any_of(targets: list[Tile], known_tiles: list[Tile]) -> Fraction:
    """P(next draw is one of `targets`)."""
    pool = unseen_pool(known_tiles)
    if not pool:
        return Fraction(0)
    target_keys = {(t.number, t.color, t.is_joker) for t in targets}
    useful = sum(1 for t in pool if (t.number, t.color, t.is_joker) in target_keys)
    return Fraction(useful, len(pool))


# ── Completion probabilities ───────────────────────────────────────────────────

def tiles_needed_to_complete(
    partial: list[Tile], target: list[Tile]
) -> list[Tile]:
    """Tiles in `target` not yet in `partial`."""
    have = list(partial)
    needed = []
    for tile in target:
        key = (tile.number, tile.color, tile.is_joker)
        idx = next((i for i, h in enumerate(have) if (h.number, h.color, h.is_joker) == key), None)
        if idx is not None:
            have.pop(idx)
        else:
            needed.append(tile)
    return needed


def expected_draws_to_complete(
    partial: list[Tile],
    target: list[Tile],
    known_tiles: list[Tile],
) -> float:
    """
    Expected number of draws until the partial meld becomes complete,
    using a negative-hypergeometric approximation (sampling without replacement).
    """
    needed = tiles_needed_to_complete(partial, target)
    if not needed:
        return 0.0
    pool = unseen_pool(known_tiles)
    if not pool:
        return float("inf")
    needed_keys = {(t.number, t.color, t.is_joker) for t in needed}
    useful = sum(1 for t in pool if (t.number, t.color, t.is_joker) in needed_keys)
    if useful == 0:
        return float("inf")
    # E[draws] for first success in hypergeometric draw: (N+1)/(K+1) - 1
    N, K = len(pool), useful
    return (N + 1) / (K + 1)


def prob_complete_in_k_draws(
    partial: list[Tile],
    target: list[Tile],
    known_tiles: list[Tile],
    k: int,
) -> Fraction:
    """P(completing `target` within `k` draws) via hypergeometric CDF."""
    needed = tiles_needed_to_complete(partial, target)
    if not needed:
        return Fraction(1)
    pool = unseen_pool(known_tiles)
    N = len(pool)
    needed_keys = {(t.number, t.color, t.is_joker) for t in needed}
    K = sum(1 for t in pool if (t.number, t.color, t.is_joker) in needed_keys)
    need_count = len(needed)
    if K < need_count:
        return Fraction(0)
    # P(at least `need_count` successes in `k` draws from N tiles, K useful)
    denom = comb(N, k)
    if denom == 0:
        # k > N: drawing more tiles than exist — treat as certainty if K >= need_count
        return Fraction(1) if K >= need_count else Fraction(0)
    total = Fraction(0)
    for s in range(need_count, min(k, K) + 1):
        non_useful = N - K
        draws_non = k - s
        if draws_non < 0 or draws_non > non_useful:
            continue
        total += Fraction(comb(K, s) * comb(non_useful, draws_non), denom)
    return total


# ── Distribution statistics ────────────────────────────────────────────────────

def color_distribution(tiles: list[Tile]) -> dict[str, int]:
    dist: dict[str, int] = defaultdict(int)
    for t in tiles:
        if not t.is_joker:
            dist[t.color.value] += 1  # type: ignore[union-attr]
    return dict(dist)


def number_distribution(tiles: list[Tile]) -> dict[int, int]:
    dist: dict[int, int] = defaultdict(int)
    for t in tiles:
        if not t.is_joker:
            dist[t.number] += 1  # type: ignore[arg-type]
    return dict(dist)


def tile_scarcity(known_tiles: list[Tile]) -> dict[str, float]:
    """
    For each tile type, what fraction of its copies have been seen?
    High scarcity = most copies accounted for, drawing one is unlikely.
    """
    pool_full = TileSet.standard()
    total_counts: dict[tuple, int] = defaultdict(int)
    for t in pool_full:
        total_counts[(t.number, t.color, t.is_joker)] += 1

    seen_counts: dict[tuple, int] = defaultdict(int)
    for t in known_tiles:
        seen_counts[(t.number, t.color, t.is_joker)] += 1

    result = {}
    for key, total in total_counts.items():
        n, c, j = key
        label = "JOKER" if j else f"{c.value[0].upper()}{n}"  # type: ignore[union-attr]
        result[label] = seen_counts[key] / total
    return result
