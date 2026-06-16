/**
 * SortableTile — a Tile wrapped in @dnd-kit/sortable for hand reordering.
 *
 * Used inside the TileRack's SortableContext. The dragId must be stable
 * across renders (use the per-tile uuid, not the index). DnD-kit needs
 * stable IDs to track items through reorders and to run keyboard nav.
 *
 * Click-to-pick: clicking (no drag) toggles selection via the onSelect
 * callback. Visual selected ring lives on the underlying Tile.
 */
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Tile } from "./Tile";
import { type TileDTO } from "../lib/api";

interface SortableTileProps {
  dragId: string;
  tile: TileDTO;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function SortableTile({
  dragId,
  tile,
  selected,
  disabled,
  onClick,
}: SortableTileProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: dragId, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    touchAction: "none",
    cursor: disabled ? "not-allowed" : "grab",
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <Tile tile={tile} selected={selected} onClick={onClick} />
    </div>
  );
}
