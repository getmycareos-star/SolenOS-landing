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
      };
      setVerified(Boolean(data.verified));
      setDataImprovement(Boolean(data.profile?.data_improvement_consent));
      setLimitedMode(Boolean(data.profile?.limited_mode));
    } catch {
      setLoadError("We couldn't load your privacy choice. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleImprovement(enabled: boolean) {
    if (saving || loadError || !verified || limitedMode) return;
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
      if (!res.ok) throw new Error("Update failed");
      // Only update the visible switch after the server confirms the saved choice.
      setDataImprovement(enabled);
      setMessage(
        enabled
          ? "Your choice is saved. Only the improvement uses described below are allowed."
          : "Your choice is saved. Optional improvement use is now off.",
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
        You control whether feedback you deliberately submit to help improve SolenOS may be used
        for that purpose. This is separate from using your care record to provide the features
        you request. Your choice can be changed here at any time.
      </p>

      {loadError && (
        <p className="panel-muted" role="alert">
          {loadError}{" "}
          <button type="button" className="workspace-secondary" onClick={() => void load()}>
            Try again
          </button>
        </p>
      )}
      {!verified && !loadError && (
        <p className="panel-muted">
          Complete the required privacy acknowledgement before changing this optional choice.
        </p>
      )}
      {limitedMode && (
        <p className="panel-muted">
          Optional improvement use is unavailable while privacy access is limited.
        </p>
      )}

      <label className="consent-checkbox">
        <input
          type="checkbox"
          checked={dataImprovement}
          disabled={!verified || limitedMode || saving || Boolean(loadError)}
          onChange={(e) => void toggleImprovement(e.target.checked)}
        />
        <span>{saving ? "Saving your choice…" : "Allow my submitted improvement feedback to be used"}</span>
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
            <li>The feedback category and related information needed to review that submission.</li>
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
          <strong>Off.</strong> Optional improvement feedback use is not permitted. You can still
          use your care record for the care features you request.
        </p>
      )}

      {message && <p className="panel-muted" role="status">{message}</p>}
    </section>
  );
}
