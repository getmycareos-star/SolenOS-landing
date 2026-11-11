import type { CSSProperties } from "react";

type Props = {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
};

/** A single restrained archive mark shared by full-page and local loading states. */
export function LivingArchiveMark({ size = "md", label, className = "" }: Props) {
  const style = { "--archive-mark-size": size === "lg" ? "5.5rem" : size === "sm" ? "1.75rem" : "3.5rem" } as CSSProperties;
  return (
    <span className={`living-archive-loading ${className}`} style={style} role={label ? "status" : undefined} aria-live={label ? "polite" : undefined}>
      <svg className="living-archive-loading__mark" viewBox="0 0 88 88" fill="none" aria-hidden="true">
        <path className="living-archive-loading__arch living-archive-loading__arch--outer" d="M13 72V42C13 24.9 26.9 11 44 11s31 13.9 31 31v30" />
        <path className="living-archive-loading__arch living-archive-loading__arch--inner" d="M27 72V43c0-9.4 7.6-17 17-17s17 7.6 17 17v29" />
        <path className="living-archive-loading__spine" d="M44 43v29M9 72h70" />
      </svg>
      {label ? <span className="living-archive-loading__label">{label}</span> : null}
    </span>
  );
}
