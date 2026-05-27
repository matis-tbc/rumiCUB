/**
 * Board: shared playing area with all melds. Every tile is draggable.
 *
 * Solver Eye: when the toggle is on and a suggestion exists, a ghost overlay
 * renders the proposed board on top with pointer-events: none so the
 * underlying drag-and-drop keeps working. The overlay diffs against the
 * committed board so additions and new melds get visual annotations.
 */
import { DraggableTile } from "./DraggableTile";
import { Tile } from "./Tile";
import { type MeldDTO, type TileDTO } from "../lib/api";
import { useDroppable } from "@dnd-kit/core";
import { useSolver } from "../lib/SolverContext";

interface BoardProps {
  melds: MeldDTO[];
  pendingMeldIndices?: Set<number>;
  pendingChangeCount?: number;
}

const ISO_GRID: React.CSSProperties = {
  background: "var(--color-bg-elev)",
  border: "1px solid var(--color-border)",
  backgroundImage:
    "linear-gradient(60deg, transparent 49.7%, rgba(255,255,255,0.025) 49.7%, rgba(255,255,255,0.025) 50.3%, transparent 50.3%), linear-gradient(-60deg, transparent 49.7%, rgba(255,255,255,0.025) 49.7%, rgba(255,255,255,0.025) 50.3%, transparent 50.3%)",
  backgroundSize: "28px 48px",
};

export function Board({ melds, pendingMeldIndices, pendingChangeCount }: BoardProps) {
  const { solverEyeOn, suggestion, fetching } = useSolver();
  const showGhost = solverEyeOn && !!suggestion;

  return (
    <div
      className="cube-stage relative rounded-md p-6 min-h-[280px]"
      style={ISO_GRID}
    >
      <div
        className="text-[10px] uppercase tracking-[0.18em] mb-4 flex justify-between items-center"
        style={{
          color: "var(--color-text-mute)",
          fontFamily: "var(--font-mono)",
        }}
      >
        <span>
          board · <span style={{ color: "var(--color-text-dim)" }}>
            {melds.length} meld{melds.length === 1 ? "" : "s"}
          </span>
        </span>
        {pendingChangeCount !== undefined && pendingChangeCount > 0 && (
          <span style={{ color: "var(--color-accent)" }}>
            {pendingChangeCount} change{pendingChangeCount === 1 ? "" : "s"} pending
          </span>
        )}
      </div>

      {/* Real, draggable board */}
      <div className="flex flex-wrap gap-x-6 gap-y-4 items-start">
        {melds.map((meld, i) => (
          <MeldDropZone
            key={`meld-${i}`}
            meldIndex={i}
            meld={meld}
            highlighted={pendingMeldIndices?.has(i)}
          />
        ))}
        <NewMeldDropZone />
      </div>

      {melds.length === 0 && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none text-sm italic"
          style={{ color: "var(--color-text-mute)" }}
        >
          drag tiles from your hand into the new meld zone →
        </div>
      )}

      {/* Solver Eye ghost overlay. Sits ON TOP, captures zero pointer events,
          so all dnd interactions on the real board still work. */}
      {solverEyeOn && (
        <GhostOverlay
          committed={melds}
          suggestion={suggestion}
          fetching={fetching}
          showGhost={showGhost}
        />
      )}
    </div>
  );
}

function MeldDropZone({
  meldIndex,
  meld,
  highlighted,
}: {
  meldIndex: number;
  meld: MeldDTO;
  highlighted?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `meld-${meldIndex}` });

  const styleBase: React.CSSProperties = {
    background: isOver
      ? "rgba(199, 242, 61, 0.18)"
      : highlighted
      ? "rgba(199, 242, 61, 0.05)"
      : "transparent",
    outline: isOver
      ? "1px solid var(--color-accent)"
      : highlighted
      ? "1px solid var(--color-accent)"
      : "1px dashed rgba(255,255,255,0.07)",
    outlineOffset: 2,
    minWidth: 60,
    minHeight: 60,
  };

  return (
    <div
      ref={setNodeRef}
      className="flex gap-1 p-2 rounded transition-colors"
      style={styleBase}
    >
      {meld.tiles.map((tile, j) => (
        <DraggableTile
          key={`board-${meldIndex}-${j}`}
          dragId={`board-${meldIndex}-${j}`}
          tile={tile}
          size={48}
        />
      ))}
    </div>
  );
}

function NewMeldDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: "new-meld" });
  return (
    <div
      ref={setNodeRef}
      className="flex items-center justify-center px-6 py-4 rounded transition-colors"
      style={{
        minWidth: 96,
        minHeight: 60,
        background: isOver
          ? "rgba(199, 242, 61, 0.18)"
          : "rgba(255,255,255,0.02)",
        outline: isOver
          ? "1px solid var(--color-accent)"
          : "1px dashed var(--color-border-hi)",
        outlineOffset: 2,
        color: isOver ? "var(--color-accent)" : "var(--color-text-mute)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.16em",
      }}
    >
      + new meld
    </div>
  );
}

interface GhostOverlayProps {
  committed: MeldDTO[];
  suggestion: ReturnType<typeof useSolver>["suggestion"];
  fetching: boolean;
  showGhost: boolean;
}

function GhostOverlay({ committed, suggestion, fetching, showGhost }: GhostOverlayProps) {
  if (fetching) {
    return (
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden
      >
        <div
          className="px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] rounded"
          style={{
            background: "rgba(199, 242, 61, 0.1)",
            color: "var(--color-accent)",
            border: "1px solid rgba(199, 242, 61, 0.3)",
            fontFamily: "var(--font-mono)",
          }}
        >
          solver eye · computing...
        </div>
      </div>
    );
  }

  if (!showGhost || !suggestion) {
    return (
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden
      >
        <div
          className="px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] rounded"
          style={{
            background: "rgba(255,255,255,0.03)",
            color: "var(--color-text-mute)",
            border: "1px dashed var(--color-border-hi)",
            fontFamily: "var(--font-mono)",
          }}
        >
          no play found
        </div>
      </div>
    );
  }

  // Compute which melds in suggestion.new_board differ from committed.
  // We treat the suggestion board as the ghost layer and annotate each meld
  // with what changed. Matching melds (already on the committed board) are
  // hidden so the ghost shows only the deltas.
  const committedKeys = new Set(committed.map(meldKey));
  const ghosts = suggestion.new_board.map((meld) => {
    const key = meldKey(meld);
    const isExisting = committedKeys.has(key);
    const extendsExisting = !isExisting && committed.some((c) =>
      meld.tiles.length > c.tiles.length && containsAll(meld, c),
    );
    return { meld, isExisting, extendsExisting };
  });

  const visibleGhosts = ghosts.filter((g) => !g.isExisting);
  if (visibleGhosts.length === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 px-6 pb-6 pt-14 flex flex-wrap content-start gap-x-6 gap-y-4"
      aria-hidden
    >
      <div className="w-full flex items-center gap-3 mb-1">
        <span
          className="text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-sm"
          style={{
            background: "rgba(199, 242, 61, 0.08)",
            color: "var(--color-accent)",
            border: "1px solid rgba(199, 242, 61, 0.3)",
            fontFamily: "var(--font-mono)",
          }}
        >
          solver eye · proposed +{suggestion.tiles_played} tiles · {suggestion.points_true} pts
        </span>
      </div>
      {visibleGhosts.map(({ meld, extendsExisting }, i) => (
        <div key={i} className="relative">
          <span
            className="absolute -top-4 left-0 text-[9px] uppercase tracking-[0.14em] whitespace-nowrap"
            style={{ color: "var(--color-accent)", fontFamily: "var(--font-mono)" }}
          >
            {extendsExisting ? "extend existing" : `new · ${meldKind(meld)}`}
          </span>
          <div
            className="cube-stage flex gap-1 p-2 rounded"
            style={{
              background: "rgba(199, 242, 61, 0.04)",
              outline: extendsExisting
                ? "1px solid rgba(199, 242, 61, 0.5)"
                : "1px dashed rgba(199, 242, 61, 0.5)",
              outlineOffset: 2,
              opacity: 0.6,
            }}
          >
            {meld.tiles.map((tile, j) => (
              <Tile key={j} tile={tile} size={42} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function tileKey(t: TileDTO): string {
  return `${t.n ?? "_"}|${t.c ?? "_"}|${t.j ? "J" : ""}`;
}

function meldKey(m: MeldDTO): string {
  return m.tiles.map(tileKey).sort().join(",");
}

function containsAll(a: MeldDTO, b: MeldDTO): boolean {
  const counts = new Map<string, number>();
  for (const t of a.tiles) counts.set(tileKey(t), (counts.get(tileKey(t)) ?? 0) + 1);
  for (const t of b.tiles) {
    const k = tileKey(t);
    const n = counts.get(k) ?? 0;
    if (n <= 0) return false;
    counts.set(k, n - 1);
  }
  return true;
}

function meldKind(m: MeldDTO): string {
  // group = same number, different colors. run = same color, consecutive numbers.
  if (m.tiles.length < 2) return "meld";
  const colors = new Set(m.tiles.map((t) => t.c).filter(Boolean));
  if (colors.size === 1) return "run";
  return "group";
}
