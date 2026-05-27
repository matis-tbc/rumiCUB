import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  api,
  type GameStateDTO,
  type MeldDTO,
  type SuggestResponse,
  type TileDTO,
} from "./lib/api";
import { Logo } from "./components/Logo";
import { TileRack } from "./components/TileRack";
import { Board } from "./components/Board";
import { ProbabilityPanel } from "./components/ProbabilityPanel";

const STORAGE_KEY = "rumicube.game_id";

export default function App() {
  const [state, setState] = useState<GameStateDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<SuggestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [ilpAvailable, setIlpAvailable] = useState(false);

  // PENDING STATE: tiles the player has dragged onto the board but not yet
  // submitted. `pendingBoard` is what the board WILL look like if they hit
  // submit. `pendingHand` is what's still in their rack.
  const [pendingBoard, setPendingBoard] = useState<MeldDTO[]>([]);
  const [pendingHand, setPendingHand] = useState<TileDTO[]>([]);
  // Track UIDs of tiles in pendingBoard that came from hand (for highlight).
  const [pendingTileIds, setPendingTileIds] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const hasPendingChanges = pendingTileIds.size > 0;

  // ── Game lifecycle ──────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const h = await api.health();
        setIlpAvailable(h.ilp_available);
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          try {
            const g = await api.getGame(saved);
            applyServerState(g);
            return;
          } catch {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
        const g = await api.createGame(["Player 1", "Player 2"]);
        localStorage.setItem(STORAGE_KEY, g.id);
        applyServerState(g);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  function applyServerState(g: GameStateDTO) {
    setState(g);
    const current = g.players[g.current_player_index];
    setPendingBoard(g.board);
    setPendingHand(current.hand);
    setPendingTileIds(new Set());
    setSuggestion(null);
  }

  async function newGame() {
    setError(null);
    setLoading(true);
    try {
      const g = await api.createGame(["Player 1", "Player 2"]);
      localStorage.setItem(STORAGE_KEY, g.id);
      applyServerState(g);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function draw() {
    if (!state) return;
    setError(null);
    cancelPending();
    setLoading(true);
    try {
      const r = await api.draw(state.id);
      applyServerState(r.state);
      if (!r.ok) setError(r.reason);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function suggest(useIlp: boolean) {
    if (!state) return;
    setError(null);
    setLoading(true);
    try {
      const s = await api.suggest(state.id, useIlp);
      setSuggestion(s);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function playSuggested() {
    if (!state || !suggestion) return;
    await commitBoard(suggestion.new_board);
  }

  async function submitPending() {
    if (!state) return;
    await commitBoard(pendingBoard);
  }

  async function commitBoard(board: MeldDTO[]) {
    if (!state) return;
    setError(null);
    setLoading(true);
    try {
      const r = await api.play(state.id, board);
      if (!r.ok) {
        setError(r.reason);
        // Roll the pending state back to the server's source of truth
        applyServerState(r.state);
        return;
      }
      applyServerState(r.state);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function cancelPending() {
    if (!state) return;
    const current = state.players[state.current_player_index];
    setPendingBoard(state.board);
    setPendingHand(current.hand);
    setPendingTileIds(new Set());
    setSuggestion(null);
  }

  // ── Drag handler ────────────────────────────────────────────────────────

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !state) return;
    const dragId = String(active.id);
    const targetId = String(over.id);

    // Parse source
    if (!dragId.startsWith("hand-")) return;
    const handIndex = parseInt(dragId.slice("hand-".length), 10);
    if (Number.isNaN(handIndex) || handIndex < 0 || handIndex >= pendingHand.length) return;
    const tile = pendingHand[handIndex];

    // Where did it go?
    if (targetId === "hand") {
      // dropped back into the hand: no-op (already there)
      return;
    }
    if (targetId === "new-meld") {
      // Start a new meld with this single tile.
      const newMeldIndex = pendingBoard.length;
      const tileUid = `meld-${newMeldIndex}-0`;
      setPendingBoard([...pendingBoard, { tiles: [tile] }]);
      setPendingHand(pendingHand.filter((_, i) => i !== handIndex));
      setPendingTileIds(new Set([...pendingTileIds, tileUid]));
      return;
    }
    if (targetId.startsWith("meld-")) {
      const meldIdx = parseInt(targetId.slice("meld-".length), 10);
      if (Number.isNaN(meldIdx) || meldIdx < 0 || meldIdx >= pendingBoard.length) return;
      // Append the tile to that meld.
      const newBoard = pendingBoard.map((m, i) =>
        i === meldIdx ? { tiles: [...m.tiles, tile] } : m,
      );
      const appendedTileIdx = newBoard[meldIdx].tiles.length - 1;
      const tileUid = `meld-${meldIdx}-${appendedTileIdx}`;
      setPendingBoard(newBoard);
      setPendingHand(pendingHand.filter((_, i) => i !== handIndex));
      setPendingTileIds(new Set([...pendingTileIds, tileUid]));
      return;
    }
  }

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {error ? (
          <div className="text-red-400">{error}</div>
        ) : (
          <div style={{ color: "var(--color-text-dim)" }}>loading…</div>
        )}
      </div>
    );
  }

  const current = state.players[state.current_player_index];

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header
          className="flex items-center justify-between px-8 py-5"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <Logo size="md" />
          <div className="flex items-center gap-4">
            <Stat label="turn" value={String(state.turn)} />
            <Stat label="pool" value={String(state.pool_remaining)} />
            <button
              onClick={newGame}
              disabled={loading}
              className="px-3 py-1.5 text-xs uppercase tracking-widest rounded-sm transition-colors disabled:opacity-40"
              style={{
                background: "transparent",
                color: "var(--color-text-dim)",
                border: "1px solid var(--color-border)",
                fontFamily: "var(--font-mono)",
                cursor: loading ? "default" : "pointer",
              }}
            >
              new game
            </button>
          </div>
        </header>

        {state.is_over && state.winner && (
          <div
            className="px-8 py-3 text-sm"
            style={{
              background: "var(--color-tile-orange)",
              color: "var(--color-tile-face)",
              fontFamily: "var(--font-mono)",
            }}
          >
            ▸ {state.winner} won
          </div>
        )}

        {error && (
          <div
            className="px-8 py-3 text-sm font-mono"
            style={{
              background: "rgba(229, 57, 53, 0.15)",
              color: "var(--color-tile-red)",
              borderBottom: "1px solid var(--color-tile-red)",
            }}
          >
            ✗ {error}
          </div>
        )}

        {/* Main */}
        <main className="flex-1 flex flex-col xl:flex-row gap-6 p-8 max-w-[1600px] mx-auto w-full">
          <div className="flex-1 flex flex-col gap-6">
            <Board melds={pendingBoard} pendingTileIds={pendingTileIds} />

            {/* Submit / cancel strip — only shown when there's pending state */}
            {hasPendingChanges && (
              <div
                className="flex items-center justify-between rounded-sm px-4 py-3"
                style={{
                  background: "rgba(251, 140, 0, 0.08)",
                  border: "1px solid var(--color-tile-orange)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                <span
                  className="text-sm"
                  style={{ color: "var(--color-tile-orange)" }}
                >
                  {pendingTileIds.size} tile{pendingTileIds.size === 1 ? "" : "s"} pending — submit to commit your play
                </span>
                <div className="flex gap-2">
                  <Btn onClick={cancelPending} disabled={loading}>
                    cancel
                  </Btn>
                  <Btn onClick={submitPending} disabled={loading} tone="primary">
                    submit play
                  </Btn>
                </div>
              </div>
            )}

            <div
              className="flex items-center justify-between px-1"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="text-xs uppercase tracking-widest"
                  style={{ color: "var(--color-text-mute)" }}
                >
                  current
                </span>
                <span
                  className="text-base"
                  style={{ color: "var(--color-text)" }}
                >
                  {current.name}
                </span>
                {current.has_opened ? (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-sm"
                    style={{
                      background: "var(--color-tile-blue)",
                      color: "var(--color-tile-face)",
                    }}
                  >
                    opened
                  </span>
                ) : (
                  <span
                    className="text-xs"
                    style={{ color: "var(--color-text-mute)" }}
                  >
                    needs 30+ to open
                  </span>
                )}
              </div>
              <span
                className="text-xs"
                style={{ color: "var(--color-text-mute)" }}
              >
                hand penalty: {current.penalty}
              </span>
            </div>

            <TileRack tiles={pendingHand} label="your hand" />
          </div>

          <aside className="xl:w-80 flex flex-col gap-4">
            <div
              className="rounded-sm p-4"
              style={{
                background: "var(--color-bg-card)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div
                className="text-xs uppercase tracking-widest mb-3"
                style={{
                  color: "var(--color-text-mute)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                actions
              </div>
              <div className="flex flex-col gap-2">
                <Btn
                  onClick={draw}
                  disabled={loading || state.is_over || hasPendingChanges}
                  title={hasPendingChanges ? "cancel pending play first" : undefined}
                >
                  draw a tile
                </Btn>
                <Btn
                  onClick={() => suggest(false)}
                  disabled={loading || state.is_over}
                  tone="primary"
                >
                  suggest (hand-only)
                </Btn>
                <Btn
                  onClick={() => suggest(true)}
                  disabled={loading || state.is_over || !ilpAvailable}
                  tone="primary"
                  title={ilpAvailable ? undefined : "ILP solver requires pulp"}
                >
                  suggest (ILP solver)
                </Btn>
              </div>
            </div>

            {suggestion && (
              <div
                className="rounded-sm p-4"
                style={{
                  background: "var(--color-bg-card)",
                  border: "1px solid var(--color-tile-orange)",
                  boxShadow: "0 0 0 1px rgba(251, 140, 0, 0.2)",
                }}
              >
                <div
                  className="text-xs uppercase tracking-widest mb-3 flex justify-between"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  <span style={{ color: "var(--color-tile-orange)" }}>
                    suggestion ({suggestion.solver_used})
                  </span>
                  {suggestion.solve_time_ms > 0 && (
                    <span style={{ color: "var(--color-text-mute)" }}>
                      {suggestion.solve_time_ms.toFixed(0)}ms
                    </span>
                  )}
                </div>
                <div className="flex justify-between text-sm mb-3">
                  <Stat label="tiles" value={String(suggestion.tiles_played)} />
                  <Stat label="pts" value={String(suggestion.points_true)} />
                </div>
                {suggestion.melds_to_place.length > 0 ? (
                  <>
                    <div className="flex flex-col gap-2 mb-3">
                      {suggestion.melds_to_place.map((meld, i) => (
                        <div
                          key={i}
                          className="cube-stage flex gap-1 p-2 rounded-sm"
                          style={{
                            background: "rgba(251, 140, 0, 0.05)",
                          }}
                        >
                          {meld.tiles.map((tile, j) => (
                            <CompactTile key={j} tile={tile} />
                          ))}
                        </div>
                      ))}
                    </div>
                    <Btn onClick={playSuggested} disabled={loading} tone="primary">
                      play this
                    </Btn>
                  </>
                ) : (
                  <div
                    className="text-xs italic"
                    style={{ color: "var(--color-text-mute)" }}
                  >
                    no play found — drawing is the only option
                  </div>
                )}
              </div>
            )}

            <div
              className="rounded-sm p-4"
              style={{
                background: "var(--color-bg-card)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div
                className="text-xs uppercase tracking-widest mb-3"
                style={{
                  color: "var(--color-text-mute)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                players
              </div>
              <div className="flex flex-col gap-2">
                {state.players.map((p, i) => (
                  <div
                    key={p.name}
                    className="flex justify-between items-center text-sm py-1.5 px-2 rounded-sm"
                    style={{
                      background:
                        i === state.current_player_index
                          ? "rgba(30, 136, 229, 0.1)"
                          : "transparent",
                      color:
                        i === state.current_player_index
                          ? "var(--color-text)"
                          : "var(--color-text-dim)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    <span>{p.name}</span>
                    <span style={{ color: "var(--color-text-mute)" }}>
                      {p.hand_count} tiles · {p.penalty} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Probability sidebar — fetches and renders /probabilities */}
            <ProbabilityPanel
              gameId={state.id}
              refreshKey={state.turn * 100 + state.current_player_index}
            />
          </aside>
        </main>
      </div>
    </DndContext>
  );
}

// ── small UI atoms ─────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex flex-col items-end"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      <span
        className="text-[10px] uppercase tracking-widest"
        style={{ color: "var(--color-text-mute)" }}
      >
        {label}
      </span>
      <span
        className="text-sm font-bold"
        style={{ color: "var(--color-text)" }}
      >
        {value}
      </span>
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  tone = "default",
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "primary";
  title?: string;
}) {
  const isPrimary = tone === "primary";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="px-3 py-2 text-sm uppercase tracking-widest rounded-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: isPrimary ? "var(--color-tile-blue)" : "transparent",
        color: isPrimary ? "var(--color-tile-face)" : "var(--color-text-dim)",
        border: isPrimary
          ? "1px solid var(--color-tile-blue-edge)"
          : "1px solid var(--color-border)",
        fontFamily: "var(--font-mono)",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function CompactTile({ tile }: { tile: TileDTO }) {
  const COLOR_FILL: Record<string, string> = {
    red: "var(--color-tile-red)",
    blue: "var(--color-tile-blue)",
    black: "var(--color-tile-black)",
    orange: "var(--color-tile-orange)",
  };
  const COLOR_TEXT: Record<string, string> = {
    red: "var(--color-tile-red)",
    blue: "var(--color-tile-blue)",
    black: "#1a1a1a",
    orange: "var(--color-tile-orange)",
  };
  const isJoker = tile.j;
  const fill = isJoker ? "var(--color-tile-joker)" : COLOR_FILL[tile.c || "red"];
  const textCol = isJoker
    ? "var(--color-tile-joker-edge)"
    : COLOR_TEXT[tile.c || "red"];

  return (
    <div
      className="flex items-center justify-center rounded-sm font-bold"
      style={{
        width: 36,
        height: 36,
        background: "var(--color-tile-face)",
        color: textCol,
        fontFamily: "var(--font-display)",
        fontSize: 18,
        borderLeft: `3px solid ${fill}`,
      }}
    >
      {isJoker ? "J" : tile.n}
    </div>
  );
}
