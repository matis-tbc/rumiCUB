"""
Board-manipulation ILP solver for rumiCUB.

The classic Rummikub problem: given a hand and a current board, find the
arrangement of (hand ∪ board) tiles into a NEW board that maximises the
number of hand tiles placed, subject to:
  - every meld on the new board is valid
  - every board tile gets reused somewhere
  - tile counts are conserved

This is NP-hard in general but tractable in practice for realistic positions
via 0-1 integer linear programming. See engine/candidates.py for the
candidate-meld enumeration; this module formulates and solves the MIP.

When `allow_board_manipulation=False`, the simpler hand-only solver in
engine/solver.py is the right tool — this class always assumes the flag is on
(if you call it with the flag off, behaviour falls back to: every existing
meld must remain a subset of some chosen new meld).
"""
from __future__ import annotations
import time
from collections import Counter
from dataclasses import dataclass, field
from typing import Optional

try:
    import pulp
    _HAS_PULP = True
except ImportError:
    pulp = None  # type: ignore[assignment]
    _HAS_PULP = False


def _require_pulp() -> None:
    if not _HAS_PULP:
        raise ImportError(
            "rumiCUB's ILP solver requires PuLP. Install with:\n"
            "    pip install 'rumicub[solver]'\n"
            "or directly:\n"
            "    pip install pulp\n"
            "The hand-only solver in rumicub.engine.solver works without it."
        )


from ..tile import Tile, JOKER
from ..rules import RuleSet, STANDARD_RULES, meld_value_accurate, is_valid_meld
from .candidates import enumerate_candidate_melds
from .validator import validate_turn


@dataclass
class BoardSolution:
    """The result of a successful ILP solve."""
    board_after: list[list[Tile]]
    hand_after: list[Tile]
    tiles_played: int
    points_true: int
    solve_time_ms: float
    candidate_count: int
    objective_value: float
    status: str

    def is_optimal(self) -> bool:
        return self.status == "Optimal"


class BoardManipulator:
    """
    ILP-backed solver: find the optimal board manipulation given a hand
    and the current board.

    Usage:
        solver = BoardManipulator(rules)
        result = solver.solve(hand, board)
        if result.is_optimal():
            game.play_melds(result.board_after)
    """

    def __init__(
        self,
        rules: RuleSet = STANDARD_RULES,
        time_limit_seconds: float = 30.0,
        verbose: bool = False,
    ):
        self.rules = rules
        self.time_limit_seconds = time_limit_seconds
        self.verbose = verbose

    def solve(
        self,
        hand: list[Tile],
        board: list[list[Tile]],
    ) -> BoardSolution:
        _require_pulp()
        start = time.perf_counter()

        hand_tiles = list(hand)
        board_flat = [t for meld in board for t in meld]
        available = hand_tiles + board_flat

        # Tile-count availability and which tiles are "from hand"
        available_counts = _tile_counts(available)
        hand_counts = _tile_counts(hand_tiles)
        board_counts = _tile_counts(board_flat)

        # Generate candidates from the full available pool.
        candidates = enumerate_candidate_melds(available, self.rules)
        cand_count = len(candidates)

        if cand_count == 0:
            return BoardSolution(
                board_after=list(board),
                hand_after=hand_tiles,
                tiles_played=0,
                points_true=0,
                solve_time_ms=(time.perf_counter() - start) * 1000,
                candidate_count=0,
                objective_value=0.0,
                status="NoCandidates",
            )

        # Pre-compute meld stats
        meld_tile_counts = [_tile_counts(m) for m in candidates]
        meld_values = [meld_value_accurate(m) for m in candidates]
        meld_sizes = [len(m) for m in candidates]
        # How many hand tiles each meld uses — counted by capping per-tile
        # usage at hand availability (the rest must come from board).
        # NOTE: this is an UPPER BOUND on hand tiles a meld can pull from hand;
        # the actual hand vs board attribution gets locked in by the constraint
        # set (board tiles must all be used).
        meld_hand_potential = []
        for mc in meld_tile_counts:
            hand_potential = 0
            for key, used in mc.items():
                hand_potential += min(used, hand_counts.get(key, 0))
            meld_hand_potential.append(hand_potential)

        # ── Build the MIP ────────────────────────────────────────────────
        prob = pulp.LpProblem("rumikub_board", pulp.LpMaximize)

        # x_m in {0, 1}: select candidate meld m for the new board.
        x = [
            pulp.LpVariable(f"x_{i}", cat="Binary")
            for i in range(cand_count)
        ]

        # Tile conservation:
        #   - For each tile type, total usage by selected melds == count in
        #     (board) + count_used_from_hand. The latter is bounded by
        #     count in hand. So: board_count <= sum(x_m * count_in_m) <= total_count.
        all_keys = set(available_counts.keys()) | set(board_counts.keys())
        for key in all_keys:
            total_avail = available_counts.get(key, 0)
            board_avail = board_counts.get(key, 0)
            usage = pulp.lpSum(
                x[i] * meld_tile_counts[i].get(key, 0)
                for i in range(cand_count)
                if meld_tile_counts[i].get(key, 0) > 0
            )
            # Cannot use more of this tile than exists
            prob += usage <= total_avail, f"max_{_keyname(key)}"
            # Every board tile must end up in some selected meld
            if board_avail > 0:
                prob += usage >= board_avail, f"reuse_{_keyname(key)}"

        # Objective: maximise (1000 * tiles_played_from_hand + accurate_value)
        # Approximation: each selected meld contributes meld_hand_potential[i]
        # hand tiles. This is an upper bound; the conservation constraints
        # ensure the actual attribution is consistent.
        # In practice this gives an upper bound on hand-tile usage, but combined
        # with the constraints it pushes the solver toward putting hand tiles
        # to use.
        WEIGHT = 1000
        prob += pulp.lpSum(
            x[i] * (WEIGHT * meld_hand_potential[i] + meld_values[i])
            for i in range(cand_count)
        )

        # ── Solve ────────────────────────────────────────────────────────
        solver = pulp.PULP_CBC_CMD(
            msg=1 if self.verbose else 0,
            timeLimit=self.time_limit_seconds,
        )
        prob.solve(solver)
        status = pulp.LpStatus[prob.status]

        # ── Extract solution ─────────────────────────────────────────────
        new_board: list[list[Tile]] = []
        if status in ("Optimal", "Not Solved"):
            for i, var in enumerate(x):
                if var.value() is not None and var.value() > 0.5:
                    new_board.append([t for t in candidates[i]])

        # Reconstruct hand_after: tiles that were in hand but not used by any
        # selected meld stay in hand. We need to figure out which physical
        # tiles those are — since tiles are interchangeable by key, we just
        # subtract the per-key usage that came from hand.
        used_per_key = _meld_usage(new_board)
        # board tiles consume their full count; hand provides the rest
        hand_used_per_key: dict[tuple, int] = {}
        for key, used in used_per_key.items():
            from_board = board_counts.get(key, 0)
            from_hand = max(0, used - from_board)
            hand_used_per_key[key] = from_hand

        hand_after = _hand_minus(hand_tiles, hand_used_per_key)
        tiles_played = len(hand_tiles) - len(hand_after)
        points_true = sum(meld_value_accurate(m) for m in new_board) - sum(
            meld_value_accurate(m) for m in board
        )

        # Cross-check via validator: solver output should always pass
        ok, reason = validate_turn(
            hand_before=hand_tiles,
            board_before=list(board),
            hand_after=hand_after,
            board_after=new_board,
            has_opened=True,  # opening is a game-level concern, not solver
            rules=self.rules,
        )
        if not ok:
            status = f"InvalidSolution: {reason}"

        elapsed_ms = (time.perf_counter() - start) * 1000
        return BoardSolution(
            board_after=new_board,
            hand_after=hand_after,
            tiles_played=tiles_played,
            points_true=points_true,
            solve_time_ms=elapsed_ms,
            candidate_count=cand_count,
            objective_value=pulp.value(prob.objective) or 0.0,
            status=status,
        )


# ── Helpers ──────────────────────────────────────────────────────────────────

def _tile_counts(tiles: list[Tile]) -> dict[tuple, int]:
    out: dict[tuple, int] = {}
    for t in tiles:
        key = (t.number, t.color, t.is_joker)
        out[key] = out.get(key, 0) + 1
    return out


def _meld_usage(melds: list[list[Tile]]) -> dict[tuple, int]:
    out: dict[tuple, int] = {}
    for m in melds:
        for t in m:
            key = (t.number, t.color, t.is_joker)
            out[key] = out.get(key, 0) + 1
    return out


def _hand_minus(hand: list[Tile], used_per_key: dict[tuple, int]) -> list[Tile]:
    """Return hand minus `used_per_key` tiles, preserving original ordering."""
    remaining = dict(used_per_key)
    result: list[Tile] = []
    for tile in hand:
        key = (tile.number, tile.color, tile.is_joker)
        if remaining.get(key, 0) > 0:
            remaining[key] -= 1
        else:
            result.append(tile)
    return result


def _keyname(key: tuple) -> str:
    """Stable, unique key name for a tile (used as ILP constraint label)."""
    n, c, j = key
    if j:
        return "JOKER"
    return f"{c.value}_{n}"
