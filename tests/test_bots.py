"""
Tests for bot strategies (random, greedy, solver) and the arena entry point.
"""
from __future__ import annotations
import pytest

from rumicub.tile import Tile, Color, JOKER
from rumicub.rules import STANDARD_RULES, RuleSet
from rumicub.game import Game
from rumicub.bot import RandomBot, GreedyBot, SolverBot, DrawAction, PlayAction
from rumicub.analysis.monte_carlo import simulate_game, simulate_many

R, B, BK, O = Color.RED, Color.BLUE, Color.BLACK, Color.ORANGE


def t(n, c): return Tile(number=n, color=c)


# ── Bot interface contract ──────────────────────────────────────────────────

def test_random_bot_returns_action():
    game = Game(["a", "b"], seed=0)
    action = RandomBot(seed=0).choose_action(game)
    assert isinstance(action, (DrawAction, PlayAction))


def test_greedy_bot_returns_action():
    game = Game(["a", "b"], seed=0)
    action = GreedyBot().choose_action(game)
    assert isinstance(action, (DrawAction, PlayAction))


def test_greedy_bot_plays_when_openable():
    """Force a hand that can open — greedy must propose a PlayAction."""
    game = Game(["a", "b"], seed=0)
    game.current_player.hand = [t(10, R), t(11, R), t(12, R)] + [t(1, B)] * 11
    action = GreedyBot().choose_action(game)
    assert isinstance(action, PlayAction)


def test_greedy_bot_draws_when_below_opening_threshold():
    """Hand has a meld but below 30 pts — greedy must draw, not play."""
    game = Game(["a", "b"], seed=0)
    game.current_player.hand = [t(1, R), t(2, R), t(3, R)] + [t(13, B)] * 11
    # Note: even though [B13,B13,...] groups exist, we want a clear case where
    # the best playable opening is below 30. Use only a low run.
    game.current_player.hand = [t(1, R), t(2, R), t(3, R)] + [t(5, BK)] * 11
    action = GreedyBot().choose_action(game)
    assert isinstance(action, DrawAction)


# ── Solver bot ──────────────────────────────────────────────────────────────

pulp = pytest.importorskip("pulp", reason="solver bot needs pulp; install rumicub[solver]")


def test_solver_bot_returns_action():
    game = Game(["a", "b"], seed=0)
    bot = SolverBot()
    action = bot.choose_action(game)
    assert isinstance(action, (DrawAction, PlayAction))


def test_solver_bot_extends_board_meld_when_greedy_cant():
    """SolverBot can extend an existing board meld; greedy can't."""
    game = Game(["a", "b"], seed=0)
    player = game.current_player
    player.has_opened = True  # bypass opening
    player.hand = [t(7, R)]
    game.board = [[t(7, B), t(7, BK), t(7, O)]]

    g_action = GreedyBot().choose_action(game)
    s_action = SolverBot().choose_action(game)

    # Greedy can only play hand-only melds; one tile = no meld → draws.
    assert isinstance(g_action, DrawAction)
    # Solver extends the group.
    assert isinstance(s_action, PlayAction)
    assert len(s_action.new_board) == 1
    assert len(s_action.new_board[0]) == 4


# ── Bot-vs-bot integration ──────────────────────────────────────────────────

def test_solver_beats_greedy_over_many_games():
    """Empirical: SolverBot should win majority of games vs GreedyBot."""
    stats = simulate_many(
        SolverBot(time_limit_seconds=2.0),
        GreedyBot(),
        n_games=5,
        seed_base=500,
    )
    solver_wins = stats.win_counts.get("solver", 0)
    # 5/5 is the empirically observed outcome; even 3/5 would be a clear signal
    # given the ILP's structural advantage.
    assert solver_wins >= 3, (
        f"SolverBot won only {solver_wins}/5 — expected dominance. "
        f"Stats: {stats.win_counts}"
    )


def test_greedy_at_least_competitive_with_random():
    """Sanity check: Greedy should win at least as often as Random over 20 games.

    Without board manipulation, the gap between Greedy and Random is small —
    both are picking from the same candidate list, just with different
    tie-breaking. We assert non-worse-than-coin-flip, not domination.
    """
    stats = simulate_many(
        GreedyBot(), RandomBot(seed=1),
        n_games=20, seed_base=600,
    )
    greedy_wins = stats.win_counts.get("greedy", 0)
    random_wins = stats.win_counts.get("random", 0)
    # Allow ties around 50%; just ensure greedy isn't significantly worse.
    assert greedy_wins + 2 >= random_wins, (
        f"GreedyBot ({greedy_wins}) trailing RandomBot ({random_wins}) "
        f"by more than the noise threshold. Stats: {stats.win_counts}"
    )
