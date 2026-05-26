import pytest
from rumicub.tile import Tile, Color, TileSet, JOKER, MIN_NUMBER, MAX_NUMBER


def test_joker_properties():
    assert JOKER.is_joker
    assert JOKER.value() == 30
    assert repr(JOKER) == "JOKER"


def test_tile_repr():
    t = Tile(number=7, color=Color.RED)
    assert repr(t) == "R7"


def test_tile_invalid_number():
    with pytest.raises(ValueError):
        Tile(number=0, color=Color.BLUE)
    with pytest.raises(ValueError):
        Tile(number=14, color=Color.BLUE)


def test_tile_invalid_joker():
    with pytest.raises(ValueError):
        Tile(number=5, color=None, is_joker=False)


def test_standard_tileset_count():
    pool = TileSet.standard()
    assert len(pool) == 106


def test_standard_tileset_joker_count():
    pool = TileSet.standard()
    assert sum(1 for t in pool if t.is_joker) == 2


def test_standard_tileset_each_tile_twice():
    pool = TileSet.standard()
    non_jokers = [t for t in pool if not t.is_joker]
    from collections import Counter
    counts = Counter((t.number, t.color) for t in non_jokers)
    assert all(v == 2 for v in counts.values())
    assert len(counts) == 4 * 13


def test_restricted_tileset_excludes_numbers():
    pool = TileSet.restricted(excluded_numbers={13})
    assert all(t.number != 13 for t in pool if not t.is_joker)


def test_restricted_tileset_excludes_colors():
    pool = TileSet.restricted(excluded_colors={Color.RED})
    assert all(t.color != Color.RED for t in pool if not t.is_joker)
