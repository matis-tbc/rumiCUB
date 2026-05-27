/**
 * TileRack — horizontal strip of the player's hand tiles.
 * Each tile is draggable; the rack itself is a drop zone so tiles dragged
 * out of the board can be returned to the hand (revert behavior).
 */
import { DraggableTile } from "./DraggableTile";
import { type TileDTO } from "../lib/api";
import { useDroppable } from "@dnd-kit/core";

interface TileRackProps {
  tiles: TileDTO[];
  label?: string;
  draggable?: boolean;
}

export function TileRack({ tiles, label, draggable = true }: TileRackProps) {
  const { setNodeRef, isOver } = useDroppable({ id: "hand" });

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
            empty
          </div>
        ) : (
          tiles.map((tile, i) => (
            <DraggableTile
              key={`hand-${i}`}
              dragId={`hand-${i}`}
              tile={tile}
              disabled={!draggable}
            />
          ))
        )}
      </div>
    </div>
  );
}
