"use client";

import { useState } from "react";
import Link from "next/link";
import { ensureAnonymousSession } from "@/api/client";
import { apiUrl, safeJson } from "@/lib/api-url";
import { canSubmitEarlyAccessConsent } from "@/lib/trust-content/early-access-consent";

/**
 * One required checkbox covers both linked legal documents. The server confirms
 * the acknowledgement before local onboarding is marked complete.
 */
export function EarlyAccessConsentForm({
  continueHref = "/workspace?enter=1",
  continueLabel = "Begin your Living Care Record",
  onConsentDone,
}: {
  continueHref?: string;
  continueLabel?: string;
  onConsentDone?: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = canSubmitEarlyAccessConsent({
    termsAccepted: acknowledged,
    privacyAccepted: acknowledged,
  });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const session = await ensureAnonymousSession();
      const statusRes = await fetch(
        apiUrl(`/api/v1/consent?person_id=${encodeURIComponent(session.person.id)}`),
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        },
      );
      const status = (await safeJson(statusRes)) as {
        required?: boolean;
        terms_version?: string;
        detail?: string;
        error?: string;
      };
      if (!statusRes.ok) {
        throw new Error(status.detail ?? status.error ?? "Could not verify your privacy acknowledgement.");
      }

      if (status.required !== false) {
        const consentRes = await fetch(apiUrl("/api/v1/consent"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            person_id: session.person.id,
            caregiver_id: session.caregiver.id,
            medical_disclaimer_acknowledged: true,
            privacy_model_acknowledged: true,
            multi_caregiver_acknowledged: true,
            no_advertising_acknowledged: true,
            data_improvement_consent: false,
            accepted_terms_version: status.terms_version ?? "2026-10",
          }),
        });
        const saved = (await safeJson(consentRes)) as {
          verified?: boolean;
          required?: boolean;
          detail?: string;
          error?: string;
        };
        if (!consentRes.ok || saved.verified !== true || saved.required !== false) {
          throw new Error(saved.detail ?? saved.error ?? "SolenOS could not confirm that your acknowledgement was saved. Please try again.");
        }
      }

      // OnboardingGate persists the one-time local flag only after the server
      // has confirmed the required acknowledgement.
      onConsentDone?.();
      if (continueHref) window.location.assign(continueHref);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your acknowledgement could not be saved. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="early-access-consent" onSubmit={handleSubmit} noValidate>
      <p className="early-access-consent-lead">
        Before you begin, please confirm you agree to how SolenOS treats your information.
      </p>

      <label className="early-access-consent-check">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
          disabled={submitting}
          aria-required="true"
        />
        <span>
          I agree to the SolenOS{" "}
          <Link href="/terms" target="_blank" rel="noopener noreferrer">
            Terms of Service
          </Link>{" "}
          and confirm that I have read and understand the{" "}
          <Link href="/privacy" target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </Link>.
        </span>
      </label>

      {error && <p className="early-access-consent-error" role="alert">{error}</p>}

      <div className="early-access-consent-actions">
        <button
          type="submit"
          className="public-cta-primary early-access-consent-submit"
          disabled={!ready || submitting}
        >
          {submitting ? "Saving your acknowledgement…" : continueLabel}
        </button>
        <Link href="/how-it-works#first-use" className="public-cta-secondary">
          What happens first
        </Link>
      </div>
    </form>
  );
}
