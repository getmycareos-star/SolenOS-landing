"use client";

import { useState } from "react";
import Link from "next/link";
import { ensureAnonymousSession } from "@/api/client";
import { apiUrl, safeJson } from "@/lib/api-url";
import { canSubmitEarlyAccessConsent } from "@/lib/trust-content/early-access-consent";
import type { SolenOSUiLanguage } from "@/lib/language-preference";

/**
 * One required checkbox covers both linked legal documents. The server confirms
 * the acknowledgement before local onboarding is marked complete.
 */
const CONSENT_COPY: Record<SolenOSUiLanguage, {
  lead: string;
  agreeStart: string;
  terms: string;
  agreeMiddle: string;
  privacy: string;
  agreeEnd: string;
  saving: string;
  whatFirst: string;
  verificationError: string;
  saveError: string;
  legalEnglish: string;
}> = {
  en: {
    lead: "Before you begin, please confirm you agree to how SolenOS handles your information.",
    agreeStart: "I agree to the SolenOS",
    terms: "Terms of Service",
    agreeMiddle: "and confirm that I have read and understand the",
    privacy: "Privacy Policy",
    agreeEnd: ".",
    saving: "Saving your acknowledgement…",
    whatFirst: "{copy.whatFirst}",
    verificationError: "We couldn’t verify your acknowledgement. Please try again.",
    saveError: "Your acknowledgement could not be saved. Please try again.",
    legalEnglish: "",
  },
  es: {
    lead: "Antes de comenzar, confirma que aceptas cómo SolenOS trata tu información.",
    agreeStart: "Acepto los",
    terms: "Términos del servicio",
    agreeMiddle: "de SolenOS y confirmo que he leído y entiendo la",
    privacy: "Política de privacidad",
    agreeEnd: ".",
    saving: "Guardando tu confirmación…",
    whatFirst: "Qué sucede primero",
    verificationError: "No pudimos verificar tu confirmación. Inténtalo de nuevo.",
    saveError: "No se pudo guardar tu confirmación. Inténtalo de nuevo.",
    legalEnglish: "Los documentos legales están disponibles en inglés.",
  },
  fr: {
    lead: "Avant de commencer, veuillez confirmer que vous acceptez la manière dont SolenOS traite vos informations.",
    agreeStart: "J’accepte les",
    terms: "Conditions d’utilisation",
    agreeMiddle: "de SolenOS et confirme avoir lu et compris la",
    privacy: "Politique de confidentialité",
    agreeEnd: ".",
    saving: "Enregistrement de votre confirmation…",
    whatFirst: "Que se passe-t-il d’abord",
    verificationError: "Nous n’avons pas pu vérifier votre confirmation. Veuillez réessayer.",
    saveError: "Votre confirmation n’a pas pu être enregistrée. Veuillez réessayer.",
    legalEnglish: "Les documents juridiques sont actuellement disponibles en anglais.",
  },
};

export function EarlyAccessConsentForm({
  continueHref = "/workspace?enter=1",
  continueLabel = "Begin your Living Care Record",
  onConsentDone,
  language = "en",
}: {
  continueHref?: string;
  continueLabel?: string;
  onConsentDone?: () => void;
  language?: SolenOSUiLanguage;
}) {
  const copy = CONSENT_COPY[language];
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
        throw new Error(copy.verificationError);
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
          throw new Error(copy.saveError);
        }
      }

      // OnboardingGate persists the one-time local flag only after the server
      // has confirmed the required acknowledgement.
      onConsentDone?.();
      if (continueHref) window.location.assign(continueHref);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.saveError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="early-access-consent" onSubmit={handleSubmit} noValidate>
      <p className="early-access-consent-lead">
        {copy.lead}
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
          {copy.agreeStart}{" "}
          <Link href="/terms" target="_blank" rel="noopener noreferrer">
            {copy.terms}
          </Link>{" "}
          {copy.agreeMiddle}{" "}
          <Link href="/privacy" target="_blank" rel="noopener noreferrer">
            {copy.privacy}
          </Link>{copy.agreeEnd}
        </span>
      </label>

      {error && <p className="early-access-consent-error" role="alert">{error}</p>}

      {copy.legalEnglish && <p className="onboarding-legal-note">{copy.legalEnglish}</p>}
      <div className="early-access-consent-actions">
        <button
          type="submit"
          className="public-cta-primary early-access-consent-submit"
          disabled={!ready || submitting}
        >
          {submitting ? copy.saving : continueLabel}
        </button>
        <Link href="/how-it-works#first-use" className="public-cta-secondary">
          {copy.whatFirst}
        </Link>
      </div>
    </form>
  );
}
