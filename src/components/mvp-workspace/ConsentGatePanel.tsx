"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type ConsentStatus = {
  verified: boolean;
  required: boolean;
  terms_version: string;
  one_line_agreement: string;
  data_improvement_statement: string;
  no_advertising_statement: string;
  signup_improvement_copy: string;
};

type Props = {
  caregiverId: string;
  onConsentAccepted?: () => void;
};

export function ConsentGatePanel({ caregiverId, onConsentAccepted }: Props) {
  const [status, setStatus] = useState<ConsentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [medicalAck, setMedicalAck] = useState(false);
  const [privacyAck, setPrivacyAck] = useState(false);
  const [multiCaregiverAck, setMultiCaregiverAck] = useState(false);
  const [noAdvertisingAck, setNoAdvertisingAck] = useState(false);
  const [dataImprovement, setDataImprovement] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/policy/consent?user_id=${encodeURIComponent(caregiverId)}`);
      const data = (await res.json()) as ConsentStatus;
      setStatus(data);
    } catch {
      setError("Could not load consent status.");
    } finally {
      setLoading(false);
    }
  }, [caregiverId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function handleAccept(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/policy/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: caregiverId,
          medical_disclaimer_acknowledged: medicalAck,
          privacy_model_acknowledged: privacyAck,
          multi_caregiver_acknowledged: multiCaregiverAck,
          no_advertising_acknowledged: noAdvertisingAck,
          data_improvement_consent: dataImprovement,
          accepted_terms_version: status?.terms_version,
        }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Consent submission failed");

      await loadStatus();
      onConsentAccepted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Consent submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;
  if (!status || !status.required) return null;

  const mandatoryReady =
    termsAccepted && medicalAck && privacyAck && multiCaregiverAck && noAdvertisingAck;

  return (
    <section className="panel consent-gate-panel" aria-label="Privacy and consent">
      <h2 className="workspace-headline">A few confirmations</h2>
      <p className="workspace-lede">
        We respect your information. Please confirm these basics — you can open Privacy and Terms
        anytime.
      </p>

      <form onSubmit={handleAccept} className="consent-gate-form">
        <label className="consent-checkbox">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
          />
          <span>
            {status.one_line_agreement}{" "}
            <Link href="/terms" target="_blank" rel="noopener noreferrer">
              Terms of Service
            </Link>
          </span>
        </label>

        <label className="consent-checkbox">
          <input
            type="checkbox"
            checked={medicalAck}
            onChange={(e) => setMedicalAck(e.target.checked)}
          />
          <span>I acknowledge SolenOS does not provide medical advice or emergency guidance.</span>
        </label>

        <label className="consent-checkbox">
          <input
            type="checkbox"
            checked={privacyAck}
            onChange={(e) => setPrivacyAck(e.target.checked)}
          />
          <span>
            I have read and understand the SolenOS{" "}
            <Link href="/privacy" target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </Link>
            . The Living Care Record belongs to the person receiving care. Trusted contributors
            may add to the same Care Reality; SolenOS keeps who contributed for understanding —
            it is not a family chat.
          </span>
        </label>

        <label className="consent-checkbox">
          <input
            type="checkbox"
            checked={multiCaregiverAck}
            onChange={(e) => setMultiCaregiverAck(e.target.checked)}
          />
          <span>
            I accept that other trusted contributors may add notes to this Care Reality
            without turning SolenOS into a messaging feed.
          </span>
        </label>

        <label className="consent-checkbox">
          <input
            type="checkbox"
            checked={noAdvertisingAck}
            onChange={(e) => setNoAdvertisingAck(e.target.checked)}
          />
          <span>{status.no_advertising_statement}</span>
        </label>

        <fieldset className="consent-optional">
          <legend>Optional</legend>
          <p className="panel-muted">{status.signup_improvement_copy}</p>
          <label className="consent-checkbox">
            <input
              type="checkbox"
              checked={dataImprovement}
              onChange={(e) => setDataImprovement(e.target.checked)}
            />
            <span>{status.data_improvement_statement}</span>
          </label>
        </fieldset>

        {error && <p className="consent-error">{error}</p>}

        <button type="submit" className="workspace-primary" disabled={!mandatoryReady || submitting}>
          {submitting ? "Recording consent…" : "Accept and continue"}
        </button>
      </form>
    </section>
  );
}
