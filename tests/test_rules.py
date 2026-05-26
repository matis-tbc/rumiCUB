import pytest
from rumicub.tile import Tile, Color, JOKER
from rumicub.rules import (
    RuleSet, STANDARD_RULES,
    is_valid_run, is_valid_group, is_valid_meld,
    meld_value, meld_value_accurate, joker_values_in_meld,
)

R = Color.RED
B = Color.BLUE
BK = Color.BLACK
O = Color.ORANGE


def t(n, c):
    return Tile(number=n, color=c)


# ── Run validation ─────────────────────────────────────────────────────────────

def test_valid_run_basic():
    assert is_valid_run([t(1, R), t(2, R), t(3, R)])


def test_valid_run_longer():
    assert is_valid_run([t(5, B), t(6, B), t(7, B), t(8, B)])


def test_run_too_short():
    assert not is_valid_run([t(1, R), t(2, R)])


def test_run_wrong_color():
    assert not is_valid_run([t(1, R), t(2, B), t(3, R)])


def test_run_not_consecutive():
    assert not is_valid_run([t(1, R), t(3, R), t(5, R)])


def test_run_duplicate_numbers_rejected():
    assert not is_valid_run([t(2, R), t(2, R), t(3, R)])


def test_run_full_thirteen():
    assert is_valid_run([t(n, B) for n in range(1, 14)])


def test_run_exceeds_max_run_size():
    rules = RuleSet(max_run_size=5)
    assert not is_valid_run([t(n, R) for n in range(1, 8)], rules)


def test_run_with_joker_gap():
    assert is_valid_run([t(1, R), JOKER, t(3, R)])


def test_run_joker_at_start():
    assert is_valid_run([JOKER, t(2, R), t(3, R)])


def test_run_joker_at_end():
    assert is_valid_run([t(1, R), t(2, R), JOKER])


def test_run_two_jokers_rejected_default():
    assert not is_valid_run([t(1, R), JOKER, JOKER, t(4, R)])


def test_run_two_jokers_custom_rules():
    rules = RuleSet(jokers_per_meld=2)
    assert is_valid_run([t(1, R), JOKER, JOKER, t(4, R)], rules)


def test_run_excluded_number():
    rules = RuleSet(excluded_numbers=frozenset({2}))
    assert not is_valid_run([t(1, R), t(2, R), t(3, R)], rules)


# ── Group validation ───────────────────────────────────────────────────────────

def test_valid_group_three():
    assert is_valid_group([t(7, R), t(7, B), t(7, BK)])


def test_valid_group_four():
    assert is_valid_group([t(7, R), t(7, B), t(7, BK), t(7, O)])


def test_group_too_short():
    assert not is_valid_group([t(7, R), t(7, B)])


def test_group_five_rejected():
    assert not is_valid_group([t(7, R), t(7, B), t(7, BK), t(7, O), JOKER])


def test_group_duplicate_color():
    assert not is_valid_group([t(7, R), t(7, R), t(7, B)])


def test_group_different_numbers():
    assert not is_valid_group([t(7, R), t(8, B), t(9, BK)])


def test_group_with_joker():
    assert is_valid_group([t(7, R), t(7, B), JOKER])


def test_group_excluded_number():
    rules = RuleSet(excluded_numbers=frozenset({7}))
    assert not is_valid_group([t(7, R), t(7, B), t(7, BK)], rules)


def test_color_restriction_blocks_invalid_combo():
    rules = RuleSet(allowed_color_combos=frozenset({frozenset({R, B, BK})}))
    assert not is_valid_group([t(7, R), t(7, B), t(7, O)], rules)


def test_color_restriction_allows_valid_combo():
    rules = RuleSet(allowed_color_combos=frozenset({frozenset({R, B, BK})}))
    assert is_valid_group([t(7, R), t(7, B), t(7, BK)], rules)


def test_color_restriction_joker_valid_assignment():
    # [R7, B7, JOKER] — joker can be BK, making R+B+BK which is in allowed set
    rules = RuleSet(allowed_color_combos=frozenset({frozenset({R, B, BK})}))
    assert is_valid_group([t(7, R), t(7, B), JOKER], rules)


def test_color_restriction_joker_no_valid_assignment():
    # Only R+B+BK allowed; joker would need to be O to make a 4-tile group, not in allowed
    rules = RuleSet(allowed_color_combos=frozenset({frozenset({R, B, BK})}))
    assert not is_valid_group([t(7, R), t(7, B), t(7, BK), JOKER], rules)


# ── Joker value functions ──────────────────────────────────────────────────────

def test_joker_value_in_group():
    meld = [t(7, R), t(7, B), JOKER]
    assert joker_values_in_meld(meld) == [7]


def test_joker_value_fills_gap_in_run():
    meld = [t(1, R), JOKER, t(3, R)]
    assert joker_values_in_meld(meld) == [2]


def test_joker_value_extends_run_high():
    meld = [t(5, R), t(6, R), JOKER]
    assert 7 in joker_values_in_meld(meld)


def test_joker_value_fills_gap_then_extends():
    rules = RuleSet(jokers_per_meld=2)
    meld = [t(1, R), JOKER, t(3, R), JOKER]
    vals = joker_values_in_meld(meld)
    assert 2 in vals  # fills gap 1→3
    assert len(vals) == 2


def test_meld_value_penalty():
    # meld_value always counts joker as 30 (end-game penalty)
    meld = [t(5, R), JOKER, t(7, R)]
    assert meld_value(meld) == 5 + 30 + 7


def test_meld_value_accurate_run_with_joker():
    # [R5, J, R7] — joker fills gap as 6, accurate total = 5+6+7 = 18
    meld = [t(5, R), JOKER, t(7, R)]
    assert meld_value_accurate(meld) == 18


def test_meld_value_accurate_group_with_joker():
    # [R7, B7, J] — joker = 7, accurate total = 21
    meld = [t(7, R), t(7, B), JOKER]
    assert meld_value_accurate(meld) == 21


def test_meld_value_accurate_no_joker():
    meld = [t(1, R), t(2, R), t(3, R)]
    assert meld_value_accurate(meld) == meld_value(meld) == 6


def test_opening_threshold_joker_not_inflated():
    # [J, R2, R3] as run — joker extends high to 4: accurate value = 2+3+4 = 9, NOT 30+2+3 = 35
    meld = [JOKER, t(2, R), t(3, R)]
    assert meld_value_accurate(meld) == 9
    assert meld_value(meld) == 35   # penalty scoring counts joker=30 — different
    assert meld_value_accurate(meld) < 30  # still fails opening threshold


def test_opening_threshold_joker_at_high_end():
    # [R12, R13, J] — joker extends to... 11 (only valid low extension) or nothing high
    # lo=12, hi=13; hi+1=14 invalid, lo-1=11 valid → joker=11
    meld = [t(12, R), t(13, R), JOKER]
    assert meld_value_accurate(meld) == 36  # 12+13+11


def test_meld_value_accurate_high_end_extension():
    # [R5, R6, J] — joker extends high: 7
    meld = [t(5, R), t(6, R), JOKER]
    assert meld_value_accurate(meld) == 18  # 5+6+7
