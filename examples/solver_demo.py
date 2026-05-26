"""
Solver demo: shows optimal play and all valid melds for a sample hand.
Run: python examples/solver_demo.py
"""
from rumicub.tile import Tile, Color, JOKER
from rumicub.engine.solver import find_all_melds, find_optimal_play
from rumicub.analysis.strategy import advise
from rumicub.rules import STANDARD_RULES

R, B, BK, O = Color.RED, Color.BLUE, Color.BLACK, Color.ORANGE


def t(n, c):
    return Tile(number=n, color=c)


hand = [
    t(1, R), t(2, R), t(3, R), t(4, R),   # solid run
    t(7, B), t(7, BK), t(7, O),            # group
    t(5, B), t(6, B),                      # partial run
    t(11, R),                              # isolated
    JOKER,
    t(9, O), t(12, BK), t(13, R),
]

print(f"Hand ({len(hand)} tiles): {hand}\n")

print("── All valid melds ──")
melds = find_all_melds(hand)
for m in melds:
    print(" ", m)

print(f"\nTotal valid melds: {len(melds)}\n")

print("── Optimal play (maximize tiles played) ──")
result = find_optimal_play(hand, board=[], rules=STANDARD_RULES, maximize="tiles_played")
print(f"  Tiles played : {result['tiles_played']}")
print(f"  Points       : {result['points']}")
print(f"  Hand after   : {result['hand_after']}")

print("\n── Strategy advice (first turn, not yet opened) ──")
advice = advise(hand, board=[], has_opened=False, rules=STANDARD_RULES)
print(f"  Action       : {advice.action}")
print(f"  Tiles played : {advice.tiles_played}")
print(f"  Points       : {advice.points}")
print(f"  Reasoning    : {advice.reasoning}")
print(f"  Confidence   : {advice.confidence:.0%}")

if advice.partial_melds:
    print("\n── Top partial melds (easiest to complete) ──")
    for pm in advice.partial_melds[:3]:
        print(f"  {pm.tiles}  →  expected {pm.expected_draws:.1f} draws, "
              f"P(done in 3)={pm.prob_complete_in_3:.1%}")
