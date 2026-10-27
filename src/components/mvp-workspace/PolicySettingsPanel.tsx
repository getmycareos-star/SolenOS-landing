"use client";

import { apiUrl, safeJson } from "@/lib/api-url";
import { ensureAnonymousSession } from "@/api/client";
import { useCallback, useEffect, useState } from "react";

type Props = {
  caregiverId?: string;
};

export function PolicySettingsPanel(_props: Props = {}) {
  const [dataImprovement, setDataImprovement] = useState(false);
  const [verified, setVerified] = useState(false);
  const [requiredAck, setRequiredAck] = useState(false);
  const [acknowledgementBusy, setAcknowledgementBusy] = useState(false);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  const [limitedMode, setLimitedMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const session = await ensureAnonymousSession();
      const res = await fetch(apiUrl(`/api/v1/consent?person_id=${encodeURIComponent(session.person.id)}`), {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Could not load consent status.");
      const data = (await safeJson(res)) as {
        verified?: boolean;
        profile?: { data_improvement_consent?: boolean; limited_mode?: boolean };
        consent?: { accepted_at?: string | null };
      };
      setVerified(Boolean(data.verified));
      setDataImprovement(Boolean(data.profile?.data_improvement_consent));
      setLimitedMode(Boolean(data.profile?.limited_mode));
      setAcceptedAt(data.consent?.accepted_at ?? null);
    } catch {
      setLoadError("We couldn't load your privacy choice. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function acknowledgeRequiredTerms() {
    if (!requiredAck || saving || loadError || verified) return;
    setSaving(true);
    setAcknowledgementBusy(true);
    setMessage(null);
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
          medical_disclaimer_acknowledged: true,
          privacy_model_acknowledged: true,
          multi_caregiver_acknowledged: true,
          no_advertising_acknowledged: true,
          data_improvement_consent: dataImprovement,
          accepted_terms_version: "2026-10",
        }),
      });
      const saved = (await safeJson(res)) as {
        verified?: boolean;
        required?: boolean;
        profile?: { data_improvement_consent?: boolean; limited_mode?: boolean };
        consent?: { accepted_at?: string | null };
        detail?: string;
        error?: string;
      };
      if (!res.ok || saved.verified !== true || saved.required !== false) {
        throw new Error(saved.detail ?? saved.error ?? "SolenOS did not confirm the acknowledgement.");
      }
      setVerified(true);
      setDataImprovement(Boolean(saved.profile?.data_improvement_consent));
      setLimitedMode(Boolean(saved.profile?.limited_mode));
      setAcceptedAt(saved.consent?.accepted_at ?? new Date().toISOString());
      setMessage("Required privacy acknowledgement saved. You can now change your optional improvement choice.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We couldn't save the acknowledgement. Please try again.");
    } finally {
      setSaving(false);
      setAcknowledgementBusy(false);
    }
  }

  async function toggleImprovement(enabled: boolean) {
    if (saving || loadError || limitedMode) return;
    setSaving(true);
    setMessage(null);
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
          action: "update_data_improvement",
          data_improvement_consent: enabled,
        }),
      });
      const saved = (await safeJson(res)) as {
        ok?: boolean;
        verified?: boolean;
        profile?: { data_improvement_consent?: boolean };
        detail?: string;
        error?: string;
      };
      if (
        !res.ok ||
        saved.profile?.data_improvement_consent !== enabled
      ) {
        throw new Error(saved.detail ?? saved.error ?? "The server did not confirm the saved choice.");
      }
      // Only update the visible switch after the server response confirms the persisted value.
      setDataImprovement(enabled);
      setMessage(
        enabled
          ? "Saved. New feedback you deliberately submit is eligible for SolenOS improvement review."
          : "Saved. New optional improvement feedback is blocked. Your personal care history and existing care continuity remain available.",
      );
    } catch {
      setMessage("We couldn't save this choice. Your previous saved setting remains in place.");
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="policy-settings-panel">
        <h4>Help improve SolenOS (optional)</h4>
        <p className="panel-muted" role="status">Checking your saved privacy choice…</p>
      </section>
    );
  }

  return (
    <section className="policy-settings-panel" aria-labelledby="improvement-consent-heading">
      <h4 id="improvement-consent-heading">Help improve SolenOS (optional)</h4>
      <p className="panel-muted">
        When this is on, feedback you deliberately submit and any context you choose to attach may be used in SolenOS's improvement review. This setting does not automatically send every private care note, document, or Companion conversation, and it does not mean an AI model's weights are retrained immediately. Your personal care history and the processing needed to provide the care features you request remain available whether this setting is on or off. You can change this choice here at any time.
      </p>

      {loadError && (
        <p className="panel-muted" role="alert">
          {loadError}{" "}
          <button type="button" className="workspace-secondary" onClick={() => void load()}>
            Try again
          </button>
        </p>
      )}
      {verified && acceptedAt && (
        <p className="panel-muted">
          Required privacy acknowledgement accepted on {new Date(acceptedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}.
        </p>
      )}
      {!verified && !loadError && !limitedMode && (
        <div className="policy-required-ack">
          <p className="panel-muted">
            The server has no confirmed required privacy acknowledgement for this care-record session. Confirm the Terms of Service and Privacy Policy below before changing the optional setting.
          </p>
          <label className="consent-checkbox">
            <input type="checkbox" checked={requiredAck} disabled={saving} onChange={(event) => setRequiredAck(event.target.checked)} />
            <span>I have read and accept the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>. I understand SolenOS is not medical or emergency guidance, care information is not sold or used for advertising, and trusted contributors may add notes to the care record.</span>
          </label>
          <button type="button" className="workspace-primary policy-acknowledge-button" onClick={() => void acknowledgeRequiredTerms()} disabled={!requiredAck || acknowledgementBusy || saving}>
            {acknowledgementBusy ? "Saving acknowledgement…" : "Confirm and save acknowledgement"}
          </button>
        </div>
      )}
      {limitedMode && (
        <p className="panel-muted" role="status">
          Optional improvement use is unavailable while privacy access is limited. Your care history has not been deleted.
        </p>
      )}

      <label className="consent-checkbox">
        <input
          type="checkbox"
          checked={dataImprovement}
          disabled={limitedMode || saving || Boolean(loadError)}
          onChange={(e) => void toggleImprovement(e.target.checked)}
        />
        <span>{saving ? "Saving your choice…" : "Allow submitted feedback to contribute to SolenOS improvements"}</span>
      </label>

      {loadError ? (
        <p className="panel-muted">
          We couldn't confirm whether this is on or off, so the control is disabled until your
          saved choice can be checked.
        </p>
      ) : dataImprovement ? (
        <div className="policy-improvement-details">
          <h5>What may be used when this is on</h5>
          <ul>
            <li>Feedback you deliberately submit using an improvement or validation option.</li>
            <li>Context you choose to include with that feedback, plus the feedback category and related details needed to review it.</li>
            <li>Use of those submitted materials to improve SolenOS product features and AI behavior, subject to access controls and appropriate de-identification.</li>
          </ul>
          <h5>What this choice does not allow</h5>
          <ul>
            <li>Publishing your care record or making it visible to other caregivers.</li>
            <li>Using this checkbox as permission to sell your personal information or show you targeted ads.</li>
            <li>Automatically sending every private care note, document, or Companion conversation as improvement feedback.</li>
          </ul>
          <p className="panel-muted">
            SolenOS must still apply access controls and remove direct identifiers where appropriate.
            This setting does not mean your care details are made public.
          </p>
        </div>
      ) : (
        <p className="panel-muted">
          <strong>Off — you have opted out.</strong> SolenOS must not accept your submissions for
          optional improvement processing. Your care record remains available for the features you
          request; required processing to provide those features is separate.
        </p>
      )}

      {message && <p className="policy-consent-message" role="status">{message}</p>}
    </section>
  );
}
