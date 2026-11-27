"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SolenosWordmark } from "@/components/brand";
import { Button } from "@/components/ui/Button";
import { EarlyAccessConsentForm } from "@/components/public/EarlyAccessConsentForm";
import { ensureAnonymousSession, putJSON } from "@/api/client";
import {
  hasCompletedOnboarding,
  markOnboardingComplete,
  markOnboardingCompleteAt,
} from "@/lib/onboarding";

/**
 * First-time caregiver entry. Consent is acknowledged first; recipient details
 * are saved through the existing bearer-scoped care-profile API. The profile
 * step can be skipped and completed later in Settings.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<"loading" | "welcome" | "consent" | "profile" | "done">(
    "loading",
  );
  const [recipientName, setRecipientName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    if (hasCompletedOnboarding()) {
      setPhase("done");
    } else {
      setPhase("welcome");
    }
  }, []);

  const handleStart = useCallback(() => {
    setPhase("consent");
  }, []);

  const handleConsentDone = useCallback(() => {
    setPhase("profile");
  }, []);

  const finishOnboarding = useCallback(() => {
    markOnboardingComplete();
    markOnboardingCompleteAt();
    setPhase("done");
  }, []);

  const saveRecipient = useCallback(async () => {
    const name = recipientName.trim();
    if (!name) {
      setProfileError("Enter the name you use for the person receiving care, or choose to do this later.");
      return;
    }
    setSavingProfile(true);
    setProfileError("");
    try {
      await ensureAnonymousSession();
      await putJSON("/care-profile", {
        name,
        relationship: relationship.trim(),
        condition: null,
      });
      finishOnboarding();
    } catch {
      setProfileError("We couldn't save these details. Check your connection and try again. You can also do this later in Settings.");
    } finally {
      setSavingProfile(false);
    }
  }, [finishOnboarding, recipientName, relationship]);

  if (phase === "loading") {
    return (
      <div className="mobile-loading">
        <div className="mobile-loading-spinner" aria-hidden="true" />
        <span className="mobile-loading-text">Loading…</span>
      </div>
    );
  }

  if (phase === "done") {
    return <>{children}</>;
  }

  return (
    <div className="mobile-app-shell onboarding-shell">
      <div className="mobile-app-main onboarding-main">
        {phase === "welcome" ? (
          <section className="onboarding-welcome">
            <SolenosWordmark size="lg" className="onboarding-brand" />
            <h1 className="onboarding-title">The care journey, remembered.</h1>
            <p className="onboarding-lede">
              Keep the important details about someone&apos;s care in one place.
              Record what happens, save documents and understand what has changed.
              Start with what you know. Add more when you are ready.
            </p>
            <div className="onboarding-trust-signal">
              <span aria-hidden="true">🔒</span> Your care information stays private. It is not sold or used for advertising.
            </div>
            <Button variant="primary" className="onboarding-cta" onClick={handleStart}>
              Get started
            </Button>
          </section>
        ) : phase === "consent" ? (
          <section className="onboarding-consent">
            <h2 className="onboarding-title">One quick confirmation</h2>
            <EarlyAccessConsentForm
              continueHref=""
              continueLabel="Continue to SolenOS"
              onConsentDone={handleConsentDone}
            />
            <p className="onboarding-legal-note">
              <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link>
            </p>
          </section>
        ) : (
          <section className="onboarding-consent" aria-labelledby="onboarding-recipient-title">
            <SolenosWordmark size="lg" className="onboarding-brand" />
            <p className="onboarding-eyebrow">YOUR CARE RECORD</p>
            <h1 className="onboarding-title" id="onboarding-recipient-title">Who are you caring for?</h1>
            <p className="onboarding-lede">
              Add a name so the care information is easy to recognise. You can add
              other details later, and you can change this at any time in Settings.
            </p>
            <label className="mobile-settings-label" htmlFor="onboarding-recipient-name">
              Their name
            </label>
            <input
              id="onboarding-recipient-name"
              className="mobile-settings-input"
              value={recipientName}
              maxLength={120}
              autoComplete="off"
              onChange={(event) => setRecipientName(event.target.value)}
              placeholder="Name or the name you call them"
              disabled={savingProfile}
            />
            <label className="mobile-settings-label" htmlFor="onboarding-relationship">
              Your relationship <span>(optional)</span>
            </label>
            <input
              id="onboarding-relationship"
              className="mobile-settings-input"
              value={relationship}
              maxLength={80}
              autoComplete="off"
              onChange={(event) => setRelationship(event.target.value)}
              placeholder="For example, daughter or spouse"
              disabled={savingProfile}
            />
            {profileError && <p role="alert" className="onboarding-lede">{profileError}</p>}
            <Button variant="primary" className="onboarding-cta" loading={savingProfile} disabled={savingProfile || !recipientName.trim()} onClick={() => void saveRecipient()}>
              Save and continue
            </Button>
            <Button variant="secondary" className="onboarding-cta" disabled={savingProfile} onClick={finishOnboarding}>
              I&apos;ll do this later
            </Button>
            <p className="onboarding-legal-note">
              Your Care Record brings together updates and documents over time.
              Some details may be incomplete or uncertain. SolenOS may help organise
              information, but AI suggestions are not confirmed medical facts.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
