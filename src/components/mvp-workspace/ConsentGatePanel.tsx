"use client";

import { apiUrl, safeJson } from "@/lib/api-url";
import { ensureAnonymousSession } from "@/api/client";
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
  onStatusChange?: (status: "required" | "accepted" | "unavailable") => void;
};

export function ConsentGatePanel({ caregiverId, onConsentAccepted, onStatusChange }: Props) {
  const [status, setStatus] = useState<ConsentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [requiredAck, setRequiredAck] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await ensureAnonymousSession();
      const res = await fetch(apiUrl(`/api/v1/consent?person_id=${encodeURIComponent(session.person.id)}`), {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Could not load consent status.");
      const data = (await res.json()) as ConsentStatus;
      // Fail closed: HTTP success alone is not proof of verified consent.
      const confirmed = data.verified === true && data.required === false;
      setStatus(confirmed ? data : { ...data, required: true });
      onStatusChange?.(confirmed ? "accepted" : "required");
    } catch {
      // A failed status read must not replace the acknowledgement form with a dead-end.
      // Keep the required confirmations available; the POST below is authoritative.
      setError(null);
      setStatus({
        verified: false,
        required: true,
        terms_version: "2026-10",
        one_line_agreement: "SolenOS organizes caregiver-reported information and does not replace clinical judgment.",
        data_improvement_statement: "Data improvement is optional and can be changed later.",
        no_advertising_statement: "Your care information is not sold or used for advertising.",
        signup_improvement_copy: "You can help improve SolenOS only if you choose to opt in.",
      });
      onStatusChange?.("required");
    } finally {
      setLoading(false);
    }
  }, [caregiverId, onStatusChange]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function handleAccept(event?: React.FormEvent, accepted = requiredAck) {
    event?.preventDefault();
    if (!accepted) return;
    setSubmitting(true);
    setError(null);

    try {
      const session = await ensureAnonymousSession();
      const res = await fetch(apiUrl("/api/v1/consent"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          person_id: session.person.id,
          caregiver_id: session.caregiver.id,
          medical_disclaimer_acknowledged: accepted,
          privacy_model_acknowledged: accepted,
          multi_caregiver_acknowledged: accepted,
          no_advertising_acknowledged: accepted,
          accepted_terms_version: status?.terms_version,
        }),
      });

      const data = (await safeJson(res)) as ConsentStatus & { ok?: boolean; error?: string; detail?: string };
      if (!res.ok) throw new Error(data.detail ?? data.error ?? "Your privacy acknowledgement could not be saved. Please try again.");
      if (data.verified !== true || data.required !== false) {
        throw new Error("SolenOS has not confirmed the required acknowledgement yet. Please try again.");
      }

      // The authenticated server response confirms the persisted write. Open immediately
      // from that confirmation; a second GET must not block the caregiver.
      setStatus(data);
      setError(null);
      onStatusChange?.("accepted");
      onConsentAccepted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Consent submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;
  if (!status) return null;
  if (!status.required) return null;

  return (
    <section className="panel consent-gate-panel" aria-label="Privacy and consent">
      <h2 className="workspace-headline">One quick confirmation</h2>
      <p className="workspace-lede">
        Before you begin, please confirm you agree to how SolenOS treats your information. This is required once; optional improvement feedback is available separately in Settings.
      </p>

      <form onSubmit={handleAccept} className="consent-gate-form">
<label className="consent-checkbox">
          <input
            type="checkbox"
            checked={requiredAck}
            disabled={submitting}
            onChange={(e) => {
              const checked = e.target.checked;
              setRequiredAck(checked);
              if (checked) void handleAccept(undefined, true);
              else setError(null);
            }}
          />
          <span>
            I agree to the SolenOS{" "}
            <Link href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</Link>
            {" "}and confirm that I have read and understand the{" "}
            <Link href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>.
            I understand my care information is not sold or used for advertising.
          </span>
        </label>



        {submitting && <p className="panel-muted" role="status">Saving your acknowledgement…</p>}
        {error && (
          <>
            <p role="alert" className="consent-error">{error}</p>
            <button type="submit" className="workspace-primary" disabled={!requiredAck || submitting}>
              {submitting ? "Saving…" : "Retry and open Living Care Record"}
            </button>
          </>
        )}
      </form>
    </section>
  );
}
