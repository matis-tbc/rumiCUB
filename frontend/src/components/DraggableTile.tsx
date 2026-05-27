/**
 * DraggableTile — wraps Tile in a dnd-kit draggable container.
 *
 * The drag id encodes WHERE the tile is being dragged FROM, so the drag-end
 * handler can move it correctly:
 *   "hand-<index>"            tile from the hand
 *   "pending-<meldIdx>-<idx>" tile from a pending meld on the board
 *
 * v1 only enables hand→board drags. Pending-meld tiles are not draggable yet.
 */
import { Tile } from "./Tile";
import { type TileDTO } from "../lib/api";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

interface DraggableTileProps {
  tile: TileDTO;
  dragId: string;
  size?: number;
  disabled?: boolean;
}

export function DraggableTile({ tile, dragId, size = 56, disabled }: DraggableTileProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: dragId,
      disabled,
    });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    cursor: disabled ? "default" : "grab",
    touchAction: "none",   // dnd-kit needs this for pointer sensors on touch
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <Tile tile={tile} size={size} />
    </div>
  );
}
