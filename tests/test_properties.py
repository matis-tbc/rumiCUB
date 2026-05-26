"""
Property-based tests for invariants that should hold across any input.

These tests use Hypothesis to generate random hands / boards / proposed plays
and assert structural properties — tile conservation, validator symmetry,
joker handling. They catch bugs the example-based tests miss.
"""
from __future__ import annotations
from collections import Counter

import pytest
from hypothesis import given, strategies as st, settings, assume, HealthCheck

from rumicub.tile import Tile, Color, TileSet, JOKER
from rumicub.rules import (
    RuleSet, STANDARD_RULES,
    is_valid_meld, is_valid_run, is_valid_group, meld_value_accurate,
)
from rumicub.engine.solver import find_optimal_play, find_all_melds
from rumicub.engine.validator import validate_turn


# ── Strategies ────────────────────────────────────────────────────────────────

@st.composite
def real_tile(draw):
    """A non-joker tile with valid number+color."""
    n = draw(st.integers(min_value=1, max_value=13))
    c = draw(st.sampled_from(list(Color)))
    return Tile(number=n, color=c)


@st.composite
def tile_or_joker(draw):
    if draw(st.booleans()):
        return JOKER
    return draw(real_tile())


@st.composite
def small_hand(draw):
    """Random hand of 0-8 tiles. Small enough to keep solver tractable."""
    n = draw(st.integers(min_value=0, max_value=8))
    return [draw(tile_or_joker()) for _ in range(n)]


def _key(tile: Tile) -> tuple:
    return (tile.number, tile.color, tile.is_joker)


# ── Conservation properties ──────────────────────────────────────────────────

@given(hand=small_hand())
@settings(suppress_health_check=[HealthCheck.too_slow], deadline=2000)
def test_solver_conserves_tiles(hand):
    """Tiles placed + tiles remaining in hand must equal the original hand."""
    result = find_optimal_play(hand, board=[])
    placed = Counter()
    for m in result["melds_to_place"]:
        placed.update(_key(t) for t in m)
    remaining = Counter(_key(t) for t in result["hand_after"])
    original = Counter(_key(t) for t in hand)
    assert placed + remaining == original, (
        f"Hand: {hand}\nPlaced: {placed}\nRemaining: {remaining}\nOriginal: {original}"
    )


@given(hand=small_hand())
@settings(suppress_health_check=[HealthCheck.too_slow], deadline=2000)
def test_solver_output_melds_are_all_valid(hand):
    """Every meld the solver returns must pass is_valid_meld."""
    result = find_optimal_play(hand, board=[])
    for meld in result["melds_to_place"]:
        assert is_valid_meld(meld), f"Solver returned invalid meld: {meld}"


@given(hand=small_hand())
@settings(suppress_health_check=[HealthCheck.too_slow], deadline=2000)
def test_find_all_melds_returns_only_valid_melds(hand):
    melds = find_all_melds(hand)
    for meld in melds:
        assert is_valid_meld(meld)


@given(hand=small_hand())
@settings(suppress_health_check=[HealthCheck.too_slow], deadline=2000)
def test_solver_tiles_played_equals_meld_tile_count(hand):
    result = find_optimal_play(hand, board=[])
    placed = sum(len(m) for m in result["melds_to_place"])
    assert placed == result["tiles_played"]


# ── Validator symmetry ───────────────────────────────────────────────────────

@given(hand=small_hand())
@settings(suppress_health_check=[HealthCheck.too_slow], deadline=2000)
def test_solver_output_passes_validator(hand):
    """If the solver returns a play, the validator must accept it."""
    result = find_optimal_play(hand, board=[])
    if result["tiles_played"] == 0:
        return
    ok, reason = validate_turn(
        hand_before=hand,
        board_before=[],
        hand_after=result["hand_after"],
        board_after=result["board_after"],
        has_opened=True,   # bypass opening threshold; we test structure
        rules=STANDARD_RULES,
    )
    assert ok, f"Solver returned a play the validator rejects: {reason}"


# ── Joker properties ────────────────────────────────────────────────────────

@given(joker_count=st.integers(min_value=0, max_value=2))
def test_meld_value_accurate_never_exceeds_max_tile_value_times_count(joker_count):
    """A meld with k tiles cannot score more than k * 13."""
    # Build a meld with jokers: [J, R2, R3] etc
    if joker_count == 0:
        meld = [Tile(number=5, color=Color.RED),
                Tile(number=6, color=Color.RED),
                Tile(number=7, color=Color.RED)]
    elif joker_count == 1:
        meld = [Tile(number=11, color=Color.RED),
                Tile(number=12, color=Color.RED),
                JOKER]
    else:  # 2 jokers, custom rules
        meld = [Tile(number=11, color=Color.RED), JOKER, JOKER]
        # is_valid_meld won't accept under default rules (max 1 joker)
        return

    assert meld_value_accurate(meld) <= len(meld) * 13
