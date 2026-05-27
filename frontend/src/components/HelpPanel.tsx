/**
 * HelpPanel — slide-in right-side dialog with rules + controls.
 *
 * Opened via the header `?` button OR auto-opened on first visit
 * (localStorage.rumicube.seen_intro absent). Native browser focus on
 * mount via autoFocus on close button. ESC closes.
 */
import { useEffect, useRef } from "react";
import { safeSet, STORAGE_KEYS } from "../lib/safeStorage";

interface HelpPanelProps {
  open: boolean;
  firstVisit: boolean;
  onClose: () => void;
}

export function HelpPanel({ open, firstVisit, onClose }: HelpPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    // Remember the element that had focus so we can restore on close
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Trap focus inside the panel via Tab/Shift+Tab cycling.
    const trapFocus = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button, a[href], input, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "Tab") {
        trapFocus(e);
      }
    };

    document.addEventListener("keydown", onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Initial focus on close button
    setTimeout(() => {
      const closeBtn = panelRef.current?.querySelector<HTMLButtonElement>(
        'button[aria-label="close help"]',
      );
      closeBtn?.focus();
    }, 0);

    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleGotIt = () => {
    safeSet(STORAGE_KEYS.seenIntro, "1");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        className="absolute top-0 right-0 h-full overflow-y-auto"
        style={{
          width: 380,
          maxWidth: "92vw",
          background: "var(--color-surface)",
          borderLeft: "1px solid var(--color-border)",
          boxShadow: "-12px 0 36px rgba(0,0,0,0.4)",
          padding: "24px 28px",
        }}
      >
        <div className="flex justify-between items-start mb-6">
          <h2
            id="help-title"
            className="text-2xl"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              letterSpacing: "-0.025em",
            }}
          >
            How to play
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="close help"
            className="text-xl px-2 py-1 leading-none transition-colors"
            style={{
              color: "var(--color-text-mute)",
              fontFamily: "var(--font-mono)",
              background: "transparent",
              border: "1px solid var(--color-border-hi)",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        <Section title="Rummikub">
          Form valid melds from 104 numbered tiles plus 2 jokers. A{" "}
          <b>run</b> is three or more same-color consecutive numbers. A{" "}
          <b>group</b> is three or more same-number different-color tiles.
          Your opening play must total 30+ points.
        </Section>

        <Section title="Controls">
          <ul className="list-disc pl-5 space-y-1">
            <li>Drag a tile from your hand to a meld or the +new meld zone.</li>
            <li>Drag tiles within your hand to rearrange them.</li>
            <li>
              Or click a tile to pick it up (lime ring), then click any drop
              zone to place it.
            </li>
            <li>Click submit play when you finish your turn.</li>
            <li>Click cancel to revert all pending changes.</li>
          </ul>
        </Section>

        <Section title="Solver">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <b>Suggest hand-only</b>: fastest, only your hand tiles.
            </li>
            <li>
              <b>Suggest ILP solver</b>: slower, also rearranges existing
              board melds to fit your tiles. This is the hard part of
              Rummikub strategy.
            </li>
            <li>
              <b>Solver Eye</b>: see the board AS IT WOULD LOOK after the
              solver's proposed play. Toggle off to return to your real
              state.
            </li>
          </ul>
        </Section>

        <Section title="About">
          rumiCUBE v0.7.x. Open source at{" "}
          <a
            href="https://github.com/matis-tbc/rumiCUBE"
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--color-accent)", textDecoration: "underline" }}
          >
            github.com/matis-tbc/rumiCUBE
          </a>
          . The ILP solver wins 10/10 against the greedy bot in the arena CLI.
        </Section>

        {firstVisit && (
          <button
            type="button"
            onClick={handleGotIt}
            className="mt-4 w-full inline-flex items-center justify-center px-4 py-3 text-xs uppercase tracking-[0.16em] rounded transition-colors"
            style={{
              background: "var(--color-accent)",
              color: "#0F1A00",
              border: "1px solid var(--color-accent-edge)",
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
            }}
          >
            got it, don't show again
          </button>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div
        className="text-[10px] uppercase tracking-[0.18em] mb-2"
        style={{
          color: "var(--color-accent)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {title}
      </div>
      <div
        className="text-sm leading-relaxed"
        style={{ color: "var(--color-text)", fontFamily: "var(--font-body)" }}
      >
        {children}
      </div>
    </div>
  );
}
