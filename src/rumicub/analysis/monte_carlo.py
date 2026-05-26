"""
Monte Carlo opponent simulation for rumiCUB.

Run full games between bots to estimate win probability, mean game length,
and score distributions. Bots are pluggable (any object implementing the
Bot interface in rumicub.bot).

Use cases:
  - "How much does my GreedyBot beat the RandomBot baseline?"
  - "What's P(win | hand)" — sample-based answer when analytical EV is hard
  - "Track regression: does v0.3 still beat v0.2 N times out of M?"
"""
from __future__ import annotations
import time
from dataclasses import dataclass
from math import sqrt
from typing import Optional

from ..tile import Tile
from ..rules import RuleSet, STANDARD_RULES
from ..game import Game
from ..bot.base import Bot, DrawAction, PlayAction


MAX_TURNS_PER_GAME = 200


@dataclass
class GameResult:
    """Outcome of a single simulated game."""
    winner_name: Optional[str]
    turn_count: int
    scores: dict[str, int]
    timed_out: bool = False


@dataclass
class SimulationStats:
    """Aggregate stats over N games."""
    n_games: int
    win_counts: dict[str, int]
    mean_turns: float
    mean_score_per_player: dict[str, float]
    time_outs: int
    elapsed_seconds: float

    def win_rate(self, name: str) -> float:
        return self.win_counts.get(name, 0) / self.n_games if self.n_games else 0.0

    def win_rate_ci(self, name: str, z: float = 1.96) -> tuple[float, float]:
        """Wilson-ish normal-approximation CI for the win rate (95% by default)."""
        if self.n_games == 0:
            return (0.0, 0.0)
        p = self.win_rate(name)
        se = sqrt(p * (1 - p) / self.n_games)
        return (max(0.0, p - z * se), min(1.0, p + z * se))


# ── Single-game simulation ───────────────────────────────────────────────────

def simulate_game(
    bot_a: Bot,
    bot_b: Bot,
    rules: RuleSet = STANDARD_RULES,
    seed: Optional[int] = None,
    custom_pool: Optional[list[Tile]] = None,
    max_turns: int = MAX_TURNS_PER_GAME,
) -> GameResult:
    """
    Play one game between bot_a (seat 0) and bot_b (seat 1).
    Returns a GameResult.

    Raises ValueError if both bots have the same `name` (would collide in
    Game's name-keyed scoring dict). Disambiguate the bots' `name` attrs
    before calling.
    """
    if bot_a.name == bot_b.name:
        raise ValueError(
            f"Both bots have name {bot_a.name!r}; player names must be "
            "unique. Set distinct .name attributes (e.g. 'solver_p1' / "
            "'solver_p2') before passing them in."
        )
    bots = [bot_a, bot_b]
    game = Game(
        player_names=[bot_a.name, bot_b.name],
        rules=rules,
        seed=seed,
        custom_pool=list(custom_pool) if custom_pool is not None else None,
    )

    turns = 0
    while not game.is_over and turns < max_turns:
        bot = bots[game.current_player_index]
        action = bot.choose_action(game)

        if isinstance(action, DrawAction):
            result = game.draw()
        elif isinstance(action, PlayAction):
            result = game.play_melds(action.new_board)
            # If the bot proposed an invalid play, fall back to drawing.
            if not result.ok:
                result = game.draw()
        else:
            raise TypeError(f"Bot {bot.name} returned unexpected action: {action!r}")

        # If draw failed because pool is empty, game is now over.
        if not result.ok and game.is_over:
            break
        turns += 1

    winner = game.winner()
    return GameResult(
        winner_name=winner.name if winner else None,
        turn_count=turns,
        scores=game.scores(),
        timed_out=turns >= max_turns and not game.is_over,
    )


# ── Many-game simulation ─────────────────────────────────────────────────────

def simulate_many(
    bot_a: Bot,
    bot_b: Bot,
    n_games: int,
    rules: RuleSet = STANDARD_RULES,
    seed_base: int = 0,
    max_turns: int = MAX_TURNS_PER_GAME,
) -> SimulationStats:
    """
    Run `n_games` between bot_a and bot_b. Each game uses a different seed
    (seed_base + i) so reproducible without RNG collisions.
    """
    start = time.perf_counter()
    win_counts: dict[str, int] = {bot_a.name: 0, bot_b.name: 0}
    total_score: dict[str, int] = {bot_a.name: 0, bot_b.name: 0}
    total_turns = 0
    timeouts = 0

    for i in range(n_games):
        result = simulate_game(
            bot_a, bot_b, rules=rules, seed=seed_base + i, max_turns=max_turns
        )
        if result.timed_out:
            timeouts += 1
        if result.winner_name:
            win_counts[result.winner_name] = win_counts.get(result.winner_name, 0) + 1
        for name, sc in result.scores.items():
            total_score[name] = total_score.get(name, 0) + sc
        total_turns += result.turn_count

    elapsed = time.perf_counter() - start
    return SimulationStats(
        n_games=n_games,
        win_counts=win_counts,
        mean_turns=total_turns / n_games if n_games else 0.0,
        mean_score_per_player={
            name: total / n_games for name, total in total_score.items()
        } if n_games else {},
        time_outs=timeouts,
        elapsed_seconds=elapsed,
    )
