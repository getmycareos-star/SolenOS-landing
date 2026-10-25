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
      setLoadError("We couldn't load your privacy preference. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleImprovement(enabled: boolean) {
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
      setDataImprovement(enabled);
      setMessage(enabled ? "Your choice is saved. De-identified patterns may be used to improve care continuity and safety as described below." : "Your choice is saved. Your information will not be used for optional system improvement.");
    } catch {
      setMessage("We couldn't save this choice. Your previous setting remains in place.");
    } finally {
      setSaving(false);
    }
  }


  if (loading) return <section className="policy-settings-panel"><h4>Data &amp; system improvement</h4><p className="panel-muted" role="status">Loading your privacy choice…</p></section>;

  return (
    <section className="policy-settings-panel">
      <h4>Data &amp; system improvement</h4>
      <p className="panel-muted">
        You choose whether SolenOS may use de-identified patterns to improve how care information is organized and understood. This choice is optional and can be changed at any time.
      </p>
      {loadError && <p className="panel-muted" role="alert">{loadError} <button type="button" className="workspace-secondary" onClick={() => void load()}>Try again</button></p>}

      {!verified && <p className="panel-muted">Please complete the required privacy acknowledgement before changing this optional preference.</p>}
      {limitedMode && <p className="panel-muted">Optional system improvement is unavailable while limited privacy mode is active.</p>}
      <label className="consent-checkbox">
        <input
          type="checkbox"
          checked={dataImprovement}
          disabled={!verified || limitedMode || saving || Boolean(loadError)}
          onChange={(e) => void toggleImprovement(e.target.checked)}
        />
        <span>Allow system improvement using my data</span>
      </label>

      {dataImprovement ? (
        <div className="policy-improvement-details" role="status">
          <h5>What may be used</h5>
          <ul>
            <li>De-identified patterns about how care updates, changes, and follow-up needs are organized.</li>
            <li>Broad usage patterns that help improve continuity and safety.</li>
          </ul>
          <h5>What is not used for this purpose</h5>
          <ul>
            <li>Your name, email address, or direct account identifiers.</li>
            <li>Your identifiable care notes, documents, or a named person's care history as public examples.</li>
            <li>Advertising, selling personal data, or targeting you with ads.</li>
          </ul>
          <p className="panel-muted">This setting records your preference. It does not mean every item is automatically shared or that identifiable care details are made public.</p>
        </div>
      ) : (
        <p className="panel-muted">Off: your information is not permitted for optional system improvement. Your care record still works for your own care continuity.</p>
      )}
      {message && <p className="panel-muted" role="status">{message}</p>}
    </section>
  );
}
