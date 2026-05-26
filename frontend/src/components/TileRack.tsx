/**
 * TileRack — a horizontal strip of tiles representing a player's hand.
 * Uses the isometric Tile component; gives the rack a wooden-trim look.
 */
import { Tile } from "./Tile";
import { type TileDTO } from "../lib/api";

interface TileRackProps {
  tiles: TileDTO[];
  selectedIndices?: Set<number>;
  onTileClick?: (index: number) => void;
  label?: string;
}

export function TileRack({ tiles, selectedIndices, onTileClick, label }: TileRackProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <div
          className="text-xs uppercase tracking-widest"
          style={{
            color: "var(--color-text-mute)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {label} <span style={{ color: "var(--color-text-dim)" }}>· {tiles.length} tile{tiles.length === 1 ? "" : "s"}</span>
        </div>
      )}
      <div
        className="cube-stage flex flex-wrap gap-2 p-4 rounded-sm"
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
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
            <Tile
              key={i}
              tile={tile}
              selected={selectedIndices?.has(i)}
              onClick={onTileClick ? () => onTileClick(i) : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}
