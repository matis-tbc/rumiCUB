from __future__ import annotations
from enum import Enum
from dataclasses import dataclass
from typing import Optional

MIN_NUMBER = 1
MAX_NUMBER = 13


class Color(Enum):
    RED = "red"
    BLUE = "blue"
    BLACK = "black"
    ORANGE = "orange"


@dataclass(frozen=True)
class Tile:
    number: Optional[int]
    color: Optional[Color]
    is_joker: bool = False

    def __post_init__(self):
        if self.is_joker:
            if self.number is not None or self.color is not None:
                raise ValueError("Joker must have number=None and color=None")
        else:
            if self.number is None or self.color is None:
                raise ValueError("Non-joker tile must have a number and color")
            if not (MIN_NUMBER <= self.number <= MAX_NUMBER):
                raise ValueError(f"Tile number must be {MIN_NUMBER}–{MAX_NUMBER}")

    def value(self) -> int:
        return 30 if self.is_joker else self.number  # type: ignore[return-value]

    def __repr__(self) -> str:
        if self.is_joker:
            return "JOKER"
        return f"{self.color.value[0].upper()}{self.number}"


JOKER = Tile(number=None, color=None, is_joker=True)


class TileSet:
    """Factory for standard and custom tile pools."""

    @staticmethod
    def standard() -> list[Tile]:
        """106 tiles: 2× each of (4 colors × 13 numbers) + 2 jokers."""
        tiles: list[Tile] = []
        for _ in range(2):
            for color in Color:
                for n in range(MIN_NUMBER, MAX_NUMBER + 1):
                    tiles.append(Tile(number=n, color=color))
            tiles.append(JOKER)
        return tiles

    @staticmethod
    def restricted(
        excluded_numbers: Optional[set[int]] = None,
        excluded_colors: Optional[set[Color]] = None,
        copies: int = 2,
        joker_count: int = 2,
    ) -> list[Tile]:
        """Custom tile pool with number/color exclusions."""
        excluded_numbers = excluded_numbers or set()
        excluded_colors = excluded_colors or set()
        tiles: list[Tile] = []
        for _ in range(copies):
            for color in Color:
                if color in excluded_colors:
                    continue
                for n in range(MIN_NUMBER, MAX_NUMBER + 1):
                    if n in excluded_numbers:
                        continue
                    tiles.append(Tile(number=n, color=color))
        tiles.extend([JOKER] * joker_count)
        return tiles
