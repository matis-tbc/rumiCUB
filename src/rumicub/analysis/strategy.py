"""
Strategy advisor for rumiCUB.

Combines the solver and probability engine to recommend the best action
for the current turn and evaluate the long-term quality of a hand.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from itertools import combinations
from typing import Optional

from ..tile import Tile
from ..rules import RuleSet, STANDARD_RULES, meld_value, meld_value_accurate
from ..engine.solver import find_all_melds, find_optimal_play
from .probability import (
    unseen_pool,
    expected_draws_to_complete,
    prob_complete_in_k_draws,
    tiles_needed_to_complete,
)


# ── Data types ─────────────────────────────────────────────────────────────────

@dataclass
class PartialMeldInfo:
    tiles: list[Tile]
    missing_count: int
    expected_draws: float
    prob_complete_in_3: float


@dataclass
class TurnAdvice:
    action: str                          # "play" | "draw"
    melds_to_play: list[list[Tile]]
    hand_after: list[Tile]
    tiles_played: int
    points: int
    reasoning: str
    confidence: float                    # 0–1
    partial_melds: list[PartialMeldInfo] = field(default_factory=list)


# ── Main advisor ───────────────────────────────────────────────────────────────

def advise(
    hand: list[Tile],
    board: list[list[Tile]],
    has_opened: bool,
    rules: RuleSet = STANDARD_RULES,
    opponent_tile_counts: list[int] | None = None,
    full_pool: Optional[list[Tile]] = None,
) -> TurnAdvice:
    """
    Recommend the best action for the current turn.

    `opponent_tile_counts` influences urgency: if an opponent has few tiles,
    we bias toward playing aggressively.
    """
    optimal = find_optimal_play(hand, board, rules, maximize="tiles_played")
    known = hand + [t for meld in board for t in meld]
    partials = rank_partial_melds(hand, known, rules, full_pool)

    urgency = _urgency(opponent_tile_counts)

    if not has_opened:
        # Opening threshold uses the TRUE meld value (joker = represented value),
        # not the inflated penalty value where joker = 30. Without this, the
        # advisor recommends opening with melds the validator will reject.
        opening_pts = sum(
            meld_value_accurate(m) for m in optimal["melds_to_place"]
        )
        if opening_pts < rules.initial_meld_min_points:
            return TurnAdvice(
                action="draw",
                melds_to_play=[],
                hand_after=hand,
                tiles_played=0,
                points=0,
                reasoning=(
                    f"Cannot open: best play worth {opening_pts} pts (true value) "
                    f"(need {rules.initial_meld_min_points}). Drawing."
                ),
                confidence=0.95,
                partial_melds=partials,
            )

    if optimal["tiles_played"] == 0:
        return TurnAdvice(
            action="draw",
            melds_to_play=[],
            hand_after=hand,
            tiles_played=0,
            points=0,
            reasoning="No valid play available — drawing a tile.",
            confidence=1.0,
            partial_melds=partials,
        )

    # Display the true (accurate) point value, not the penalty inflation.
    display_pts = sum(meld_value_accurate(m) for m in optimal["melds_to_place"])
    return TurnAdvice(
        action="play",
        melds_to_play=optimal["melds_to_place"] if optimal["melds_to_place"] else [],
        hand_after=optimal["hand_after"],
        tiles_played=optimal["tiles_played"],
        points=display_pts,
        reasoning=(
            f"Play {optimal['tiles_played']} tile(s) for {display_pts} pts. "
            + (f"Urgency={urgency:.2f} (opponent close)." if urgency > 0.6 else "")
        ),
        confidence=0.85 + 0.1 * urgency,
        partial_melds=partials,
    )


# ── Partial meld analysis ──────────────────────────────────────────────────────

def rank_partial_melds(
    hand: list[Tile],
    known_tiles: list[Tile],
    rules: RuleSet = STANDARD_RULES,
    full_pool: Optional[list[Tile]] = None,
) -> list[PartialMeldInfo]:
    """
    Enumerate 2-tile partial melds from `hand` and rank by expected draws to complete.
    Only subsets that could form a valid meld with one more tile are included.
    """
    pool = unseen_pool(known_tiles, full_pool)
    infos: list[PartialMeldInfo] = []

    for size in range(2, rules.min_meld_size):
        for combo in combinations(hand, size):
            partial = list(combo)
            # Check if any tile in the unseen pool completes this partial into a valid meld
            completions = _possible_completions(partial, pool, rules)
            if not completions:
                continue
            # Use the easiest-to-reach completion
            best_target = min(
                completions,
                key=lambda t: expected_draws_to_complete(partial, t, known_tiles, full_pool),
            )
            exp = expected_draws_to_complete(partial, best_target, known_tiles, full_pool)
            p3 = float(
                prob_complete_in_k_draws(partial, best_target, known_tiles, 3, full_pool)
            )
            infos.append(PartialMeldInfo(
                tiles=partial,
                missing_count=len(tiles_needed_to_complete(partial, best_target)),
                expected_draws=exp,
                prob_complete_in_3=p3,
            ))

    return sorted(infos, key=lambda x: x.expected_draws)


def _possible_completions(
    partial: list[Tile],
    pool: list[Tile],
    rules: RuleSet,
) -> list[list[Tile]]:
    """
    Return candidate complete melds (size == min_meld_size) that contain `partial`
    and whose missing tiles exist in `pool`.
    """
    from ..rules import is_valid_meld
    completions = []
    needed_count = rules.min_meld_size - len(partial)
    if needed_count <= 0:
        return []
    for extra in combinations(pool, needed_count):
        candidate = partial + list(extra)
        if is_valid_meld(candidate, rules):
            completions.append(candidate)
    return completions


# ── Helpers ────────────────────────────────────────────────────────────────────

def _urgency(opponent_counts: list[int] | None) -> float:
    if not opponent_counts:
        return 0.0
    min_opp = min(opponent_counts)
    if min_opp <= 1:
        return 1.0
    if min_opp <= 3:
        return 0.8
    if min_opp <= 6:
        return 0.5
    return 0.2


def hand_flexibility(
    hand: list[Tile],
    known_tiles: list[Tile],
    rules: RuleSet = STANDARD_RULES,
    full_pool: Optional[list[Tile]] = None,
) -> float:
    """
    Score 0–1: how many distinct partial melds the hand contains.
    Higher = more drawing options; lower = more locked-in.
    """
    partials = rank_partial_melds(hand, known_tiles, rules, full_pool)
    full_melds = find_all_melds(hand, rules)
    raw = len(full_melds) * 3 + len(partials)
    return min(1.0, raw / 30.0)
