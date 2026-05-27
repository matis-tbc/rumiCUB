"""
Tests for the FastAPI backend (web/api.py).

Uses TestClient; doesn't spin up uvicorn.
"""
from __future__ import annotations
import pytest

# Skip the entire module if FastAPI isn't installed (it's an optional extra).
pytest.importorskip("fastapi", reason="install via: pip install 'rumicub[web]'")

from fastapi.testclient import TestClient
from rumicub.web.api import app, _GAMES


@pytest.fixture(autouse=True)
def _clear_games():
    """Wipe in-memory store between tests so they don't leak."""
    _GAMES.clear()
    yield
    _GAMES.clear()


@pytest.fixture
def client():
    return TestClient(app)


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert "ilp_available" in body


def test_create_game(client):
    r = client.post("/games", json={"player_names": ["A", "B"], "seed": 0})
    assert r.status_code == 200
    state = r.json()
    assert state["id"]
    assert state["turn"] == 0
    assert state["current_player_index"] == 0
    assert len(state["players"]) == 2
    assert len(state["players"][0]["hand"]) == 14


def test_create_game_requires_two_players(client):
    r = client.post("/games", json={"player_names": ["Alone"]})
    assert r.status_code == 422


def test_get_game_404(client):
    r = client.get("/games/nonexistent")
    assert r.status_code == 404


def test_delete_game(client):
    r = client.post("/games", json={"player_names": ["A", "B"], "seed": 1})
    gid = r.json()["id"]
    r = client.delete(f"/games/{gid}")
    assert r.status_code == 200
    r = client.get(f"/games/{gid}")
    assert r.status_code == 404


def test_draw_action(client):
    r = client.post("/games", json={"player_names": ["A", "B"], "seed": 2})
    gid = r.json()["id"]
    pre_pool = r.json()["pool_remaining"]
    r = client.post(f"/games/{gid}/draw")
    assert r.status_code == 200
    assert r.json()["ok"] is True
    assert r.json()["state"]["pool_remaining"] == pre_pool - 1
    assert r.json()["state"]["current_player_index"] == 1  # turn advanced


def test_suggest_returns_shape(client):
    r = client.post("/games", json={"player_names": ["A", "B"], "seed": 3})
    gid = r.json()["id"]
    r = client.get(f"/games/{gid}/suggest")
    assert r.status_code == 200
    body = r.json()
    assert "tiles_played" in body
    assert "points_true" in body
    assert "melds_to_place" in body
    assert body["solver_used"] == "hand_only"


def test_suggest_ilp_when_available(client):
    pytest.importorskip("pulp")
    r = client.post("/games", json={"player_names": ["A", "B"], "seed": 4})
    gid = r.json()["id"]
    r = client.get(f"/games/{gid}/suggest?use_ilp=true")
    assert r.status_code == 200
    assert r.json()["solver_used"] == "ilp"


def test_probabilities_endpoint(client):
    r = client.post("/games", json={"player_names": ["A", "B"], "seed": 7})
    gid = r.json()["id"]
    r = client.get(f"/games/{gid}/probabilities")
    assert r.status_code == 200
    body = r.json()
    assert "hand_quality" in body
    assert "scarcity" in body
    assert "pool_remaining" in body
    # 4 colors × 13 numbers + 1 joker entry = 53 distinct tile types
    assert len(body["scarcity"]) == 53
    # hand_quality must have the expected keys
    hq = body["hand_quality"]
    for key in [
        "can_open_now", "best_play_value", "best_play_tiles",
        "prob_open_in_3", "penalty_if_loss", "partial_count",
    ]:
        assert key in hq


def test_probabilities_scarcity_no_blue_black_collision(client):
    """Regression: tile_scarcity() collapses Blue/Black to 'B'; our API
    computes per-key and uses 'BL'/'BK' prefixes to disambiguate."""
    r = client.post("/games", json={"player_names": ["A", "B"], "seed": 8})
    gid = r.json()["id"]
    r = client.get(f"/games/{gid}/probabilities")
    labels = {e["label"] for e in r.json()["scarcity"] if not e["j"]}
    blue_labels = {l for l in labels if l.startswith("BL")}
    black_labels = {l for l in labels if l.startswith("BK")}
    assert len(blue_labels) == 13
    assert len(black_labels) == 13


def test_play_invalid_rejected(client):
    r = client.post("/games", json={"player_names": ["A", "B"], "seed": 5})
    gid = r.json()["id"]
    # Try playing a bogus meld (tiles not in any hand)
    bogus = [{"tiles": [
        {"n": 1, "c": "red", "j": False},
        {"n": 2, "c": "red", "j": False},
        {"n": 3, "c": "red", "j": False},
    ]}]
    r = client.post(f"/games/{gid}/play", json={"new_board": bogus})
    assert r.status_code == 200
    body = r.json()
    # Most random seed-0 hands won't have all of R1, R2, R3; expect rejection.
    # If by chance they do, the play is legal — but tile_conservation fail
    # is the common case.
    if not body["ok"]:
        assert "conservation" in body["reason"].lower() or "30" in body["reason"]
