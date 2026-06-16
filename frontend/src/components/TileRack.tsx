/**
 * TileRack — horizontal hand of player tiles.
 *
 * Each tile is BOTH sortable (drag-to-reorder within the hand) AND
 * draggable to the board. The whole rack is also a droppable target so
 * tiles dragged FROM the board can return to the hand.
 *
 * Tiles use stable client-side UUIDs for sortable IDs so reordering
 * doesn't break animations or keyboard navigation.
 */
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { SortableTile } from "./SortableTile";
import { type HandTile } from "../lib/handTile";

interface TileRackProps {
  tiles: HandTile[];
  label?: string;
  draggable?: boolean;
  selectedId?: string | null;
  onTileClick?: (id: string) => void;
}

export function TileRack({
  tiles,
  label,
  draggable = true,
  selectedId,
  onTileClick,
}: TileRackProps) {
  const { setNodeRef, isOver } = useDroppable({ id: "hand" });
  const ids = tiles.map((t) => t.id);

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <div
          className="text-[10px] uppercase tracking-[0.18em]"
          style={{
            color: "var(--color-text-mute)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {label}{" "}
          <span style={{ color: "var(--color-text-dim)" }}>
            · {tiles.length} tile{tiles.length === 1 ? "" : "s"}
          </span>
        </div>
      )}
      <div
        ref={setNodeRef}
        className="cube-stage flex flex-wrap gap-2 p-4 rounded-md transition-colors"
        style={{
          background: isOver
            ? "rgba(199, 242, 61, 0.12)"
            : "var(--color-surface)",
          border: isOver
            ? "1px solid var(--color-accent)"
            : "1px solid var(--color-border)",
          minHeight: 80,
        }}
      >
        {tiles.length === 0 ? (
          <div
            className="text-sm italic"
            style={{ color: "var(--color-text-mute)" }}
          >
            your rack is empty. draw a tile to continue.
          </div>
        ) : (
          <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
            {tiles.map((ht) => (
              <SortableTile
                key={ht.id}
                dragId={ht.id}
                tile={ht.tile}
                selected={selectedId === ht.id}
                disabled={!draggable}
                onClick={onTileClick ? () => onTileClick(ht.id) : undefined}
              />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  );
}
