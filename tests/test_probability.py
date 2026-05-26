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
