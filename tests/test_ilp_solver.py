"""
Tests for engine/ilp_solver.BoardManipulator.

Covers the cases the hand-only solver explicitly cannot handle:
  - meld extension (adding a tile to an existing meld)
  - meld split + reform with hand tiles
  - joker retrieval and re-use
  - mixed hand-only + board-manipulation choices

Also asserts that hand-only positions produce the same tile count as the
naive solver (the ILP must be at least as good).
"""
from __future__ import annotations
import pytest

from rumicub.tile import Tile, Color, JOKER, TileSet
from rumicub.rules import STANDARD_RULES, is_valid_meld
from rumicub.engine.solver import find_optimal_play
from rumicub.engine.ilp_solver import BoardManipulator
from rumicub.engine.validator import validate_turn

R, B, BK, O = Color.RED, Color.BLUE, Color.BLACK, Color.ORANGE


def t(n, c): return Tile(number=n, color=c)


@pytest.fixture(scope="module")
def solver():
    return BoardManipulator()


# ── Hand-only equivalence ────────────────────────────────────────────────────

def test_ilp_matches_naive_on_simple_hand(solver):
    """When board is empty, ILP and hand-only solver agree on tile count."""
    hand = [t(1, R), t(2, R), t(3, R), t(9, O)]
    naive = find_optimal_play(hand, board=[])
    ilp = solver.solve(hand, [])
    assert ilp.status == "Optimal"
    assert ilp.tiles_played == naive["tiles_played"] == 3


def test_ilp_matches_naive_on_two_melds(solver):
    hand = [t(1, R), t(2, R), t(3, R), t(7, R), t(7, B), t(7, BK)]
    ilp = solver.solve(hand, [])
    assert ilp.tiles_played == 6
    assert ilp.points_true == 6 + 21


def test_ilp_no_play_on_dead_hand(solver):
    hand = [t(1, R), t(3, R), t(5, R), t(7, R)]
    ilp = solver.solve(hand, [])
    assert ilp.tiles_played == 0
    assert ilp.board_after == []


def test_ilp_empty_hand_empty_board(solver):
    ilp = solver.solve([], [])
    assert ilp.tiles_played == 0


# ── Meld extension (the case the naive solver misses) ───────────────────────

def test_ilp_extends_group_with_hand_tile(solver):
    """Hand=[R7], board=[[B7,BK7,O7]] -> extend to 4-tile group."""
    hand = [t(7, R)]
    board = [[t(7, B), t(7, BK), t(7, O)]]
    ilp = solver.solve(hand, board)
    assert ilp.status == "Optimal"
    assert ilp.tiles_played == 1
    assert len(ilp.board_after) == 1
    extended = ilp.board_after[0]
    assert len(extended) == 4
    assert is_valid_meld(extended)


def test_ilp_extends_run_with_hand_tile(solver):
    """Hand=[R4], board=[[R1,R2,R3]] -> extend to 4-tile run."""
    hand = [t(4, R)]
    board = [[t(1, R), t(2, R), t(3, R)]]
    ilp = solver.solve(hand, board)
    assert ilp.tiles_played == 1
    assert len(ilp.board_after) == 1
    extended = ilp.board_after[0]
    assert len(extended) == 4
    assert is_valid_meld(extended)


def test_ilp_naive_solver_misses_extensions(solver):
    """Same input where the naive solver fails: it plays 0, ILP plays 1."""
    hand = [t(7, R)]
    board = [[t(7, B), t(7, BK), t(7, O)]]
    naive = find_optimal_play(hand, board)
    ilp = solver.solve(hand, board)
    assert naive["tiles_played"] == 0       # naive misses extension
    assert ilp.tiles_played == 1            # ILP finds it


# ── Meld split + reform with hand tiles ─────────────────────────────────────

def test_ilp_splits_run_to_form_new_meld(solver):
    """Classic rearrangement: split [R1-R4] so R4 joins [B4,BK4] as a group."""
    hand = [t(4, B), t(4, BK)]
    board = [[t(1, R), t(2, R), t(3, R), t(4, R)]]
    ilp = solver.solve(hand, board)
    assert ilp.status == "Optimal"
    assert ilp.tiles_played == 2
    # 2 melds on new board: [R1,R2,R3] + [R4,B4,BK4]
    assert len(ilp.board_after) == 2
    for m in ilp.board_after:
        assert is_valid_meld(m), f"Invalid meld in ILP output: {m}"


# ── Validator agreement ─────────────────────────────────────────────────────

def test_ilp_output_passes_validator(solver):
    """Any ILP result must satisfy validate_turn (modulo opening, which the
    solver doesn't model)."""
    hand = [t(1, R), t(2, R), t(3, R), t(4, B), t(5, B), t(6, B), t(7, R)]
    board = [[t(7, B), t(7, BK), t(7, O)]]
    ilp = solver.solve(hand, board)
    ok, reason = validate_turn(
        hand_before=hand,
        board_before=board,
        hand_after=ilp.hand_after,
        board_after=ilp.board_after,
        has_opened=True,
        rules=STANDARD_RULES,
    )
    assert ok, f"ILP output failed validator: {reason}"


# ── Joker handling ──────────────────────────────────────────────────────────

def test_ilp_uses_joker_to_complete_run(solver):
    """Hand=[R5,R7,JOKER] -> [R5,R6(joker),R7]."""
    hand = [t(5, R), t(7, R), JOKER]
    ilp = solver.solve(hand, [])
    assert ilp.tiles_played == 3
    assert len(ilp.board_after) == 1


# ── Performance budget ──────────────────────────────────────────────────────

def test_ilp_solve_under_budget(solver):
    """Mid-game position should solve in under 2 seconds.

    Note: PuLP spawns the CBC binary as a subprocess on each solve, so the
    first call in a process pays ~1-2 sec of subprocess overhead. We give
    a generous budget here; pytest-benchmark in test_performance.py can
    track regression more precisely.
    """
    hand = [t(1, R), t(2, R), t(3, R), t(4, B), t(5, B), t(6, B),
            t(7, R), t(7, B), t(7, BK), t(11, O), t(12, O), t(13, O),
            JOKER, t(9, R)]
    board = [
        [t(1, B), t(2, B), t(3, B)],
        [t(8, R), t(8, B), t(8, BK)],
    ]
    ilp = solver.solve(hand, board)
    assert ilp.solve_time_ms < 5000  # 5s — process spawn + solve
    assert ilp.status == "Optimal"
