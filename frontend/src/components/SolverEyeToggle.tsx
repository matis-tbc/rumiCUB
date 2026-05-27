import { useSolver } from "../lib/SolverContext";

interface SolverEyeToggleProps {
  gameId: string;
  ilpAvailable: boolean;
}

export function SolverEyeToggle({ gameId, ilpAvailable }: SolverEyeToggleProps) {
  const { solverEyeOn, toggleSolverEye, fetching } = useSolver();

  const disabled = !ilpAvailable;
  const title = disabled
    ? "ILP solver requires pulp"
    : solverEyeOn
    ? "hide the solver overlay"
    : "show the solver's proposed play overlaid on the board";

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

  return (
    <button
      type="button"
      onClick={() => toggleSolverEye(gameId)}
      disabled={disabled}
      title={title}
      className="inline-flex items-center gap-2 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] rounded-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ fontFamily: "var(--font-mono)", ...baseStyle }}
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
