"""
GreedyBot — iteratively plays the largest valid meld from hand until no more
melds are possible. Linear in number of melds played (vs exponential
optimal-play search). Not provably optimal but close in practice and
massively faster, making it suitable for long Monte Carlo runs.
"""
from __future__ import annotations

from ..engine.candidates import enumerate_candidate_melds
from ..rules import meld_value_accurate
from ..game import Game
from ..tile import Tile
from .base import Bot, DrawAction, PlayAction


class GreedyBot(Bot):
    name = "greedy"

    def choose_action(self, game: Game):
        player = game.current_player
        remaining = list(player.hand)
        melds_to_play: list[list[Tile]] = []

        while True:
            # Structure-aware enumeration scales linearly with hand size,
            # unlike find_all_melds's subset enumeration which blows up.
            valid = enumerate_candidate_melds(remaining, game.rules)
            if not valid:
                break
            # Pick the meld that places the most tiles; tiebreak by accurate value.
            best = max(valid, key=lambda m: (len(m), meld_value_accurate(m)))
            melds_to_play.append(list(best))
            # Remove those tiles from `remaining`
            remaining = _remove_tiles(remaining, best)

        if not melds_to_play:
            return DrawAction()

        # Opening check: opening must meet threshold (true value).
        if not player.has_opened:
            opening_pts = sum(meld_value_accurate(m) for m in melds_to_play)
            if opening_pts < game.rules.initial_meld_min_points:
                return DrawAction()

        new_board = list(game.board) + melds_to_play
        return PlayAction(new_board=new_board)


def _remove_tiles(hand: list[Tile], to_remove: list[Tile]) -> list[Tile]:
    """Return hand with one occurrence of each tile in `to_remove` removed."""
    out = list(hand)
    for tile in to_remove:
        for i, h in enumerate(out):
            if (h.number, h.color, h.is_joker) == (tile.number, tile.color, tile.is_joker):
                out.pop(i)
                break
    return out
