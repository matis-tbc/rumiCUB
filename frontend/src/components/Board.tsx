/**
 * Board — the shared playing area showing all melds laid down.
 */
import { Tile } from "./Tile";
import { type MeldDTO } from "../lib/api";

interface BoardProps {
  melds: MeldDTO[];
  highlightIndices?: Set<number>;
}

export function Board({ melds, highlightIndices }: BoardProps) {
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
        className="text-xs uppercase tracking-widest mb-4"
        style={{
          color: "var(--color-text-mute)",
          fontFamily: "var(--font-mono)",
        }}
      >
        board <span style={{ color: "var(--color-text-dim)" }}>· {melds.length} meld{melds.length === 1 ? "" : "s"}</span>
      </div>

      {melds.length === 0 ? (
        <div
          className="flex items-center justify-center h-40 text-sm italic"
          style={{ color: "var(--color-text-mute)" }}
        >
          no melds yet — first play goes here
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-6 gap-y-4">
          {melds.map((meld, i) => (
            <div
              key={i}
              className="flex gap-1 p-2 rounded-sm"
              style={{
                background: highlightIndices?.has(i)
                  ? "rgba(251, 140, 0, 0.08)"
                  : "transparent",
                outline: highlightIndices?.has(i)
                  ? "1px solid var(--color-tile-orange)"
                  : "none",
              }}
            >
              {meld.tiles.map((tile, j) => (
                <Tile key={j} tile={tile} size={48} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
