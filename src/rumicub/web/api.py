"""
rumiCUBE FastAPI backend.

In-memory game storage. Endpoints follow the REST shape locked in CLAUDE.md
Phase 4. For production multi-process deploys, swap _GAMES for Redis or a
proper session store.

Run locally:
    uvicorn rumicub.web.api:app --reload --port 8000
"""
from __future__ import annotations
import secrets
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from collections import defaultdict

from ..tile import Color
from ..game import Game
from ..rules import STANDARD_RULES, meld_value_accurate
from ..engine.solver import find_optimal_play
from ..analysis.strategy import hand_quality_score

from .schemas import (
    CreateGameRequest,
    GameStateDTO,
    HandQualityDTO,
    MeldDTO,
    PlayRequest,
    PlayResponse,
    PlayerDTO,
    ProbabilitiesResponse,
    ScarcityEntry,
    SuggestResponse,
    TileDTO,
)

# Try to import the ILP solver (optional)
try:
    from ..engine.ilp_solver import BoardManipulator
    _HAS_ILP = True
except ImportError:
    BoardManipulator = None  # type: ignore[assignment]
    _HAS_ILP = False


app = FastAPI(
    title="rumiCUBE API",
    version="0.4.0-dev",
    description="Backend for the rumiCUBE web game and solver UI",
)

# CORS: allow the Vite dev server (5173) and the deployed Vercel domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://rumicube.vercel.app",
        "https://rumicube-*.vercel.app",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


# In-memory store. Restart wipes everything. Fine for dev.
_GAMES: dict[str, Game] = {}


def _new_id() -> str:
    """Short URL-safe game ID."""
    return secrets.token_urlsafe(6)


def _serialize_game(game_id: str, game: Game) -> GameStateDTO:
    return GameStateDTO(
        id=game_id,
        turn=game.turn,
        current_player_index=game.current_player_index,
        is_over=game.is_over,
        winner=(game.winner().name if game.winner() else None),
        pool_remaining=len(game.pool),
        board=[MeldDTO.from_meld(m) for m in game.board],
        players=[
            PlayerDTO(
                name=p.name,
                hand=[TileDTO.from_tile(t) for t in p.hand],
                has_opened=p.has_opened,
                hand_count=len(p.hand),
                penalty=sum(
                    game.rules.joker_penalty if t.is_joker else (t.number or 0)
                    for t in p.hand
                ),
            )
            for p in game.players
        ],
    )


def _get_game(game_id: str) -> Game:
    if game_id not in _GAMES:
        raise HTTPException(status_code=404, detail=f"game {game_id!r} not found")
    return _GAMES[game_id]


# ── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "active_games": len(_GAMES),
        "ilp_available": _HAS_ILP,
    }


# ── Game lifecycle ───────────────────────────────────────────────────────────

@app.post("/games", response_model=GameStateDTO)
def create_game(req: CreateGameRequest) -> GameStateDTO:
    game = Game(player_names=req.player_names, rules=STANDARD_RULES, seed=req.seed)
    game_id = _new_id()
    _GAMES[game_id] = game
    return _serialize_game(game_id, game)


@app.get("/games/{game_id}", response_model=GameStateDTO)
def get_game(game_id: str) -> GameStateDTO:
    return _serialize_game(game_id, _get_game(game_id))


@app.delete("/games/{game_id}")
def delete_game(game_id: str) -> dict:
    if game_id in _GAMES:
        del _GAMES[game_id]
        return {"deleted": game_id}
    raise HTTPException(status_code=404, detail=f"game {game_id!r} not found")


# ── Turn actions ─────────────────────────────────────────────────────────────

@app.post("/games/{game_id}/play", response_model=PlayResponse)
def play(game_id: str, req: PlayRequest) -> PlayResponse:
    game = _get_game(game_id)
    new_board = [m.to_meld() for m in req.new_board]
    result = game.play_melds(new_board)
    return PlayResponse(
        ok=result.ok,
        reason=result.reason,
        won=result.won,
        state=_serialize_game(game_id, game),
    )


@app.post("/games/{game_id}/draw", response_model=PlayResponse)
def draw(game_id: str) -> PlayResponse:
    game = _get_game(game_id)
    result = game.draw()
    return PlayResponse(
        ok=result.ok,
        reason=result.reason,
        won=False,
        state=_serialize_game(game_id, game),
    )


# ── Solver hints ─────────────────────────────────────────────────────────────

@app.get("/games/{game_id}/suggest", response_model=SuggestResponse)
def suggest(game_id: str, use_ilp: bool = False) -> SuggestResponse:
    """
    Recommend a play for the current player.
      use_ilp=False (default): hand-only solver (fast, no board manipulation)
      use_ilp=True: ILP solver (finds extensions, splits, swaps; requires pulp)
    """
    game = _get_game(game_id)
    player = game.current_player

    if use_ilp:
        if not _HAS_ILP:
            raise HTTPException(
                status_code=503,
                detail="ILP solver unavailable: pulp not installed. "
                       "Install with: pip install 'rumicub[solver]'",
            )
        solver = BoardManipulator(game.rules)
        result = solver.solve(player.hand, game.board)
        # melds_to_place is the DELTA from the original board
        original_sigs = {_meld_sig(m) for m in game.board}
        delta = [m for m in result.board_after if _meld_sig(m) not in original_sigs]
        return SuggestResponse(
            melds_to_place=[MeldDTO.from_meld(m) for m in delta],
            tiles_played=result.tiles_played,
            points_true=result.points_true,
            new_board=[MeldDTO.from_meld(m) for m in result.board_after],
            solver_used="ilp",
            solve_time_ms=result.solve_time_ms,
            status=result.status,
        )

    # Hand-only solver
    optimal = find_optimal_play(player.hand, game.board, game.rules)
    points_true = sum(meld_value_accurate(m) for m in optimal["melds_to_place"])
    return SuggestResponse(
        melds_to_place=[MeldDTO.from_meld(m) for m in optimal["melds_to_place"]],
        tiles_played=optimal["tiles_played"],
        points_true=points_true,
        new_board=[MeldDTO.from_meld(m) for m in optimal["board_after"]],
        solver_used="hand_only",
        solve_time_ms=0.0,
        status="Optimal",
    )


def _meld_sig(meld: list) -> tuple:
    """Order-independent meld signature for deduplication."""
    items = sorted(
        (t.number if t.number is not None else -1,
         t.color.value if t.color is not None else "",
         t.is_joker) for t in meld
    )
    return tuple(items)


# ── Probability snapshot ─────────────────────────────────────────────────────

@app.get("/games/{game_id}/probabilities", response_model=ProbabilitiesResponse)
def probabilities(game_id: str) -> ProbabilitiesResponse:
    """
    Analytical snapshot for the CURRENT player:
      - hand_quality: can_open_now, best_play, prob_open_in_3, penalty
      - scarcity: per-tile-type "how many copies have been seen" (used for
        a heatmap in the UI)
    """
    game = _get_game(game_id)
    player = game.current_player
    known = list(player.hand) + [t for m in game.board for t in m]

    quality = hand_quality_score(
        hand=player.hand,
        known_tiles=known,
        rules=game.rules,
        full_pool=game.full_pool,
    )

    # Compute scarcity from raw counts so Blue / Black don't collide on label
    # (the labels in analysis.probability.tile_scarcity collapse on first
    # letter — fine for printing, ambiguous for a UI grid).
    total_counts: dict[tuple, int] = defaultdict(int)
    for t in game.full_pool:
        total_counts[(t.number, t.color, t.is_joker)] += 1
    seen_counts: dict[tuple, int] = defaultdict(int)
    for t in known:
        seen_counts[(t.number, t.color, t.is_joker)] += 1

    # Unique 2-letter prefix per color (BLue and BLack would otherwise both
    # render as "BL" if we used `c.value[:2].upper()`).
    COLOR_PREFIX = {
        Color.RED: "R",
        Color.BLUE: "BL",
        Color.BLACK: "BK",
        Color.ORANGE: "O",
    }
    scarcity: list[ScarcityEntry] = []
    for key, total in total_counts.items():
        n, c, j = key
        frac = seen_counts[key] / total if total > 0 else 0.0
        if j:
            scarcity.append(ScarcityEntry(
                label="JOKER", n=None, c=None, j=True, seen_fraction=frac,
            ))
        else:
            scarcity.append(ScarcityEntry(
                label=f"{COLOR_PREFIX[c]}{n}",
                n=n, c=c.value, j=False, seen_fraction=frac,
            ))

    return ProbabilitiesResponse(
        hand_quality=HandQualityDTO(**quality),
        scarcity=scarcity,
        pool_remaining=len(game.pool),
    )
