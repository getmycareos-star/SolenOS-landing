import type { ReactNode } from "react";

export type RecordStateKind =
  | "first-empty"
  | "period-empty"
  | "no-results"
  | "loading"
  | "error"
  | "forbidden"
  | "unavailable"
  | "incomplete";

type RecordStateCopy = {
  title: string;
  description: string;
  actionLabel?: string;
};

const COPY: Record<RecordStateKind, RecordStateCopy> = {
  "first-empty": {
    title: "No care updates yet",
    description: "Add the first care update to begin building a history of care.",
    actionLabel: "Add an update",
  },
  "period-empty": {
    title: "Nothing recorded today",
    description: "Your recorded care updates will appear here.",
    actionLabel: "Add an update",
  },
  "no-results": {
    title: "No matching records",
    description: "Try another search term or adjust your filters.",
    actionLabel: "Clear filters",
  },
  loading: {
    title: "Loading your care information",
    description: "Please wait while your saved information is retrieved.",
  },
  error: {
    title: "We couldn't load this information",
    description: "Your saved information has not been changed. Please try again.",
    actionLabel: "Try again",
  },
  forbidden: {
    title: "You can't access this information",
    description: "Check that you're signed in with the right account or ask the record owner for access.",
  },
  unavailable: {
    title: "This information isn't available right now",
    description: "The service needed to retrieve it isn't available. Please try again.",
    actionLabel: "Try again",
  },
  incomplete: {
    title: "Some information needs confirmation",
    description: "Review these details before relying on them.",
    actionLabel: "Review information",
  },
};

export function RecordState({
  kind,
  title,
  description,
  onAction,
  actionLabel,
  children,
}: {
  kind: RecordStateKind;
  title?: string;
  description?: string;
  onAction?: () => void;
  actionLabel?: string;
  children?: ReactNode;
}) {
  const copy = COPY[kind];
  const label = actionLabel || copy.actionLabel;
  const isError = kind === "error" || kind === "forbidden" || kind === "unavailable";

  return (
    <section
      role={isError ? "alert" : kind === "loading" ? "status" : "region"}
      aria-live={isError ? "assertive" : "polite"}
      className={`record-state record-state--${kind}`}
      style={{
        display: "grid",
        gap: 8,
        padding: 16,
        border: "1px solid #e1e9df",
        borderRadius: 12,
        background: isError ? "#fff8f4" : "#fbfdfb",
        color: "#26392c",
      }}
    >
      <strong style={{ fontSize: 15 }}>{title || copy.title}</strong>
      <p style={{ margin: 0, color: "#69796c", fontSize: 14, lineHeight: 1.6 }}>
        {description || copy.description}
      </p>
      {children}
      {label && onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            justifySelf: "start",
            minHeight: 40,
            padding: "8px 12px",
            border: "1px solid #dce6da",
            borderRadius: 9,
            background: "#eef4ec",
            color: "#26392c",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {label}
        </button>
      )}
    </section>
  );
}