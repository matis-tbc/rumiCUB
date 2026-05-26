"""
Turn validator for rumiCUB.

validate_turn() verifies that a player's proposed board state is fully legal:
  1. Tile conservation — no tiles created or destroyed.
  2. Every meld on the resulting board is structurally valid.
  3. Board-rearrange permission — if disabled, no existing meld may be broken.
  4. Opening constraint — first play must meet the point threshold; if
     opening_hand_only is set, no board tiles may be incorporated.
  5. Joker-in-hand prohibition — a retrieved joker must be placed in the same turn.
  6. Joker lockout — a joker cannot be moved from its meld within
     `joker_lockout_turns` turns of being placed there.
"""
from __future__ import annotations
from collections import Counter

from ..tile import Tile
from ..rules import RuleSet, STANDARD_RULES, is_valid_meld, meld_value_accurate, board_is_valid


def validate_turn(
    hand_before: list[Tile],
    board_before: list[list[Tile]],
    hand_after: list[Tile],
    board_after: list[list[Tile]],
    has_opened: bool,
    rules: RuleSet = STANDARD_RULES,
    current_turn: int = 0,
    joker_placement_turns: list[int] | None = None,
) -> tuple[bool, str]:
    """
    Return (ok, reason).  `reason` is empty on success.

    Parameters
    ----------
    joker_placement_turns
        List of turn numbers on which each joker currently on the board was
        placed (one entry per joker, sorted ascending).  Required only when
        rules.joker_lockout_turns > 0.
    """
    # ── 1. Tile conservation ───────────────────────────────────────────────
    pool_before = Counter(_key(t) for t in hand_before)
    pool_before.update(_key(t) for meld in board_before for t in meld)
    pool_after = Counter(_key(t) for t in hand_after)
    pool_after.update(_key(t) for meld in board_after for t in meld)

    if pool_before != pool_after:
        delta_created = pool_after - pool_before
        delta_lost = pool_before - pool_after
        return False, (
            f"Tile conservation violated — "
            f"created: {dict(delta_created)}, lost: {dict(delta_lost)}"
        )

    # ── 2. All board melds are structurally valid ─────────────────────────
    if not board_is_valid(board_after, rules):
        invalid = [m for m in board_after if not is_valid_meld(m, rules)]
        return False, f"Invalid melds on board after turn: {invalid}"

    # ── 3. Board-rearrange restriction ────────────────────────────────────
    if not rules.allow_board_rearrange:
        before_sigs = Counter(_meld_sig(m) for m in board_before)
        after_sigs = Counter(_meld_sig(m) for m in board_after)
        for sig, count in before_sigs.items():
            if after_sigs[sig] < count:
                return False, (
                    "Board rearrangement is disabled — an existing meld was "
                    "broken or modified."
                )

    # ── 4. Joker-in-hand prohibition ──────────────────────────────────────
    # Jokers that were NOT in hand_before may not appear in hand_after
    jokers_before_in_hand = sum(1 for t in hand_before if t.is_joker)
    jokers_after_in_hand = sum(1 for t in hand_after if t.is_joker)
    if jokers_after_in_hand > jokers_before_in_hand:
        return False, (
            "A retrieved joker must be placed into a new meld in the same turn — "
            "it cannot remain in hand."
        )

    # ── 5. Joker-replacement permission ───────────────────────────────────
    if not rules.joker_replacement_allowed:
        # Any change to a joker-containing meld (even same count) counts as retrieval
        before_joker_melds = Counter(
            _meld_sig(m) for m in board_before if any(t.is_joker for t in m)
        )
        after_joker_melds = Counter(
            _meld_sig(m) for m in board_after if any(t.is_joker for t in m)
        )
        if before_joker_melds != after_joker_melds:
            return False, "Joker replacement (retrieval) is not allowed by the active rule set."

    # ── 6. Joker lockout ──────────────────────────────────────────────────
    if rules.joker_lockout_turns > 0 and joker_placement_turns:
        before_joker_meld_sigs = frozenset(
            _meld_sig(m) for m in board_before if any(t.is_joker for t in m)
        )
        after_joker_meld_sigs = frozenset(
            _meld_sig(m) for m in board_after if any(t.is_joker for t in m)
        )
        if before_joker_meld_sigs != after_joker_meld_sigs:
            for placed_turn in joker_placement_turns:
                if current_turn - placed_turn < rules.joker_lockout_turns:
                    return False, (
                        f"Joker placed on turn {placed_turn} is locked for "
                        f"{rules.joker_lockout_turns} turn(s) — cannot be moved yet."
                    )

    # ── 7. Opening constraint ─────────────────────────────────────────────
    played_from_hand = Counter(_key(t) for t in hand_before) - Counter(
        _key(t) for t in hand_after
    )
    if not has_opened and any(played_from_hand.values()):
        ok, reason = _validate_opening(
            hand_before, board_before, board_after, rules
        )
        if not ok:
            return False, reason

    return True, ""


# ── Opening validation ─────────────────────────────────────────────────────────

def _validate_opening(
    hand_before: list[Tile],
    board_before: list[list[Tile]],
    board_after: list[list[Tile]],
    rules: RuleSet,
) -> tuple[bool, str]:
    """
    Validate the initial meld attempt.

    Identifies newly-placed melds (melds in board_after whose tiles all
    originate from hand_before, not from existing board melds) and checks that
    their combined accurate value meets the threshold.

    Also enforces opening_hand_only: no tile from board_before may be
    incorporated into the opening melds.
    """
    board_before_pool = Counter(_key(t) for m in board_before for t in m)
    board_after_pool = Counter(_key(t) for m in board_after for t in m)
    new_board_tiles = board_after_pool - board_before_pool

    if rules.opening_hand_only:
        hand_pool = Counter(_key(t) for t in hand_before)
        for key, count in new_board_tiles.items():
            if hand_pool.get(key, 0) < count:
                return False, (
                    "Opening meld must consist entirely of tiles from your own hand — "
                    "board tiles may not be incorporated."
                )

    # Find melds on board_after that are composed solely of newly-placed tiles.
    # Consume the new_tile counter as we identify opening melds.
    new_tile_budget = Counter(new_board_tiles)
    opening_value = 0
    opening_meld_count = 0

    for meld in board_after:
        meld_keys = Counter(_key(t) for t in meld)
        if all(new_tile_budget.get(k, 0) >= v for k, v in meld_keys.items()):
            # Entire meld is new tiles — it's an opening meld
            opening_value += meld_value_accurate(meld)
            opening_meld_count += 1
            for k, v in meld_keys.items():
                new_tile_budget[k] -= v

    if opening_meld_count == 0:
        return False, "No opening melds identified — all proposed melds mix hand and board tiles."

    if opening_value < rules.initial_meld_min_points:
        return False, (
            f"Opening meld worth {opening_value} pts (joker counted at represented value); "
            f"need {rules.initial_meld_min_points} pts."
        )

    return True, ""


# ── Helpers ────────────────────────────────────────────────────────────────────

def _key(tile: Tile) -> tuple:
    return (tile.number, tile.color, tile.is_joker)


def _meld_sig(meld: list[Tile]) -> tuple:
    """Canonical, order-independent meld signature that preserves tile multiplicity."""
    def _sortable(tile: Tile) -> tuple:
        # None values and Color enums aren't directly comparable — normalise to strings/ints
        n = tile.number if tile.number is not None else -1
        c = tile.color.value if tile.color is not None else ""
        return (n, c, tile.is_joker)
    return tuple(sorted(_sortable(t) for t in meld))
