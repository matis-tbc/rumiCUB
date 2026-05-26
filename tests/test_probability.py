from fractions import Fraction
import pytest
from rumicub.tile import Tile, Color, TileSet, JOKER
from rumicub.analysis.probability import (
    unseen_pool,
    prob_draw_specific,
    prob_draw_any_of,
    expected_draws_to_complete,
    prob_complete_in_k_draws,
    color_distribution,
    number_distribution,
    tile_scarcity,
    tiles_needed_to_complete,
)

R, B, BK, O = Color.RED, Color.BLUE, Color.BLACK, Color.ORANGE


def t(n, c):
    return Tile(number=n, color=c)


def test_unseen_pool_full():
    pool = unseen_pool([])
    assert len(pool) == 106


def test_unseen_pool_removes_known():
    known = [t(1, R), t(1, R)]
    pool = unseen_pool(known)
    assert len(pool) == 104
    remaining_r1 = sum(1 for tile in pool if tile.number == 1 and tile.color == R)
    assert remaining_r1 == 0


def test_prob_draw_specific_basic():
    known = []
    p = prob_draw_specific(t(1, R), known)
    assert p == Fraction(2, 106)


def test_prob_draw_specific_after_seeing_one():
    known = [t(1, R)]
    p = prob_draw_specific(t(1, R), known)
    assert p == Fraction(1, 105)


def test_prob_draw_specific_none_left():
    known = [t(1, R), t(1, R)]
    p = prob_draw_specific(t(1, R), known)
    assert p == Fraction(0)


def test_prob_draw_any_of():
    targets = [t(1, R), t(2, R)]
    p = prob_draw_any_of(targets, [])
    # 2 copies each = 4 useful out of 106
    assert p == Fraction(4, 106)


def test_tiles_needed_already_complete():
    partial = [t(1, R), t(2, R), t(3, R)]
    target = [t(1, R), t(2, R), t(3, R)]
    assert tiles_needed_to_complete(partial, target) == []


def test_tiles_needed_one_missing():
    partial = [t(1, R), t(2, R)]
    target = [t(1, R), t(2, R), t(3, R)]
    needed = tiles_needed_to_complete(partial, target)
    assert len(needed) == 1
    assert needed[0] == t(3, R)


def test_expected_draws_already_complete():
    partial = [t(1, R), t(2, R), t(3, R)]
    assert expected_draws_to_complete(partial, partial, []) == 0.0


def test_expected_draws_finite():
    partial = [t(1, R), t(2, R)]
    target = [t(1, R), t(2, R), t(3, R)]
    e = expected_draws_to_complete(partial, target, [t(1, R), t(2, R)])
    assert 0 < e < float("inf")


def test_expected_draws_multi_tile_uses_negative_hypergeometric():
    # Need 2 tiles (R2, R3). Only R1 is known.
    # Pool 105, useful = 2 copies of R2 + 2 copies of R3 = 4.
    # E[draws to collect r=2 useful] = r * (N+1) / (K+1) = 2 * 106 / 5 = 42.4.
    # The pre-fix formula returned (N+1)/(K+1) ≈ 21 — half the correct value.
    partial = [t(1, R)]
    target = [t(1, R), t(2, R), t(3, R)]
    e = expected_draws_to_complete(partial, target, [t(1, R)])
    assert e == pytest.approx(42.4, abs=0.1)


def test_expected_draws_single_tile_unchanged():
    # For r=1 needed tile, the formula reduces to (N+1)/(K+1).
    partial = [t(1, R), t(2, R)]
    target = [t(1, R), t(2, R), t(3, R)]
    e = expected_draws_to_complete(partial, target, [t(1, R), t(2, R)])
    # Pool 104, useful = 2 copies of R3. E = 1 * 105 / 3 = 35.
    assert e == pytest.approx(35.0, abs=0.1)


def test_expected_draws_infinite_when_pool_lacks_tiles():
    partial = [t(1, R), t(2, R)]
    target = [t(1, R), t(2, R), t(3, R)]
    # Both R3s are already seen
    known = [t(1, R), t(2, R), t(3, R), t(3, R)]
    e = expected_draws_to_complete(partial, target, known)
    assert e == float("inf")


def test_unseen_pool_with_custom_full_pool():
    # Restricted pool: no 13s.
    from rumicub.tile import TileSet
    restricted = TileSet.restricted(excluded_numbers={13})
    pool = unseen_pool([], full_pool=restricted)
    assert len(pool) == len(restricted)
    assert all(t.number != 13 for t in pool if not t.is_joker)


def test_prob_draw_specific_respects_custom_pool():
    from rumicub.tile import TileSet
    restricted = TileSet.restricted(excluded_colors={Color.RED})
    # Drawing a red tile from a no-red pool should be impossible.
    p = prob_draw_specific(t(7, R), [], full_pool=restricted)
    assert p == Fraction(0)


# ── Joker-aware completion sets ───────────────────────────────────────────────

def test_any_completion_run_two_in_a_row():
    """[R1, R2] is completed by R3 (specific) OR a joker."""
    from rumicub.analysis.probability import any_completion_keys
    keys = any_completion_keys([t(1, R), t(2, R)])
    assert (3, R, False) in keys
    assert (None, None, True) in keys
    # NOT B3, BK3, O3 (wrong color)
    assert (3, Color.BLUE, False) not in keys


def test_any_completion_run_with_gap():
    """[R1, R3] is completed by R2 (gap) OR joker — R4 would not help."""
    from rumicub.analysis.probability import any_completion_keys
    keys = any_completion_keys([t(1, R), t(3, R)])
    assert (2, R, False) in keys
    assert (None, None, True) in keys
    assert (4, R, False) not in keys


def test_any_completion_group_two_distinct_colors():
    """[R7, B7] is completed by any of BK7, O7, or joker."""
    from rumicub.analysis.probability import any_completion_keys
    keys = any_completion_keys([t(7, R), t(7, B)])
    assert (7, Color.BLACK, False) in keys
    assert (7, Color.ORANGE, False) in keys
    assert (None, None, True) in keys
    # R7 already there — drawing another R7 doesn't form a group
    assert (7, Color.RED, False) not in keys


def test_any_completion_single_tile_partial_is_empty():
    """A 1-tile partial needs 2 more draws — out of single-draw scope."""
    from rumicub.analysis.probability import any_completion_keys
    keys = any_completion_keys([t(1, R)])
    assert keys == set()


def test_prob_complete_with_any_draw_joker_in_pool():
    """[R1, R2] with no relevant tiles seen — useful = 2 R3s + 2 jokers = 4/106."""
    from rumicub.analysis.probability import prob_complete_with_any_draw
    p = prob_complete_with_any_draw([t(1, R), t(2, R)], known_tiles=[])
    # Pool has 2 R3 + 2 JOKER = 4 useful out of 106
    assert p == Fraction(4, 106)


def test_expected_draws_to_any_completion_uses_joker():
    """The any-completion expected draws should be SHORTER than a specific
    target's expected draws, because more tiles are useful."""
    from rumicub.analysis.probability import (
        expected_draws_to_any_completion,
    )
    partial = [t(1, R), t(2, R)]
    e_any = expected_draws_to_any_completion(partial, known_tiles=[])
    # specific R3: useful=2, N=106 -> 107/3 ≈ 35.67
    # any (R3 or J): useful=4, N=106 -> 107/5 = 21.4
    assert e_any == pytest.approx(21.4, abs=0.1)


def test_prob_complete_in_k_already_done():
    partial = [t(1, R), t(2, R), t(3, R)]
    p = prob_complete_in_k_draws(partial, partial, [], k=1)
    assert p == Fraction(1)


def test_prob_complete_in_k_impossible():
    # Need t(3, R) but both copies are known/seen
    partial = [t(1, R), t(2, R)]
    target = [t(1, R), t(2, R), t(3, R)]
    known = [t(1, R), t(2, R), t(3, R), t(3, R)]
    p = prob_complete_in_k_draws(partial, target, known, k=10)
    assert p == Fraction(0)


def test_color_distribution():
    tiles = [t(1, R), t(2, R), t(3, B), JOKER]
    dist = color_distribution(tiles)
    assert dist["red"] == 2
    assert dist["blue"] == 1
    assert "JOKER" not in dist


def test_number_distribution():
    tiles = [t(1, R), t(1, B), t(7, BK)]
    dist = number_distribution(tiles)
    assert dist[1] == 2
    assert dist[7] == 1


def test_tile_scarcity_unseen():
    # No tiles seen — scarcity should be 0 for all
    scarcity = tile_scarcity([])
    assert all(v == 0.0 for v in scarcity.values())


def test_tile_scarcity_full_set_seen():
    scarcity = tile_scarcity(TileSet.standard())
    assert all(v == 1.0 for v in scarcity.values())
