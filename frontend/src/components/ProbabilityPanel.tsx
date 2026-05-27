/**
 * ProbabilityPanel — analytical sidebar showing hand quality + tile scarcity.
 *
 * Fetches /games/{id}/probabilities. Renders:
 *   - Hand quality card (can_open_now, best play, P(open in 3), penalty)
 *   - Tile scarcity heatmap: 4 colors × 13 numbers grid, cell intensity
 *     scales with how many copies have been seen (darker = more seen = harder to draw)
 */
import { useEffect, useState } from "react";
import { api, type ProbabilitiesResponse } from "../lib/api";

interface ProbabilityPanelProps {
  gameId: string;
  refreshKey: number; // bump to re-fetch (e.g., turn changed)
}

const COLORS = ["red", "blue", "black", "orange"] as const;
// In the scarcity heatmap, use a lighter shade for "black" so cells are
// visible against the dark page background. The actual tile color is
// still represented in the tile renderer.
const COLOR_FILL: Record<string, string> = {
  red: "var(--color-tile-red)",
  blue: "var(--color-tile-blue)",
  black: "#888888",
  orange: "var(--color-tile-orange)",
};

export function ProbabilityPanel({ gameId, refreshKey }: ProbabilityPanelProps) {
  const [data, setData] = useState<ProbabilitiesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await api.probabilities(gameId);
        if (!cancelled) {
          setData(p);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId, refreshKey]);

  if (error) {
    return (
      <div
        className="rounded-sm p-4 text-xs"
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-tile-red)",
          color: "var(--color-tile-red)",
          fontFamily: "var(--font-mono)",
        }}
      >
        probability error: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="rounded-sm p-4 text-xs"
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text-mute)",
          fontFamily: "var(--font-mono)",
        }}
      >
        loading probabilities…
      </div>
    );
  }

  const q = data.hand_quality;

  // Build a per-(color, number) lookup of seen_fraction
  const cell = new Map<string, number>();
  let jokerFrac = 0;
  for (const e of data.scarcity) {
    if (e.j) {
      jokerFrac = e.seen_fraction;
    } else if (e.c && e.n !== null) {
      cell.set(`${e.c}-${e.n}`, e.seen_fraction);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Hand quality */}
      <div
        className="rounded-sm p-4"
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div
          className="text-xs uppercase tracking-widest mb-3"
          style={{
            color: "var(--color-text-mute)",
            fontFamily: "var(--font-mono)",
          }}
        >
          hand quality
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs" style={{ fontFamily: "var(--font-mono)" }}>
          <KV
            k="can open"
            v={q.can_open_now ? "yes" : "no"}
            color={q.can_open_now ? "var(--color-tile-blue)" : "var(--color-text-dim)"}
          />
          <KV k="best play" v={`${q.best_play_tiles} tiles · ${q.best_play_value} pts`} />
          <KV k="p(open in 3)" v={`${Math.round(q.prob_open_in_3 * 100)}%`} />
          <KV k="penalty" v={`${q.penalty_if_loss}`} />
          <KV k="partials" v={`${q.partial_count}`} />
          <KV k="pool left" v={`${data.pool_remaining}`} />
        </div>
      </div>

      {/* Tile scarcity heatmap */}
      <div
        className="rounded-sm p-4"
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div
          className="text-xs uppercase tracking-widest mb-3"
          style={{
            color: "var(--color-text-mute)",
            fontFamily: "var(--font-mono)",
          }}
        >
          tile scarcity
        </div>
        <div className="text-[10px] mb-2" style={{ color: "var(--color-text-mute)", fontFamily: "var(--font-mono)" }}>
          darker = more copies seen → harder to draw
        </div>

        {/* Grid: 4 color rows × 13 number columns */}
        <div className="flex flex-col gap-1">
          {/* Number axis label */}
          <div className="grid grid-cols-[20px_repeat(13,1fr)] gap-[2px]">
            <div />
            {Array.from({ length: 13 }, (_, i) => (
              <div
                key={i}
                className="text-center text-[9px]"
                style={{
                  color: "var(--color-text-mute)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {i + 1}
              </div>
            ))}
          </div>
          {COLORS.map((color) => (
            <div key={color} className="grid grid-cols-[20px_repeat(13,1fr)] gap-[2px]">
              <div
                className="text-[10px] flex items-center"
                style={{
                  color: "var(--color-text-mute)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {color === "black" ? "BK" : color[0].toUpperCase()}
              </div>
              {Array.from({ length: 13 }, (_, i) => {
                const n = i + 1;
                const frac = cell.get(`${color}-${n}`) ?? 0;
                return (
                  <ScarcityCell key={n} color={color} fraction={frac} label={`${color} ${n}`} />
                );
              })}
            </div>
          ))}

          {/* Joker row */}
          <div className="grid grid-cols-[20px_repeat(13,1fr)] gap-[2px] mt-1">
            <div
              className="text-[10px] flex items-center"
              style={{
                color: "var(--color-text-mute)",
                fontFamily: "var(--font-mono)",
              }}
            >
              J
            </div>
            <div className="col-span-13 flex">
              <ScarcityCell color="orange" fraction={jokerFrac} label={`joker (${Math.round(jokerFrac * 100)}% seen)`} wide />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


function KV({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <>
      <span style={{ color: "var(--color-text-mute)" }}>{k}</span>
      <span className="text-right font-bold" style={{ color: color || "var(--color-text)" }}>
        {v}
      </span>
    </>
  );
}


function ScarcityCell({
  color,
  fraction,
  label,
  wide,
}: {
  color: string;
  fraction: number;
  label: string;
  wide?: boolean;
}) {
  // fraction = 0 means none seen (bright tile); fraction = 1 means all seen (dim).
  // Map to opacity so seen tiles fade away.
  const alpha = Math.max(0.1, 1 - fraction);
  const fill = COLOR_FILL[color] || "var(--color-text-dim)";
  return (
    <div
      title={label}
      style={{
        height: 14,
        width: wide ? "100%" : undefined,
        background: fill,
        opacity: alpha,
        borderRadius: 2,
      }}
    />
  );
}
