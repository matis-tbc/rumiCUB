/**
 * SolverEyeToggle — header chip that flips Solver Eye on/off.
 * Lime when on (with a soft glow). 44px min touch target.
 * Calls toggleSolverEye on click and forwards the result so callers can
 * show a toast when pending changes get cancelled.
 */
import { useSolver } from "../lib/SolverContext";

type ToggleResult =
  | { kind: "noop" }
  | { kind: "off" }
  | { kind: "on"; cancelledPending: boolean };

interface SolverEyeToggleProps {
  gameId: string;
  ilpAvailable: boolean;
  onToggleResult?: (r: ToggleResult) => void;
}

export function SolverEyeToggle({
  gameId,
  ilpAvailable,
  onToggleResult,
}: SolverEyeToggleProps) {
  const { solverEyeOn, toggleSolverEye, fetching } = useSolver();

  const disabled = !ilpAvailable;
  const title = disabled
    ? "ILP solver requires pulp"
    : solverEyeOn
    ? "hide the solver overlay"
    : "preview the solver's proposed play";

  const baseStyle: React.CSSProperties = solverEyeOn
    ? {
        background: "rgba(199, 242, 61, 0.1)",
        color: "var(--color-accent)",
        border: "1px solid rgba(199, 242, 61, 0.4)",
      }
    : {
        background: "transparent",
        color: "var(--color-text-dim)",
        border: "1px solid var(--color-border-hi)",
      };

  async function onClick() {
    const r = await toggleSolverEye(gameId);
    onToggleResult?.(r);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={`solver eye ${solverEyeOn ? "on" : "off"}`}
      aria-pressed={solverEyeOn}
      className="inline-flex items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-[0.16em] rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        fontFamily: "var(--font-mono)",
        minHeight: 32,
        ...baseStyle,
      }}
    >
      <span
        className="inline-block"
        style={{
          width: 6,
          height: 6,
          borderRadius: 1,
          background: solverEyeOn ? "var(--color-accent)" : "var(--color-text-mute)",
          boxShadow: solverEyeOn ? "0 0 8px rgba(199, 242, 61, 0.6)" : "none",
        }}
        aria-hidden
      />
      solver eye · {fetching ? "..." : solverEyeOn ? "on" : "off"}
    </button>
  );
}
