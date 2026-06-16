/**
 * NewGameModal — centered dialog to configure a new game.
 * Pick 2-4 players, edit each name, Start. Backend enforces 2-4.
 *
 * Opened on first load (when no saved game) and when the user clicks
 * NEW GAME. DIY focus trap + Esc (Esc only closes if a game already
 * exists, so the first-load modal can't be dismissed into a blank app).
 */
import { useEffect, useRef, useState } from "react";

interface NewGameModalProps {
  open: boolean;
  dismissable: boolean; // false on first load (no game to fall back to)
  onStart: (names: string[]) => void;
  onClose: () => void;
}

const DEFAULT_NAMES = ["Player 1", "Player 2", "Player 3", "Player 4"];

export function NewGameModal({ open, dismissable, onStart, onClose }: NewGameModalProps) {
  const [names, setNames] = useState<string[]>(["Player 1", "Player 2"]);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissable) {
        e.stopPropagation();
        onClose();
      } else if (e.key === "Tab" && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>(
          'button, input, [tabindex]:not([tabindex="-1"])',
        );
        if (f.length === 0) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setTimeout(() => {
      panelRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    }, 0);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [open, dismissable, onClose]);

  if (!open) return null;

  const count = names.length;

  function setCount(n: number) {
    setNames((prev) => {
      const next = [...prev];
      while (next.length < n) next.push(DEFAULT_NAMES[next.length] ?? `Player ${next.length + 1}`);
      next.length = n;
      return next;
    });
  }

  function start() {
    const cleaned = names.map((n, i) => n.trim() || DEFAULT_NAMES[i] || `Player ${i + 1}`);
    onStart(cleaned);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget && dismissable) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="newgame-title"
        className="rounded-md"
        style={{
          width: 420,
          maxWidth: "92vw",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
          padding: "28px 32px",
        }}
      >
        <h2
          id="newgame-title"
          className="text-2xl mb-1"
          style={{ fontFamily: "var(--font-display)", fontWeight: 800, letterSpacing: "-0.025em" }}
        >
          New game
        </h2>
        <p className="text-sm mb-6" style={{ color: "var(--color-text-dim)" }}>
          Pass-and-play on one device. 2 to 4 players.
        </p>

        {/* Count selector */}
        <div className="mb-5">
          <div
            className="text-[10px] uppercase tracking-[0.18em] mb-2"
            style={{ color: "var(--color-text-mute)", fontFamily: "var(--font-mono)" }}
          >
            players
          </div>
          <div className="flex gap-2">
            {[2, 3, 4].map((n) => {
              const active = count === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  aria-pressed={active}
                  className="flex-1 py-2 text-sm rounded transition-colors"
                  style={{
                    fontFamily: "var(--font-mono)",
                    background: active ? "var(--color-accent)" : "transparent",
                    color: active ? "#0F1A00" : "var(--color-text-dim)",
                    border: active
                      ? "1px solid var(--color-accent-edge)"
                      : "1px solid var(--color-border-hi)",
                    fontWeight: active ? 700 : 500,
                    cursor: "pointer",
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>

        {/* Name inputs */}
        <div className="flex flex-col gap-2 mb-6">
          <div
            className="text-[10px] uppercase tracking-[0.18em] mb-1"
            style={{ color: "var(--color-text-mute)", fontFamily: "var(--font-mono)" }}
          >
            names
          </div>
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <span
                className="inline-block rounded-sm"
                style={{ width: 8, height: 8, background: TILE_DOTS[i] }}
                aria-hidden
              />
              <input
                value={names[i]}
                onChange={(e) =>
                  setNames((prev) => prev.map((nm, j) => (j === i ? e.target.value : nm)))
                }
                onKeyDown={(e) => { if (e.key === "Enter") start(); }}
                maxLength={20}
                aria-label={`player ${i + 1} name`}
                className="flex-1 rounded"
                style={{
                  background: "var(--color-bg-elev)",
                  border: "1px solid var(--color-border-hi)",
                  color: "var(--color-text)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  padding: "10px 12px",
                }}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          {dismissable && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs uppercase tracking-[0.14em] rounded transition-colors"
              style={{
                background: "transparent",
                color: "var(--color-text-dim)",
                border: "1px solid var(--color-border-hi)",
                fontFamily: "var(--font-mono)",
                cursor: "pointer",
              }}
            >
              cancel
            </button>
          )}
          <button
            type="button"
            onClick={start}
            className="px-5 py-2.5 text-xs uppercase tracking-[0.14em] rounded transition-colors"
            style={{
              background: "var(--color-accent)",
              color: "#0F1A00",
              border: "1px solid var(--color-accent-edge)",
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            start game →
          </button>
        </div>
      </div>
    </div>
  );
}

const TILE_DOTS = [
  "var(--color-tile-red)",
  "var(--color-tile-blue)",
  "var(--color-tile-orange)",
  "var(--color-tile-black)",
];
