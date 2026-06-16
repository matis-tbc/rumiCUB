import { type ReactNode } from "react";

interface BtnProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "default" | "primary" | "ghost";
  size?: "md" | "sm";
  title?: string;
  type?: "button" | "submit";
  className?: string;
}

export function Btn({
  children,
  onClick,
  disabled,
  tone = "default",
  size = "md",
  title,
  type = "button",
  className = "",
}: BtnProps) {
  const isPrimary = tone === "primary";

  const baseStyle: React.CSSProperties = {
    background: isPrimary ? "var(--color-accent)" : "transparent",
    color: isPrimary ? "#0F1A00" : "var(--color-text-dim)",
    border: isPrimary
      ? "1px solid var(--color-accent-edge)"
      : tone === "ghost"
      ? "1px solid var(--color-border)"
      : "1px solid var(--color-border-hi)",
    fontWeight: isPrimary ? 700 : 500,
    fontFamily: "var(--font-mono)",
    cursor: disabled ? "not-allowed" : "pointer",
  };

  const padding = size === "sm" ? "px-3 py-1.5" : "px-3 py-2";
  const text = size === "sm" ? "text-[11px]" : "text-xs";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`group inline-flex items-center justify-center gap-2 ${padding} ${text} uppercase tracking-[0.14em] rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      style={baseStyle}
    >
      {children}
    </button>
  );
}

export function BtnArrow() {
  return (
    <span className="inline-block transition-transform duration-150 group-hover:translate-x-[2px]">
      →
    </span>
  );
}
