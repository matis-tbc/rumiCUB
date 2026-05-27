/**
 * Board — the shared playing area showing all melds laid down.
 *
 * DnD v2: every tile on the board is draggable (dragId "board-{meldIdx}-{tileIdx}"),
 * not just hand-sourced ones. Players can move tiles between melds, split melds,
 * pull tiles back to the hand. The server validates the final proposed board on
 * submit; the client does not try to enforce intermediate legality.
 *
 * Drop targets:
 *   - Each meld (id "meld-N") — appends the dragged tile to that meld
 *   - "new-meld" — starts a fresh meld with the dragged tile
 *   - "hand" (via TileRack) — returns the dragged tile to the rack
 *
 * Visual cue: a meld whose tile set differs from the committed board version
 * gets an orange outline so the player can see what changes are pending.
 */
import { DraggableTile } from "./DraggableTile";
import { type MeldDTO } from "../lib/api";
import { useDroppable } from "@dnd-kit/core";

interface BoardProps {
  melds: MeldDTO[];
  pendingMeldIndices?: Set<number>;
  pendingChangeCount?: number;
}

export function Board({ melds, pendingMeldIndices, pendingChangeCount }: BoardProps) {
  return (
    <div
      className="cube-stage relative rounded-sm p-6 min-h-[260px]"
      style={{
        background: "var(--color-bg-elev)",
        border: "1px solid var(--color-border)",
        backgroundImage:
          "repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0 2px, transparent 2px 12px)",
      }}
    >
      <div
        className="text-xs uppercase tracking-widest mb-4 flex justify-between"
        style={{
          color: "var(--color-text-mute)",
          fontFamily: "var(--font-mono)",
        }}
      >
        <span>
          board{" "}
          <span style={{ color: "var(--color-text-dim)" }}>
            · {melds.length} meld{melds.length === 1 ? "" : "s"}
          </span>
        </span>
        {pendingChangeCount !== undefined && pendingChangeCount > 0 && (
          <span style={{ color: "var(--color-tile-orange)" }}>
            {pendingChangeCount} change{pendingChangeCount === 1 ? "" : "s"} pending
          </span>
        )}
      </div>

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

  return (
    <div
      ref={setNodeRef}
      className="flex gap-1 p-2 rounded-sm transition-colors"
      style={{
        background: isOver
          ? "rgba(30, 136, 229, 0.18)"
          : highlighted
          ? "rgba(251, 140, 0, 0.08)"
          : "transparent",
        outline: isOver
          ? "1px solid var(--color-tile-blue)"
          : highlighted
          ? "1px solid var(--color-tile-orange)"
          : "1px dashed rgba(255,255,255,0.06)",
        outlineOffset: 2,
        minWidth: 60,
        minHeight: 60,
      }}
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
      className="flex items-center justify-center px-6 py-4 rounded-sm transition-colors"
      style={{
        minWidth: 96,
        minHeight: 60,
        background: isOver
          ? "rgba(30, 136, 229, 0.18)"
          : "rgba(255,255,255,0.02)",
        outline: isOver
          ? "1px solid var(--color-tile-blue)"
          : "1px dashed var(--color-border)",
        outlineOffset: 2,
        color: "var(--color-text-mute)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
      }}
    >
      + new meld
    </div>
  );
}
