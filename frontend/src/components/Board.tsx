/**
 * Board — shared playing area.
 *
 * Two render modes:
 *   - REAL: shows melds as the user's pending board. Drop zones active.
 *   - PREVIEW (solverEyeOn + suggestion): shows the solver's proposed
 *     board state. Drop zones disabled. Changed melds outlined in lime
 *     with delta annotations. Persistent banner above the board.
 *
 * Click-to-pick: drop zones become clickable when a tile is selected
 * (selectedDragId is set). Clicking a drop zone calls onDropZoneClick.
 */
import { DraggableTile } from "./DraggableTile";
import { Tile } from "./Tile";
import { type MeldDTO, type TileDTO } from "../lib/api";
import { useDroppable } from "@dnd-kit/core";
import { useSolver } from "../lib/SolverContext";
import { Btn, BtnArrow } from "./Btn";

interface BoardProps {
  melds: MeldDTO[];
  pendingMeldIndices?: Set<number>;
  pendingChangeCount?: number;
  gameId: string;
  selectedDragId: string | null;
  onDropZoneClick: (targetId: string) => void;
  onPlayThis: () => void;
  loading: boolean;
}

const ISO_GRID: React.CSSProperties = {
  background: "var(--color-bg-elev)",
  border: "1px solid var(--color-border)",
  backgroundImage:
    "linear-gradient(60deg, transparent 49.7%, rgba(255,255,255,0.025) 49.7%, rgba(255,255,255,0.025) 50.3%, transparent 50.3%), linear-gradient(-60deg, transparent 49.7%, rgba(255,255,255,0.025) 49.7%, rgba(255,255,255,0.025) 50.3%, transparent 50.3%)",
  backgroundSize: "28px 48px",
};

export function Board({
  melds,
  pendingMeldIndices,
  pendingChangeCount,
  gameId,
  selectedDragId,
  onDropZoneClick,
  onPlayThis,
  loading,
}: BoardProps) {
  const { solverEyeOn, suggestion, fetching, fetchError, retryFetch, exitPreview } = useSolver();

  const inPreview = solverEyeOn;
  const previewBoard = suggestion?.new_board ?? [];
  const hasPlay = suggestion && suggestion.melds_to_place.length > 0;

  // What the user sees: real board OR proposed board
  const rendered = inPreview && suggestion ? previewBoard : melds;

  // Compute which melds in the proposed board differ from the committed
  // (live) board. Used to highlight deltas in preview mode.
  const proposedDelta = (() => {
    if (!inPreview || !suggestion) return new Set<number>();
    const committedKeys = melds.map(meldKey);
    const out = new Set<number>();
    previewBoard.forEach((m, i) => {
      const k = meldKey(m);
      if (!committedKeys.includes(k)) out.add(i);
    });
    return out;
  })();

  return (
    <div
      className="cube-stage relative rounded-md p-6 min-h-[280px]"
      style={ISO_GRID}
    >
      {/* HEADER OR BANNER (mutually exclusive) */}
      {inPreview ? (
        <PreviewBanner
          gameId={gameId}
          loading={loading}
          fetching={fetching}
          fetchError={fetchError}
          hasPlay={!!hasPlay}
          tilesPlayed={suggestion?.tiles_played ?? 0}
          points={suggestion?.points_true ?? 0}
          solver={suggestion?.solver_used ?? null}
          timeMs={suggestion?.solve_time_ms ?? 0}
          onPlay={onPlayThis}
          onExit={exitPreview}
          onRetry={() => void retryFetch(gameId)}
        />
      ) : (
        <BoardHeader meldCount={melds.length} pendingChangeCount={pendingChangeCount} />
      )}

      {/* Melds */}
      <div className="flex flex-wrap gap-x-8 gap-y-5 items-start">
        {rendered.map((meld, i) => {
          if (inPreview) {
            return (
              <PreviewMeld
                key={`preview-${i}`}
                meld={meld}
                isDelta={proposedDelta.has(i)}
              />
            );
          }
          return (
            <MeldDropZone
              key={`meld-${i}`}
              meldIndex={i}
              meld={meld}
              highlighted={pendingMeldIndices?.has(i)}
              disabled={inPreview}
              selectedDragId={selectedDragId}
              onDropZoneClick={onDropZoneClick}
            />
          );
        })}
        {!inPreview && (
          <NewMeldDropZone
            disabled={inPreview}
            selectedDragId={selectedDragId}
            onDropZoneClick={onDropZoneClick}
          />
        )}
      </div>

      {/* Empty-state hints */}
      {!inPreview && melds.length === 0 && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none text-sm italic"
          style={{ color: "var(--color-text-mute)" }}
        >
          drag tiles from your hand into the new meld zone →
        </div>
      )}

      {inPreview && !suggestion && !fetching && !fetchError && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none text-sm italic"
          style={{ color: "var(--color-text-mute)" }}
        >
          solver computed nothing yet
        </div>
      )}

      {inPreview && suggestion && !hasPlay && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none text-sm italic"
          style={{ color: "var(--color-text-mute)" }}
        >
          no play found. drawing is the only option.
        </div>
      )}
    </div>
  );
}

function BoardHeader({ meldCount, pendingChangeCount }: {
  meldCount: number;
  pendingChangeCount?: number;
}) {
  return (
    <div
      className="text-[10px] uppercase tracking-[0.18em] mb-4 flex justify-between items-center"
      style={{
        color: "var(--color-text-mute)",
        fontFamily: "var(--font-mono)",
      }}
    >
      <span>
        board · <span style={{ color: "var(--color-text-dim)" }}>
          {meldCount} meld{meldCount === 1 ? "" : "s"}
        </span>
      </span>
      {pendingChangeCount !== undefined && pendingChangeCount > 0 && (
        <span style={{ color: "var(--color-accent)" }}>
          {pendingChangeCount} change{pendingChangeCount === 1 ? "" : "s"} pending
        </span>
      )}
    </div>
  );
}

interface PreviewBannerProps {
  gameId: string;
  loading: boolean;
  fetching: boolean;
  fetchError: string | null;
  hasPlay: boolean;
  tilesPlayed: number;
  points: number;
  solver: "hand_only" | "ilp" | null;
  timeMs: number;
  onPlay: () => void;
  onExit: () => void;
  onRetry: () => void;
}

function PreviewBanner(props: PreviewBannerProps) {
  const {
    loading, fetching, fetchError, hasPlay,
    tilesPlayed, points, solver, timeMs,
    onPlay, onExit, onRetry,
  } = props;

  let message: React.ReactNode;
  let actions: React.ReactNode;

  if (fetching) {
    message = (
      <span style={{ color: "var(--color-accent)" }}>
        solver preview · computing...
      </span>
    );
    actions = (
      <Btn onClick={onExit} disabled={loading} size="sm" tone="ghost">
        exit preview
      </Btn>
    );
  } else if (fetchError) {
    message = (
      <span style={{ color: "var(--color-tile-red)" }}>
        solver error · {fetchError}
      </span>
    );
    actions = (
      <>
        <Btn onClick={onRetry} disabled={loading} size="sm" tone="ghost">
          retry
        </Btn>
        <Btn onClick={onExit} disabled={loading} size="sm" tone="ghost">
          exit preview
        </Btn>
      </>
    );
  } else if (hasPlay) {
    message = (
      <span style={{ color: "var(--color-accent)" }}>
        solver preview · +{tilesPlayed} tiles · {points} pts
        {solver && (
          <span style={{ color: "var(--color-text-mute)", marginLeft: 12 }}>
            · {solver === "ilp" ? "ilp" : "hand-only"}
            {timeMs > 0 ? ` · ${Math.round(timeMs)}ms` : ""}
          </span>
        )}
      </span>
    );
    actions = (
      <>
        <Btn onClick={onPlay} disabled={loading} size="sm" tone="primary">
          play this <BtnArrow />
        </Btn>
        <Btn onClick={onExit} disabled={loading} size="sm" tone="ghost">
          exit preview
        </Btn>
      </>
    );
  } else {
    // No play found
    message = (
      <span style={{ color: "var(--color-accent)" }}>
        solver eye · no play found · drawing is the only option
      </span>
    );
    actions = (
      <Btn onClick={onExit} disabled={loading} size="sm" tone="ghost">
        exit preview
      </Btn>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 flex items-center justify-between px-3 py-2 rounded"
      style={{
        background: "rgba(199, 242, 61, 0.06)",
        border: "1px solid rgba(199, 242, 61, 0.35)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.14em",
        minHeight: 44,
      }}
    >
      <span className="flex items-center gap-3">
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            background: "var(--color-accent)",
            borderRadius: 1,
            boxShadow: "0 0 8px rgba(199, 242, 61, 0.6)",
          }}
        />
        {message}
      </span>
      <div className="flex gap-2">{actions}</div>
    </div>
  );
}

function PreviewMeld({ meld, isDelta }: { meld: MeldDTO; isDelta: boolean }) {
  return (
    <div
      className="flex gap-1 p-2 rounded"
      style={{
        outline: isDelta
          ? "1px solid var(--color-accent)"
          : "1px dashed rgba(255,255,255,0.07)",
        outlineOffset: 2,
        background: isDelta ? "rgba(199, 242, 61, 0.05)" : "transparent",
        opacity: isDelta ? 1 : 0.85,
        minHeight: 76,
      }}
    >
      {meld.tiles.map((tile, j) => (
        <Tile key={j} tile={tile} size={48} />
      ))}
    </div>
  );
}

function MeldDropZone({
  meldIndex,
  meld,
  highlighted,
  disabled,
  selectedDragId,
  onDropZoneClick,
}: {
  meldIndex: number;
  meld: MeldDTO;
  highlighted?: boolean;
  disabled?: boolean;
  selectedDragId: string | null;
  onDropZoneClick: (targetId: string) => void;
}) {
  const dropId = `meld-${meldIndex}`;
  const { setNodeRef, isOver } = useDroppable({ id: dropId, disabled });

  const clickable = !disabled && !!selectedDragId;

  const styleBase: React.CSSProperties = {
    background: isOver
      ? "rgba(199, 242, 61, 0.25)"
      : highlighted
      ? "rgba(199, 242, 61, 0.05)"
      : clickable
      ? "rgba(199, 242, 61, 0.04)"
      : "transparent",
    outline: isOver
      ? "1px solid var(--color-accent)"
      : highlighted
      ? "1px solid var(--color-accent)"
      : clickable
      ? "1px dashed rgba(199, 242, 61, 0.4)"
      : "1px dashed rgba(255,255,255,0.07)",
    outlineOffset: 2,
    minWidth: 60,
    minHeight: 76,
    cursor: clickable ? "pointer" : disabled ? "not-allowed" : "default",
  };

  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={`meld ${meldIndex + 1}`}
      onClick={clickable ? () => onDropZoneClick(dropId) : undefined}
      className="flex gap-1 p-2 rounded transition-colors relative"
      style={styleBase}
    >
      {clickable && (
        <span
          aria-hidden
          className="absolute -top-3 left-2 text-[9px] uppercase tracking-[0.14em] px-1 rounded-sm"
          style={{
            background: "var(--color-accent)",
            color: "#0F1A00",
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
          }}
        >
          click here
        </span>
      )}
      {meld.tiles.map((tile, j) => (
        <DraggableTile
          key={`board-${meldIndex}-${j}`}
          dragId={`board-${meldIndex}-${j}`}
          tile={tile}
          size={48}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

function NewMeldDropZone({
  disabled,
  selectedDragId,
  onDropZoneClick,
}: {
  disabled?: boolean;
  selectedDragId: string | null;
  onDropZoneClick: (targetId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "new-meld", disabled });
  const clickable = !disabled && !!selectedDragId;

  return (
    <div
      ref={setNodeRef}
      role="button"
      aria-label="start a new meld"
      tabIndex={clickable ? 0 : -1}
      onClick={clickable ? () => onDropZoneClick("new-meld") : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onDropZoneClick("new-meld");
              }
            }
          : undefined
      }
      className="flex items-center justify-center px-6 py-4 rounded transition-colors relative"
      style={{
        minWidth: 120,
        minHeight: 80,
        background: isOver
          ? "rgba(199, 242, 61, 0.25)"
          : clickable
          ? "rgba(199, 242, 61, 0.06)"
          : "rgba(255,255,255,0.02)",
        outline: isOver
          ? "1px solid var(--color-accent)"
          : clickable
          ? "1px dashed var(--color-accent)"
          : "1px dashed var(--color-border-hi)",
        outlineOffset: 2,
        color: isOver || clickable ? "var(--color-accent)" : "var(--color-text-mute)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.16em",
        cursor: clickable ? "pointer" : disabled ? "not-allowed" : "default",
      }}
    >
      + new meld
    </div>
  );
}

function tileKey(t: TileDTO): string {
  return `${t.n ?? "_"}|${t.c ?? "_"}|${t.j ? "J" : ""}`;
}

function meldKey(m: MeldDTO): string {
  return m.tiles.map(tileKey).sort().join(",");
}
