/**
 * Tile — an isometric CSS cube rendering of a single rumiCUBE tile.
 *
 * Uses real 3D transforms (transform-style: preserve-3d) rather than 2D
 * skew tricks, so the cube reads cleanly at any angle. Three visible faces:
 * front (numeral + color), top (edge color), right (edge color).
 *
 * Props:
 *   tile: TileDTO from the API
 *   size: face edge length in px (default 56)
 *   selected: highlight ring + slight lift
 *   onClick: optional click handler
 */
import { type TileDTO } from "../lib/api";

interface TileProps {
  tile: TileDTO;
  size?: number;
  selected?: boolean;
  onClick?: () => void;
}

const COLOR_FILL: Record<string, string> = {
  red: "var(--color-tile-red)",
  blue: "var(--color-tile-blue)",
  black: "var(--color-tile-black)",
  orange: "var(--color-tile-orange)",
};

const COLOR_EDGE: Record<string, string> = {
  red: "var(--color-tile-red-edge)",
  blue: "var(--color-tile-blue-edge)",
  black: "var(--color-tile-black-edge)",
  orange: "var(--color-tile-orange-edge)",
};

const NUMERAL_COLOR: Record<string, string> = {
  red: "var(--color-tile-red)",
  blue: "var(--color-tile-blue)",
  black: "#1a1a1a",
  orange: "var(--color-tile-orange)",
};

export function Tile({ tile, size = 56, selected, onClick }: TileProps) {
  const isJoker = tile.j;
  const fill = isJoker
    ? "var(--color-tile-joker)"
    : COLOR_FILL[tile.c || "red"];
  const edge = isJoker
    ? "var(--color-tile-joker-edge)"
    : COLOR_EDGE[tile.c || "red"];
  const numeralColor = isJoker
    ? "var(--color-tile-joker-edge)"
    : NUMERAL_COLOR[tile.c || "red"];

  // Depth of the cube along z-axis. Front face is at z=0; cube extends back.
  const depth = Math.round(size * 0.22);

  // The "tilted" rotations create the isometric feel. Modest angles keep
  // the numeral readable.
  const rotX = -22; // tilt back to expose top
  const rotY = 18;  // tilt right to expose left/right face

  // Render as a button only if onClick is provided. Otherwise a div, so
  // wrapping Tile in DraggableTile doesn't create a nested-button situation
  // and tab-focus only lands on actually-interactive tiles.
  const Tag = onClick ? "button" : "div";
  const baseClass =
    "relative inline-block cursor-pointer border-0 bg-transparent p-0 " +
    "transition-transform duration-150 hover:translate-y-[-3px] active:translate-y-0 " +
    (selected ? "translate-y-[-5px]" : "");
  const baseStyle: React.CSSProperties = {
    width: size + depth, // extra width to accommodate the right face's projection
    height: size + depth,
  };
  const buttonProps = onClick
    ? { type: "button" as const, onClick }
    : { role: "presentation" };

  return (
    <Tag
      {...buttonProps}
      className={baseClass}
      style={baseStyle}
      aria-label={isJoker ? "Joker" : `${tile.c} ${tile.n}`}
    >
      {/* Glow ring when selected */}
      {selected && (
        <div
          aria-hidden
          className="absolute inset-0 rounded-md pointer-events-none -m-1"
          style={{
            boxShadow: `0 0 0 2px ${fill}, 0 0 18px ${fill}80`,
          }}
        />
      )}

      {/* The 3D cube container. Centered in the button. */}
      <div
        className="absolute inset-0 m-auto"
        style={{
          width: size,
          height: size,
          transformStyle: "preserve-3d",
          transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
        }}
      >
        {/* FRONT face */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center rounded-sm overflow-hidden"
          style={{
            background: "var(--color-tile-face)",
            boxShadow: `inset 0 -2px 0 ${edge}40, inset 0 1px 0 rgba(255,255,255,0.4)`,
            transform: `translateZ(${depth / 2}px)`,
            backfaceVisibility: "hidden",
            fontFamily: "var(--font-display)",
          }}
        >
          {isJoker ? (
            <span
              className="font-bold tracking-tight leading-none"
              style={{
                fontSize: size * 0.3,
                color: numeralColor,
                fontFamily: "var(--font-mono)",
              }}
            >
              JKR
            </span>
          ) : (
            <>
              <span
                className="font-bold leading-none"
                style={{
                  fontSize: size * 0.58,
                  color: numeralColor,
                }}
              >
                {tile.n}
              </span>
              <span
                className="absolute bottom-1 right-1 inline-block rounded-full"
                style={{
                  width: size * 0.15,
                  height: size * 0.15,
                  background: fill,
                  border: `1px solid ${edge}`,
                }}
                aria-hidden
              />
            </>
          )}
        </div>

        {/* TOP face */}
        <div
          className="absolute inset-x-0 top-0"
          style={{
            height: depth,
            background: edge,
            transform: `rotateX(-90deg) translateZ(${depth / 2}px)`,
            transformOrigin: "top",
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.1)`,
          }}
          aria-hidden
        />

        {/* RIGHT face */}
        <div
          className="absolute inset-y-0 right-0"
          style={{
            width: depth,
            background: edge,
            transform: `rotateY(90deg) translateZ(${depth / 2}px)`,
            transformOrigin: "right",
            filter: "brightness(0.85)",
          }}
          aria-hidden
        />

        {/* BACK face (rarely visible at this angle but completes the cube) */}
        <div
          className="absolute inset-0 rounded-sm"
          style={{
            background: edge,
            transform: `translateZ(-${depth / 2}px) rotateY(180deg)`,
            backfaceVisibility: "hidden",
          }}
          aria-hidden
        />
      </div>

      {/* Bottom shadow — grounded floor contact */}
      <div
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{
          width: size * 0.95,
          height: depth * 0.5,
          bottom: depth * 0.1,
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 70%)",
        }}
      />
    </button>
  );
}
