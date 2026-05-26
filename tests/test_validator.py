"""Tests for the full validate_turn() contract."""
import pytest
from rumicub.tile import Tile, Color, JOKER
from rumicub.rules import RuleSet, STANDARD_RULES
from rumicub.engine.validator import validate_turn

R, B, BK, O = Color.RED, Color.BLUE, Color.BLACK, Color.ORANGE


def t(n, c):
    return Tile(number=n, color=c)


def ok(result):
    valid, reason = result
    assert valid, f"Expected ok but got: {reason}"


def fail(result, substring=""):
    valid, reason = result
    assert not valid, f"Expected failure but got ok"
    if substring:
        assert substring.lower() in reason.lower(), f"Expected '{substring}' in '{reason}'"


# ── Tile conservation ──────────────────────────────────────────────────────────

def test_conservation_ok():
    hand = [t(1, R), t(2, R), t(3, R)]
    new_board = [[t(1, R), t(2, R), t(3, R)]]
    ok(validate_turn(hand, [], [], new_board, has_opened=True))


def test_conservation_tile_created():
    hand = [t(1, R), t(2, R)]
    new_board = [[t(1, R), t(2, R), t(3, R)]]  # R3 not in hand
    fail(validate_turn(hand, [], [], new_board, has_opened=True), "conservation")


def test_conservation_tile_destroyed():
    hand = [t(1, R), t(2, R), t(3, R)]
    new_board = [[t(1, R), t(2, R)]]  # R3 gone missing
    fail(validate_turn(hand, [], [], new_board, has_opened=True), "conservation")


# ── Board validity ─────────────────────────────────────────────────────────────

def test_invalid_meld_on_board():
    hand = [t(1, R), t(2, R)]
    fail(validate_turn(hand, [], [], [[t(1, R), t(2, R)]], has_opened=True), "invalid")


# ── Board rearrange restriction ────────────────────────────────────────────────

def test_no_rearrange_allows_adding_new_meld():
    rules = RuleSet(allow_board_rearrange=False)
    existing = [[t(1, R), t(2, R), t(3, R)]]
    hand = [t(7, B), t(7, BK), t(7, O)]
    new_board = existing + [[t(7, B), t(7, BK), t(7, O)]]
    ok(validate_turn(hand, existing, [], new_board, has_opened=True, rules=rules))


def test_no_rearrange_blocks_breaking_existing_meld():
    rules = RuleSet(allow_board_rearrange=False)
    existing = [[t(1, R), t(2, R), t(3, R), t(4, R)]]  # 4-tile run
    hand = []
    # Player tries to split it into two separate melds
    new_board = [[t(1, R), t(2, R), t(3, R)], [t(4, R), t(4, B), t(4, BK)]]
    # R4 only exists in hand (none here), so conservation fails first — but let's test the rearrange check too
    hand2 = [t(4, B), t(4, BK)]
    fail(validate_turn(hand2, existing, [], new_board, has_opened=True, rules=rules), "rearrangement")


# ── Joker in hand prohibition ─────────────────────────────────────────────────

def test_joker_cannot_stay_in_hand_after_retrieval():
    # Board has joker; player adds natural tile but keeps joker in hand
    board = [[t(1, R), JOKER, t(3, R)]]   # joker = 2 in the run
    hand_before = [t(2, R), t(5, B), t(5, BK), t(5, O)]
    # Player replaces joker with R2, but instead of placing joker in new meld, keeps it
    new_board = [[t(1, R), t(2, R), t(3, R)]]
    hand_after = [JOKER, t(5, B), t(5, BK), t(5, O)]
    fail(validate_turn(hand_before, board, hand_after, new_board, has_opened=True), "joker")


def test_joker_retrieval_valid_when_placed_in_new_meld():
    board = [[t(1, R), JOKER, t(3, R)]]   # joker = 2
    hand_before = [t(2, R), t(5, B), t(5, BK), t(5, O)]
    # Replace joker with R2, use joker in new group [J, B5, BK5] -> [O5, B5, BK5] or similar
    # Actually joker goes into a new meld: [JOKER, B5, BK5] as group of 7s — but joker must match
    # Let's do: player places R2 in run, uses joker in group [J, B5, BK5] (joker=5)
    new_board = [
        [t(1, R), t(2, R), t(3, R)],       # original run with natural R2
        [JOKER, t(5, B), t(5, BK)],         # new meld using the retrieved joker
    ]
    hand_after = [t(5, O)]
    ok(validate_turn(hand_before, board, hand_after, new_board, has_opened=True))


# ── Joker lockout ──────────────────────────────────────────────────────────────

def test_joker_lockout_blocks_retrieval():
    rules = RuleSet(joker_lockout_turns=2)
    board = [[JOKER, t(2, R), t(3, R)]]
    hand_before = [t(1, R), t(5, B), t(5, BK)]
    # Player wants to replace joker with R1 (joker placed on turn 5, current turn 6 — only 1 turn ago)
    new_board = [[t(1, R), t(2, R), t(3, R)], [JOKER, t(5, B), t(5, BK)]]
    hand_after = []
    fail(
        validate_turn(
            hand_before, board, hand_after, new_board,
            has_opened=True, rules=rules,
            current_turn=6, joker_placement_turns=[5],
        ),
        "locked",
    )


def test_joker_lockout_allows_retrieval_after_expiry():
    rules = RuleSet(joker_lockout_turns=2)
    board = [[JOKER, t(2, R), t(3, R)]]
    hand_before = [t(1, R), t(5, B), t(5, BK)]
    new_board = [[t(1, R), t(2, R), t(3, R)], [JOKER, t(5, B), t(5, BK)]]
    hand_after = []
    ok(
        validate_turn(
            hand_before, board, hand_after, new_board,
            has_opened=True, rules=rules,
            current_turn=10, joker_placement_turns=[5],  # 5 turns ago ≥ 2
        )
    )


# ── Joker replacement permission ──────────────────────────────────────────────

def test_joker_replacement_forbidden():
    rules = RuleSet(joker_replacement_allowed=False)
    board = [[JOKER, t(2, R), t(3, R)]]
    hand_before = [t(1, R), t(5, B), t(5, BK)]
    new_board = [[t(1, R), t(2, R), t(3, R)], [JOKER, t(5, B), t(5, BK)]]
    hand_after = []
    fail(validate_turn(hand_before, board, hand_after, new_board, has_opened=True, rules=rules), "replacement")


# ── Opening constraint ─────────────────────────────────────────────────────────

def test_opening_below_threshold():
    hand = [t(1, R), t(2, R), t(3, R)]  # value = 6, need 30
    new_board = [[t(1, R), t(2, R), t(3, R)]]
    fail(validate_turn(hand, [], [], new_board, has_opened=False), "30")


def test_opening_meets_threshold():
    hand = [t(10, R), t(11, R), t(12, R)]  # value = 33
    new_board = [[t(10, R), t(11, R), t(12, R)]]
    ok(validate_turn(hand, [], [], new_board, has_opened=False))


def test_opening_joker_counted_accurately_not_as_30():
    # [J, R2, R3] — joker=1, accurate value=6, NOT 35; must fail
    hand = [JOKER, t(2, R), t(3, R)]
    new_board = [[JOKER, t(2, R), t(3, R)]]
    fail(validate_turn(hand, [], [], new_board, has_opened=False), "30")


def test_opening_joker_high_value_meets_threshold():
    # [R12, R13, J] — joker=11 (extends low), accurate value=36 ≥ 30
    hand = [t(12, R), t(13, R), JOKER]
    new_board = [[t(12, R), t(13, R), JOKER]]
    ok(validate_turn(hand, [], [], new_board, has_opened=False))


def test_opening_hand_only_blocks_board_tiles():
    rules = RuleSet(opening_hand_only=True, allow_board_rearrange=True)
    board = [[t(10, R), t(11, R), t(12, R)]]   # 33 pts already on board
    hand = [t(9, R), t(1, B), t(2, B)]
    # Player extends existing run with R9 and tries to claim it as their opening.
    # The resulting meld [R9,R10,R11,R12] would be 42 pts but mixes hand + board tiles.
    new_board = [[t(9, R), t(10, R), t(11, R), t(12, R)]]
    hand_after = [t(1, B), t(2, B)]
    # Validator finds no meld composed entirely of new (hand-only) tiles → fails
    fail(validate_turn(hand, board, hand_after, new_board, has_opened=False, rules=rules))


def test_opening_allows_board_tiles_when_flag_off():
    rules = RuleSet(opening_hand_only=False, initial_meld_min_points=30)
    board = [[t(10, B), t(11, B), t(12, B)]]  # 33 pts on board
    hand = [t(10, R), t(11, R), t(12, R)]
    # Player forms opening from their hand tiles, board unchanged
    new_board = board + [[t(10, R), t(11, R), t(12, R)]]
    ok(validate_turn(hand, board, [], new_board, has_opened=False, rules=rules))
