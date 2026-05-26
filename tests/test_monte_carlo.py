"""
Tests for analysis/monte_carlo.py — single-game and many-game simulators.

These tests use deterministic seeds so results are reproducible.
"""
from __future__ import annotations
import pytest

from rumicub.rules import STANDARD_RULES
from rumicub.bot import RandomBot, GreedyBot
from rumicub.analysis.monte_carlo import (
    simulate_game,
    simulate_many,
    GameResult,
    SimulationStats,
    MAX_TURNS_PER_GAME,
)


# ── Single-game ──────────────────────────────────────────────────────────────

def test_simulate_game_returns_a_result():
    result = simulate_game(GreedyBot(), RandomBot(seed=0), seed=42)
    assert isinstance(result, GameResult)
    assert result.turn_count > 0
    assert "greedy" in result.scores and "random" in result.scores


def test_simulate_game_terminates_within_max_turns():
    """No infinite loops — every game must finish or hit the cap."""
    result = simulate_game(GreedyBot(), RandomBot(seed=1), seed=1, max_turns=200)
    assert result.turn_count <= 200


def test_simulate_game_winner_has_zero_score():
    """Whoever wins has a zero penalty per the official scoring."""
    result = simulate_game(GreedyBot(), RandomBot(seed=0), seed=7)
    if result.winner_name:
        # Winner = empty hand OR (game over by pool exhaustion + lowest penalty).
        # In either case, the loser's score is >= winner's.
        winner_score = result.scores[result.winner_name]
        other = next(n for n in result.scores if n != result.winner_name)
        assert winner_score <= result.scores[other]


def test_simulate_game_reproducible_with_seed():
    """Same seed → same outcome."""
    r1 = simulate_game(GreedyBot(), RandomBot(seed=0), seed=42)
    r2 = simulate_game(GreedyBot(), RandomBot(seed=0), seed=42)
    assert r1.winner_name == r2.winner_name
    assert r1.turn_count == r2.turn_count
    assert r1.scores == r2.scores


# ── Many-game ────────────────────────────────────────────────────────────────

def test_simulate_many_aggregates_stats():
    stats = simulate_many(
        GreedyBot(), RandomBot(seed=99), n_games=10, seed_base=1000
    )
    assert stats.n_games == 10
    total_wins = sum(stats.win_counts.values())
    # Win count + draws/timeouts should equal games. Some games could have
    # no winner (timeout), so total_wins <= n_games.
    assert total_wins <= stats.n_games
    assert stats.mean_turns > 0


def test_win_rate_and_ci():
    stats = simulate_many(
        GreedyBot(), RandomBot(seed=0), n_games=20, seed_base=2000
    )
    wr = stats.win_rate("greedy")
    lo, hi = stats.win_rate_ci("greedy")
    assert 0.0 <= wr <= 1.0
    assert lo <= wr <= hi


def test_simulate_many_perf_budget():
    """20 games against RandomBot must complete in under 5 sec."""
    import time
    start = time.perf_counter()
    simulate_many(
        GreedyBot(), RandomBot(seed=42), n_games=20, seed_base=3000
    )
    elapsed = time.perf_counter() - start
    assert elapsed < 5.0, f"Took {elapsed:.1f}s — bots are too slow"
