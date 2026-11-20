"use client";

import { apiUrl } from "@/lib/api-url";
import { ensureAnonymousSession } from "@/api/client";
import { caregiverSafeErrorMessage } from "@/lib/caregiver-language";
import { useCallback, useEffect, useState } from "react";
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
type ConsentState = "checking" | "allowed" | "not_allowed" | "error";

export function UnderstandingFeedbackPrompt({
  careKey,
  situationId,
  rawInputExcerpt,
}: Props) {
  const [step, setStep] = useState<Step>("ask");
  const [consentState, setConsentState] = useState<ConsentState>("checking");
  const [option, setOption] = useState<string>("");
  const [expected, setExpected] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadConsent = useCallback(async () => {
    setConsentState("checking");
    try {
      const session = await ensureAnonymousSession();
      const response = await fetch(
        apiUrl(`/api/v1/consent?person_id=${encodeURIComponent(session.person.id)}`),
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        },
      );
      if (!response.ok) throw new Error("Could not verify your privacy choice.");
      const consent = (await response.json()) as {
        verified?: boolean;
        profile?: { data_improvement_consent?: boolean };
      };
      setConsentState(
        consent.verified && consent.profile?.data_improvement_consent === true
          ? "allowed"
          : "not_allowed",
      );
    } catch {
      setConsentState("error");
    }
  }, []);

  useEffect(() => {
    void loadConsent();
  }, [loadConsent]);

  const submit = useCallback(
    async (helped: boolean, details?: { option?: string; expected?: string }) => {
      if (!careKey.trim() || saving) return;
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
        if (!consentResponse.ok) {
          throw new Error("We couldn't verify your privacy choice. No feedback was sent.");
        }
        const consent = (await consentResponse.json()) as {
          verified?: boolean;
          profile?: { data_improvement_consent?: boolean };
        };
        if (!consent.verified || consent.profile?.data_improvement_consent !== true) {
          setConsentState("not_allowed");
          return;
        }

        const detail = JSON.stringify({
          care_key: careKey.trim(),
          helped_understand: helped,
          missed: details?.option,
          expected_understanding: details?.expected,
          situation_id: situationId ?? undefined,
          raw_input_excerpt: rawInputExcerpt ?? undefined,
          source: "post_response_understanding_prompt",
        });
        const query = new URLSearchParams({
          person_id: session.person.id,
          caregiver_id: session.caregiver.id,
          category: "human_validation",
          detail,
        });
        const response = await fetch(
          apiUrl(`/api/v1/feedback?${query.toString()}`),
          {
            method: "POST",
            headers: { Authorization: `Bearer ${session.access_token}` },
          },
        );
        if (response.status === 403) {
          setConsentState("not_allowed");
          return;
        }
        if (!response.ok) {
          const failure = (await response.json().catch(() => ({}))) as {
            detail?: string;
            error?: string;
          };
          throw new Error(
            failure.detail ?? failure.error ?? "We couldn't send your feedback right now.",
          );
        }
        setStep("thanks");
      } catch {
        setSubmitError(
          caregiverSafeErrorMessage(),
        );
      } finally {
        setSaving(false);
      }
    },
    [careKey, rawInputExcerpt, saving, situationId],
  );

  if (step === "hidden") return null;

  if (consentState === "checking") {
    return (
      <p className="panel-muted" role="status">
        Checking your privacy choice…
      </p>
    );
  }

  if (consentState === "error") {
    return (
      <p className="workspace-error" role="alert">
        We couldn't check your privacy choice. No feedback has been sent.{" "}
        <button type="button" className="link-button" onClick={() => void loadConsent()}>
          Try again
        </button>
      </p>
    );
  }

  if (consentState === "not_allowed") {
    return (
      <p className="panel-muted research-feedback-consent">
        Feedback sharing is off. To send feedback, turn on optional feedback sharing in{" "}
        <Link href="/workspace/settings">Privacy settings</Link>.
      </p>
    );
  }

  if (step === "thanks") {
    return (
      <p className="panel-muted research-feedback-thanks" role="status">
        Thank you — your feedback helps our team improve future versions of SolenOS.
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
          {UNDERSTANDING_MISUNDERSTAND_OPTIONS.map((item) => (
            <li key={item}>
              <label>
                <input
                  type="radio"
                  name="misunderstand"
                  checked={option === item}
                  onChange={() => setOption(item)}
                  disabled={saving}
                />
                {item}
              </label>
            </li>
          ))}
        </ul>
        <label className="research-feedback-field">
          <span>What should SolenOS have understood? (optional)</span>
          <textarea
            rows={2}
            value={expected}
            onChange={(event) => setExpected(event.target.value)}
            disabled={saving}
          />
        </label>
        {submitError && (
          <p className="workspace-error" role="alert">
            {submitError}
          </p>
        )}
        <div className="situation-actions">
          <button
            type="button"
            className="workspace-primary"
            disabled={saving}
            onClick={() => void submit(false, { option, expected })}
          >
            {saving ? "Sending…" : "Send feedback"}
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
          Or email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
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
      {submitError && (
        <p className="workspace-error" role="alert">
          {submitError}
        </p>
      )}
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
