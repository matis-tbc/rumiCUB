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

  // PENDING STATE: tiles the player has dragged around but not yet
  // submitted. `pendingBoard` is what the board WILL look like if they hit
  // submit. `pendingHand` is what's still in their rack.
  // `committedBoard` / `committedHand` are the last server-acknowledged
  // state — used to derive whether changes are pending and to revert on
  // cancel.
  const [pendingBoard, setPendingBoard] = useState<MeldDTO[]>([]);
  const [pendingHand, setPendingHand] = useState<TileDTO[]>([]);
  const [committedBoard, setCommittedBoard] = useState<MeldDTO[]>([]);
  const [committedHand, setCommittedHand] = useState<TileDTO[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  // Derive pending-ness from the diff between proposed and committed.
  const pendingChangeCount = useMemo(() => {
    return diffMeldCount(committedBoard, pendingBoard) +
      Math.abs(committedHand.length - pendingHand.length);
  }, [committedBoard, pendingBoard, committedHand.length, pendingHand.length]);
  const hasPendingChanges = pendingChangeCount > 0;

  // Which meld indices in pendingBoard differ from committedBoard?
  const pendingMeldIndices = useMemo(() => {
    const out = new Set<number>();
    pendingBoard.forEach((meld, i) => {
      const committed = committedBoard[i];
      if (!committed || !sameMeld(committed, meld)) out.add(i);
    });
    return out;
  }, [pendingBoard, committedBoard]);

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
    setCommittedBoard(g.board);
    setCommittedHand(current.hand);
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
    setPendingBoard(committedBoard);
    setPendingHand(committedHand);
    setSuggestion(null);
  }

  // ── Drag handler ────────────────────────────────────────────────────────

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !state) return;
    const dragId = String(active.id);
    const targetId = String(over.id);

    // Take the tile from its source, returning [tile, newHand, newBoard].
    const source = takeTile(dragId, pendingHand, pendingBoard);
    if (!source) return;
    const { tile, handAfter, boardAfter } = source;

    // Place it at the target.
    const placed = placeTile(tile, targetId, handAfter, boardAfter);
    if (!placed) return;
    const { handFinal, boardFinal } = placed;

    setPendingHand(handFinal);
    setPendingBoard(pruneEmptyMelds(boardFinal));
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
            <Board
              melds={pendingBoard}
              pendingMeldIndices={pendingMeldIndices}
              pendingChangeCount={pendingChangeCount}
            />

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
                  {pendingChangeCount} change{pendingChangeCount === 1 ? "" : "s"} pending — submit to commit your play
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

// ── Pending-state helpers ─────────────────────────────────────────────────

function takeTile(
  dragId: string,
  hand: TileDTO[],
  board: MeldDTO[],
): { tile: TileDTO; handAfter: TileDTO[]; boardAfter: MeldDTO[] } | null {
  if (dragId.startsWith("hand-")) {
    const i = parseInt(dragId.slice("hand-".length), 10);
    if (Number.isNaN(i) || i < 0 || i >= hand.length) return null;
    const tile = hand[i];
    return {
      tile,
      handAfter: hand.filter((_, j) => j !== i),
      boardAfter: board,
    };
  }
  if (dragId.startsWith("board-")) {
    const m = dragId.match(/^board-(\d+)-(\d+)$/);
    if (!m) return null;
    const mi = Number(m[1]);
    const ti = Number(m[2]);
    if (mi < 0 || mi >= board.length) return null;
    const meld = board[mi];
    if (ti < 0 || ti >= meld.tiles.length) return null;
    const tile = meld.tiles[ti];
    const boardAfter = board.map((mm, i) =>
      i === mi ? { tiles: mm.tiles.filter((_, j) => j !== ti) } : mm,
    );
    return { tile, handAfter: hand, boardAfter };
  }
  return null;
}

function placeTile(
  tile: TileDTO,
  targetId: string,
  hand: TileDTO[],
  board: MeldDTO[],
): { handFinal: TileDTO[]; boardFinal: MeldDTO[] } | null {
  if (targetId === "hand") {
    return { handFinal: [...hand, tile], boardFinal: board };
  }
  if (targetId === "new-meld") {
    return { handFinal: hand, boardFinal: [...board, { tiles: [tile] }] };
  }
  if (targetId.startsWith("meld-")) {
    const mi = parseInt(targetId.slice("meld-".length), 10);
    if (Number.isNaN(mi) || mi < 0 || mi >= board.length) return null;
    const boardFinal = board.map((mm, i) =>
      i === mi ? { tiles: [...mm.tiles, tile] } : mm,
    );
    return { handFinal: hand, boardFinal };
  }
  return null;
}

function pruneEmptyMelds(board: MeldDTO[]): MeldDTO[] {
  return board.filter((m) => m.tiles.length > 0);
}

function tileKey(t: TileDTO): string {
  return `${t.n ?? "_"}|${t.c ?? "_"}|${t.j ? "J" : ""}`;
}

function meldKey(m: MeldDTO): string {
  return m.tiles.map(tileKey).sort().join(",");
}

function sameMeld(a: MeldDTO, b: MeldDTO): boolean {
  return meldKey(a) === meldKey(b);
}

function diffMeldCount(a: MeldDTO[], b: MeldDTO[]): number {
  // Count melds in `b` that don't match any meld in `a` by canonical key.
  // Plus the count of `a` melds missing from `b`.
  const aKeys = a.map(meldKey);
  const bKeys = b.map(meldKey);
  const aCount = new Map<string, number>();
  const bCount = new Map<string, number>();
  for (const k of aKeys) aCount.set(k, (aCount.get(k) ?? 0) + 1);
  for (const k of bKeys) bCount.set(k, (bCount.get(k) ?? 0) + 1);
  let diff = 0;
  for (const k of new Set([...aCount.keys(), ...bCount.keys()])) {
    diff += Math.abs((aCount.get(k) ?? 0) - (bCount.get(k) ?? 0));
  }
  return diff;
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
