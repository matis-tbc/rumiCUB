"""
Basic 2-player game loop using the engine to drive both players.
Run: python examples/basic_game.py
"""
from rumicub.game import Game
from rumicub.engine.solver import find_optimal_play
from rumicub.rules import STANDARD_RULES


def ai_turn(game: "Game") -> bool:
    """Simple AI: play as many tiles as possible, otherwise draw."""
    player = game.current_player
    result = find_optimal_play(player.hand, game.board, STANDARD_RULES)

    if result["tiles_played"] == 0:
        tile = game.draw()
        print(f"  {player.name} draws {tile}")
        return False

    # Build a proposed board: existing board + new hand tiles arranged into melds
    # For the simple AI we just play the new melds on top of existing board
    new_board = list(game.board)
    for meld_idx in result.get("_melds_idx", []):
        # _melds_idx are pool indices; we reconstruct the meld
        pass

    # Simplified: use hand_after to derive what was played
    # In a real UI the player proposes the full board state
    print(f"  {player.name}: no board-manipulation — drawing instead (demo limitation)")
    tile = game.draw()
    print(f"  {player.name} draws {tile}")
    return False


def main():
    game = Game(["Alice", "Bob"], seed=42)

    print("=== rumiCUB demo game ===")
    for p in game.players:
        print(f"{p.name}'s hand: {p.hand}")
    print()

    for _ in range(10):
        if game.is_over:
            break
        player = game.current_player
        print(f"Turn {game.turn} — {player.name} ({len(player.hand)} tiles)")
        ai_turn(game)

    if game.is_over:
        w = game.winner()
        print(f"\n{w.name} wins!" if w else "\nGame ended — no winner (pool empty).")
    else:
        print("\nDemo ended after 10 turns.")

    print("\nFinal scores (penalty points, lower is better):")
    for name, score in game.scores().items():
        print(f"  {name}: {score}")


if __name__ == "__main__":
    main()
