"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SolenosWordmark } from "@/components/brand";
import { LanguagePreferenceSelect } from "@/components/language-selector/LanguagePreferenceSelect";
import { coerceSolenOSUiLanguage, type SolenOSUiLanguage } from "@/lib/language-preference";
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
const ONBOARDING_COPY: Record<SolenOSUiLanguage, {
  title: string;
  lede: string;
  privacy: string;
  begin: string;
  consentTitle: string;
  continue: string;
  terms: string;
  privacyLink: string;
  loading: string;
}> = {
  en: {
    title: "Your care, in one place.",
    lede: "Keep the important parts of someone’s care journey organized — notes, documents, and what changed over time. No memory required.",
    privacy: "Your care information stays private. It is not sold or used for advertising.",
    begin: "Begin",
    consentTitle: "One quick confirmation",
    continue: "Continue to SolenOS",
    terms: "Terms",
    privacyLink: "Privacy",
    loading: "Loading…",
  },
  es: {
    title: "El cuidado de tu ser querido, en un solo lugar.",
    lede: "Organiza lo importante del cuidado de alguien: notas, documentos y cambios a lo largo del tiempo. No tienes que recordarlo todo.",
    privacy: "Tu información de cuidado es privada. No se vende ni se usa para publicidad.",
    begin: "Comenzar",
    consentTitle: "Una confirmación rápida",
    continue: "Continuar a SolenOS",
    terms: "Términos",
    privacyLink: "Privacidad",
    loading: "Cargando…",
  },
  fr: {
    title: "Les soins de votre proche, au même endroit.",
    lede: "Gardez les éléments importants du parcours de soins au même endroit : notes, documents et changements au fil du temps. Vous n’avez pas à tout mémoriser.",
    privacy: "Vos informations de soins restent privées. Elles ne sont ni vendues ni utilisées à des fins publicitaires.",
    begin: "Commencer",
    consentTitle: "Une brève confirmation",
    continue: "Continuer vers SolenOS",
    terms: "Conditions",
    privacyLink: "Confidentialité",
    loading: "Chargement…",
  },
};

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<SolenOSUiLanguage>("en");
  const [phase, setPhase] = useState<"loading" | "welcome" | "consent" | "done">(
    "loading",
  );

  useEffect(() => {
    const syncLanguage = () => {
      try {
        const next = coerceSolenOSUiLanguage(window.localStorage.getItem("solenos_language_preference"));
        setLanguage(next);
        document.documentElement.lang = next;
      } catch {
        setLanguage("en");
        document.documentElement.lang = "en";
      }
    };
    syncLanguage();
    window.addEventListener("solenos:language-change", syncLanguage);
    window.addEventListener("storage", syncLanguage);
    return () => {
      window.removeEventListener("solenos:language-change", syncLanguage);
      window.removeEventListener("storage", syncLanguage);
    };
  }, []);

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
        <span className="mobile-loading-text">{ONBOARDING_COPY[language].loading}</span>
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
            <LanguagePreferenceSelect />
            <SolenosWordmark size="lg" className="onboarding-brand" />
            <h1 className="onboarding-title">{ONBOARDING_COPY[language].title}</h1>
            <p className="onboarding-lede">{ONBOARDING_COPY[language].lede}</p>
            <div className="onboarding-trust-signal">
              <span aria-hidden="true">🔒</span> {ONBOARDING_COPY[language].privacy}
            </div>
            <Button variant="primary" className="onboarding-cta" onClick={handleStart}>
              {ONBOARDING_COPY[language].begin}
            </Button>
          </section>
        ) : (
          <section className="onboarding-consent">
            <LanguagePreferenceSelect />
            <h2 className="onboarding-title">{ONBOARDING_COPY[language].consentTitle}</h2>
            <EarlyAccessConsentForm
              continueHref=""
              continueLabel={ONBOARDING_COPY[language].continue}
              language={language}
              onConsentDone={handleConsentDone}
            />
            <p className="onboarding-legal-note">
              <Link href="/terms">{ONBOARDING_COPY[language].terms}</Link> · <Link href="/privacy">{ONBOARDING_COPY[language].privacyLink}</Link>
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
