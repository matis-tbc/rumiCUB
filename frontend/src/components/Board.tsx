/**
 * Board — the shared playing area showing all melds laid down.
 *
 * Each meld is a droppable zone (so the player can drop a tile from their
 * hand onto it to extend the meld). A trailing "new meld" zone lets the
 * player start a fresh meld.
 *
 * Tiles already on existing melds are NOT draggable from the board yet —
 * v1 keeps interactions hand→board only. v2 will allow board→board moves
 * and joker retrieval via DnD.
 */
import { Tile } from "./Tile";
import { type MeldDTO, type TileDTO } from "../lib/api";
import { useDroppable } from "@dnd-kit/core";

interface BoardProps {
  melds: MeldDTO[];
  pendingTileIds?: Set<string>;   // tile UIDs that are pending (not yet committed)
  highlightIndices?: Set<number>;
}

export function Board({ melds, pendingTileIds, highlightIndices }: BoardProps) {
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
          board <span style={{ color: "var(--color-text-dim)" }}>· {melds.length} meld{melds.length === 1 ? "" : "s"}</span>
        </span>
        {pendingTileIds && pendingTileIds.size > 0 && (
          <span style={{ color: "var(--color-tile-orange)" }}>
            {pendingTileIds.size} pending
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-4 items-start">
        {melds.map((meld, i) => (
          <MeldDropZone
            key={`meld-${i}`}
            meldIndex={i}
            meld={meld}
            highlighted={highlightIndices?.has(i)}
            pendingTileIds={pendingTileIds}
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
  pendingTileIds,
}: {
  meldIndex: number;
  meld: MeldDTO;
  highlighted?: boolean;
  pendingTileIds?: Set<string>;
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
      }}
    >
      {meld.tiles.map((tile, j) => {
        const tileUid = `meld-${meldIndex}-${j}`;
        const isPending = pendingTileIds?.has(tileUid);
        return (
          <div
            key={j}
            style={{
              opacity: isPending ? 1 : 1,
              filter: isPending
                ? "drop-shadow(0 0 6px var(--color-tile-orange))"
                : undefined,
            }}
          >
            <Tile tile={tile} size={48} />
          </div>
        );
      })}
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
