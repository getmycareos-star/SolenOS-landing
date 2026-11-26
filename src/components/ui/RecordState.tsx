import { useId, type ReactNode } from "react";

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
  const titleId = useId();
  const copy = COPY[kind];
  const label = actionLabel || copy.actionLabel;
  const isError = kind === "error" || kind === "forbidden" || kind === "unavailable";

  return (
    <section
      role={isError ? "alert" : kind === "loading" ? "status" : "region"}
      aria-labelledby={titleId}
      aria-live={isError ? "assertive" : "polite"}
      aria-busy={kind === "loading"}
      className={`record-state record-state--${kind}`}
    >
      <strong id={titleId} className="record-state-title">{title || copy.title}</strong>
      <p className="record-state-description">{description || copy.description}</p>
      {children}
      {label && onAction && (
        <button type="button" className="record-state-action" onClick={onAction}>
          {label}
        </button>
      )}
    </section>
  );
}
