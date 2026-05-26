"""
SolverBot — uses the ILP BoardManipulator for optimal board-manipulation
plays each turn. Falls back to GreedyBot if PuLP isn't installed.
"""
from __future__ import annotations

from ..game import Game
from ..rules import meld_value_accurate
from ..tile import Tile
from .base import Bot, DrawAction, PlayAction
from .greedy_bot import GreedyBot


class SolverBot(Bot):
    name = "solver"

    def __init__(self, time_limit_seconds: float = 5.0):
        try:
            from ..engine.ilp_solver import BoardManipulator
            self._solver = BoardManipulator(time_limit_seconds=time_limit_seconds)
            self._fallback = None
        except ImportError:
            # PuLP not installed — degrade gracefully to greedy.
            self._solver = None
            self._fallback = GreedyBot()

    def choose_action(self, game: Game):
        if self._solver is None:
            return self._fallback.choose_action(game)

        player = game.current_player
        try:
            result = self._solver.solve(player.hand, game.board)
        except Exception:
            # Solver hiccup — defer to greedy
            return GreedyBot().choose_action(game)

        if result.tiles_played == 0:
            return DrawAction()

        # Opening check
        if not player.has_opened:
            opening_pts = sum(
                meld_value_accurate(m) for m in result.board_after
            ) - sum(meld_value_accurate(m) for m in game.board)
            if opening_pts < game.rules.initial_meld_min_points:
                return DrawAction()

        return PlayAction(new_board=result.board_after)
