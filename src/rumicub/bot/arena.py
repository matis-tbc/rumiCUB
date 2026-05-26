"""
Bot arena: pit two bots against each other across N games.

Usage:
    python -m rumicub.bot.arena --p1 greedy --p2 random --games 100
    python -m rumicub.bot.arena --p1 solver --p2 greedy --games 20 --seed 42

Available bots: random, greedy, solver

Output: win rates with 95% CI, mean turn count, mean penalty score.
"""
from __future__ import annotations
import argparse
import sys

from ..analysis.monte_carlo import simulate_many
from . import RandomBot, GreedyBot, SolverBot


_BOTS = {
    "random": lambda seed=None: RandomBot(seed=seed),
    "greedy": lambda seed=None: GreedyBot(),
    "solver": lambda seed=None: SolverBot(),
}


def _build(name: str, seed: int | None):
    if name not in _BOTS:
        raise SystemExit(f"unknown bot {name!r}. Pick one of: {', '.join(_BOTS)}")
    return _BOTS[name](seed=seed)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--p1", required=True, help="seat 1 bot")
    parser.add_argument("--p2", required=True, help="seat 2 bot")
    parser.add_argument("--games", type=int, default=50)
    parser.add_argument("--seed", type=int, default=0, help="seed base (each game seed = base + i)")
    args = parser.parse_args(argv)

    bot_a = _build(args.p1, seed=args.seed)
    bot_b = _build(args.p2, seed=args.seed + 1)
    # Disambiguate names so the same kind on both sides doesn't collide
    bot_a.name = f"{args.p1}_p1"
    bot_b.name = f"{args.p2}_p2"

    print(
        f"running {args.games} games: {bot_a.name} vs {bot_b.name} "
        f"(seed_base={args.seed})", flush=True,
    )
    stats = simulate_many(bot_a, bot_b, n_games=args.games, seed_base=args.seed)

    print()
    print(f"results ({stats.elapsed_seconds:.1f}s, "
          f"{stats.elapsed_seconds/args.games*1000:.0f} ms/game):")
    for name in (bot_a.name, bot_b.name):
        wins = stats.win_counts.get(name, 0)
        wr = stats.win_rate(name)
        lo, hi = stats.win_rate_ci(name)
        mean_pen = stats.mean_score_per_player.get(name, 0)
        print(
            f"  {name:>12}: {wins:3d} wins  ({wr:5.1%}  "
            f"95% CI [{lo:.1%}, {hi:.1%}])  mean_penalty={mean_pen:.0f}",
        )
    draws = args.games - sum(stats.win_counts.values())
    if draws:
        print(f"        draws: {draws}")
    print(f"  mean turns: {stats.mean_turns:.0f}, timeouts: {stats.time_outs}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
