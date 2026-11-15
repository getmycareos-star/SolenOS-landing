import type { ReactNode } from "react";

export type RecordStateKind =
  | "empty"
  | "no-results"
  | "loading"
  | "error"
  | "unavailable"
  | "unconfirmed";

type RecordStateProps = {
  kind: RecordStateKind;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

/**
 * Shared, accessible presentation for care-information states.
 * Callers must classify the state from the actual request/result lifecycle;
 * an error or pending request must never be rendered as an empty result.
 */
export function RecordState({
  kind,
  title,
  description,
  action,
  className = "",
}: RecordStateProps) {
  const isBusy = kind === "loading";
  const isError = kind === "error" || kind === "unavailable";

  return (
    <div
      className={`record-state record-state--${kind} ${className}`.trim()}
      role={isError ? "alert" : "status"}
      aria-busy={isBusy || undefined}
      aria-live={isError ? "assertive" : "polite"}
    >
      <strong className="record-state-title">{title}</strong>
      {description ? <p className="record-state-description">{description}</p> : null}
      {action ? <div className="record-state-action">{action}</div> : null}
    </div>
  );
}
