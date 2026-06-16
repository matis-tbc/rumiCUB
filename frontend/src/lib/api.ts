/**
 * rumiCUBE API client.
 *
 * In dev, requests go to /api/* and Vite proxies to the FastAPI backend
 * at 127.0.0.1:8000 (see vite.config.ts). In production, set
 * VITE_API_BASE to the deployed backend URL.
 */

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export interface TileDTO {
  n: number | null;
  c: string | null;
  j: boolean;
}

export interface MeldDTO {
  tiles: TileDTO[];
}

export interface PlayerDTO {
  name: string;
  hand: TileDTO[];
  has_opened: boolean;
  hand_count: number;
  penalty: number;
}

export interface GameStateDTO {
  id: string;
  rules_name: string;
  turn: number;
  current_player_index: number;
  is_over: boolean;
  winner: string | null;
  pool_remaining: number;
  board: MeldDTO[];
  players: PlayerDTO[];
}

export interface PlayResponse {
  ok: boolean;
  reason: string;
  won: boolean;
  state: GameStateDTO;
}

export interface SuggestResponse {
  melds_to_place: MeldDTO[];
  tiles_played: number;
  points_true: number;
  new_board: MeldDTO[];
  solver_used: "hand_only" | "ilp";
  solve_time_ms: number;
  status: string;
}

export interface HealthResponse {
  ok: boolean;
  active_games: number;
  ilp_available: boolean;
}

export interface HandQualityDTO {
  can_open_now: boolean;
  best_play_value: number;
  best_play_tiles: number;
  prob_open_in_3: number;
  penalty_if_loss: number;
  partial_count: number;
}

export interface ScarcityEntry {
  label: string;
  n: number | null;
  c: string | null;
  j: boolean;
  seen_fraction: number;
}

export interface ProbabilitiesResponse {
  hand_quality: HandQualityDTO;
  scarcity: ScarcityEntry[];
  pool_remaining: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<HealthResponse>("/health"),

  createGame: (player_names: string[], seed?: number) =>
    request<GameStateDTO>("/games", {
      method: "POST",
      body: JSON.stringify({ player_names, seed }),
    }),

  getGame: (id: string) => request<GameStateDTO>(`/games/${id}`),

  deleteGame: (id: string) =>
    request<{ deleted: string }>(`/games/${id}`, { method: "DELETE" }),

  draw: (id: string) =>
    request<PlayResponse>(`/games/${id}/draw`, { method: "POST" }),

  play: (id: string, new_board: MeldDTO[]) =>
    request<PlayResponse>(`/games/${id}/play`, {
      method: "POST",
      body: JSON.stringify({ new_board }),
    }),

  suggest: (id: string, use_ilp = false, signal?: AbortSignal) =>
    request<SuggestResponse>(
      `/games/${id}/suggest${use_ilp ? "?use_ilp=true" : ""}`,
      signal ? { signal } : undefined,
    ),

  probabilities: (id: string) =>
    request<ProbabilitiesResponse>(`/games/${id}/probabilities`),
};
