"""
Oracle tests for the solver: hand-computed positions with known optimal plays.

These tests catch regressions where the solver's tile count looks right but
the actual melds it returns drift. Asserting on the meld set itself (not just
counts) is what makes the oracle work.
"""
import pytest

from rumicub.engine.solver import find_optimal_play
from .fixtures.positions import POSITIONS, meld_key


@pytest.mark.parametrize("position", POSITIONS, ids=lambda p: p.name)
def test_solver_finds_known_optimal(position):
    result = find_optimal_play(
        list(position.hand),
        [list(m) for m in position.board],
    )

    actual_melds = frozenset(meld_key(m) for m in result["melds_to_place"])

    assert result["tiles_played"] == position.expected_tiles, (
        f"[{position.name}] expected {position.expected_tiles} tiles, "
        f"got {result['tiles_played']}. Melds: {result['melds_to_place']}"
    )
    assert result["points_true"] == position.expected_points, (
        f"[{position.name}] expected {position.expected_points} points, "
        f"got {result['points_true']}."
    )
    assert actual_melds in position.expected_melds, (
        f"[{position.name}] meld mismatch. "
        f"Solver returned: {actual_melds}. "
        f"None of the {len(position.expected_melds)} accepted "
        f"alternatives matched."
    )
