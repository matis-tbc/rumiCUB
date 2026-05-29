import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import {
  api,
  type GameStateDTO,
  type MeldDTO,
  type TileDTO,
} from "./lib/api";
import { SolverProvider, useSolver } from "./lib/SolverContext";
import { wrapHand, unwrapHand, type HandTile } from "./lib/handTile";
import { safeGet, safeRemove, safeSet, STORAGE_KEYS } from "./lib/safeStorage";
import { Logo } from "./components/Logo";
import { TileRack } from "./components/TileRack";
import { Board } from "./components/Board";
import { ProbabilityPanel } from "./components/ProbabilityPanel";
import { Tile } from "./components/Tile";
import { Btn, BtnArrow } from "./components/Btn";
import { Chip } from "./components/Chip";
import { SolverEyeToggle } from "./components/SolverEyeToggle";
import { HelpPanel } from "./components/HelpPanel";
import { HelpButton } from "./components/HelpButton";
import { Toast } from "./components/Toast";
import { NewGameModal } from "./components/NewGameModal";
import { PassScreen } from "./components/PassScreen";

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

  // Help panel state
  const [helpOpen, setHelpOpen] = useState(false);
  const [firstVisit, setFirstVisit] = useState(false);

  // New-game setup modal
  const [setupOpen, setSetupOpen] = useState(false);

  // Pass-and-play privacy gate. Active when the turn just advanced to a
  // new player so the device can be handed over without peeking.
  const [passActive, setPassActive] = useState(false);
  // Tracks the last (gameId, playerIdx) we rendered so applyServerState can
  // tell a turn-advance apart from a fresh game / resume.
  const lastSeenRef = useRef<{ gameId: string; playerIdx: number } | null>(null);

  // Transient toast (auto-cancel-pending message)
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Click-to-pick state. dragId of the currently-picked-up tile (hand-uuid
  // or board-meldIdx-tileIdx). null = no selection.
  const [selectedDragId, setSelectedDragId] = useState<string | null>(null);

  const {
    suggestion,
    setSuggestion,
    solverEyeOn,
    exitPreview,
    setIlpAvailable: setCtxIlp,
    setCancelPending,
  } = useSolver();

  // Pending vs committed game state. Hand uses HandTile wrappers (stable
  // UUIDs across renders) so @dnd-kit/sortable can track tiles through
  // reorders without breaking animations or keyboard nav.
  const [pendingBoard, setPendingBoard] = useState<MeldDTO[]>([]);
  const [pendingHand, setPendingHand] = useState<HandTile[]>([]);
  const [committedBoard, setCommittedBoard] = useState<MeldDTO[]>([]);
  const [committedHand, setCommittedHand] = useState<HandTile[]>([]);

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

  const cancelPending = useCallback(() => {
    const count = pendingChangeCount;
    setPendingBoard(committedBoard);
    setPendingHand(committedHand);
    setSelectedDragId(null);
    return count;
  }, [committedBoard, committedHand, pendingChangeCount]);

  // Inject cancelPending into the SolverContext so Solver Eye can auto-
  // cancel pending changes before previewing (E3 / D1).
  useEffect(() => {
    setCancelPending(cancelPending);
    return () => setCancelPending(null);
  }, [cancelPending, setCancelPending]);

  // Initial load: resume a saved game if present, else open the setup modal
  // (we no longer silently auto-create a 2-player game).
  useEffect(() => {
    (async () => {
      try {
        const h = await api.health();
        setIlpAvailable(h.ilp_available);
        setCtxIlp(h.ilp_available);
        const saved = safeGet(STORAGE_KEYS.gameId);
        if (saved) {
          try {
            const g = await api.getGame(saved);
            applyServerState(g, { fresh: true });
          } catch {
            safeRemove(STORAGE_KEYS.gameId);
            setSetupOpen(true);
          }
        } else {
          setSetupOpen(true);
        }
      } catch (e) {
        setError(String(e));
      }
      // First-visit auto-open help
      if (!safeGet(STORAGE_KEYS.seenIntro)) {
        setFirstVisit(true);
        setHelpOpen(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global keybindings: ? opens help, Esc deselects or exits preview
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
      if (isInput) return;
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setHelpOpen(true);
      } else if (e.key === "Escape") {
        if (helpOpen) {
          // handled by HelpPanel
        } else if (selectedDragId) {
          setSelectedDragId(null);
        } else if (solverEyeOn) {
          exitPreview();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [helpOpen, selectedDragId, solverEyeOn, exitPreview]);

  // Auto-exit Solver Eye when the game ends.
  useEffect(() => {
    if (state?.is_over && solverEyeOn) {
      exitPreview();
    }
  }, [state?.is_over, solverEyeOn, exitPreview]);

  function applyServerState(g: GameStateDTO, opts?: { fresh?: boolean }) {
    setState(g);
    const current = g.players[g.current_player_index];
    setPendingBoard(g.board);
    setPendingHand(wrapHand(current.hand));
    setCommittedBoard(g.board);
    setCommittedHand(wrapHand(current.hand));
    setSuggestion(null); // E2: server state changed -> stale suggestion
    setSelectedDragId(null);

    // Pass-and-play gate: trigger when the active player changed within the
    // SAME game and the game isn't over. Fresh games / resumes don't gate.
    const prev = lastSeenRef.current;
    const turnAdvanced =
      !opts?.fresh &&
      prev !== null &&
      prev.gameId === g.id &&
      prev.playerIdx !== g.current_player_index &&
      !g.is_over &&
      g.players.length > 1;
    if (turnAdvanced) {
      setPassActive(true);
    }
    lastSeenRef.current = { gameId: g.id, playerIdx: g.current_player_index };
  }

  function newGame() {
    setSetupOpen(true);
  }

  async function startGameWithNames(names: string[]) {
    setError(null);
    setLoading(true);
    setSetupOpen(false);
    try {
      const g = await api.createGame(names);
      safeSet(STORAGE_KEYS.gameId, g.id);
      lastSeenRef.current = null; // reset so the first deal doesn't gate
      applyServerState(g, { fresh: true });
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

  // Click-to-pick: clicking a tile selects/deselects; clicking a drop zone
  // places the selected tile. Wired here so the same move-tile machinery
  // serves both click AND drag flows.
  const placeSelectedTileAt = useCallback(
    (targetId: string) => {
      if (!selectedDragId) return;
      moveTile(selectedDragId, targetId);
      setSelectedDragId(null);
      // Track usage for D2 discoverability hint suppression
      const n = parseInt(safeGet(STORAGE_KEYS.clickSeenCount) ?? "0", 10);
      safeSet(STORAGE_KEYS.clickSeenCount, String(n + 1));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedDragId, pendingBoard, pendingHand],
  );

  // Shared tile-move pipeline: takes from a source, places at a target.
  function moveTile(dragId: string, targetId: string) {
    if (dragId === targetId) return;

    // Hand-to-hand reorder
    if (dragId.startsWith("hand-uuid:") && targetId.startsWith("hand-uuid:")) {
      const fromIdx = pendingHand.findIndex((h) => h.id === dragId.slice("hand-uuid:".length));
      const toIdx = pendingHand.findIndex((h) => h.id === targetId.slice("hand-uuid:".length));
      if (fromIdx < 0 || toIdx < 0) return;
      const clamped = Math.max(0, Math.min(pendingHand.length - 1, toIdx));
      setPendingHand((prev) => arrayMove(prev, fromIdx, clamped));
      return;
    }

    // Source: hand-uuid:<id> or board-<m>-<t>
    const source = takeTile(dragId, pendingHand, pendingBoard);
    if (!source) return;
    const { tile, handAfter, boardAfter } = source;

    const placed = placeTile(tile, targetId, handAfter, boardAfter);
    if (!placed) return;
    const { handFinal, boardFinal } = placed;

    setPendingHand(handFinal);
    setPendingBoard(pruneEmptyMelds(boardFinal));
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !state) return;
    const dragId = String(active.id);
    const targetId = String(over.id);
    moveTile(dragId, targetId);
  }

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {error ? (
          <div style={{ color: "var(--color-accent)", fontFamily: "var(--font-mono)" }}>
            {error}
          </div>
        ) : (
          <div style={{ color: "var(--color-text-dim)" }}>
            {setupOpen ? "" : "loading…"}
          </div>
        )}
        <NewGameModal
          open={setupOpen}
          dismissable={false}
          onStart={startGameWithNames}
          onClose={() => setSetupOpen(false)}
        />
      </div>
    );
  }

  const current = state.players[state.current_player_index];

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
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
            <SolverEyeToggle
              gameId={state.id}
              ilpAvailable={ilpAvailable}
              onToggleResult={(r) => {
                if (r.kind === "on" && r.cancelledPending) {
                  setToastMsg("reverted pending changes");
                }
              }}
            />
            <HelpButton onClick={() => { setFirstVisit(false); setHelpOpen(true); }} />
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
            {toastMsg && (
              <div className="flex justify-start">
                <Toast message={toastMsg} onDismiss={() => setToastMsg(null)} />
              </div>
            )}

            <Board
              melds={pendingBoard}
              pendingMeldIndices={pendingMeldIndices}
              pendingChangeCount={pendingChangeCount}
              gameId={state.id}
              selectedDragId={selectedDragId}
              onDropZoneClick={placeSelectedTileAt}
              onPlayThis={playSuggested}
              loading={loading}
            />

            {hasPendingChanges && !solverEyeOn && (
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

            <TileRack
              tiles={pendingHand}
              label="your hand"
              draggable={!solverEyeOn}
              selectedId={
                selectedDragId?.startsWith("hand-uuid:")
                  ? selectedDragId.slice("hand-uuid:".length)
                  : null
              }
              onTileClick={(id) => {
                if (solverEyeOn) return;
                const dragId = `hand-uuid:${id}`;
                setSelectedDragId((prev) => (prev === dragId ? null : dragId));
              }}
            />
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
                  disabled={loading || state.is_over || hasPendingChanges || solverEyeOn}
                  title={
                    solverEyeOn
                      ? "exit solver preview first"
                      : hasPendingChanges
                      ? "cancel pending play first"
                      : undefined
                  }
                >
                  draw a tile
                </Btn>
                <Btn
                  onClick={() => suggest(false)}
                  disabled={loading || state.is_over || solverEyeOn}
                  tone="ghost"
                >
                  suggest · hand-only
                </Btn>
                <Btn
                  onClick={() => suggest(true)}
                  disabled={loading || state.is_over || !ilpAvailable || solverEyeOn}
                  tone="ghost"
                  title={ilpAvailable ? undefined : "ILP solver requires pulp"}
                >
                  suggest · ilp solver
                </Btn>
              </div>
            </div>

            {suggestion && !solverEyeOn && (
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

        <HelpPanel
          open={helpOpen}
          firstVisit={firstVisit}
          onClose={() => { setHelpOpen(false); setFirstVisit(false); }}
        />

        <NewGameModal
          open={setupOpen}
          dismissable={true}
          onStart={startGameWithNames}
          onClose={() => setSetupOpen(false)}
        />

        <PassScreen
          open={passActive}
          playerName={current.name}
          onReveal={() => setPassActive(false)}
        />
      </div>
    </DndContext>
  );
}

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

// Tile-move helpers operating on HandTile[] (hand) + MeldDTO[] (board).

function takeTile(
  dragId: string,
  hand: HandTile[],
  board: MeldDTO[],
): { tile: TileDTO; handAfter: HandTile[]; boardAfter: MeldDTO[] } | null {
  if (dragId.startsWith("hand-uuid:")) {
    const id = dragId.slice("hand-uuid:".length);
    const i = hand.findIndex((h) => h.id === id);
    if (i < 0) return null;
    const tile = hand[i].tile;
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
  hand: HandTile[],
  board: MeldDTO[],
): { handFinal: HandTile[]; boardFinal: MeldDTO[] } | null {
  if (targetId === "hand") {
    // Append the returned tile with a new UUID so sortable identity holds
    return { handFinal: [...hand, { id: newId(), tile }], boardFinal: board };
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

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tile-${Math.random().toString(36).slice(2, 11)}-${Date.now()}`;
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

// Suppress unused-import warning while iterating
void unwrapHand;
