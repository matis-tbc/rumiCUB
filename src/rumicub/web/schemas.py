"""
Pydantic schemas for the rumiCUBE HTTP API.

Tiles travel as compact dicts: {"n": int, "c": str, "j": bool}
where n=number (None for joker), c=color name (None for joker), j=is_joker.
"""
from __future__ import annotations
from typing import Optional, Literal
from pydantic import BaseModel, Field

from ..tile import Tile, Color, JOKER


class TileDTO(BaseModel):
    n: Optional[int] = Field(None, description="Number 1-13, None for joker")
    c: Optional[str] = Field(None, description="Color name (red/blue/black/orange), None for joker")
    j: bool = Field(False, description="True if this is a joker")

    @classmethod
    def from_tile(cls, tile: Tile) -> "TileDTO":
        return cls(
            n=tile.number,
            c=tile.color.value if tile.color is not None else None,
            j=tile.is_joker,
        )

    def to_tile(self) -> Tile:
        if self.j:
            return JOKER
        color = next(c for c in Color if c.value == self.c)
        return Tile(number=self.n, color=color)


class MeldDTO(BaseModel):
    tiles: list[TileDTO]

    @classmethod
    def from_meld(cls, meld: list[Tile]) -> "MeldDTO":
        return cls(tiles=[TileDTO.from_tile(t) for t in meld])

    def to_meld(self) -> list[Tile]:
        return [t.to_tile() for t in self.tiles]


class PlayerDTO(BaseModel):
    name: str
    hand: list[TileDTO]
    has_opened: bool
    hand_count: int
    penalty: int = Field(0, description="Sum of hand-tile penalty values")


class GameStateDTO(BaseModel):
    id: str
    rules_name: str = "standard"
    turn: int
    current_player_index: int
    is_over: bool
    winner: Optional[str]
    pool_remaining: int
    board: list[MeldDTO]
    players: list[PlayerDTO]


class CreateGameRequest(BaseModel):
    player_names: list[str] = Field(..., min_length=2, max_length=4)
    seed: Optional[int] = None


class PlayRequest(BaseModel):
    new_board: list[MeldDTO]


class PlayResponse(BaseModel):
    ok: bool
    reason: str = ""
    won: bool = False
    state: GameStateDTO


class SuggestResponse(BaseModel):
    """Solver's recommended play for the current player."""
    melds_to_place: list[MeldDTO]
    tiles_played: int
    points_true: int
    new_board: list[MeldDTO]
    solver_used: Literal["hand_only", "ilp"] = "hand_only"
    solve_time_ms: float = 0.0
    status: str = "Optimal"
