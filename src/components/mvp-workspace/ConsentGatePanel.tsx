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
  const [dataImprovement, setDataImprovement] = useState(false);

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
      setStatus(data);
      onStatusChange?.(data.required ? "required" : "accepted");
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
          data_improvement_consent: dataImprovement,
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
      <h2 className="workspace-headline">One privacy acknowledgement</h2>
      <p className="workspace-lede">
        Confirm the required terms once. After SolenOS confirms the save, your Living Care Record opens immediately.
      </p>

      <form onSubmit={handleAccept} className="consent-gate-form">
        <fieldset className="consent-optional">
          <legend>Optional — help improve SolenOS</legend>
          <p className="panel-muted">
            This choice is separate from using SolenOS to maintain the care record you request.
            It is off unless you tick the box below.
          </p>
          <h3>What may be used if you opt in</h3>
          <ul>
            <li>Feedback you deliberately submit to help improve or validate SolenOS.</li>
            <li>The feedback category and related details needed to review that submission.</li>
          </ul>
          <h3>What this checkbox does not permit</h3>
          <ul>
            <li>Publishing your care record or sharing it with other caregivers.</li>
            <li>Selling personal information or using it for targeted advertising.</li>
            <li>Automatically submitting every private care note, document, or Companion conversation as improvement feedback.</li>
          </ul>
          <p className="panel-muted">
            SolenOS must continue to protect access to care information and remove direct identifiers
            where appropriate. You can change this optional choice later in Settings → Privacy &amp; Data.
          </p>
          <label className="consent-checkbox">
            <input
              type="checkbox"
              checked={dataImprovement}
              onChange={(e) => setDataImprovement(e.target.checked)}
            />
            <span>Yes, allow feedback I submit for improvement to be used for that purpose.</span>
          </label>
        </fieldset>

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
            I have read and accept the SolenOS{" "}
            <Link href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</Link>
            {" "}and{" "}
            <Link href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>.
            I understand SolenOS does not provide medical or emergency guidance, trusted contributors
            may add notes to this Care Reality, and my care information is not sold or used for advertising.
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
