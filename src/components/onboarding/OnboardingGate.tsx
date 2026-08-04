"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SolenosWordmark } from "@/components/brand";
import { Button } from "@/components/ui/Button";
import { EarlyAccessConsentForm } from "@/components/public/EarlyAccessConsentForm";
import {
  hasCompletedOnboarding,
  markOnboardingComplete,
  markOnboardingCompleteAt,
} from "@/lib/onboarding";

/**
 * First-time onboarding gate.
 * One flow: welcome → privacy consent checkbox → app shell.
 * Persists a single `onboarding_complete` flag. Once done, every future
 * open goes straight to the app shell (no welcome/back/refresh/deep-link).
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<"loading" | "welcome" | "consent" | "done">(
    "loading",
  );

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
    markOnboardingComplete();
    markOnboardingCompleteAt();
    setPhase("done");
  }, []);

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
      <main className="mobile-app-main onboarding-main">
        {phase === "welcome" ? (
          <section className="onboarding-welcome">
            <SolenosWordmark size="lg" className="onboarding-brand" />
            <h1 className="onboarding-title">Your care, in one place.</h1>
            <p className="onboarding-lede">
              Keep the important parts of someone&apos;s care journey organized — notes,
              documents, and what changed over time. No memory required.
            </p>
            <div className="onboarding-trust-signal">
              <span aria-hidden="true">🔒</span> Your data stays private.
            </div>
            <Button variant="primary" className="onboarding-cta" onClick={handleStart}>
              Begin
            </Button>
          </section>
        ) : (
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
        )}
      </main>
    </div>
  );
}
