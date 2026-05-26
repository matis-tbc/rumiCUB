"""
Bot interface for rumiCUB.

A Bot inspects the current game state and returns an action: either a play
(meld proposal) or "draw." The game runner calls choose_action() each turn
and applies the result.
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Union

from ..game import Game
from ..tile import Tile


@dataclass(frozen=True)
class DrawAction:
    pass


@dataclass(frozen=True)
class PlayAction:
    new_board: list[list[Tile]]


Action = Union[DrawAction, PlayAction]


class Bot(ABC):
    """Minimal bot interface. Implementations override `choose_action`."""

    name: str = "bot"

    @abstractmethod
    def choose_action(self, game: Game) -> Action:
        ...
