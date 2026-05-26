"""
Game orchestration for rumiCUB.

The Game class manages the full lifecycle: dealing, turn management, drawing,
playing melds, and end-of-game scoring.

Board model
-----------
A player proposes their intended full board state via play_melds().
The validator checks legality; if it passes, the state is committed.
If a player wants to "try" a play first, use propose_play() which returns a
snapshot — call commit_play() or abandon_play() on the result.

Joker lockout tracking
----------------------
The game tracks which turn each joker was placed on the board.  This is
count-based (not per-identity, since jokers have no distinguishing marks) and
works correctly when at most one joker is placed per turn.
"""
from __future__ import annotations
import random
from copy import deepcopy
from dataclasses import dataclass, field

from .tile import Tile, TileSet
from .rules import RuleSet, STANDARD_RULES, meld_value
from .engine.validator import validate_turn
from .engine.solver import find_all_melds, find_optimal_play


INITIAL_HAND_SIZE = 14


@dataclass
class Player:
    name: str
    hand: list[Tile] = field(default_factory=list)
    has_opened: bool = False
    tiles_played_total: int = 0


@dataclass
class TurnResult:
    ok: bool
    reason: str = ""
    won: bool = False


@dataclass
class ProposedPlay:
    """Snapshot returned by propose_play(); use commit() or abandon()."""
    _game: "Game"
    _hand_after: list[Tile]
    _board_after: list[list[Tile]]
    _joker_turns_after: list[int]
    _has_opened: bool
    tiles_played: int
    points: int
    valid: bool
    reason: str

    def commit(self) -> TurnResult:
        """Apply the proposed play to the live game."""
        if not self.valid:
            return TurnResult(ok=False, reason=self.reason)
        return self._game._commit_play(
            self._hand_after,
            self._board_after,
            self._joker_turns_after,
            self._has_opened,
        )

    def abandon(self) -> None:
        """Discard the proposal without changing game state."""


class Game:
    """
    Full Rummikub game.

    Usage (direct):
        game = Game(["Alice", "Bob"])
        result = game.play_melds(new_board)   # propose + immediately commit
        tile = game.draw()                     # draw and end turn

    Usage (preview):
        proposal = game.propose_play(new_board)
        if proposal.valid:
            proposal.commit()
        else:
            proposal.abandon()
            game.draw()
    """

    def __init__(
        self,
        player_names: list[str],
        rules: RuleSet = STANDARD_RULES,
        seed: int | None = None,
        custom_pool: list[Tile] | None = None,
    ):
        if len(player_names) < 2:
            raise ValueError("Rummikub requires at least 2 players.")
        self.rules = rules
        self._rng = random.Random(seed)

        pool = custom_pool if custom_pool is not None else TileSet.standard()
        # Snapshot the full universe BEFORE shuffling and dealing — probability
        # functions need this to know what tiles could possibly exist, not just
        # what's currently in the draw pool.
        self.full_pool: list[Tile] = list(pool)
        self._rng.shuffle(pool)

        self.players: list[Player] = [Player(name=n) for n in player_names]
        for player in self.players:
            player.hand = [pool.pop() for _ in range(INITIAL_HAND_SIZE)]

        self.pool: list[Tile] = pool
        self.board: list[list[Tile]] = []
        self._current_idx: int = 0
        self.turn: int = 0
        self._over: bool = False
        self._history: list[dict] = []

        # Joker lockout: one entry per joker currently on the board, recording the turn
        # it was placed.  Sorted ascending (oldest first).
        self._joker_placement_turns: list[int] = []

    # ── Public state ───────────────────────────────────────────────────────

    @property
    def current_player(self) -> Player:
        return self.players[self._current_idx]

    @property
    def current_player_index(self) -> int:
        """Index of the player whose turn it currently is."""
        return self._current_idx

    @property
    def is_over(self) -> bool:
        return self._over

    def winner(self) -> Player | None:
        """
        Return the winning player.
          * If any player has an empty hand -> that player wins (classic).
          * Else if the game is over (pool exhausted) -> lowest hand-penalty wins.
          * Else (game still in progress) -> None.
        Ties: returns the first tied player in seat order.
        """
        for p in self.players:
            if not p.hand:
                return p
        if not self._over:
            return None
        # Stuck-state end: lowest hand-penalty wins.
        penalty_per_player = self.scores()
        return min(self.players, key=lambda p: penalty_per_player[p.name])

    # ── Actions ────────────────────────────────────────────────────────────

    def draw(self) -> TurnResult:
        """
        Draw one tile from the pool and end the current player's turn.

        Rejected if must_play_if_possible is active and a valid play exists.
        """
        if self._over:
            return TurnResult(ok=False, reason="Game is already over.")

        if self.rules.must_play_if_possible and self.current_player.has_opened:
            if find_all_melds(self.current_player.hand, self.rules):
                optimal = find_optimal_play(
                    self.current_player.hand, self.board, self.rules
                )
                if optimal["tiles_played"] > 0:
                    return TurnResult(
                        ok=False,
                        reason="must_play_if_possible: a valid play exists — drawing is not allowed.",
                    )

        # M2: stuck-state end. If pool is empty AND no player can place any
        # tile this turn (we don't know about other players' hands precisely,
        # but if every player's hand has no valid play AND we have no draw to
        # take, the game ends with lowest-hand-penalty wins).
        if not self.pool:
            self._over = True
            return TurnResult(ok=False, reason="Pool is empty — game over.")

        tile = self.pool.pop()
        self.current_player.hand.append(tile)
        self._record("draw", tile=tile)
        self._advance()
        return TurnResult(ok=True)

    def propose_play(self, new_board: list[list[Tile]]) -> ProposedPlay:
        """
        Validate `new_board` without committing.  Lets callers preview legality.
        """
        if self._over:
            return ProposedPlay(
                _game=self, _hand_after=[], _board_after=[], _joker_turns_after=[],
                _has_opened=False, tiles_played=0, points=0,
                valid=False, reason="Game is already over.",
            )

        player = self.current_player
        hand_after = _derive_hand(player.hand, self.board, new_board)
        joker_turns_after = _updated_joker_turns(
            self.board, new_board, self._joker_placement_turns, self.turn
        )

        ok, reason = validate_turn(
            hand_before=player.hand,
            board_before=self.board,
            hand_after=hand_after,
            board_after=new_board,
            has_opened=player.has_opened,
            rules=self.rules,
            current_turn=self.turn,
            joker_placement_turns=self._joker_placement_turns,
        )

        tiles_placed = len(player.hand) - len(hand_after)
        pts = sum(t.value() for t in player.hand) - sum(t.value() for t in hand_after)

        # M1: no-op plays are not legal turns. A turn must place at least one
        # tile from hand to the board OR be a draw. Validator passed (because
        # conservation trivially holds for no-op), so we layer this on top.
        if ok and tiles_placed == 0:
            ok = False
            reason = (
                "No tiles played. A turn must either place at least one tile "
                "from your hand OR be a draw — passing is not allowed."
            )

        return ProposedPlay(
            _game=self,
            _hand_after=hand_after,
            _board_after=new_board,
            _joker_turns_after=joker_turns_after,
            _has_opened=player.has_opened or tiles_placed > 0,
            tiles_played=tiles_placed,
            points=pts,
            valid=ok,
            reason=reason,
        )

    def play_melds(self, new_board: list[list[Tile]]) -> TurnResult:
        """
        Propose `new_board` as the complete board after this turn and immediately commit.
        `new_board` is the FULL board — existing melds plus any new or rearranged ones.
        """
        proposal = self.propose_play(new_board)
        return proposal.commit()

    def _commit_play(
        self,
        hand_after: list[Tile],
        board_after: list[list[Tile]],
        joker_turns_after: list[int],
        has_opened: bool,
    ) -> TurnResult:
        player = self.current_player
        tiles_placed = len(player.hand) - len(hand_after)
        player.tiles_played_total += tiles_placed
        player.hand = hand_after
        player.has_opened = has_opened
        self.board = board_after
        self._joker_placement_turns = joker_turns_after
        self._record("play", board_size=len(board_after), tiles_placed=tiles_placed)

        if not player.hand:
            self._over = True
            return TurnResult(ok=True, won=True)

        self._advance()
        return TurnResult(ok=True)

    # ── Scoring ────────────────────────────────────────────────────────────

    def scores(self) -> dict[str, int]:
        """
        End-of-game penalty scores (lower is better; winner gets 0).
        Joker in hand = joker_penalty pts (default 30, per official rules).
        """
        result = {}
        for p in self.players:
            if not p.hand or not self.rules.penalize_unplayed:
                result[p.name] = 0
            else:
                penalty = sum(
                    self.rules.joker_penalty if t.is_joker else t.value()
                    for t in p.hand
                )
                result[p.name] = penalty
        return result

    # ── Internals ──────────────────────────────────────────────────────────

    def _advance(self):
        self._current_idx = (self._current_idx + 1) % len(self.players)
        self.turn += 1

    def _record(self, kind: str, **kwargs):
        self._history.append({
            "turn": self.turn,
            "player": self.current_player.name,
            "kind": kind,
            **kwargs,
        })


# ── Helpers ────────────────────────────────────────────────────────────────────

def _key(tile: Tile) -> tuple:
    return (tile.number, tile.color, tile.is_joker)


def _derive_hand(
    hand_before: list[Tile],
    board_before: list[list[Tile]],
    board_after: list[list[Tile]],
) -> list[Tile]:
    """Compute the player's hand after they've proposed board_after."""
    from collections import Counter

    before_pool = Counter(_key(t) for t in hand_before)
    before_pool.update(_key(t) for m in board_before for t in m)
    after_board = Counter(_key(t) for m in board_after for t in m)
    remaining = before_pool - after_board

    result: list[Tile] = []
    for tile in hand_before:
        k = _key(tile)
        if remaining[k] > 0:
            result.append(tile)
            remaining[k] -= 1
    return result


def _updated_joker_turns(
    board_before: list[list[Tile]],
    board_after: list[list[Tile]],
    current_turns: list[int],
    this_turn: int,
) -> list[int]:
    """
    Reconcile the joker-placement-turn list as the board changes.

    Count-based: if the number of jokers on the board increases, record this_turn
    for each new joker; if it decreases, remove the oldest placement record.
    (Works correctly when at most one joker is placed or retrieved per turn.)
    """
    before_count = sum(1 for m in board_before for t in m if t.is_joker)
    after_count = sum(1 for m in board_after for t in m if t.is_joker)
    turns = list(current_turns)
    delta = after_count - before_count
    if delta > 0:
        turns.extend([this_turn] * delta)
    elif delta < 0:
        for _ in range(-delta):
            if turns:
                turns.pop(0)  # remove oldest placement
    return sorted(turns)
