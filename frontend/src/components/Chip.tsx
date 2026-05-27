import { type ReactNode } from "react";

interface ChipProps {
  children: ReactNode;
  variant?: "default" | "lime";
}

export function Chip({ children, variant = "default" }: ChipProps) {
  const styles: React.CSSProperties =
    variant === "lime"
      ? {
          background: "rgba(199, 242, 61, 0.08)",
          color: "var(--color-accent)",
          border: "1px solid rgba(199, 242, 61, 0.3)",
        }
      : {
          background: "transparent",
          color: "var(--color-text-dim)",
          border: "1px solid var(--color-border-hi)",
        };

  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] rounded-sm"
      style={{ fontFamily: "var(--font-mono)", ...styles }}
    >
      {children}
    </span>
  );
}
