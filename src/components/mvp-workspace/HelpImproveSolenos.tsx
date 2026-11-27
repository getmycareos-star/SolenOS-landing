"use client";

import { apiUrl } from "@/lib/api-url";
import { ensureAnonymousSession } from "@/api/client";
import { caregiverSafeErrorMessage } from "@/lib/caregiver-language";
import { useCallback, useRef, useState } from "react";
import {
  GLOBAL_FEEDBACK_LABEL,
  GLOBAL_FEEDBACK_OPTIONS,
  GLOBAL_FEEDBACK_PROMPT,
} from "@/lib/mvp-faq";
import { SUPPORT_EMAIL } from "@/lib/early-access-trust";

type Props = {
  compact?: boolean;
};

/**
 * Optional improvement feedback. In-app submission is gated by explicit
 * data-improvement consent and never attaches the caregiver's full record.
 */
export function HelpImproveSolenos({ compact }: Props) {
  const [open, setOpen] = useState(false);
  const [option, setOption] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submissionInFlightRef = useRef(false);

  const submit = useCallback(async () => {
    if (saving || submissionInFlightRef.current) return;
    submissionInFlightRef.current = true;
    setSaving(true);
    setSubmitError(null);
    try {
      const session = await ensureAnonymousSession();
      const consentResponse = await fetch(
        apiUrl(`/api/v1/consent?person_id=${encodeURIComponent(session.person.id)}`),
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        },
      );
      if (!consentResponse.ok) throw new Error("We couldn't verify your improvement-feedback permission.");
      const consent = (await consentResponse.json()) as {
        verified?: boolean;
        profile?: { data_improvement_consent?: boolean };
      };
      if (!consent.verified || consent.profile?.data_improvement_consent !== true) {
        throw new Error("Turn on optional improvement feedback in Privacy settings before sending feedback.");
      }

      // Preserve the caregiver's selected feedback category as-is. These
      // categories include usability issues and ideas, not only response quality.
      const detail = JSON.stringify({
        feedback_category: option,
        message: note.trim() || undefined,
        source: "early_access_feedback",
        app_version: "0.1.0",
        route: window.location.pathname,
      });
      const res = await fetch(apiUrl("/api/v1/feedback"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          person_id: session.person.id,
          caregiver_id: session.caregiver.id,
          category: "help_improve",
          detail,
        }),
      });
      if (!res.ok) {
        // Do not expose raw backend errors or implementation details in the
        // caregiver interface. A failed write is reported plainly.
        throw new Error("feedback_submission_failed");
      }
      // Only claim the feedback was recorded once the request actually succeeds.
      setDone(true);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "Turn on optional improvement feedback in Privacy settings before sending feedback.") {
        setSubmitError(code);
      } else if (code === "We couldn't verify your improvement-feedback permission.") {
        setSubmitError(code);
      } else {
        setSubmitError(caregiverSafeErrorMessage());
      }
    } finally {
      submissionInFlightRef.current = false;
      setSaving(false);
    }
  }, [note, option, saving]);

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
      <p className="panel-muted">In-app feedback is stored only when you have enabled optional improvement feedback in Privacy settings. You can also email us directly without enabling that setting.</p>
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
        <small>Please avoid including names, contact details, or detailed medical information.</small>
        <textarea
          maxLength={10000}
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
