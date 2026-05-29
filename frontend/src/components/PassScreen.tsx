/**
 * PassScreen — pass-and-play privacy gate between turns.
 *
 * When the active player changes, a full-viewport overlay covers the
 * board, hand, and analysis so the previous player can hand the device
 * to the next player without anyone peeking at the upcoming hand. The
 * next player taps "reveal" to start their turn.
 */

interface PassScreenProps {
  open: boolean;
  playerName: string;
  onReveal: () => void;
}

export function PassScreen({ open, playerName, onReveal }: PassScreenProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center"
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, rgba(199,242,61,0.06), transparent 55%), var(--color-bg)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`pass the device to ${playerName}`}
    >
      <div
        className="text-[10px] uppercase tracking-[0.2em] mb-4"
        style={{ color: "var(--color-text-mute)", fontFamily: "var(--font-mono)" }}
      >
        pass the device
      </div>
      <h2
        className="text-center mb-2"
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: "clamp(36px, 6vw, 72px)",
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      >
        <span style={{ color: "var(--color-accent)" }}>{playerName}</span>
        <br />
        it&apos;s your turn
      </h2>
      <p className="text-sm mb-8" style={{ color: "var(--color-text-dim)" }}>
        Tap reveal when no one else can see the screen.
      </p>
      <button
        type="button"
        onClick={onReveal}
        autoFocus
        className="px-8 py-4 text-sm uppercase tracking-[0.16em] rounded transition-colors"
        style={{
          background: "var(--color-accent)",
          color: "#0F1A00",
          border: "1px solid var(--color-accent-edge)",
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        reveal my hand →
      </button>
    </div>
  );
}
