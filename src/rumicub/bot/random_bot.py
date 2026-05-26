"""
RandomBot — picks any valid play uniformly at random, or draws if none.

Used as a baseline opponent for benchmarking smarter bots.
"""
from __future__ import annotations
import random

from ..engine.candidates import enumerate_candidate_melds
from ..rules import meld_value_accurate
from ..game import Game
from .base import Bot, DrawAction, PlayAction


class RandomBot(Bot):
    name = "random"

    def __init__(self, seed: int | None = None):
        self._rng = random.Random(seed)

    def choose_action(self, game: Game):
        player = game.current_player
        hand = player.hand

        # Enumerate all single-meld plays from hand (structure-aware, fast).
        all_melds = enumerate_candidate_melds(hand, game.rules)
        if not all_melds:
            return DrawAction()

        # If we haven't opened yet, must pick a meld set that meets threshold.
        # Naive: pick the highest-value single meld; if it doesn't meet
        # threshold, draw. (RandomBot is a baseline, not clever.)
        if not player.has_opened:
            best = max(all_melds, key=lambda m: meld_value_accurate(m))
            if meld_value_accurate(best) < game.rules.initial_meld_min_points:
                return DrawAction()
            new_board = game.board + [list(best)]
            return PlayAction(new_board=new_board)

        # Already opened. Play a random valid single meld.
        meld = self._rng.choice(all_melds)
        new_board = game.board + [list(meld)]
        return PlayAction(new_board=new_board)
