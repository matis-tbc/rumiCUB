"""
Performance baselines for the engine. Catches regressions in solver,
validator, and probability functions.

Run with: pytest tests/test_performance.py --benchmark-only
Skip with: pytest -k 'not performance' (or no special flags by default,
           pytest-benchmark runs them as normal tests too).

These are baselines, not hard SLAs. The numbers in the assertions are
"shouldn't get drastically worse." Phase 2 (ILP solver) will move the
goalposts.
"""
from __future__ import annotations
import random

import pytest

from rumicub.tile import Tile, Color, TileSet, JOKER
from rumicub.rules import STANDARD_RULES, is_valid_meld
from rumicub.engine.solver import find_all_melds, find_optimal_play
from rumicub.engine.validator import validate_turn
from rumicub.analysis.probability import (
    expected_draws_to_complete, prob_complete_in_k_draws, tile_scarcity,
)

R, B, BK, O = Color.RED, Color.BLUE, Color.BLACK, Color.ORANGE


def _t(n, c): return Tile(number=n, color=c)


# ── Solver benchmarks ────────────────────────────────────────────────────────

def test_bench_find_all_melds_typical_hand(benchmark):
    """14-tile typical hand: enumerate all valid melds."""
    random.seed(42)
    pool = TileSet.standard()
    random.shuffle(pool)
    hand = pool[:14]
    benchmark(find_all_melds, hand)


def test_bench_find_optimal_play_rich_hand(benchmark):
    """A hand engineered to have many overlapping plays."""
    hand = [
        _t(1, R), _t(2, R), _t(3, R), _t(4, R), _t(5, R),
        _t(7, R), _t(7, B), _t(7, BK), _t(7, O),
        _t(10, B), _t(11, B), _t(12, B), _t(13, B), JOKER,
    ]
    result = benchmark(find_optimal_play, hand, [])
    # Sanity: the rich hand should play most/all tiles
    assert result["tiles_played"] >= 13


def test_bench_find_optimal_play_no_play(benchmark):
    """Hand with no valid play — solver should bail fast."""
    hand = [_t(1, R), _t(3, R), _t(5, R), _t(7, R), _t(9, R)]
    result = benchmark(find_optimal_play, hand, [])
    assert result["tiles_played"] == 0


# ── Validator benchmarks ─────────────────────────────────────────────────────

def test_bench_validate_simple_play(benchmark):
    """Single-meld validation — the hot path during interactive play."""
    hand = [_t(1, R), _t(2, R), _t(3, R)]
    benchmark(
        validate_turn,
        hand_before=hand, board_before=[],
        hand_after=[], board_after=[[_t(1, R), _t(2, R), _t(3, R)]],
        has_opened=True,
    )


def test_bench_validate_complex_board(benchmark):
    """Validate a play against a 10-meld board."""
    board = [
        [_t(n, c) for n in (i, i+1, i+2)]
        for i, c in zip([1, 4, 7, 10, 1, 4, 7, 10, 1, 4], [R, R, R, R, B, B, B, B, BK, BK])
    ]
    hand = [_t(7, O), _t(7, BK), _t(7, R)]
    # The "new" board adds a group of 7s
    new_board = board + [[_t(7, R), _t(7, B), _t(7, BK)]]
    benchmark(
        validate_turn,
        hand_before=hand, board_before=board,
        hand_after=[_t(7, O)], board_after=new_board,
        has_opened=True,
    )


# ── Probability benchmarks ───────────────────────────────────────────────────

def test_bench_expected_draws(benchmark):
    partial = [_t(1, R), _t(2, R)]
    target = [_t(1, R), _t(2, R), _t(3, R)]
    benchmark(expected_draws_to_complete, partial, target, [])


def test_bench_prob_complete_k_draws(benchmark):
    partial = [_t(1, R)]
    target = [_t(1, R), _t(2, R), _t(3, R)]
    benchmark(prob_complete_in_k_draws, partial, target, [], 10)


def test_bench_tile_scarcity(benchmark):
    """Compute scarcity over a 30-tile known set."""
    random.seed(42)
    pool = TileSet.standard()
    random.shuffle(pool)
    known = pool[:30]
    benchmark(tile_scarcity, known)
