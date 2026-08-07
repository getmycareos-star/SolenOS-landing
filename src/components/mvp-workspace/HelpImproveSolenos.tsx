"use client";

import { apiUrl } from "@/lib/api-url";
import { useCallback, useState } from "react";
import {
  GLOBAL_FEEDBACK_LABEL,
  GLOBAL_FEEDBACK_OPTIONS,
  GLOBAL_FEEDBACK_PROMPT,
} from "@/lib/mvp-faq";
import { SUPPORT_EMAIL } from "@/lib/early-access-trust";

type Props = {
  careKey?: string | null;
  compact?: boolean;
};

/**
 * Always-available improvement signal — not only after AI responses.
 */
export function HelpImproveSolenos({ careKey, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [option, setOption] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const key = careKey?.trim() || "anonymous_feedback";
      const helped = option === "Response was helpful";
      const res = await fetch(apiUrl("/api/research-feedback"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          care_key: key,
          helped_understand: helped,
          missed: helped ? undefined : option || undefined,
          expected_understanding: note.trim() || undefined,
          raw_input_excerpt: "global_help_improve",
        }),
      });
      if (!res.ok) {
        throw new Error("We couldn't send your feedback right now.");
      }
      // Only claim the feedback was recorded once the request actually succeeds.
      setDone(true);
    } catch {
      setSubmitError(
        "We couldn't send your feedback. Check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  }, [careKey, note, option, saving]);

  if (done) {
    return (
      <p className="panel-muted help-improve-thanks" role="status">
        Thank you — we have recorded your feedback for our team.
      </p>
    );
  }

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
                disabled={saving}
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
          disabled={saving}
        />
      </label>
{submitError && (
        <p className="panel-muted help-improve-error" role="alert">
          {submitError}
        </p>
      )}
      <div className="situation-actions">
        <button
          type="button"
          className="workspace-primary"
          disabled={saving || !option}
          onClick={() => void submit()}
        >
          Send
        </button>
        <button
          type="button"
          className="workspace-secondary"
          disabled={saving}
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
      <p className="panel-muted">
        Or email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </div>
  );
}
