"use client";

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

  const submit = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const key = careKey?.trim() || "anonymous_feedback";
      const helped = option === "Response was helpful";
      await fetch("/api/research-feedback", {
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
    } catch {
      /* best-effort */
    } finally {
      setSaving(false);
      setDone(true);
    }
  }, [careKey, note, option, saving]);

  if (done) {
    return (
      <p className="panel-muted help-improve-thanks" role="status">
        Thank you — that helps improve SolenOS.
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
