/**
 * Logo — "rumiCUBE" lockup. The CUBE letters render as real 3D cubes
 * (preserve-3d + rotateX/rotateY) so they read as physical objects. The
 * "rumi" prefix stays small monospace to keep the cubes as the focal point.
 */

interface LogoProps {
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: { letter: 14, cube: 24 },
  md: { letter: 22, cube: 38 },
  lg: { letter: 34, cube: 60 },
};

const CUBE_COLORS = [
  { fill: "var(--color-tile-red)", edge: "var(--color-tile-red-edge)" },
  { fill: "var(--color-tile-blue)", edge: "var(--color-tile-blue-edge)" },
  { fill: "var(--color-tile-orange)", edge: "var(--color-tile-orange-edge)" },
  { fill: "var(--color-tile-black)", edge: "var(--color-tile-black-edge)" },
];

const LETTERS = ["C", "U", "B", "E"];

export function Logo({ size = "md" }: LogoProps) {
  const s = SIZES[size];
  const depth = Math.round(s.cube * 0.28);

  return (
    <div
      className="flex items-baseline gap-2 select-none"
      style={{ perspective: "800px" }}
    >
      <span
        className="font-bold tracking-tight"
        style={{
          fontSize: s.letter,
          fontFamily: "var(--font-mono)",
          color: "var(--color-text-dim)",
          letterSpacing: "0.08em",
        }}
      >
        rumi
      </span>
      <div className="flex items-end gap-1">
        {LETTERS.map((letter, i) => {
          const c = CUBE_COLORS[i];
          return (
            <div
              key={letter}
              className="relative inline-block"
              style={{
                width: s.cube + depth,
                height: s.cube + depth,
                perspective: "600px",
              }}
              aria-hidden
            >
              <div
                className="absolute inset-0 m-auto"
                style={{
                  width: s.cube,
                  height: s.cube,
                  transformStyle: "preserve-3d",
                  transform: "rotateX(-22deg) rotateY(18deg)",
                }}
              >
                {/* Front face with letter */}
                <div
                  className="absolute inset-0 flex items-center justify-center rounded-sm font-bold"
                  style={{
                    background: c.fill,
                    color: "var(--color-tile-face)",
                    fontFamily: "var(--font-display)",
                    fontSize: s.cube * 0.6,
                    transform: `translateZ(${depth / 2}px)`,
                    boxShadow: `inset 0 -3px 0 ${c.edge}, inset 0 1px 0 rgba(255,255,255,0.2)`,
                  }}
                >
                  {letter}
                </div>
                {/* Top face */}
                <div
                  className="absolute inset-x-0 top-0"
                  style={{
                    height: depth,
                    background: c.edge,
                    transform: `rotateX(-90deg) translateZ(${depth / 2}px)`,
                    transformOrigin: "top",
                  }}
                />
                {/* Right face */}
                <div
                  className="absolute inset-y-0 right-0"
                  style={{
                    width: depth,
                    background: c.edge,
                    transform: `rotateY(90deg) translateZ(${depth / 2}px)`,
                    transformOrigin: "right",
                    filter: "brightness(0.8)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
