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
      setMessage("Your privacy terms have been saved. You can now choose whether to share feedback to help improve SolenOS.");
    } catch (error) {
      setMessage("We couldn't save your privacy choice. Please try again.");
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
          ? "Your choice is saved. Feedback you choose to send may be reviewed to help improve SolenOS. You must also accept the Terms of Service and Privacy Policy before it can be used."
          : "Your choice is saved. New feedback will not be used to improve SolenOS, and any feedback waiting for review has been removed. Your Care Record is still available.",
      );
    } catch {
      // Keep the previously confirmed preference as the source of truth.
      // Do not show a status message unless the user explicitly changes the choice successfully.
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="policy-settings-panel">
        <h4>Help improve SolenOS (optional)</h4>
        <p className="panel-muted" role="status">Checking your privacy choice…</p>
      </section>
    );
  }

  return (
    <section className="policy-settings-panel" aria-labelledby="improvement-consent-heading">
      <h4 id="improvement-consent-heading">Help improve SolenOS (optional)</h4>
      <p className="panel-muted">
        This optional choice controls whether feedback you choose to send can be used to improve SolenOS. It does not automatically send your care notes, documents, or Ask SolenOS conversations. Your Care Record and the work needed to provide the features you ask for are separate from this choice. Your choice stays saved until you change it.
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
          You confirmed these privacy terms on {new Date(acceptedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}.
        </p>
      )}
      {!verified && !loadError && !limitedMode && (
        <div className="policy-required-ack">
          <p className="panel-muted">
            You have not yet confirmed that you have read and accepted the Terms of Service and Privacy Policy for this Care Record. Read them below, then check the box to confirm. This is separate from optional feedback sharing; turning it on does not mean you have accepted the terms.
          </p>
          <label className="consent-checkbox">
            <input type="checkbox" checked={requiredAck} disabled={saving} onChange={(event) => setRequiredAck(event.target.checked)} />
            <span>I have read and accept the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>. I understand SolenOS does not provide medical or emergency advice, care information is not sold or used for advertising, and people I trust who have access can add notes to my Care Record.</span>
          </label>
          <button type="button" className="workspace-primary policy-acknowledge-button" onClick={() => void acknowledgeRequiredTerms()} disabled={!requiredAck || acknowledgementBusy || saving}>
            {acknowledgementBusy ? "Saving…" : "Confirm and save"}
          </button>
        </div>
      )}
      {limitedMode && (
        <p className="panel-muted" role="status">
          You cannot change optional feedback sharing right now. Your care history has not been deleted.
        </p>
      )}

      <label className="consent-checkbox">
        <input
          type="checkbox"
          checked={dataImprovement}
          disabled={limitedMode || saving || Boolean(loadError)}
          onChange={(e) => void toggleImprovement(e.target.checked)}
        />
        <span>{saving ? "Saving your choice…" : "Allow feedback I choose to send to help improve SolenOS"}</span>
      </label>

      {loadError ? (
        <p className="panel-muted">
          We couldn't check whether feedback sharing is on or off. This setting is disabled until we can check your saved choice.
        </p>
      ) : dataImprovement ? (
        <div className="policy-improvement-details">
          <h5>Optional feedback sharing is on</h5>
          <p>Your preference is saved. It remains on until you turn it off.</p>
          <h5>What may be shared</h5>
          <ul>
            <li>Feedback you choose to send through an improvement or testing option.</li>
            <li>The type of feedback and any details you include, along with information needed to review it.</li>
            <li>Some of the material you choose to send may be used to improve SolenOS, as explained in the Privacy Policy.</li>
          </ul>
          <h5>What is not shared automatically</h5>
          <ul>
            <li>Your full Care Record or your full care history.</li>
            <li>Your care notes, uploaded documents, or Ask SolenOS conversations are not automatically sent as feedback.</li>
            <li>Your care details are not published, your personal information is not sold, and your information is not used for targeted advertising.</li>
          </ul>
          <p className="panel-muted">
            Where possible, direct personal details are removed from feedback before it is reviewed. This does not guarantee that every personal detail is removed from every attachment. Turning on optional feedback sharing does not mean you have accepted the Terms of Service or Privacy Policy. Feedback is not accepted until the required privacy choices are confirmed. See the Privacy Policy for how information is stored and handled.
          </p>
        </div>
      ) : null}

      {message && <p className="policy-consent-message" role="status">{message}</p>}
    </section>
  );
}
