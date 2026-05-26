import pytest
from rumicub.tile import Tile, Color, JOKER
from rumicub.rules import STANDARD_RULES
from rumicub.engine.solver import find_all_melds, find_all_complete_solutions, find_optimal_play

R, B, BK, O = Color.RED, Color.BLUE, Color.BLACK, Color.ORANGE


def t(n, c):
    return Tile(number=n, color=c)


# ── find_all_melds ─────────────────────────────────────────────────────────────

def test_find_all_melds_includes_run():
    hand = [t(1, R), t(2, R), t(3, R), t(5, B)]
    melds = find_all_melds(hand)
    reprs = [tuple(repr(x) for x in m) for m in melds]
    assert ("R1", "R2", "R3") in reprs


def test_find_all_melds_includes_group():
    hand = [t(7, R), t(7, B), t(7, BK), t(1, O)]
    melds = find_all_melds(hand)
    assert any(all(ti.number == 7 for ti in m) and len(m) == 3 for m in melds)


def test_find_all_melds_empty_hand():
    assert find_all_melds([]) == []


def test_find_all_melds_no_valid():
    assert find_all_melds([t(1, R), t(3, R), t(5, R)]) == []


# ── find_all_complete_solutions ────────────────────────────────────────────────

def test_complete_solutions_all_tiles_used():
    tiles = [t(1, R), t(2, R), t(3, R), t(7, B), t(7, BK), t(7, O)]
    solutions = find_all_complete_solutions(tiles)
    assert len(solutions) >= 1
    for sol in solutions:
        assert sum(len(m) for m in sol) == len(tiles)


def test_complete_solutions_no_partition():
    tiles = [t(1, R), t(2, R), t(3, R), t(9, O)]  # 9O has no partners
    assert find_all_complete_solutions(tiles) == []


# ── find_optimal_play: correctness of return values ───────────────────────────

def test_optimal_play_returns_real_melds():
    hand = [t(1, R), t(2, R), t(3, R), t(9, O)]
    result = find_optimal_play(hand, board=[])
    assert result["tiles_played"] == 3
    assert len(result["melds_to_place"]) == 1
    meld = result["melds_to_place"][0]
    assert len(meld) == 3
    assert all(isinstance(ti, Tile) for ti in meld)


def test_optimal_play_board_after_includes_original_board():
    existing = [[t(4, B), t(5, B), t(6, B)]]
    hand = [t(1, R), t(2, R), t(3, R)]
    result = find_optimal_play(hand, board=existing)
    assert result["tiles_played"] == 3
    assert existing[0] in result["board_after"]
    assert result["melds_to_place"][0] in result["board_after"]


def test_optimal_play_hand_after_correct():
    hand = [t(1, R), t(2, R), t(3, R), t(9, O)]
    result = find_optimal_play(hand, board=[])
    assert len(result["hand_after"]) == 1
    assert result["hand_after"][0] == t(9, O)


def test_optimal_play_empty_hand():
    result = find_optimal_play([], board=[])
    assert result["tiles_played"] == 0
    assert result["melds_to_place"] == []


def test_optimal_play_no_valid_melds():
    hand = [t(1, R), t(3, R), t(5, R)]
    result = find_optimal_play(hand, board=[])
    assert result["tiles_played"] == 0
    assert result["melds_to_place"] == []
    assert result["hand_after"] == hand


def test_optimal_play_prefers_more_tiles():
    hand = [t(1, B), t(2, B), t(3, B), t(4, B), t(9, R)]
    result = find_optimal_play(hand, board=[], maximize="tiles_played")
    assert result["tiles_played"] == 4


def test_optimal_play_maximize_points():
    # [R11,R12,R13] = 36 pts vs [R1,R2,R3] = 6 pts — maximize="points" should pick high run
    hand = [t(11, R), t(12, R), t(13, R), t(1, R), t(2, R), t(3, R)]
    result_pts = find_optimal_play(hand, board=[], maximize="points")
    result_tiles = find_optimal_play(hand, board=[], maximize="tiles_played")
    assert result_pts["points"] >= result_tiles["points"]
    assert result_pts["points"] == 36 + 6 or result_pts["points"] >= 36  # plays both runs or at least the big one


def test_optimal_play_with_joker():
    hand = [t(1, R), JOKER, t(3, R), t(9, O)]
    result = find_optimal_play(hand, board=[])
    assert result["tiles_played"] >= 3


def test_optimal_play_callback_fires():
    calls = []
    hand = [t(1, R), t(2, R), t(3, R)]
    find_optimal_play(hand, board=[], on_new_best=lambda b: calls.append(dict(b)))
    assert len(calls) >= 1
    assert calls[-1]["tiles_played"] == 3
