"""Integration tests for Game: draw, play, scoring, joker lockout, must_play."""
import pytest
from rumicub.tile import Tile, Color, JOKER
from rumicub.game import Game
from rumicub.rules import RuleSet, STANDARD_RULES

R, B, BK, O = Color.RED, Color.BLUE, Color.BLACK, Color.ORANGE


def t(n, c):
    return Tile(number=n, color=c)


# ── Basic game mechanics ───────────────────────────────────────────────────────

def test_initial_hand_size():
    game = Game(["A", "B"], seed=1)
    for p in game.players:
        assert len(p.hand) == 14


def test_draw_gives_tile_and_advances_turn():
    game = Game(["A", "B"], seed=1)
    original_name = game.current_player.name
    hand_size_before = len(game.current_player.hand)
    result = game.draw()
    assert result.ok
    # Turn advances — now the other player is current
    assert game.current_player.name != original_name
    # Original player's hand grew
    player_a = next(p for p in game.players if p.name == original_name)
    assert len(player_a.hand) == hand_size_before + 1


def test_play_melds_valid():
    game = Game(["A", "B"], seed=0)
    player = game.current_player
    # Inject a hand that we know meets the opening threshold
    player.hand = [t(10, R), t(11, R), t(12, R)] + [t(1, B)] * 11
    new_board = [[t(10, R), t(11, R), t(12, R)]]
    result = game.play_melds(new_board)
    assert result.ok
    assert player.has_opened


def test_play_melds_invalid_below_threshold():
    game = Game(["A", "B"], seed=0)
    player = game.current_player
    player.hand = [t(1, R), t(2, R), t(3, R)] + [t(5, B)] * 11
    new_board = [[t(1, R), t(2, R), t(3, R)]]  # 6 pts, need 30
    result = game.play_melds(new_board)
    assert not result.ok
    assert "30" in result.reason


def test_win_when_hand_empty():
    game = Game(["A", "B"], seed=0)
    player = game.current_player
    player.has_opened = True
    player.hand = [t(10, R), t(11, R), t(12, R)]
    new_board = [[t(10, R), t(11, R), t(12, R)]]
    result = game.play_melds(new_board)
    assert result.ok
    assert result.won
    assert game.is_over
    assert game.winner().name == player.name


def test_scores_winner_zero():
    game = Game(["A", "B"], seed=0)
    player = game.current_player
    player.has_opened = True
    player.hand = [t(10, R), t(11, R), t(12, R)]
    game.play_melds([[t(10, R), t(11, R), t(12, R)]])
    s = game.scores()
    assert s[player.name] == 0


def test_scores_loser_penalised():
    game = Game(["A", "B"], seed=0)
    winner = game.current_player
    loser = game.players[1]
    winner.has_opened = True
    winner.hand = [t(10, R), t(11, R), t(12, R)]
    loser.hand = [t(5, B)]  # 5 pts penalty
    game.play_melds([[t(10, R), t(11, R), t(12, R)]])
    s = game.scores()
    assert s[loser.name] == 5


def test_joker_penalty_30():
    game = Game(["A", "B"], seed=0)
    winner = game.current_player
    loser = game.players[1]
    winner.has_opened = True
    winner.hand = [t(10, R), t(11, R), t(12, R)]
    loser.hand = [JOKER]  # 30 pts penalty
    game.play_melds([[t(10, R), t(11, R), t(12, R)]])
    s = game.scores()
    assert s[loser.name] == 30


# ── Joker lockout ──────────────────────────────────────────────────────────────

def test_joker_lockout_tracking():
    rules = RuleSet(joker_lockout_turns=3)
    game = Game(["A", "B"], rules=rules, seed=0)
    a, b = game.players

    # Give A a hand that allows placing a joker on the board
    a.hand = [JOKER, t(2, R), t(3, R)] + [t(1, B)] * 11
    a.has_opened = True
    game.play_melds([[JOKER, t(2, R), t(3, R)]])
    # One joker on board, placed on turn 0
    assert len(game._joker_placement_turns) == 1
    assert game._joker_placement_turns[0] == 0


def test_joker_lockout_prevents_retrieval():
    rules = RuleSet(joker_lockout_turns=3)
    game = Game(["A", "B"], rules=rules, seed=0)
    a, b = game.players

    # Place joker on board
    a.hand = [JOKER, t(2, R), t(3, R)] + [t(1, B)] * 11
    a.has_opened = True
    game.play_melds([[JOKER, t(2, R), t(3, R)]])
    # Now it's B's turn — skip (draw)
    game.draw()  # B draws
    # Back to A — only 1 turn has passed, lockout is 3
    # A tries to retrieve the joker
    a.hand = [t(1, R), t(5, B), t(5, BK)]
    new_board = [
        [t(1, R), t(2, R), t(3, R)],
        [JOKER, t(5, B), t(5, BK)],
    ]
    result = game.play_melds(new_board)
    assert not result.ok
    assert "locked" in result.reason.lower()


# ── must_play_if_possible ──────────────────────────────────────────────────────

def test_must_play_blocks_draw_when_play_exists():
    rules = RuleSet(must_play_if_possible=True)
    game = Game(["A", "B"], rules=rules, seed=0)
    player = game.current_player
    player.has_opened = True
    player.hand = [t(10, R), t(11, R), t(12, R), t(1, B)]
    result = game.draw()
    assert not result.ok
    assert "must_play" in result.reason.lower()


def test_must_play_allows_draw_when_no_play():
    rules = RuleSet(must_play_if_possible=True)
    game = Game(["A", "B"], rules=rules, seed=0)
    player = game.current_player
    player.has_opened = True
    player.hand = [t(1, R), t(3, R), t(5, R), t(7, R)]  # no valid meld
    result = game.draw()
    assert result.ok


# ── propose_play preview / rollback ───────────────────────────────────────────

def test_propose_play_valid_does_not_commit():
    game = Game(["A", "B"], seed=0)
    player = game.current_player
    player.hand = [t(10, R), t(11, R), t(12, R)] + [t(1, B)] * 11
    proposal = game.propose_play([[t(10, R), t(11, R), t(12, R)]])
    assert proposal.valid
    # Board not yet changed
    assert game.board == []
    assert not player.has_opened


def test_propose_play_commit_applies():
    game = Game(["A", "B"], seed=0)
    player = game.current_player
    player.hand = [t(10, R), t(11, R), t(12, R)] + [t(1, B)] * 11
    proposal = game.propose_play([[t(10, R), t(11, R), t(12, R)]])
    result = proposal.commit()
    assert result.ok
    assert player.has_opened
    assert len(game.board) == 1


def test_propose_play_invalid_and_abandon():
    game = Game(["A", "B"], seed=0)
    player = game.current_player
    player.hand = [t(1, R), t(2, R), t(3, R)] + [t(5, B)] * 11
    proposal = game.propose_play([[t(1, R), t(2, R), t(3, R)]])
    assert not proposal.valid
    proposal.abandon()
    assert game.board == []  # unchanged
    assert not player.has_opened


# ── full_pool snapshot ─────────────────────────────────────────────────────────

def test_game_snapshots_full_pool():
    # The Game must remember the universe of tiles, not just the draw pile,
    # so probability functions can reason about the correct space.
    game = Game(["A", "B"], seed=0)
    assert len(game.full_pool) == 106
    # After dealing, full_pool stays at 106 while pool drops by 28 (2 * 14).
    assert len(game.pool) == 106 - 28


def test_game_full_pool_respects_custom():
    from rumicub.tile import TileSet
    restricted = TileSet.restricted(excluded_numbers={13})
    universe_size = len(restricted)   # snapshot before Game pops tiles for deal
    game = Game(["A", "B"], seed=0, custom_pool=restricted)
    assert len(game.full_pool) == universe_size
    assert all(t.number != 13 for t in game.full_pool if not t.is_joker)


# ── C1: advisor uses true joker value for opening check ───────────────────────

def test_advisor_does_not_recommend_invalid_opening_with_joker():
    """Previously: advise() inflated joker=30 and recommended invalid openings.
    Now: opening check uses meld_value_accurate (joker = represented value)."""
    from rumicub.analysis.strategy import advise
    # Hand: [J, R2, R3] -- joker fills as 4 (extends high). Accurate value=9.
    # Validator rejects opening below 30; advisor must agree.
    hand = [JOKER, t(2, R), t(3, R)]
    advice = advise(hand, board=[], has_opened=False)
    assert advice.action == "draw"
    assert "true value" in advice.reasoning.lower() or "9" in advice.reasoning


def test_advisor_recommends_legitimate_opening():
    from rumicub.analysis.strategy import advise
    hand = [t(10, R), t(11, R), t(12, R)] + [t(1, B)] * 11
    advice = advise(hand, board=[], has_opened=False)
    assert advice.action == "play"
    assert advice.points == 33   # true value, no joker


# ── M1: no-op turn ban ────────────────────────────────────────────────────────

def test_noop_play_is_rejected():
    """M1: cannot 'pass' by proposing the current board unchanged."""
    game = Game(["A", "B"], seed=0)
    player = game.current_player
    player.hand = [t(1, B)] * 14  # no valid plays from this hand
    result = game.play_melds([])
    assert not result.ok
    assert "not allowed" in result.reason.lower() or "no tiles played" in result.reason.lower()
    # State unchanged
    assert game.turn == 0
    assert game.board == []
    assert len(player.hand) == 14


def test_noop_propose_marks_invalid():
    game = Game(["A", "B"], seed=0)
    player = game.current_player
    player.hand = [t(1, B)] * 14
    proposal = game.propose_play([])
    assert not proposal.valid


# ── M2: stuck-state winner determination ──────────────────────────────────────

def test_stuck_state_winner_is_lowest_penalty():
    """When pool empties and game ends, the player with the lowest hand
    penalty wins, not None."""
    game = Game(["A", "B"], seed=0)
    a, b = game.players
    # Drain pool to empty
    game.pool = []
    a.hand = [t(13, R), t(13, B)]   # 26 penalty
    b.hand = [t(1, R), t(2, R)]      # 3 penalty
    # A tries to draw, hits empty pool → game over
    result = game.draw()
    assert not result.ok
    assert game.is_over
    winner = game.winner()
    assert winner is not None
    assert winner.name == b.name   # lower penalty


def test_stuck_state_tie_breaks_by_seat_order():
    game = Game(["A", "B"], seed=0)
    a, b = game.players
    game.pool = []
    a.hand = [t(5, R)]
    b.hand = [t(5, B)]
    game.draw()  # triggers game over
    winner = game.winner()
    assert winner.name == a.name  # tied, A is first in seat order


def test_winner_still_none_mid_game():
    game = Game(["A", "B"], seed=0)
    assert game.winner() is None
