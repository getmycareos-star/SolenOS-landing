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

  const load = useCallback(async () => {
    setLoading(true);
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
      setMessage(enabled ? "System improvement enabled." : "Strict privacy mode — no improvement use.");
    } catch {
      setMessage("Could not update data improvement preference.");
    } finally {
      setSaving(false);
    }
  }

  async function revoke() {
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
          action: "revoke",
        }),
      });
      if (!res.ok) throw new Error("Revoke failed");
      await load();
      setMessage("Consent revoked — limited mode active. New care events are blocked.");
    } catch {
      setMessage("Could not revoke consent.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <section className="policy-settings-panel">
      <h4>Data &amp; system improvement</h4>
      <p className="panel-muted">
        Control how solenos uses de-identified care patterns to improve continuity and safety.
      </p>

      <label className="consent-checkbox">
        <input
          type="checkbox"
          checked={dataImprovement}
          disabled={!verified || limitedMode || saving}
          onChange={(e) => void toggleImprovement(e.target.checked)}
        />
        <span>Allow system improvement using my data</span>
      </label>

      <div className="policy-settings-actions">
        <button
          type="button"
          className="workspace-secondary"
          disabled={!verified || saving}
          onClick={() => void revoke()}
        >
          Revoke consent (limited mode)
        </button>
      </div>

      {message && <p className="panel-muted">{message}</p>}
    </section>
  );
}
