/**
 * Toast — transient lime-tinted strip for short status messages.
 * Used for "reverted N pending changes" when Solver Eye auto-cancels.
 * Auto-dismisses after 3s. role=status aria-live=polite for SR users.
 */
import { useEffect, useState } from "react";

interface ToastProps {
  message: string | null;
  onDismiss?: () => void;
  durationMs?: number;
}

export function Toast({ message, onDismiss, durationMs = 3000 }: ToastProps) {
  const [visible, setVisible] = useState(!!message);

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, durationMs);
    return () => clearTimeout(t);
  }, [message, durationMs, onDismiss]);

  if (!message || !visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] rounded transition-opacity"
      style={{
        background: "rgba(199, 242, 61, 0.08)",
        border: "1px solid rgba(199, 242, 61, 0.35)",
        color: "var(--color-accent)",
        fontFamily: "var(--font-mono)",
      }}
    >
      {message}
    </div>
  );
}
