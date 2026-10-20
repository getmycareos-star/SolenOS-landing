"use client";

import { useState } from "react";
import Link from "next/link";
import { canSubmitEarlyAccessConsent } from "@/lib/trust-content/early-access-consent";

/**
 * Early-access join: awareness + consent, not a legal wall.
 * Submit stays disabled until Terms + Privacy are checked.
 * Document links open in a new tab so the form context is preserved.
 */
export function EarlyAccessConsentForm({
  continueHref = "/workspace?enter=1",
  continueLabel = "Begin your Living Care Record",
  onConsentDone,
}: {
  continueHref?: string;
  continueLabel?: string;
  /** Optional — called after consent is recorded (used by the onboarding gate). */
  onConsentDone?: () => void;
}) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const ready = canSubmitEarlyAccessConsent({
    termsAccepted,
    privacyAccepted,
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    // Consent is persisted via the single onboarding_complete flag (localStorage),
    // owned by the OnboardingGate. No second consent state is written here.
    onConsentDone?.();
    if (continueHref) {
      window.location.assign(continueHref);
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
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          aria-required="true"
        />
        <span>
          I agree to the SolenOS{" "}
          <Link href="/terms" target="_blank" rel="noopener noreferrer">
            Terms of Service
          </Link>
        </span>
      </label>

      <label className="early-access-consent-check">
        <input
          type="checkbox"
          checked={privacyAccepted}
          onChange={(e) => setPrivacyAccepted(e.target.checked)}
          aria-required="true"
        />
        <span>
          I have read and understand the SolenOS{" "}
          <Link href="/privacy" target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </Link>
        </span>
      </label>

      <div className="early-access-consent-actions">
        <button
          type="submit"
          className="public-cta-primary early-access-consent-submit"
          disabled={!ready}
        >
          {continueLabel}
        </button>
        <Link href="/how-it-works#first-use" className="public-cta-secondary">
          What happens first
        </Link>
      </div>
    </form>
  );
}
