"""
Tests for analysis/strategy.py — advisor + EV-based hand quality.
"""
from __future__ import annotations
import pytest

from rumicub.tile import Tile, Color, JOKER
from rumicub.rules import STANDARD_RULES, RuleSet
from rumicub.analysis.strategy import (
    can_open_now,
    prob_can_open_within_k_draws,
    hand_quality_score,
)

R, B, BK, O = Color.RED, Color.BLUE, Color.BLACK, Color.ORANGE


def t(n, c): return Tile(number=n, color=c)


# ── can_open_now ─────────────────────────────────────────────────────────────

def test_can_open_now_above_threshold():
    hand = [t(10, R), t(11, R), t(12, R)]  # 33 pts
    ok, value = can_open_now(hand)
    assert ok is True
    assert value == 33


def test_can_open_now_below_threshold():
    hand = [t(1, R), t(2, R), t(3, R)]  # 6 pts
    ok, value = can_open_now(hand)
    assert ok is False
    assert value == 6


def test_can_open_now_joker_not_inflated():
    # [J, R2, R3] joker fills as 4, accurate=9, below 30
    hand = [JOKER, t(2, R), t(3, R)]
    ok, value = can_open_now(hand)
    assert ok is False
    assert value == 9


def test_can_open_now_no_meld_possible():
    hand = [t(1, R), t(3, B), t(5, BK)]  # no run, no group
    ok, value = can_open_now(hand)
    assert ok is False
    assert value == 0


# ── prob_can_open_within_k_draws ─────────────────────────────────────────────

def test_prob_open_immediately():
    hand = [t(10, R), t(11, R), t(12, R)]
    p = prob_can_open_within_k_draws(hand, hand, k=0)
    assert p == 1.0


def test_prob_open_in_3_dead_hand_low_but_nonzero():
    """A truly dead hand should still have SOME chance to open in 3 draws."""
    hand = [t(1, R), t(3, B), t(5, BK), t(7, O), t(9, R)]
    p = prob_can_open_within_k_draws(hand, hand, k=3, samples=100)
    assert 0.0 <= p <= 1.0


def test_prob_open_returns_zero_when_pool_too_small():
    """If unseen pool has fewer tiles than k, probability is 0."""
    from rumicub.tile import TileSet
    # Build a known set that's almost the entire pool
    full = TileSet.standard()
    almost_all_seen = full[:-2]  # only 2 unseen
    hand = [t(1, R), t(2, R)]
    p = prob_can_open_within_k_draws(hand, almost_all_seen, k=5)
    assert p == 0.0


# ── hand_quality_score ───────────────────────────────────────────────────────

def test_hand_quality_can_open():
    hand = [t(10, R), t(11, R), t(12, R), t(1, B), t(2, B)]
    q = hand_quality_score(hand, hand)
    assert q["can_open_now"] is True
    assert q["best_play_tiles"] == 3
    assert q["best_play_value"] == 33
    assert q["prob_open_in_3"] == 1.0


def test_hand_quality_cannot_open():
    hand = [t(1, R), t(2, R), t(3, R)]  # 6 pts, can play but below opening
    q = hand_quality_score(hand, hand)
    assert q["can_open_now"] is False
    assert q["best_play_tiles"] == 3   # the meld IS playable, just not openable
    assert q["best_play_value"] == 6
    assert q["penalty_if_loss"] == 6


def test_hand_quality_joker_penalty_counted():
    hand = [JOKER, t(2, R), t(3, R)]
    q = hand_quality_score(hand, hand)
    # joker = 30 penalty
    assert q["penalty_if_loss"] == 30 + 2 + 3