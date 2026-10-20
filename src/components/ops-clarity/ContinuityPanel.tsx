"use client";

import { Check } from "lucide-react";
import { condenseEventSummary } from "@/lib/mvp-workspace";
import type { AttachedDocument, ClarityEnvelope } from "@/lib/mvp-workspace";

type Props = {
  rawInput: string;
  documents: AttachedDocument[];
  envelope: ClarityEnvelope;
  onReset: () => void;
};

export function ContinuityPanel({ rawInput, documents, envelope, onReset }: Props) {
  const summary = condenseEventSummary(rawInput, envelope.what_is_happening);
  const checks = [
    { label: "Event recorded", done: true },
    { label: "Documents attached", done: documents.length > 0 },
    {
      label: "Follow-ups preserved",
      done: envelope.follow_up_items.length > 0 || Boolean(envelope.what_matters_now),
    },
    { label: "Context retained", done: true },
  ];

  return (
    <>
      <section className="panel panel-input" aria-label="Caregiver input">
        <div className="workspace-panel-inner">
          <h2 className="workspace-headline">This moment</h2>
          <p className="read-only-dump condensed">{summary}</p>
        </div>
      </section>

      <section className="panel panel-output" aria-label="Clarity output">
        <div className="workspace-panel-inner clarity-side">
          <h2 className="workspace-headline">Continuity</h2>
          <ul className="continuity-checks">
            {checks.map((c) => (
              <li key={c.label} className={c.done ? "is-done" : "is-soft"}>
                <Check size={18} aria-hidden strokeWidth={c.done ? 2.5 : 1.5} />
                <span>
                  {c.label}
                  {!c.done && c.label === "Documents attached" ? " — none this time" : ""}
                </span>
              </li>
            ))}
          </ul>

          <p className="reassurance">
            This moment has been securely recorded. What is not urgent tonight has been deferred.
            You can rest now.
          </p>

          <button type="button" className="workspace-primary" onClick={onReset}>
            New Brain Dump
          </button>
        </div>
      </section>
    </>
  );
}
