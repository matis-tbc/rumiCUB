/**
 * HelpButton — header button that opens HelpPanel.
 * Shows a lime dot when seenIntro is absent (first-visit prompt).
 */
import { useEffect, useState } from "react";
import { safeGet, STORAGE_KEYS } from "../lib/safeStorage";

interface HelpButtonProps {
  onClick: () => void;
}

export function HelpButton({ onClick }: HelpButtonProps) {
  const [hasUnreadIntro, setHasUnreadIntro] = useState(false);

  useEffect(() => {
    setHasUnreadIntro(!safeGet(STORAGE_KEYS.seenIntro));
    const onStorage = () => setHasUnreadIntro(!safeGet(STORAGE_KEYS.seenIntro));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="help"
      title="help"
      className="relative inline-flex items-center justify-center rounded transition-colors"
      style={{
        width: 32,
        height: 32,
        background: "transparent",
        color: "var(--color-text-dim)",
        border: "1px solid var(--color-border-hi)",
        fontFamily: "var(--font-mono)",
        fontSize: 14,
        cursor: "pointer",
      }}
    >
      ?
      {hasUnreadIntro && (
        <span
          aria-hidden
          className="absolute"
          style={{
            top: -3,
            right: -3,
            width: 8,
            height: 8,
            background: "var(--color-accent)",
            borderRadius: 1,
            boxShadow: "0 0 8px rgba(199, 242, 61, 0.6)",
          }}
        />
      )}
    </button>
  );
}
