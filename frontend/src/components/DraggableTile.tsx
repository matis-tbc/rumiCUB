/**
 * DraggableTile — wraps Tile in a dnd-kit draggable container.
 *
 * The drag id encodes WHERE the tile is being dragged FROM, so the drag-end
 * handler can move it correctly:
 *   "hand-<index>"             tile from the hand rack
 *   "board-<meldIdx>-<tileIdx>" tile from any meld on the board
 *
 * Both source kinds are interchangeable with any drop target (hand, an
 * existing meld, or the "new-meld" zone). The Game's validator catches
 * illegal proposed boards on submit; the client does not enforce
 * intermediate validity.
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
