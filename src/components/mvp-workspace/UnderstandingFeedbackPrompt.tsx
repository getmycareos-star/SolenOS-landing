"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  UNDERSTANDING_FEEDBACK_QUESTION,
  UNDERSTANDING_MISUNDERSTAND_OPTIONS,
  SUPPORT_EMAIL,
} from "@/lib/early-access-trust";

type Props = {
  careKey: string;
  situationId?: string | null;
  rawInputExcerpt?: string | null;
};

type Step = "ask" | "details" | "thanks" | "hidden";

/**
 * Post-response research prompt — learning over polish.
 */
export function UnderstandingFeedbackPrompt({
  careKey,
  situationId,
  rawInputExcerpt,
}: Props) {
  const [step, setStep] = useState<Step>("ask");
  const [option, setOption] = useState<string>("");
  const [expected, setExpected] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = useCallback(
    async (helped: boolean, details?: { option?: string; expected?: string }) => {
      if (!careKey.trim() || saving) return;
      setSaving(true);
      try {
        await fetch("/api/research-feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            care_key: careKey.trim(),
            helped_understand: helped,
            missed: details?.option,
            expected_understanding: details?.expected,
            situation_id: situationId ?? undefined,
            raw_input_excerpt: rawInputExcerpt ?? undefined,
          }),
        });
      } catch {
        /* best-effort */
      } finally {
        setSaving(false);
        setStep("thanks");
      }
    },
    [careKey, rawInputExcerpt, saving, situationId],
  );

  if (step === "hidden") return null;

  if (step === "thanks") {
    return (
      <p className="panel-muted research-feedback-thanks" role="status">
        Thank you — that helps improve SolenOS.
        <button type="button" className="link-button" onClick={() => setStep("hidden")}>
          Dismiss
        </button>
      </p>
    );
  }

  if (step === "details") {
    return (
      <div className="research-feedback" aria-label="What SolenOS misunderstood">
        <p className="workspace-lede">What did SolenOS misunderstand?</p>
        <ul className="research-feedback-options">
          {UNDERSTANDING_MISUNDERSTAND_OPTIONS.map((opt) => (
            <li key={opt}>
              <label>
                <input
                  type="radio"
                  name="misunderstand"
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
          <span>What should SolenOS have understood? (optional)</span>
          <textarea
            rows={2}
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
            disabled={saving}
          />
        </label>
        <div className="situation-actions">
          <button
            type="button"
            className="workspace-primary"
            disabled={saving}
            onClick={() => void submit(false, { option, expected })}
          >
            Send feedback
          </button>
          <button
            type="button"
            className="workspace-secondary"
            disabled={saving}
            onClick={() => void submit(false)}
          >
            Skip details
          </button>
        </div>
        <p className="panel-muted">
          Or email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </div>
    );
  }

  return (
    <div className="research-feedback" aria-label="Understanding feedback">
      <p className="workspace-lede">{UNDERSTANDING_FEEDBACK_QUESTION}</p>
      <div className="situation-actions">
        <button
          type="button"
          className="workspace-secondary"
          disabled={saving}
          onClick={() => void submit(true)}
          aria-label="Helpful"
        >
          Helpful
        </button>
        <button
          type="button"
          className="workspace-secondary"
          disabled={saving}
          onClick={() => setStep("details")}
          aria-label="Needs improvement"
        >
          Needs improvement
        </button>
      </div>
      <p className="panel-muted">
        <Link href="/support">Help</Link>
        {" · "}
        <a href={`mailto:${SUPPORT_EMAIL}?subject=Help%20improve%20SolenOS`}>
          Report misunderstanding
        </a>
      </p>
    </div>
  );
}
