"use client";

import { useCallback, useState } from "react";
import {
  GLOBAL_FEEDBACK_LABEL,
  GLOBAL_FEEDBACK_OPTIONS,
  GLOBAL_FEEDBACK_PROMPT,
} from "@/lib/mvp-faq";
import { SUPPORT_EMAIL } from "@/lib/early-access-trust";

type Props = {
  /** Retained for callers; feedback is not keyed to a care record. */
  careKey?: string | null;
  compact?: boolean;
};

/**
 * Optional improvement signal. Until a scoped, persisted feedback API exists,
 * feedback is prepared as an email draft rather than sent to an unsupported route.
 */
export function HelpImproveSolenos({ compact }: Props) {
  const [open, setOpen] = useState(false);
  const [option, setOption] = useState("");
  const [note, setNote] = useState("");

  const openEmailDraft = useCallback(() => {
    if (!option) return;
    const body = [
      `Feedback: ${option}`,
      note.trim() ? `Additional note: ${note.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    window.location.href =
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("SolenOS early-access feedback")}&body=${encodeURIComponent(body)}`;
  }, [note, option]);

  if (!open) {
    return (
      <p className={compact ? "panel-muted" : "help-improve-launch"}>
        <button type="button" className="link-button" onClick={() => setOpen(true)}>
          {GLOBAL_FEEDBACK_LABEL}
        </button>
      </p>
    );
  }

  return (
    <div className="help-improve-panel" aria-label={GLOBAL_FEEDBACK_LABEL}>
      <p className="workspace-lede">{GLOBAL_FEEDBACK_PROMPT}</p>
      <ul className="research-feedback-options">
        {GLOBAL_FEEDBACK_OPTIONS.map((opt) => (
          <li key={opt}>
            <label>
              <input
                type="radio"
                name="global-feedback"
                checked={option === opt}
                onChange={() => setOption(opt)}
              />
              {opt}
            </label>
          </li>
        ))}
      </ul>
      <label className="research-feedback-field">
        <span>Anything else? (optional)</span>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <div className="situation-actions">
        <button
          type="button"
          className="workspace-primary"
          disabled={!option}
          onClick={openEmailDraft}
        >
          Open email draft
        </button>
        <button
          type="button"
          className="workspace-secondary"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
      <p className="panel-muted">
        Feedback opens in your email app; SolenOS has not received it until you send it.
        {" "}Or email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </div>
  );
}
