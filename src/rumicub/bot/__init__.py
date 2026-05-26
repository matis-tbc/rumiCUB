"""Bot package: strategies for self-play and Monte Carlo simulation."""
from .base import Bot, DrawAction, PlayAction
from .random_bot import RandomBot
from .greedy_bot import GreedyBot

__all__ = ["Bot", "DrawAction", "PlayAction", "RandomBot", "GreedyBot"]
