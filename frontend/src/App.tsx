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
  type TileDTO,
} from "./lib/api";
import { SolverProvider, useSolver } from "./lib/SolverContext";
import { Logo } from "./components/Logo";
import { TileRack } from "./components/TileRack";
import { Board } from "./components/Board";
import { ProbabilityPanel } from "./components/ProbabilityPanel";
import { Tile } from "./components/Tile";
import { Btn, BtnArrow } from "./components/Btn";
import { Chip } from "./components/Chip";
import { SolverEyeToggle } from "./components/SolverEyeToggle";

const STORAGE_KEY = "rumicube.game_id";

export default function App() {
  return (
    <SolverProvider>
      <Game />
    </SolverProvider>
  );
}

function Game() {
  const [state, setState] = useState<GameStateDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ilpAvailable, setIlpAvailable] = useState(false);

  // Solver state lives in context so Board (ghost overlay) and the sidebar
  // suggestion card both read from the same source.
  const { suggestion, setSuggestion, setIlpAvailable: setCtxIlp } = useSolver();

  // PENDING STATE: tiles the player has dragged around but not yet
  // submitted. pendingBoard is what the board WILL look like if they hit
  // submit. pendingHand is what's still in their rack. committedBoard /
  // committedHand mirror the last server-acknowledged state, used to derive
  // pending diffs and to revert on cancel.
  const [pendingBoard, setPendingBoard] = useState<MeldDTO[]>([]);
  const [pendingHand, setPendingHand] = useState<TileDTO[]>([]);
  const [committedBoard, setCommittedBoard] = useState<MeldDTO[]>([]);
  const [committedHand, setCommittedHand] = useState<TileDTO[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const pendingChangeCount = useMemo(() => {
    return diffMeldCount(committedBoard, pendingBoard) +
      Math.abs(committedHand.length - pendingHand.length);
  }, [committedBoard, pendingBoard, committedHand.length, pendingHand.length]);
  const hasPendingChanges = pendingChangeCount > 0;

  const pendingMeldIndices = useMemo(() => {
    const out = new Set<number>();
    pendingBoard.forEach((meld, i) => {
      const committed = committedBoard[i];
      if (!committed || !sameMeld(committed, meld)) out.add(i);
    });
    return out;
  }, [pendingBoard, committedBoard]);

  useEffect(() => {
    (async () => {
      try {
        const h = await api.health();
        setIlpAvailable(h.ilp_available);
        setCtxIlp(h.ilp_available);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !state) return;
    const dragId = String(active.id);
    const targetId = String(over.id);

    const source = takeTile(dragId, pendingHand, pendingBoard);
    if (!source) return;
    const { tile, handAfter, boardAfter } = source;

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
          <div style={{ color: "var(--color-accent)", fontFamily: "var(--font-mono)" }}>
            {error}
          </div>
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
          <div className="flex items-center gap-5">
            <Stat label="turn" value={String(state.turn)} />
            <Stat label="pool" value={String(state.pool_remaining)} />
            <SolverEyeToggle
              gameId={state.id}
              ilpAvailable={ilpAvailable}
            />
            <Btn onClick={newGame} disabled={loading} size="sm" tone="ghost">
              new game
            </Btn>
          </div>
        </header>

        {state.is_over && state.winner && (
          <div
            className="px-8 py-3 text-sm font-bold"
            style={{
              background: "var(--color-accent)",
              color: "#0F1A00",
              fontFamily: "var(--font-mono)",
            }}
          >
            ▸ {state.winner} won
          </div>
        )}

        {error && (
          <div
            className="px-8 py-3 text-sm"
            style={{
              background: "rgba(229, 57, 53, 0.15)",
              color: "var(--color-tile-red)",
              borderBottom: "1px solid var(--color-tile-red)",
              fontFamily: "var(--font-mono)",
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

            {hasPendingChanges && (
              <div
                className="flex items-center justify-between rounded px-4 py-3"
                style={{
                  background: "rgba(199, 242, 61, 0.06)",
                  border: "1px solid rgba(199, 242, 61, 0.35)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                <span
                  className="text-sm"
                  style={{ color: "var(--color-accent)" }}
                >
                  {pendingChangeCount} change{pendingChangeCount === 1 ? "" : "s"} pending. submit to commit your play.
                </span>
                <div className="flex gap-2">
                  <Btn onClick={cancelPending} disabled={loading} size="sm" tone="ghost">
                    cancel
                  </Btn>
                  <Btn onClick={submitPending} disabled={loading} size="sm" tone="primary">
                    submit play <BtnArrow />
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
                  className="text-xs uppercase tracking-[0.16em]"
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
                  <Chip variant="lime">opened</Chip>
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
              className="rounded-md p-4"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div
                className="text-[10px] uppercase tracking-[0.18em] mb-3"
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
                  tone="ghost"
                >
                  suggest · hand-only
                </Btn>
                <Btn
                  onClick={() => suggest(true)}
                  disabled={loading || state.is_over || !ilpAvailable}
                  tone="ghost"
                  title={ilpAvailable ? undefined : "ILP solver requires pulp"}
                >
                  suggest · ilp solver
                </Btn>
              </div>
            </div>

            {suggestion && (
              <div
                className="rounded-md p-4"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid rgba(199, 242, 61, 0.35)",
                  boxShadow: "0 0 0 1px rgba(199, 242, 61, 0.08)",
                }}
              >
                <div
                  className="text-[10px] uppercase tracking-[0.18em] mb-3 flex justify-between"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  <span style={{ color: "var(--color-accent)" }}>
                    solver suggestion · {suggestion.solver_used}
                  </span>
                  {suggestion.solve_time_ms > 0 && (
                    <span style={{ color: "var(--color-text-mute)" }}>
                      {suggestion.solve_time_ms.toFixed(0)}ms
                    </span>
                  )}
                </div>
                <div
                  className="grid grid-cols-2 gap-2 text-sm mb-3"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--color-text-mute)" }}>tiles</span>
                    <span className="text-base font-bold" style={{ color: "var(--color-text)" }}>{suggestion.tiles_played}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--color-text-mute)" }}>points</span>
                    <span className="text-base font-bold" style={{ color: "var(--color-accent)" }}>{suggestion.points_true}</span>
                  </div>
                </div>
                {suggestion.melds_to_place.length > 0 ? (
                  <>
                    <div className="flex flex-col gap-2 mb-3">
                      {suggestion.melds_to_place.map((meld, i) => (
                        <div
                          key={i}
                          className="cube-stage flex gap-1 p-2 rounded"
                          style={{
                            background: "rgba(199, 242, 61, 0.04)",
                            outline: "1px dashed rgba(199, 242, 61, 0.25)",
                            outlineOffset: 2,
                          }}
                        >
                          {meld.tiles.map((tile, j) => (
                            <Tile key={j} tile={tile} size={32} />
                          ))}
                        </div>
                      ))}
                    </div>
                    <Btn onClick={playSuggested} disabled={loading} tone="primary" className="w-full">
                      play this <BtnArrow />
                    </Btn>
                  </>
                ) : (
                  <div
                    className="text-xs italic"
                    style={{ color: "var(--color-text-mute)" }}
                  >
                    no play found. drawing is the only option.
                  </div>
                )}
              </div>
            )}

            <div
              className="rounded-md p-4"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div
                className="text-[10px] uppercase tracking-[0.18em] mb-3"
                style={{
                  color: "var(--color-text-mute)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                players
              </div>
              <div className="flex flex-col gap-2">
                {state.players.map((p, i) => {
                  const isActive = i === state.current_player_index;
                  return (
                    <div
                      key={p.name}
                      className="flex justify-between items-center text-sm py-1.5 px-2 rounded"
                      style={{
                        background: isActive
                          ? "rgba(199, 242, 61, 0.05)"
                          : "transparent",
                        border: isActive
                          ? "1px solid rgba(199, 242, 61, 0.2)"
                          : "1px solid transparent",
                        color: isActive
                          ? "var(--color-text)"
                          : "var(--color-text-dim)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      <span className="flex items-center gap-2">
                        {isActive && (
                          <span
                            className="inline-block rounded-sm"
                            style={{ width: 6, height: 6, background: "var(--color-accent)" }}
                            aria-hidden
                          />
                        )}
                        {p.name}
                      </span>
                      <span style={{ color: "var(--color-text-mute)" }}>
                        {p.hand_count} tiles · {p.penalty} pts
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

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

// Small UI atom

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex flex-col items-end"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      <span
        className="text-[10px] uppercase tracking-[0.16em]"
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

// Pending-state helpers

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
